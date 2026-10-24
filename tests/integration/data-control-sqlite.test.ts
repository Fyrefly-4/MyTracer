import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { DataControlService } from '../../src/application/data-control'
import { ProgressService } from '../../src/application/progress'
import { RoutineRecordService } from '../../src/application/routine-records'
import type { UnitOfWorkPort } from '../../src/application/ports/persistence'
import { asDataControlRepository } from '../../src/application/ports/persistence'
import type { DeleteTarget } from '../../src/domain/data-control'
import { SqliteConnection } from '../../src/infrastructure/sqlite/sqlite-connection'
import { FakeClock } from '../support/fake-clock'
import {
  createTemporaryTestRoot,
  removeTemporaryTestRoot,
  type TemporaryTestRoot
} from '../support/temporary-test-root'

const roots: TemporaryTestRoot[] = []
const firstInstant = '2026-08-19T08:00:00.000Z'

async function openDatabase() {
  const root = await createTemporaryTestRoot()
  roots.push(root)
  const path = join(root.database, `data-control-${crypto.randomUUID()}.sqlite3`)
  return { path, connection: SqliteConnection.open(path) }
}

function populate(connection: SqliteConnection): void {
  connection.transaction((repository) => {
    repository.saveGoal({
      id: 'goal-1',
      title: 'Goal',
      description: null,
      status: 'active',
      predecessorGoalId: null,
      currentNextActionId: null,
      createdAt: firstInstant,
      updatedAt: firstInstant
    })
    repository.saveAction({
      id: 'action-1',
      goalId: 'goal-1',
      title: 'Action',
      description: null,
      status: 'pending',
      createdAt: firstInstant,
      updatedAt: firstInstant
    })
    repository.saveGoal({
      id: 'goal-1',
      title: 'Goal',
      description: null,
      status: 'active',
      predecessorGoalId: null,
      currentNextActionId: 'action-1',
      createdAt: firstInstant,
      updatedAt: firstInstant
    })
    repository.saveRoutine({
      arrangementMode: 'weekly' as const,
      id: 'routine-1',
      goalId: 'goal-1',
      name: 'Routine',
      minimumAction: 'One minute',
      description: null,
      status: 'active',
      createdAt: firstInstant,
      updatedAt: firstInstant
    })
    repository.saveRoutineScheduleDay({ routineId: 'routine-1', weekday: 3 })
    repository.createTodaySelection({
      actionId: 'action-1',
      selectedFor: '2026-08-19',
      kind: 'focus',
      selectedBy: 'user',
      createdAt: firstInstant
    })
    repository.saveActionRecord({
      id: 'action-record-1',
      actionId: 'action-1',
      occurredOn: '2026-08-19',
      durationMinutes: 10,
      outcome: 'partial',
      nextStep: null,
      note: null,
      createdAt: firstInstant,
      updatedAt: firstInstant
    })
    repository.saveUnderstanding({
      id: 'understanding-1',
      actionRecordId: 'action-record-1',
      text: 'Understanding',
      source: 'manual',
      revokedAt: null,
      createdAt: firstInstant,
      updatedAt: firstInstant
    })
    repository.saveConfusion({
      id: 'confusion-1',
      actionRecordId: 'action-record-1',
      text: 'Confusion',
      status: 'open',
      resolvedAt: null,
      resolution: null,
      createdAt: firstInstant,
      updatedAt: firstInstant
    })
    repository.saveRoutineRecord({
      id: 'routine-record-1',
      routineId: 'routine-1',
      occurredOn: '2026-08-19',
      outcome: 'acted',
      plannedForDate: true,
      plannedForDateBasis: 'schedule_at_recording',
      durationMinutes: 5,
      note: null,
      createdAt: firstInstant,
      updatedAt: firstInstant
    })
    repository.saveReviewResult({
      id: 'review-1',
      periodStartedOn: '2026-08-17',
      confirmedProgress: 'Summary',
      mainObstacle: 'Adjustment',
      nextAdjustment: 'Next',
      goalId: 'goal-1',
      createdAt: firstInstant,
      updatedAt: firstInstant
    })
  })
}

function service(
  connection: SqliteConnection,
  clock: FakeClock,
  unitOfWork: UnitOfWorkPort = connection
) {
  let sequence = 1
  return new DataControlService({
    repository: connection.repository,
    unitOfWork,
    clock,
    generateId: () => `new-${sequence++}`
  })
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => removeTemporaryTestRoot(root)))
})

