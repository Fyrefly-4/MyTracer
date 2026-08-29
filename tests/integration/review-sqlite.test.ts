import Database from 'better-sqlite3'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ProgressService } from '../../src/application/progress'
import { ReviewService } from '../../src/application/review'
import type {
  ActionPersistenceRecord,
  ActionRecordPersistenceRecord,
  ConfusionPersistenceRecord,
  GoalPersistenceRecord,
  RoutinePersistenceRecord,
  RoutineRecordPersistenceRecord,
  UnderstandingPersistenceRecord
} from '../../src/application/ports/persistence'
import { SqliteConnection } from '../../src/infrastructure/sqlite/sqlite-connection'
import { FakeClock } from '../support/fake-clock'
import {
  createTemporaryTestRoot,
  removeTemporaryTestRoot,
  type TemporaryTestRoot
} from '../support/temporary-test-root'

const roots: TemporaryTestRoot[] = []
const at = (day: number, minute = 0) =>
  `2026-08-${String(day).padStart(2, '0')}T08:${String(minute).padStart(2, '0')}:00.000Z`

async function openDatabase() {
  const root = await createTemporaryTestRoot()
  roots.push(root)
  const path = join(root.database, `review-${crypto.randomUUID()}.sqlite3`)
  return { path, connection: SqliteConnection.open(path) }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => removeTemporaryTestRoot(root)))
})

function reviewService(connection: SqliteConnection): ReviewService {
  return new ReviewService({
    repository: connection.repository,
    clock: new FakeClock({
      instant: '2026-08-12T08:00:00.000Z',
      localDate: '2026-08-12',
      timeZone: 'Asia/Shanghai'
    })
  })
}

function seed(connection: SqliteConnection): void {
  const repository = connection.repository
  const goal: GoalPersistenceRecord = {
    id: 'goal-1',
    title: 'Review facts',
    description: null,
    status: 'active',
    currentNextActionId: null,
    createdAt: at(10),
    updatedAt: at(10)
  }
  const action: ActionPersistenceRecord = {
    id: 'action-1',
    goalId: goal.id,
    title: 'Read one example',
    description: null,
    status: 'pending',
    createdAt: at(10),
    updatedAt: at(10)
  }
  const actionRecord: ActionRecordPersistenceRecord = {
    id: 'action-record-1',
    actionId: action.id,
    occurredOn: '2026-08-10',
    durationMinutes: 12,
    outcome: 'partial',
    nextStep: null,
    note: null,
    createdAt: at(10, 1),
    updatedAt: at(10, 1)
  }
  const understanding: UnderstandingPersistenceRecord = {
    id: 'understanding-1',
    actionRecordId: actionRecord.id,
    text: 'State updates are queued',
    source: 'manual',
    revokedAt: null,
    createdAt: at(10, 2),
    updatedAt: at(10, 2)
  }
  const revoked: UnderstandingPersistenceRecord = {
    ...understanding,
    id: 'understanding-revoked',
    text: 'Revoked fact',
    revokedAt: at(11),
    createdAt: at(10, 3),
    updatedAt: at(11)
  }
  const confusion: ConfusionPersistenceRecord = {
    id: 'confusion-1',
    actionRecordId: actionRecord.id,
    text: 'When is the queue flushed?',
    status: 'open',
    resolvedAt: null,
    resolution: null,
    createdAt: at(10, 4),
    updatedAt: at(10, 4)
  }
  const resolved: ConfusionPersistenceRecord = {
    ...confusion,
    id: 'confusion-resolved',
    text: 'Resolved question',
    status: 'resolved',
    resolvedAt: at(11),
    resolution: 'Known',
    createdAt: at(10, 5),
    updatedAt: at(11)
  }
  const routine: RoutinePersistenceRecord = {
    id: 'routine-1',
    goalId: goal.id,
    name: 'Daily practice',
    minimumAction: 'Open the editor',
    description: null,
    status: 'active',
    createdAt: at(10),
    updatedAt: at(10)
  }
  const routineRecords: RoutineRecordPersistenceRecord[] = (
    ['target_met', 'acted', 'intentional_rest', 'not_done'] as const
  ).map((outcome, index) => ({
    id: `routine-record-${index + 1}`,
    routineId: routine.id,
    occurredOn: `2026-08-${String(index + 10).padStart(2, '0')}`,
    outcome,
    plannedForDate: true,
    plannedForDateBasis: 'user_confirmed_history',
    durationMinutes: outcome === 'target_met' ? 5 : outcome === 'acted' ? 2 : null,
    note: null,
    createdAt: at(index + 10),
    updatedAt: at(index + 10)
  }))

  repository.saveGoal(goal)
  repository.saveAction(action)
  repository.saveActionRecord(actionRecord)
  repository.saveUnderstanding(understanding)
  repository.saveUnderstanding(revoked)
  repository.saveConfusion(confusion)
  repository.saveConfusion(resolved)
  repository.saveRoutine(routine)
  repository.saveRoutineScheduleDay({ routineId: routine.id, weekday: 5 })
  for (const record of routineRecords) repository.saveRoutineRecord(record)
}

