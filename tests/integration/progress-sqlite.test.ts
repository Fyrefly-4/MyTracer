import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { asActionRecordRepository } from '../../src/application/ports/persistence'
import { ProgressService } from '../../src/application/progress'
import type {
  ActionPersistenceRecord,
  ActionRecordPersistenceRecord,
  ConfusionPersistenceRecord,
  GoalPersistenceRecord,
  UnderstandingPersistenceRecord
} from '../../src/application/ports/persistence'
import { SqliteConnection } from '../../src/infrastructure/sqlite/sqlite-connection'
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
  const path = join(root.database, `progress-${crypto.randomUUID()}.sqlite3`)
  return { path, connection: SqliteConnection.open(path) }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => removeTemporaryTestRoot(root)))
})

function seed(connection: SqliteConnection): void {
  const repository = connection.repository
  const goals: GoalPersistenceRecord[] = [
    {
      id: 'goal-1',
      title: 'React',
      description: null,
      status: 'active',
      predecessorGoalId: null,
      currentNextActionId: null,
      createdAt: at(10),
      updatedAt: at(10)
    },
    {
      id: 'goal-2',
      title: 'Exercise',
      description: null,
      status: 'active',
      predecessorGoalId: null,
      currentNextActionId: null,
      createdAt: at(10, 1),
      updatedAt: at(10, 1)
    }
  ]
  const actions: ActionPersistenceRecord[] = [
    {
      id: 'action-1',
      goalId: 'goal-1',
      title: 'State example',
      description: null,
      status: 'pending',
      createdAt: at(10),
      updatedAt: at(10)
    },
    {
      id: 'action-2',
      goalId: 'goal-2',
      title: 'Walk',
      description: null,
      status: 'pending',
      createdAt: at(10, 1),
      updatedAt: at(10, 1)
    },
    {
      id: 'action-3',
      goalId: null,
      title: 'Standalone',
      description: null,
      status: 'pending',
      createdAt: at(10, 2),
      updatedAt: at(10, 2)
    }
  ]
  const records: ActionRecordPersistenceRecord[] = [
    {
      id: 'record-b',
      actionId: 'action-1',
      occurredOn: '2026-08-12',
      durationMinutes: 0,
      outcome: 'partial',
      nextStep: null,
      summary: null,
      note: null,
      createdAt: at(12, 1),
      updatedAt: at(12, 1)
    },
    {
      id: 'record-a',
      actionId: 'action-1',
      occurredOn: '2026-08-12',
      durationMinutes: 25,
      outcome: 'completed',
      nextStep: null,
      summary: null,
      note: null,
      createdAt: at(12, 1),
      updatedAt: at(12, 1)
    },
    {
      id: 'record-c',
      actionId: 'action-2',
      occurredOn: '2026-08-11',
      durationMinutes: 10,
      outcome: 'stopped',
      nextStep: null,
      summary: null,
      note: null,
      createdAt: at(11),
      updatedAt: at(11)
    },
    {
      id: 'record-d',
      actionId: 'action-3',
      occurredOn: '2026-08-10',
      durationMinutes: 5,
      outcome: 'partial',
      nextStep: null,
      summary: null,
      note: null,
      createdAt: at(10),
      updatedAt: at(10)
    }
  ]
  for (const item of goals) repository.saveGoal(item)
  for (const item of actions) repository.saveAction(item)
  for (const item of records) repository.saveActionRecord(item)
  const understandings: UnderstandingPersistenceRecord[] = [
    {
      id: 'understanding-b',
      actionRecordId: 'record-a',
      text: 'Second',
      source: 'manual',
      revokedAt: null,
      createdAt: at(12, 3),
      updatedAt: at(12, 3)
    },
    {
      id: 'understanding-a',
      actionRecordId: 'record-a',
      text: 'First',
      source: 'manual',
      revokedAt: null,
      createdAt: at(12, 2),
      updatedAt: at(12, 2)
    },
    {
      id: 'understanding-revoked',
      actionRecordId: 'record-a',
      text: 'Revoked',
      source: 'manual',
      revokedAt: at(13),
      createdAt: at(12, 4),
      updatedAt: at(13)
    }
  ]
  for (const item of understandings) repository.saveUnderstanding(item)
  const confusions: ConfusionPersistenceRecord[] = [
    {
      id: 'confusion-b',
      actionRecordId: 'record-a',
      text: 'Second question',
      status: 'open',
      resolvedAt: null,
      resolution: null,
      createdAt: at(12, 6),
      updatedAt: at(12, 6)
    },
    {
      id: 'confusion-a',
      actionRecordId: 'record-a',
      text: 'First question',
      status: 'open',
      resolvedAt: null,
      resolution: null,
      createdAt: at(12, 5),
      updatedAt: at(12, 5)
    },
    {
      id: 'confusion-resolved',
      actionRecordId: 'record-a',
      text: 'Resolved',
      status: 'resolved',
      resolvedAt: at(13),
      resolution: 'Known',
      createdAt: at(12, 7),
      updatedAt: at(13)
    }
  ]
  for (const item of confusions) repository.saveConfusion(item)
}