describe('data control SQLite integration', () => {
  it('reports exact stable ids and relationship pairs for Action and Goal previews', async () => {
    const { connection } = await openDatabase()
    populate(connection)
    const repository = asDataControlRepository(connection.repository)
    expect(repository.findDeleteImpact({ type: 'action', id: 'action-1' })).toMatchObject({
      actions: ['action-1'],
      todaySelections: ['action-1|2026-08-19'],
      actionRecords: ['action-record-1'],
      understandings: ['understanding-1'],
      confusions: ['confusion-1'],
      clearedCurrentNext: ['goal-1|action-1']
    })
    expect(repository.findDeleteImpact({ type: 'goal', id: 'goal-1' })).toMatchObject({
      goals: ['goal-1'],
      actions: ['action-1'],
      routines: [],
      routineRecords: [],
      reviewResults: [],
      detachedRoutines: ['routine-1|goal-1'],
      detachedGoalStages: [],
      detachedReviewResults: ['review-1|goal-1'],
      clearedCurrentNext: []
    })
    connection.close()
  })

  it('edits and backfills facts without changing parent state, Today, or current-next', async () => {
    const { path, connection } = await openDatabase()
    populate(connection)
    connection.repository.saveAction({
      ...connection.repository.readSnapshot().actions[0]!,
      status: 'completed'
    })
    connection.repository.saveRoutine({
      ...connection.repository.readSnapshot().routines[0]!,
      status: 'paused'
    })
    connection.repository.saveGoal({
      ...connection.repository.readSnapshot().goals[0]!,
      status: 'paused'
    })
    const clock = new FakeClock({
      instant: '2026-08-20T08:00:00.000Z',
      localDate: '2026-08-20',
      timeZone: 'Asia/Shanghai'
    })
    const data = service(connection, clock)

    data.updateActionRecord({
      recordId: 'action-record-1',
      occurredOn: '2026-08-18',
      durationMinutes: 20,
      outcome: 'stopped',
      nextStep: 'Retry',
      note: 'Edited'
    })
    const actionBackfill = data.backfillActionRecord({
      actionId: 'action-1',
      occurredOn: '2026-08-17',
      durationMinutes: 4,
      outcome: 'partial',
      understanding: 'Historical fact',
      confusion: 'Historical question'
    })
    const routineBackfill = data.backfillRoutineRecord({
      routineId: 'routine-1',
      occurredOn: '2026-08-17',
      outcome: 'not_done',
      plannedForDate: false
    })
    const movedRoutine = data.updateRoutineRecord({
      recordId: 'routine-record-1',
      occurredOn: '2026-08-18',
      outcome: 'target_met',
      plannedForDate: true,
      durationMinutes: 8
    })
    data.updateUnderstandingText('understanding-1', 'Edited understanding')
    data.revokeUnderstanding('understanding-1')
    data.updateConfusionText('confusion-1', 'Edited confusion')
    data.resolveConfusion('confusion-1', 'Resolved deliberately')
    const reopenedConfusion = data.reopenConfusion('confusion-1')

    expect(actionBackfill.createdAt).toBe('2026-08-20T08:00:00.000Z')
    expect(routineBackfill).toMatchObject({
      plannedForDate: false,
      plannedForDateBasis: 'user_confirmed_history'
    })
    expect(movedRoutine).toMatchObject({
      occurredOn: '2026-08-18',
      plannedForDate: true,
      plannedForDateBasis: 'user_confirmed_history'
    })
    expect(reopenedConfusion).toMatchObject({
      status: 'open',
      resolvedAt: null,
      resolution: null
    })
    const snapshot = connection.repository.readSnapshot()
    expect(snapshot.goals[0]).toMatchObject({ status: 'paused', currentNextActionId: 'action-1' })
    expect(snapshot.actions[0]).toMatchObject({ status: 'completed' })
    expect(snapshot.routines[0]).toMatchObject({ status: 'paused' })
    expect(snapshot.todaySelections).toHaveLength(1)
    expect(
      new ProgressService({ repository: connection.repository }).getProgress({
        from: '2026-08-19',
        through: '2026-08-19'
      }).records
    ).toHaveLength(0)
    expect(
      new ProgressService({ repository: connection.repository }).getProgress({
        from: '2026-08-18',
        through: '2026-08-18'
      })
    ).toMatchObject({ totalDurationMinutes: 28 })
    expect(
      new RoutineRecordService({
        repository: connection.repository,
        unitOfWork: connection,
        clock,
        generateId: crypto.randomUUID
      }).getRoutineDayState('routine-1', '2026-08-19').recordState
    ).toBe('unknown')
    connection.close()

    const reopened = SqliteConnection.open(path)
    try {
      expect(reopened.repository.readSnapshot()).toMatchObject({
        actionRecords: expect.arrayContaining([
          expect.objectContaining({ id: actionBackfill.id, occurredOn: '2026-08-17' })
        ]),
        routineRecords: expect.arrayContaining([
          expect.objectContaining({ id: 'routine-record-1', occurredOn: '2026-08-18' })
        ])
      })
    } finally {
      reopened.close()
    }
  })

  it('rejects update-as-create, duplicate Routine dates, and invalid repeated transitions with zero change', async () => {
    const { connection } = await openDatabase()
    populate(connection)
    const clock = new FakeClock({
      instant: '2026-08-20T08:00:00.000Z',
      localDate: '2026-08-20',
      timeZone: 'Asia/Shanghai'
    })
    const data = service(connection, clock)
    const before = connection.repository.readSnapshot()
    expect(() =>
      data.updateActionRecord({
        recordId: 'missing',
        occurredOn: '2026-08-18',
        durationMinutes: 1,
        outcome: 'partial'
      })
    ).toThrowError(expect.objectContaining({ code: 'not-found' }))
    expect(() =>
      data.backfillRoutineRecord({
        routineId: 'routine-1',
        occurredOn: '2026-08-19',
        outcome: 'not_done',
        plannedForDate: true
      })
    ).toThrowError(expect.objectContaining({ code: 'record-already-exists' }))
    data.revokeUnderstanding('understanding-1')
    const afterFirstTransition = connection.repository.readSnapshot()
    expect(() => data.revokeUnderstanding('understanding-1')).toThrowError(
      expect.objectContaining({ code: 'invalid-transition' })
    )
    expect(connection.repository.readSnapshot()).toEqual(afterFirstTransition)
    expect(before.actionRecords).toEqual(afterFirstTransition.actionRecords)
    connection.close()
  })

  for (const target of [
    { type: 'action-record', id: 'action-record-1' },
    { type: 'routine-record', id: 'routine-record-1' },
    { type: 'action', id: 'action-1' },
    { type: 'routine', id: 'routine-1' },
    { type: 'goal', id: 'goal-1' }
  ] as const satisfies readonly DeleteTarget[]) {
    it(`previews and transactionally deletes the ${target.type} root with exact effects`, async () => {
      const { path, connection } = await openDatabase()
      populate(connection)
      const clock = new FakeClock({
        instant: '2026-08-20T08:00:00.000Z',
        localDate: '2026-08-20',
        timeZone: 'Asia/Shanghai'
      })
      const data = service(connection, clock)
      const preview = data.previewDelete(target)
      const actual = data.confirmDelete(target, preview.fingerprint)
      expect(actual).toEqual(preview.counts)
      const snapshot = connection.repository.readSnapshot()
      if (target.type === 'action') {
        expect(snapshot.goals[0]?.currentNextActionId).toBeNull()
        expect(snapshot.todaySelections).toEqual([])
      }
      if (target.type === 'goal') {
        expect(snapshot.routines[0]).toMatchObject({ id: 'routine-1', goalId: null })
        expect(snapshot.reviewResults[0]).toMatchObject({ id: 'review-1', goalId: null })
        expect(snapshot.routineRecords).toHaveLength(1)
      }
      connection.close()
      const reopened = SqliteConnection.open(path)
      try {
        expect(reopened.repository.readSnapshot()).toEqual(snapshot)
      } finally {
        reopened.close()
      }
    })
  }

  it('rejects stale previews and rolls storage failures back without partial deletion', async () => {
    const { connection } = await openDatabase()
    populate(connection)
    const clock = new FakeClock({
      instant: '2026-08-20T08:00:00.000Z',
      localDate: '2026-08-20',
      timeZone: 'Asia/Shanghai'
    })
    const data = service(connection, clock)
    const target = { type: 'action', id: 'action-1' } as const
    const preview = data.previewDelete(target)
    connection.repository.saveActionRecord({
      id: 'late-record',
      actionId: 'action-1',
      occurredOn: '2026-08-18',
      durationMinutes: 1,
      outcome: 'partial',
      nextStep: null,
      note: null,
      createdAt: firstInstant,
      updatedAt: firstInstant
    })
    const afterConcurrentChange = connection.repository.readSnapshot()
    expect(() => data.confirmDelete(target, preview.fingerprint)).toThrowError(
      expect.objectContaining({ code: 'delete-preview-stale' })
    )
    expect(connection.repository.readSnapshot()).toEqual(afterConcurrentChange)

    const fresh = data.previewDelete(target)
    const failingUnitOfWork: UnitOfWorkPort = {
      transaction: (work) =>
        connection.transaction((repository) => {
          work(repository)
          throw new Error('injected commit failure')
        })
    }
    const failing = service(connection, clock, failingUnitOfWork)
    expect(() => failing.confirmDelete(target, fresh.fingerprint)).toThrow(
      /injected commit failure/
    )
    expect(connection.repository.readSnapshot()).toEqual(afterConcurrentChange)
    connection.close()
  })

  it('rolls back when actual delete effects include anything outside the preview', async () => {
    const { path, connection } = await openDatabase()
    populate(connection)
    const raw = new Database(path)
    try {
      raw.exec(`
        CREATE TRIGGER inject_unexpected_routine_delete
        AFTER DELETE ON actions
        BEGIN
          DELETE FROM routines;
        END;
      `)
    } finally {
      raw.close()
    }
    const clock = new FakeClock({
      instant: '2026-08-20T08:00:00.000Z',
      localDate: '2026-08-20',
      timeZone: 'Asia/Shanghai'
    })
    const data = service(connection, clock)
    const target = { type: 'action', id: 'action-1' } as const
    const preview = data.previewDelete(target)
    const before = connection.repository.readSnapshot()
    expect(() => data.confirmDelete(target, preview.fingerprint)).toThrowError(
      expect.objectContaining({ code: 'invariant-violation' })
    )
    expect(connection.repository.readSnapshot()).toEqual(before)
    connection.close()
  })
})