describe('Review SQLite summary snapshot', () => {
  it('matches Progress for the captured inclusive filter and never fills a missing Routine row', async () => {
    const { path, connection } = await openDatabase()
    seed(connection)
    const review = reviewService(connection)
    const period = review.beginReview()
    const before = structuredClone(connection.repository.readSnapshot())
    const first = review.getReviewSummary(period)
    const progress = new ProgressService({ repository: connection.repository }).getProgress({
      from: period.periodStartedOn,
      through: period.periodEndedOn
    })

    expect(first).toMatchObject({
      periodStartedOn: '2026-08-10',
      periodEndedOn: '2026-08-16',
      totalDurationMinutes: progress.totalDurationMinutes,
      realActionCount: progress.realActionCount,
      routineOutcomeCounts: { targetMet: 1, acted: 1, intentionalRest: 1, notDone: 1 },
      unknownPolicy: 'absence-is-unknown-not-counted-as-not-done'
    })
    expect(first.actionRecords).toEqual(progress.records)
    expect(first.routineRecords).toEqual(progress.routineRecords)
    expect(first.understandings.map((fact) => fact.text)).toEqual(['State updates are queued'])
    expect(first.openConfusions.map((fact) => fact.text)).toEqual(['When is the queue flushed?'])
    expect(first.routineRecords).toHaveLength(4)
    expect(connection.repository.readSnapshot()).toEqual(before)
    expect(review.getReviewSummary(period)).toEqual(first)
    expect(connection.repository.readSnapshot()).toEqual(before)

    connection.repository.saveActionRecord({
      id: 'action-record-2',
      actionId: 'action-1',
      occurredOn: '2026-08-14',
      durationMinutes: 3,
      outcome: 'stopped',
      nextStep: null,
      note: null,
      createdAt: at(14),
      updatedAt: at(14)
    })
    const changed = review.getReviewSummary(period)
    expect(changed.totalDurationMinutes).toBe(first.totalDurationMinutes + 3)
    expect(changed.realActionCount).toBe(first.realActionCount + 1)
    expect(changed.routineOutcomeCounts.notDone).toBe(1)
    expect(connection.repository.readSnapshot().reviewResults).toEqual([])
    connection.close()

    const reopened = SqliteConnection.open(path)
    try {
      expect(reviewService(reopened).getReviewSummary(period)).toEqual(changed)
      expect(reopened.repository.readSnapshot().reviewResults).toEqual([])
    } finally {
      reopened.close()
    }
  })

  it('returns only the committed fact snapshot while another connection has uncommitted facts', async () => {
    const { path, connection } = await openDatabase()
    seed(connection)
    const review = reviewService(connection)
    const period = review.beginReview()
    const committed = review.getReviewSummary(period)
    const writer = new Database(path)
    try {
      writer.pragma('foreign_keys = ON')
      writer.exec('BEGIN IMMEDIATE')
      writer
        .prepare(
          `INSERT INTO action_records
           (id, action_id, occurred_on, duration_minutes, outcome, next_step, note, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?)`
        )
        .run('uncommitted-record', 'action-1', '2026-08-15', 9, 'partial', at(15), at(15))
      writer
        .prepare(
          `INSERT INTO understandings
           (id, action_record_id, text, source, revoked_at, created_at, updated_at)
           VALUES (?, ?, ?, 'manual', NULL, ?, ?)`
        )
        .run('uncommitted-understanding', 'uncommitted-record', 'Uncommitted', at(15, 1), at(15, 1))

      expect(review.getReviewSummary(period)).toEqual(committed)
      writer.exec('COMMIT')
      expect(review.getReviewSummary(period)).toMatchObject({
        totalDurationMinutes: committed.totalDurationMinutes + 9,
        realActionCount: committed.realActionCount + 1,
        understandings: expect.arrayContaining([expect.objectContaining({ text: 'Uncommitted' })])
      })
    } finally {
      if (writer.inTransaction) writer.exec('ROLLBACK')
      writer.close()
      connection.close()
    }
  })
})
