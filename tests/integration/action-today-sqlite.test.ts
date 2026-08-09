import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ActionService } from '../../src/application/actions'
import { GoalService } from '../../src/application/goals'
import { TodayService } from '../../src/application/today'
import type { RepositoryPort, UnitOfWorkPort } from '../../src/application/ports/persistence'
import { SqliteConnection } from '../../src/infrastructure/sqlite/sqlite-connection'
import { FakeClock } from '../support/fake-clock'
import {
  createTemporaryTestRoot,
  removeTemporaryTestRoot,
  type TemporaryTestRoot
} from '../support/temporary-test-root'

const roots: TemporaryTestRoot[] = []
const instant = '2026-08-09T08:00:00.000Z'

async function openDatabase() {
  const root = await createTemporaryTestRoot()
  roots.push(root)
  const path = join(root.database, `action-today-${crypto.randomUUID()}.sqlite3`)
  return { path, connection: SqliteConnection.open(path) }
}

function servicesFor(
  connection: SqliteConnection,
  clock: FakeClock,
  ids: string[],
  unitOfWork: UnitOfWorkPort = connection
) {
  const dependencies = {
    repository: connection.repository,
    unitOfWork,
    clock,
    generateId: () => ids.shift() ?? crypto.randomUUID()
  }
  return {
    actions: new ActionService(dependencies),
    goals: new GoalService(dependencies),
    today: new TodayService({
      repository: connection.repository,
      unitOfWork,
      clock
    })
  }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => removeTemporaryTestRoot(root)))
})

