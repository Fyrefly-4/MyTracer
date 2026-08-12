import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ActionRecordService } from '../../src/application/action-records'
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
const instant = '2026-08-12T08:00:00.000Z'

async function openDatabase() {
  const root = await createTemporaryTestRoot()
  roots.push(root)
  const path = join(root.database, `action-record-${crypto.randomUUID()}.sqlite3`)
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
    records: new ActionRecordService(dependencies),
    today: new TodayService({ repository: connection.repository, unitOfWork, clock })
  }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => removeTemporaryTestRoot(root)))
})

describe('ActionRecord SQLite integration', () => {
  it('saves quick/deep facts, applies an explicit post-record choice, and survives a real reopen', async () => {
    const { path, connection } = await openDatabase()
    const clock = new FakeClock({ instant, localDate: '2026-08-12', timeZone: 'Asia/Shanghai' })
    const services = servicesFor(connection, clock, [
      'goal-1',
      'action-1',
      'record-quick',
      'record-deep',
      'understanding-1',
      'confusion-1',
      'action-2'
    ])
    services.goals.createGoal({
      name: 'Systematically learn React',
      initialNextAction: { title: 'Run a React state update example' }
    })

    expect(
      services.records.recordAction({
        actionId: 'action-1',
        capturedOn: '2026-08-12',
        durationMinutes: 0,
        outcome: 'partial'
      })
    ).toMatchObject({ kind: 'saved', action: { status: 'pending', selectedForToday: false } })
    services.today.selectActionForToday('action-1')
    expect(
      services.records.recordAction({
        actionId: 'action-1',
        capturedOn: '2026-08-12',
        durationMinutes: 25,
        outcome: 'stopped',
        understanding: 'State setters enqueue updates',
        confusion: 'When does batching stop?',
        nextStep: 'Run the functional update version',
        note: 'Stopped after reproducing batching',
        postRecord: {
          action: 'reschedule',
          currentNextResolution: { kind: 'create-from-recorded-next-step' }
        }
      })
    ).toMatchObject({
      kind: 'saved',
      action: { status: 'rescheduled', selectedForToday: false },
      appliedNextActionId: 'action-2'
    })

    const detail = services.records.getActionRecordDetail('record-deep')
    expect(detail).toMatchObject({
      durationMinutes: 25,
      outcome: 'stopped',
      understandings: [{ text: 'State setters enqueue updates', source: 'manual' }],
      confusions: [{ text: 'When does batching stop?', status: 'open' }]
    })
    expect(services.records.listActionRecordsForAction('action-1').map((item) => item.id)).toEqual([
      'record-deep',
      'record-quick'
    ])
    expect(services.goals.getGoalDetail('goal-1')).toMatchObject({
      currentNextActionId: 'action-2',
      currentNextAction: { title: 'Run the functional update version', status: 'pending' }
    })
    expect(services.today.getToday().focuses).toEqual([])

    const beforeReopen = connection.repository.readSnapshot()
    connection.close()
    const reopened = SqliteConnection.open(path)
    try {
      const reopenedServices = servicesFor(reopened, clock, [])
      expect(reopenedServices.records.getActionRecordDetail('record-deep')).toEqual(detail)
      expect(reopenedServices.records.listActionRecordsForAction('action-1')).toHaveLength(2)
      expect(reopened.repository.readSnapshot()).toEqual(beforeReopen)
    } finally {
      reopened.close()
    }
  })

  it('uses Main-captured LocalDate choices and never needs a TodaySelection', async () => {
    const { connection } = await openDatabase()
    const clock = new FakeClock({ instant, localDate: '2026-08-12', timeZone: 'Asia/Shanghai' })
    const services = servicesFor(connection, clock, ['action-1', 'record-1', 'record-2'])
    services.actions.createAction({ title: 'Standalone Action' })
    const prepared = services.records.beginActionRecording('action-1')
    clock.setState({
      instant: '2026-08-13T00:01:00.000+08:00',
      localDate: '2026-08-13',
      timeZone: 'Asia/Shanghai'
    })

    const before = connection.repository.readSnapshot()
    expect(
      services.records.recordAction({ ...prepared, durationMinutes: 1, outcome: 'stopped' })
    ).toMatchObject({ kind: 'date-confirmation-required' })
    expect(connection.repository.readSnapshot()).toEqual(before)
    expect(
      services.records.recordAction({
        ...prepared,
        dateChoice: 'keep-captured-on',
        durationMinutes: 1,
        outcome: 'stopped'
      })
    ).toMatchObject({ kind: 'saved', record: { occurredOn: '2026-08-12' } })

    expect(
      services.records.recordAction({
        actionId: 'action-1',
        capturedOn: '2026-08-12',
        dateChoice: 'use-current-on',
        durationMinutes: 1,
        outcome: 'completed'
      })
    ).toMatchObject({ kind: 'saved', record: { occurredOn: '2026-08-13' } })
    expect(connection.repository.readSnapshot().todaySelections).toEqual([])
    connection.close()
  })

  it('rejects terminal/rescheduled Actions and paused/ended linked Goals with zero writes', async () => {
    const { connection } = await openDatabase()
    const clock = new FakeClock({ instant, localDate: '2026-08-12', timeZone: 'Asia/Shanghai' })
    const services = servicesFor(connection, clock, ['goal-1', 'action-1'])
    services.goals.createGoal({ name: 'Goal', initialNextAction: { title: 'Current' } })
    services.goals.pauseGoal('goal-1')
    const beforePaused = connection.repository.readSnapshot()
    expect(() => services.records.beginActionRecording('action-1')).toThrowError(
      expect.objectContaining({ code: 'invalid-transition' })
    )
    expect(connection.repository.readSnapshot()).toEqual(beforePaused)

    services.goals.resumeGoal('goal-1')
    services.actions.rescheduleAction({
      actionId: 'action-1',
      currentNextResolution: { kind: 'clear' }
    })
    const beforeRescheduled = connection.repository.readSnapshot()
    expect(() => services.records.beginActionRecording('action-1')).toThrowError(
      expect.objectContaining({ code: 'invalid-transition' })
    )
    expect(connection.repository.readSnapshot()).toEqual(beforeRescheduled)
    connection.close()
  })

  it('rolls back parent, children, Action, Goal, and Today when any later write fails', async () => {
    const { connection } = await openDatabase()
    const clock = new FakeClock({ instant, localDate: '2026-08-12', timeZone: 'Asia/Shanghai' })
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
                  throw new Error('injected post-record Goal failure')
                }
              }
              const value = Reflect.get(target, property, receiver) as unknown
              return typeof value === 'function' ? value.bind(target) : value
            }
          })
          return work(failingRepository)
        })
    }
    const failing = servicesFor(
      connection,
      clock,
      ['record-1', 'understanding-1', 'confusion-1', 'action-2'],
      failingUnitOfWork
    )
    expect(() =>
      failing.records.recordAction({
        actionId: 'action-1',
        capturedOn: '2026-08-12',
        durationMinutes: 10,
        outcome: 'partial',
        understanding: 'A fact',
        confusion: 'A question',
        nextStep: 'Replacement',
        postRecord: {
          action: 'complete',
          currentNextResolution: { kind: 'create-from-recorded-next-step' }
        }
      })
    ).toThrow(/injected post-record Goal failure/)
    expect(connection.repository.readSnapshot()).toEqual(before)
    connection.close()
  })
})
