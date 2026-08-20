import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { GoalService } from '../../src/application/goals'
import {
  asActionRepository,
  type RepositoryPort,
  type UnitOfWorkPort
} from '../../src/application/ports/persistence'
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
  const path = join(root.database, `goal-${crypto.randomUUID()}.sqlite3`)
  return { path, connection: SqliteConnection.open(path) }
}

function serviceFor(
  connection: SqliteConnection,
  ids: string[],
  unitOfWork: UnitOfWorkPort = connection
) {
  return new GoalService({
    repository: connection.repository,
    unitOfWork,
    clock: new FakeClock({ instant, localDate: '2026-08-09', timeZone: 'Asia/Shanghai' }),
    generateId: () => ids.shift() ?? crypto.randomUUID()
  })
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => removeTemporaryTestRoot(root)))
})

describe('Goal SQLite integration', () => {
  it('preserves the current next action and every related history branch through pause, end, and real reopen', async () => {
    const { path, connection } = await openDatabase()
    const service = serviceFor(connection, ['goal-1', 'action-1'])
    const created = service.createGoal({
      name: 'Systematically learn React',
      initialNextAction: { title: 'Run a React state update example' }
    })

    connection.repository.saveRoutine({
      id: 'routine-1',
      goalId: created.id,
      name: 'Weekday learning',
      minimumAction: 'One example',
      description: null,
      status: 'active',
      createdAt: instant,
      updatedAt: instant
    })
    connection.repository.saveRoutineScheduleDay({ routineId: 'routine-1', weekday: 1 })
    connection.repository.createTodaySelection({
      actionId: 'action-1',
      selectedFor: '2026-08-09',
      kind: 'intention',
      selectedBy: 'user',
      createdAt: instant
    })
    expect(service.getGoalDetail(created.id).currentNextAction?.selectedForToday).toBe(false)
    expect(
      asActionRepository(connection.repository).updateTodaySelectionCommitment(
        'action-1',
        '2026-08-09',
        'intention',
        'focus'
      )
    ).toBe(true)
    connection.repository.saveActionRecord({
      id: 'record-1',
      actionId: 'action-1',
      occurredOn: '2026-08-08',
      durationMinutes: 25,
      outcome: 'partial',
      nextStep: 'Try another example',
      note: null,
      createdAt: instant,
      updatedAt: instant
    })
    connection.repository.saveRoutineRecord({
      id: 'routine-record-1',
      routineId: 'routine-1',
      occurredOn: '2026-08-08',
      outcome: 'acted',
      plannedForDate: true,
      plannedForDateBasis: 'schedule_at_recording',
      durationMinutes: 10,
      note: null,
      createdAt: instant,
      updatedAt: instant
    })

    const detailBefore = service.getGoalDetail(created.id)
    expect(detailBefore.currentNextAction).toMatchObject({
      id: 'action-1',
      status: 'pending',
      selectedForToday: true
    })
    expect(detailBefore.records).toEqual([
      expect.objectContaining({ id: 'record-1', actionTitle: 'Run a React state update example' })
    ])
    const historyBefore = connection.repository.readSnapshot()

    expect(service.pauseGoal(created.id)).toMatchObject({
      status: 'paused',
      currentNextActionId: 'action-1'
    })
    expect(service.getGoalDetail(created.id).currentNextAction?.selectedForToday).toBe(true)
    expect(service.resumeGoal(created.id).status).toBe('active')
    expect(service.endGoal(created.id)).toMatchObject({
      status: 'ended',
      currentNextActionId: 'action-1'
    })
    expect(() => service.resumeGoal(created.id)).toThrowError(
      expect.objectContaining({ code: 'invalid-transition' })
    )
    expect(() =>
      service.setGoalCurrentNextAction({ goalId: created.id, actionId: null })
    ).toThrowError(expect.objectContaining({ code: 'invalid-transition' }))

    const historyAfter = connection.repository.readSnapshot()
    expect({ ...historyAfter, goals: historyBefore.goals }).toEqual(historyBefore)
    connection.close()

    const reopened = SqliteConnection.open(path)
    try {
      const reopenedService = serviceFor(reopened, [])
      expect(reopenedService.getGoalDetail(created.id)).toMatchObject({
        id: created.id,
        status: 'ended',
        currentNextActionId: 'action-1',
        currentNextAction: { id: 'action-1', selectedForToday: true },
        records: [expect.objectContaining({ id: 'record-1', durationMinutes: 25 })]
      })
      expect(reopenedService.listGoals('ended')).toHaveLength(1)
      expect(reopened.repository.readSnapshot().todaySelections).toEqual(
        historyBefore.todaySelections
      )
    } finally {
      reopened.close()
    }
  })

  it('rolls back the circular-reference create sequence when the Action write fails', async () => {
    const { connection } = await openDatabase()
    const failingUnitOfWork: UnitOfWorkPort = {
      transaction: <T>(work: (repository: RepositoryPort) => T): T =>
        connection.transaction((repository) => {
          const failingRepository = new Proxy(repository, {
            get(target, property, receiver) {
              if (property === 'saveAction') {
                return () => {
                  throw new Error('injected Action write failure')
                }
              }
              const value = Reflect.get(target, property, receiver) as unknown
              return typeof value === 'function' ? value.bind(target) : value
            }
          })
          return work(failingRepository)
        })
    }
    const service = serviceFor(connection, ['goal-failed', 'action-failed'], failingUnitOfWork)

    expect(() =>
      service.createGoal({ name: 'Rollback Goal', initialNextAction: { title: 'Rollback Action' } })
    ).toThrow(/injected Action write failure/)
    expect(connection.repository.readSnapshot().goals).toEqual([])
    expect(connection.repository.readSnapshot().actions).toEqual([])
    connection.close()
  })

  it('rejects cross-Goal, completed, and missing current next action references', async () => {
    const { connection } = await openDatabase()
    const service = serviceFor(connection, ['goal-1', 'action-1', 'goal-2', 'action-2'])
    const first = service.createGoal({
      name: 'First',
      initialNextAction: { title: 'First action' }
    })
    const second = service.createGoal({
      name: 'Second',
      initialNextAction: { title: 'Second action' }
    })

    expect(() =>
      service.setGoalCurrentNextAction({ goalId: first.id, actionId: second.currentNextActionId })
    ).toThrowError(expect.objectContaining({ code: 'invariant-violation' }))
    expect(() =>
      service.setGoalCurrentNextAction({ goalId: first.id, actionId: 'missing' })
    ).toThrowError(expect.objectContaining({ code: 'not-found' }))

    const action = connection.repository.findActionById('action-1')!
    connection.repository.saveAction({ ...action, status: 'completed' })
    expect(() =>
      service.setGoalCurrentNextAction({ goalId: first.id, actionId: action.id })
    ).toThrowError(expect.objectContaining({ code: 'invariant-violation' }))
    connection.close()
  })
})
