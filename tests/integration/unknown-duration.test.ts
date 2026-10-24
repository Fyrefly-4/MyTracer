import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, expect, it } from 'vitest'
import initial from '../../src/infrastructure/sqlite/migrations/001_initial.sql?raw'
import v2 from '../../src/infrastructure/sqlite/migrations/002_add_routine_record_planned_for_date_basis.sql?raw'
import v3 from '../../src/infrastructure/sqlite/migrations/003_review_results_v3.sql?raw'
import { SqliteConnection } from '../../src/infrastructure/sqlite/sqlite-connection'
import { ActionRecordService } from '../../src/application/action-records'
import { DataControlService } from '../../src/application/data-control'
import { ProgressService } from '../../src/application/progress'
import { buildReviewSummary, currentReviewPeriod } from '../../src/domain/review'
import { buildCompleteExport, validateCompleteExport } from '../../src/application/complete-export'
import { asCompleteExportRepository } from '../../src/application/ports/persistence'
import { FakeClock } from '../support/fake-clock'
import {
  createTemporaryTestRoot,
  removeTemporaryTestRoot,
  type TemporaryTestRoot
} from '../support/temporary-test-root'

const roots: TemporaryTestRoot[] = []
const instant = '2026-10-24T08:00:00.000Z'
const clock = new FakeClock({ instant, localDate: '2026-10-24', timeZone: 'Etc/UTC' })
afterEach(async () => Promise.all(roots.splice(0).map(removeTemporaryTestRoot)))
async function legacy() {
  const root = await createTemporaryTestRoot()
  roots.push(root)
  const path = join(root.database, 'duration.sqlite3')
  const db = new Database(path)
  db.pragma('foreign_keys = ON')
  db.exec(initial)
  db.exec(v2)
  db.exec(v3)
  db.prepare('INSERT INTO metadata VALUES (?, ?)').run('schemaVersion', '3')
  db.prepare('INSERT INTO actions VALUES (?, NULL, ?, NULL, ?, ?, ?)').run(
    'action',
    'Synthetic repair',
    'pending',
    instant,
    instant
  )
  for (const duration of [0, 10]) {
    db.prepare('INSERT INTO action_records VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      `r${duration}`,
      'action',
      '2026-10-24',
      duration,
      'partial',
      'next',
      'note',
      instant,
      instant
    )
  }
  db.prepare('INSERT INTO understandings VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    'u',
    'r0',
    'revoked fact',
    'manual',
    instant,
    instant,
    instant
  )
  db.prepare('INSERT INTO confusions VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    'c',
    'r10',
    'resolved fact',
    'resolved',
    instant,
    'answer',
    instant,
    instant
  )
  return { path, db }
}
function rows(db: Database.Database) {
  return ['action_records', 'understandings', 'confusions'].map((table) =>
    db.prepare(`SELECT * FROM ${table} ORDER BY id`).all()
  )
}
it('migrates v3 numeric/zero rows and linked history exactly, retaining indexes, FK cascade and reopen', async () => {
  const { path, db } = await legacy()
  const before = rows(db)
  db.close()
  const connection = SqliteConnection.open(path)
  expect(connection.inspectPragmas().foreignKeys).toBe(1)
  connection.close()
  const check = new Database(path)
  try {
    expect(rows(check)).toEqual(before)
    expect(check.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    expect(
      check
        .prepare(
          "SELECT name FROM sqlite_master WHERE name='action_records_by_action_id_occurred_on'"
        )
        .get()
    ).toBeTruthy()
    check.pragma('foreign_keys = ON')
    check.prepare('DELETE FROM actions WHERE id=?').run('action')
    expect(rows(check)).toEqual([[], [], []])
  } finally {
    check.close()
  }
})
it('rolls back all rows and metadata if migration fails after copying/restoring history', async () => {
  const { path, db } = await legacy()
  const before = rows(db)
  db.exec(
    "CREATE TRIGGER fail_duration_version BEFORE UPDATE ON metadata WHEN NEW.value = '4' BEGIN SELECT RAISE(ABORT, 'synthetic migration failure'); END"
  )
  db.close()
  expect(() => SqliteConnection.open(path)).toThrow('synthetic migration failure')
  const check = new Database(path)
  try {
    expect(rows(check)).toEqual(before)
    expect(check.prepare('SELECT value FROM metadata').get()).toEqual({ value: '3' })
    expect(
      check.prepare("SELECT name FROM sqlite_master WHERE name='action_records_v4'").get()
    ).toBeUndefined()
  } finally {
    check.close()
  }
})
it('preserves null across creation, backfill, edits, queries, mixed/all-unknown aggregates and versioned export', async () => {
  const { path, db } = await legacy()
  db.close()
  let connection = SqliteConnection.open(path)
  try {
    const deps = {
      repository: connection.repository,
      unitOfWork: connection,
      clock,
      generateId: () => crypto.randomUUID()
    }
    const records = new ActionRecordService(deps)
    const data = new DataControlService(deps)
    const progress = new ProgressService(deps)
    const saved = records.recordAction({
      actionId: 'action',
      capturedOn: '2026-10-24',
      durationMinutes: null,
      outcome: 'partial'
    })
    expect(saved.kind).toBe('saved')
    const backfill = data.backfillActionRecord({
      actionId: 'action',
      occurredOn: '2026-10-17',
      durationMinutes: null,
      outcome: 'stopped'
    })
    expect(records.getActionRecordDetail(backfill.id).durationMinutes).toBeNull()
    for (const durationMinutes of [15, null, 0, null]) {
      data.updateActionRecord({
        recordId: backfill.id,
        occurredOn: backfill.occurredOn,
        durationMinutes,
        outcome: 'stopped'
      })
      expect(records.getActionRecordDetail(backfill.id).durationMinutes).toBe(durationMinutes)
    }
    const mixed = progress.getProgress({})
    expect(mixed).toMatchObject({
      totalDurationMinutes: 10,
      unknownDurationCount: 2,
      realActionCount: 4
    })
    expect(progress.getProgress({ from: '2026-10-17', through: '2026-10-17' })).toMatchObject({
      totalDurationMinutes: 0,
      unknownDurationCount: 1,
      realActionCount: 1
    })
    expect(progress.getProgress({ through: '2026-10-01' })).toMatchObject({
      totalDurationMinutes: 0,
      unknownDurationCount: 0,
      realActionCount: 0
    })
    expect(progress.compareWeeks({})).toMatchObject({
      current: { totalDurationMinutes: 10, unknownDurationCount: 1, realActionCount: 3 },
      previous: { totalDurationMinutes: 0, unknownDurationCount: 1, realActionCount: 1 }
    })
    const period = currentReviewPeriod('2026-10-24')
    expect(
      buildReviewSummary(
        period,
        progress.getProgress({ from: period.monday, through: period.sunday })
      )
    ).toMatchObject({ unknownDurationCount: 1, realActionCount: 3 })
    const snapshot = asCompleteExportRepository(connection.repository).readCompleteCoreSnapshot()
    const exported = JSON.parse(JSON.stringify(buildCompleteExport(snapshot, clock)))
    expect(exported).toMatchObject({ exportVersion: 3, sourceDataVersion: 4 })
    expect(() => validateCompleteExport(exported)).not.toThrow()
    for (const exportVersion of [1, 2]) {
      expect(() => validateCompleteExport({ ...exported, exportVersion })).toThrow(
        'Action record is invalid'
      )
      const numeric = {
        ...exported,
        exportVersion,
        data: {
          ...exported.data,
          actionRecords: exported.data.actionRecords.filter(
            (r: { durationMinutes: number | null }) => r.durationMinutes !== null
          )
        }
      }
      expect(() => validateCompleteExport(numeric)).not.toThrow()
    }
    const before = connection.repository.readSnapshot()
    connection.close()
    connection = SqliteConnection.open(path)
    expect(connection.repository.readSnapshot()).toEqual(before)
    expect(
      connection.repository.readSnapshot().actionRecords.filter((r) => r.durationMinutes === null)
    ).toHaveLength(2)
  } finally {
    connection.close()
  }
})