describe('Action and Today SQLite integration', () => {
  it('preserves terminal Today facts, current-next replacement, partial history, and real reopen', async () => {
    const { path, connection } = await openDatabase()
    const clock = new FakeClock({ instant, localDate: '2026-08-09', timeZone: 'Asia/Shanghai' })
    const services = servicesFor(connection, clock, ['goal-1', 'action-1', 'action-2'])
    const goal = services.goals.createGoal({
      name: 'Systematically learn React',
      initialNextAction: { title: 'Run a React state update example' }
    })
    services.today.selectActionForToday('action-1')
    connection.repository.saveActionRecord({
      id: 'record-1',
      actionId: 'action-1',
      occurredOn: '2026-08-09',
      durationMinutes: 25,
      outcome: 'partial',
      nextStep: null,
      note: null,
      createdAt: instant,
      updatedAt: instant
    })

    expect(
      services.actions.completeAction({
        actionId: 'action-1',
        currentNextResolution: {
          kind: 'create-and-use',
          title: 'Try another state update example'
        }
      })
    ).toMatchObject({
      id: 'action-1',
      status: 'completed',
      selectedForToday: true,
      canStart: false
    })
    expect(services.today.getToday().focuses).toEqual([
      expect.objectContaining({ id: 'action-1', status: 'completed' })
    ])
    expect(services.goals.getGoalDetail(goal.id)).toMatchObject({
      currentNextActionId: 'action-2',
      currentNextAction: { id: 'action-2', status: 'pending' },
      records: [expect.objectContaining({ id: 'record-1', outcome: 'partial' })]
    })

    const beforeReopen = connection.repository.readSnapshot()
    connection.close()
    const reopened = SqliteConnection.open(path)
    try {
      const reopenedServices = servicesFor(reopened, clock, [])
      expect(reopenedServices.actions.getActionDetail('action-1')).toMatchObject({
        id: 'action-1',
        status: 'completed',
        selectedForToday: true
      })
      expect(reopenedServices.today.getToday().focuses).toHaveLength(1)
      expect(reopened.repository.readSnapshot().actionRecords).toEqual(beforeReopen.actionRecords)
      expect(reopened.repository.readSnapshot().actions).toEqual(beforeReopen.actions)
    } finally {
      reopened.close()
    }
  })

  it('reschedules the same ID, removes only today, restores only by explicit selection, and never carries across LocalDate', async () => {
    const { connection } = await openDatabase()
    const clock = new FakeClock({ instant, localDate: '2026-08-09', timeZone: 'Asia/Shanghai' })
    const services = servicesFor(connection, clock, ['action-1'])
    const action = services.actions.createAction({ title: 'Standalone action' })
    services.today.selectActionForToday(action.id)
    connection.repository.saveTodaySelection({
      actionId: action.id,
      selectedFor: '2026-08-08',
      kind: 'focus',
      selectedBy: 'user',
      createdAt: instant
    })

    expect(services.actions.rescheduleAction({ actionId: action.id })).toMatchObject({
      id: 'action-1',
      status: 'rescheduled',
      selectedForToday: false
    })
    expect(connection.repository.readSnapshot().todaySelections).toEqual([
      expect.objectContaining({ selectedFor: '2026-08-08' })
    ])
    expect(services.today.selectActionForToday(action.id)).toMatchObject({
      id: 'action-1',
      status: 'pending',
      selectedForToday: true
    })

    clock.setState({
      instant: '2026-08-10T08:00:00.000Z',
      localDate: '2026-08-10',
      timeZone: 'Asia/Shanghai'
    })
    const nextDay = services.today.getToday()
    expect(nextDay).toMatchObject({ localDate: '2026-08-10', focuses: [] })
    const beforeRepeatedQueries = connection.repository.readSnapshot()
    services.today.getToday()
    services.actions.getActionDetail(action.id)
    expect(connection.repository.readSnapshot()).toEqual(beforeRepeatedQueries)
    expect(connection.repository.readSnapshot().todaySelections).toEqual([
      expect.objectContaining({ selectedFor: '2026-08-08' }),
      expect.objectContaining({ selectedFor: '2026-08-09' })
    ])
    connection.close()
  })

  it('rolls back Action, replacement, Goal reference, and Today changes when a later write fails', async () => {
    const { connection } = await openDatabase()
    const clock = new FakeClock({ instant, localDate: '2026-08-09', timeZone: 'Asia/Shanghai' })
    const initial = servicesFor(connection, clock, ['goal-1', 'action-1'])
    initial.goals.createGoal({ name: 'Goal', initialNextAction: { title: 'Current' } })
    initial.today.selectActionForToday('action-1')
    const before = connection.repository.readSnapshot()
    const failingUnitOfWork: UnitOfWorkPort = {
      transaction: <T>(work: (repository: RepositoryPort) => T): T =>
        connection.transaction((repository) => {
          const failingRepository = new Proxy(repository, {
            get(target, property, receiver) {
              if (property === 'saveGoal') {
                return () => {
                  throw new Error('injected Goal write failure')
                }
              }
              const value = Reflect.get(target, property, receiver) as unknown
              return typeof value === 'function' ? value.bind(target) : value
            }
          })
          return work(failingRepository)
        })
    }
    const failing = servicesFor(connection, clock, ['replacement'], failingUnitOfWork)

    expect(() =>
      failing.actions.rescheduleAction({
        actionId: 'action-1',
        currentNextResolution: { kind: 'create-and-use', title: 'Replacement' }
      })
    ).toThrow(/injected Goal write failure/)
    expect(connection.repository.readSnapshot()).toEqual(before)
    connection.close()
  })

  it('keeps the current-date focus visible when a non-current Action is cancelled', async () => {
    const { connection } = await openDatabase()
    const clock = new FakeClock({ instant, localDate: '2026-08-09', timeZone: 'Asia/Shanghai' })
    const services = servicesFor(connection, clock, ['action-1'])
    services.actions.createAction({ title: 'Cancel me' })
    services.today.selectActionForToday('action-1')

    expect(services.actions.cancelAction({ actionId: 'action-1' })).toMatchObject({
      status: 'cancelled',
      selectedForToday: true,
      canStart: false
    })
    expect(services.today.getToday().focuses).toEqual([
      expect.objectContaining({ id: 'action-1', status: 'cancelled' })
    ])
    connection.close()
  })
})
