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
      arrangementMode: 'weekly' as const,
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

  it('commits create-and-set as one SQLite transaction without selecting Today and survives reopen', async () => {
    const { path, connection } = await openDatabase()
    const service = serviceFor(connection, ['goal-1', 'action-1'])
    const goal = service.createGoal({ name: 'Restart Goal' })

    expect(
      service.createAndSetGoalCurrentNextAction({ goalId: goal.id, title: 'One small action' })
    ).toMatchObject({
      currentNextActionId: 'action-1',
      currentNextAction: { id: 'action-1', status: 'pending', selectedForToday: false }
    })
    expect(connection.repository.readSnapshot().todaySelections).toEqual([])
    connection.close()

    const reopened = SqliteConnection.open(path)
    try {
      expect(serviceFor(reopened, []).getGoalDetail(goal.id)).toMatchObject({
        currentNextActionId: 'action-1',
        currentNextAction: { id: 'action-1', status: 'pending' }
      })
      expect(reopened.repository.readSnapshot().todaySelections).toEqual([])
    } finally {
      reopened.close()
    }
  })

  it('rejects stale current-next, Goal revision and opened Action revision with an equal SQLite snapshot', async () => {
    const { connection } = await openDatabase()
    const service = serviceFor(connection, ['goal-1', 'action-1', 'action-never'])
    const goal = service.createGoal({
      name: 'Stale Goal',
      initialNextAction: { title: 'Opened Action' }
    })
    const opened = connection.repository.findActionById('action-1')!
    const before = connection.repository.readSnapshot()

    for (const precondition of [
      { expectedCurrentNextActionId: null },
      {
        expectedCurrentNextActionId: goal.currentNextActionId,
        expectedGoalUpdatedAt: 'stale-goal-revision'
      },
      {
        expectedCurrentNextActionId: goal.currentNextActionId,
        expectedGoalUpdatedAt: goal.updatedAt,
        expectedContextActionId: opened.id,
        expectedContextActionUpdatedAt: 'stale-action-revision'
      }
    ]) {
      expect(() =>
        service.createAndSetGoalCurrentNextAction({
          goalId: goal.id,
          title: 'Must not exist',
          ...precondition
        })
      ).toThrowError(expect.objectContaining({ code: 'invariant-violation' }))
      expect(connection.repository.readSnapshot()).toEqual(before)
    }
    connection.close()
  })

  it('rolls back the new Action when the Goal current-next write fails', async () => {
    const { connection } = await openDatabase()
    const setupService = serviceFor(connection, ['goal-1'])
    const goal = setupService.createGoal({ name: 'Rollback Goal' })
    const before = structuredClone(connection.repository.readSnapshot())
    const failingUnitOfWork: UnitOfWorkPort = {
      transaction: <T>(work: (repository: RepositoryPort) => T): T =>
        connection.transaction((repository) => {
          const failingRepository = new Proxy(repository, {
            get(target, property, receiver) {
              if (property === 'saveGoal') {
                return () => {
                  throw new Error('injected current-next write failure')
                }
              }
              const value = Reflect.get(target, property, receiver) as unknown
              return typeof value === 'function' ? value.bind(target) : value
            }
          })
          return work(failingRepository)
        })
    }
    const service = serviceFor(connection, ['action-failed'], failingUnitOfWork)

    expect(() =>
      service.createAndSetGoalCurrentNextAction({ goalId: goal.id, title: 'Rollback Action' })
    ).toThrow(/injected current-next write failure/)
    expect(connection.repository.readSnapshot()).toEqual(before)
    connection.close()
  })
})