describe('Progress SQLite projection', () => {
  it('projects only a presence flag, preserving filters and totals after original text edits', async () => {
    const { connection } = await openDatabase()
    try {
      seed(connection)
      const repository = connection.repository
      const service = new ProgressService({ repository })
      const before = service.getProgress({
        goalId: 'goal-1',
        from: '2026-08-12',
        through: '2026-08-12'
      })
      const original = asActionRecordRepository(repository).findActionRecordById('record-a')
      if (!original) throw Error('record missing')
      const note = '第一行：读到例题二。\n第二行：换成纸笔后顺了。'
      const nextStep = '下次只重做例题二\n不安排日期'
      repository.saveActionRecord({ ...original, note, nextStep })
      const after = service.getProgress({
        goalId: 'goal-1',
        from: '2026-08-12',
        through: '2026-08-12'
      })
      expect(after.records.find((record) => record.recordId === original.id)).toMatchObject({
        hasRecordedText: true
      })
      expect(after.totalDurationMinutes).toBe(before.totalDurationMinutes)
      expect(after.realActionCount).toBe(before.realActionCount)
      expect(after.records.map((record) => record.recordId)).toEqual(
        before.records.map((record) => record.recordId)
      )
      expect(after.records.find((record) => record.recordId === 'record-b')).toMatchObject({
        hasRecordedText: false
      })
      expect(after.records[0]).not.toHaveProperty('note')
      expect(after.records[0]).not.toHaveProperty('nextStep')
      expect(JSON.stringify(after)).not.toContain('换成纸笔后顺了')
      expect(JSON.stringify(after)).not.toContain(nextStep)
      expect(
        service.getProgress({ goalId: 'goal-2' }).records.every((record) => !record.hasRecordedText)
      ).toBe(true)
      repository.saveActionRecord({ ...original, note: '修改后的备注', nextStep: null })
      expect(
        service.getProgress({}).records.find((record) => record.recordId === original.id)
      ).toMatchObject({ hasRecordedText: true })
      repository.saveActionRecord({ ...original, note: null, nextStep: '仅下一步' })
      expect(
        service.getProgress({}).records.find((record) => record.recordId === original.id)
          ?.hasRecordedText
      ).toBe(true)
      repository.saveActionRecord({ ...original, note: null, nextStep: null })
      expect(
        service.getProgress({}).records.find((record) => record.recordId === original.id)
          ?.hasRecordedText
      ).toBe(false)
    } finally {
      connection.close()
    }
  })

  it('filters inclusively, counts every ActionRecord, and sorts facts explicitly', async () => {
    const { connection } = await openDatabase()
    seed(connection)
    const service = new ProgressService({ repository: connection.repository })

    expect(service.getProgress({})).toMatchObject({ totalDurationMinutes: 40, realActionCount: 4 })
    const goalPeriod = service.getProgress({
      goalId: 'goal-1',
      from: '2026-08-12',
      through: '2026-08-12'
    })
    expect(goalPeriod).toMatchObject({ totalDurationMinutes: 25, realActionCount: 2 })
    expect(goalPeriod.records.map((record) => record.recordId)).toEqual(['record-a', 'record-b'])
    expect(goalPeriod.records[0].understandings.map((item) => item.id)).toEqual([
      'understanding-a',
      'understanding-b'
    ])
    expect(goalPeriod.records[0].openConfusions.map((item) => item.id)).toEqual([
      'confusion-a',
      'confusion-b'
    ])
    expect(service.getProgress({ through: '2026-08-10' })).toMatchObject({
      totalDurationMinutes: 5,
      realActionCount: 1
    })
    expect(service.getProgress({ from: '2026-08-13' })).toMatchObject({
      totalDurationMinutes: 0,
      realActionCount: 0,
      records: []
    })
    connection.close()
  })

  it('is repeatably read-only and recalculates the same facts after a real reopen', async () => {
    const { path, connection } = await openDatabase()
    seed(connection)
    const service = new ProgressService({ repository: connection.repository })
    const before = connection.repository.readSnapshot()
    const first = service.getProgress({})
    const second = service.getProgress({})
    expect(second).toEqual(first)
    expect(connection.repository.readSnapshot()).toEqual(before)

    connection.close()
    const reopened = SqliteConnection.open(path)
    try {
      expect(new ProgressService({ repository: reopened.repository }).getProgress({})).toEqual(
        first
      )
      expect(reopened.repository.readSnapshot()).toEqual(before)
    } finally {
      reopened.close()
    }
  })

  it('returns one committed fact snapshot while another connection has an uncommitted write', async () => {
    const { path, connection } = await openDatabase()
    seed(connection)
    const service = new ProgressService({ repository: connection.repository })
    const committed = service.getProgress({})
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
        .run('record-uncommitted', 'action-1', '2026-08-13', 7, 'partial', at(13), at(13))
      writer
        .prepare(
          `INSERT INTO understandings
           (id, action_record_id, text, source, revoked_at, created_at, updated_at)
           VALUES (?, ?, ?, 'manual', NULL, ?, ?)`
        )
        .run('understanding-uncommitted', 'record-uncommitted', 'New fact', at(13, 1), at(13, 1))

      expect(service.getProgress({})).toEqual(committed)
      writer.exec('COMMIT')
      const afterCommit = service.getProgress({})
      expect(afterCommit).toMatchObject({
        totalDurationMinutes: committed.totalDurationMinutes + 7,
        realActionCount: committed.realActionCount + 1
      })
      expect(afterCommit.records[0]).toMatchObject({
        recordId: 'record-uncommitted',
        understandings: [{ text: 'New fact' }]
      })
    } finally {
      if (writer.inTransaction) writer.exec('ROLLBACK')
      writer.close()
      connection.close()
    }
  })
})
