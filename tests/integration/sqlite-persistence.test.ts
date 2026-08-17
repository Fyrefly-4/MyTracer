import { existsSync } from 'node:fs'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import type { RepositoryPort } from '../../src/application/ports/persistence'
import { schemaVersion } from '../../src/infrastructure/sqlite/migrations'
import { SqliteConnection } from '../../src/infrastructure/sqlite/sqlite-connection'
import {
  createTemporaryTestRoot,
  removeTemporaryTestRoot,
  type TemporaryTestRoot
} from '../support/temporary-test-root'

const createdRoots: TemporaryTestRoot[] = []
const timestamp = '2026-08-09T08:00:00.000Z'

async function openTestDatabase(): Promise<{
  readonly root: TemporaryTestRoot
  readonly path: string
  readonly connection: SqliteConnection
}> {
  const root = await createTemporaryTestRoot()
  createdRoots.push(root)
  const path = join(root.database, `sqlite-${crypto.randomUUID()}.sqlite3`)
  return { root, path, connection: SqliteConnection.open(path) }
}

function populate(repository: RepositoryPort): void {
  repository.saveGoal({
    id: 'goal-1',
    title: 'Goal',
    description: null,
    status: 'active',
    currentNextActionId: null,
    createdAt: timestamp,
    updatedAt: timestamp
  })
  repository.saveAction({
    id: 'action-1',
    goalId: 'goal-1',
    title: "safe '); DROP TABLE goals; --",
    description: null,
    status: 'pending',
    createdAt: timestamp,
    updatedAt: timestamp
  })
  repository.saveGoal({
    id: 'goal-1',
    title: 'Goal',
    description: null,
    status: 'active',
    currentNextActionId: 'action-1',
    createdAt: timestamp,
    updatedAt: timestamp
  })
  repository.saveRoutine({
    id: 'routine-1',
    goalId: 'goal-1',
    name: 'Routine',
    minimumAction: 'One minute',
    description: null,
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp
  })
  repository.saveRoutineScheduleDay({ routineId: 'routine-1', weekday: 1 })
  repository.createTodaySelection({
    actionId: 'action-1',
    selectedFor: '2026-08-09',
    kind: 'focus',
    selectedBy: 'user',
    createdAt: timestamp
  })
  repository.saveActionRecord({
    id: 'action-record-1',
    actionId: 'action-1',
    occurredOn: '2026-08-09',
    durationMinutes: 0,
    outcome: 'partial',
    nextStep: null,
    note: null,
    createdAt: timestamp,
    updatedAt: timestamp
  })
  repository.saveRoutineRecord({
    id: 'routine-record-1',
    routineId: 'routine-1',
    occurredOn: '2026-08-09',
    outcome: 'intentional_rest',
    plannedForDate: true,
    durationMinutes: null,
    note: null,
    createdAt: timestamp,
    updatedAt: timestamp
  })
  repository.saveUnderstanding({
    id: 'understanding-1',
    actionRecordId: 'action-record-1',
    text: 'Observed fact',
    source: 'manual',
    revokedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp
  })
  repository.saveConfusion({
    id: 'confusion-1',
    actionRecordId: 'action-record-1',
    text: 'Open question',
    status: 'open',
    resolvedAt: null,
    resolution: null,
    createdAt: timestamp,
    updatedAt: timestamp
  })
  repository.saveReviewResult({
    id: 'review-1',
    periodStartedOn: '2026-08-03',
    summary: 'Summary',
    adjustment: 'Adjustment',
    nextFocus: 'Focus',
    goalId: 'goal-1',
    createdAt: timestamp,
    updatedAt: timestamp
  })
}

afterEach(async () => {
  await Promise.all(createdRoots.splice(0).map((root) => removeTemporaryTestRoot(root)))
})

describe('SQLite persistence', () => {
  it('migrates a fresh isolated database to schema v1 with verified pragmas', async () => {
    const { path, connection } = await openTestDatabase()

    try {
      expect(connection.inspectPragmas()).toEqual({ foreignKeys: 1, journalMode: 'wal' })
      expect(existsSync(path)).toBe(true)
      connection.close()

      const inspected = new Database(path, { readonly: true })
      try {
        expect(
          inspected.prepare("SELECT value FROM metadata WHERE key = 'schemaVersion'").get()
        ).toEqual({
          value: String(schemaVersion)
        })
        expect(
          inspected
            .prepare(
              "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
            )
            .all()
        ).toEqual([
          { name: 'action_records' },
          { name: 'actions' },
          { name: 'confusions' },
          { name: 'goals' },
          { name: 'metadata' },
          { name: 'review_results' },
          { name: 'routine_records' },
          { name: 'routine_schedule_days' },
          { name: 'routines' },
          { name: 'today_selections' },
          { name: 'understandings' }
        ])
      } finally {
        inspected.close()
      }
    } finally {
      try {
        connection.close()
      } catch {
        // The assertion path above intentionally closes the connection first.
      }
    }
  })

  it('opens an existing S1 v1 database without changing S1 facts or generating S2 data', async () => {
    const { path, connection } = await openTestDatabase()
    connection.transaction((repository) => {
      repository.saveGoal({
        id: 's1-goal',
        title: 'Existing S1 goal',
        description: 'Preserve this description',
        status: 'active',
        currentNextActionId: null,
        createdAt: timestamp,
        updatedAt: timestamp
      })
      repository.saveAction({
        id: 's1-action',
        goalId: 's1-goal',
        title: 'Existing S1 action',
        description: null,
        status: 'pending',
        createdAt: timestamp,
        updatedAt: timestamp
      })
      repository.saveGoal({
        id: 's1-goal',
        title: 'Existing S1 goal',
        description: 'Preserve this description',
        status: 'active',
        currentNextActionId: 's1-action',
        createdAt: timestamp,
        updatedAt: timestamp
      })
      repository.createTodaySelection({
        actionId: 's1-action',
        selectedFor: '2026-08-09',
        kind: 'focus',
        selectedBy: 'user',
        createdAt: timestamp
      })
      repository.saveActionRecord({
        id: 's1-record',
        actionId: 's1-action',
        occurredOn: '2026-08-09',
        durationMinutes: 12,
        outcome: 'partial',
        nextStep: 'Continue from the preserved context',
        note: 'Existing S1 note',
        createdAt: timestamp,
        updatedAt: timestamp
      })
      repository.saveUnderstanding({
        id: 's1-understanding',
        actionRecordId: 's1-record',
        text: 'Existing confirmed understanding',
        source: 'manual',
        revokedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp
      })
      repository.saveConfusion({
        id: 's1-confusion',
        actionRecordId: 's1-record',
        text: 'Existing open confusion',
        status: 'open',
        resolvedAt: null,
        resolution: null,
        createdAt: timestamp,
        updatedAt: timestamp
      })
    })
    const beforeReopen = connection.repository.readSnapshot()
    expect(beforeReopen.routines).toEqual([])
    expect(beforeReopen.routineScheduleDays).toEqual([])
    expect(beforeReopen.routineRecords).toEqual([])
    connection.close()

    const beforeInspection = new Database(path, { readonly: true })
    const metadataBefore = beforeInspection.prepare('SELECT key, value FROM metadata').all()
    beforeInspection.close()

    const reopened = SqliteConnection.open(path)
    try {
      expect(reopened.repository.readSnapshot()).toEqual(beforeReopen)
      expect(reopened.repository.readSnapshot()).toMatchObject({
        goals: [expect.objectContaining({ id: 's1-goal', currentNextActionId: 's1-action' })],
        actions: [expect.objectContaining({ id: 's1-action', status: 'pending' })],
        todaySelections: [expect.objectContaining({ kind: 'focus' })],
        actionRecords: [expect.objectContaining({ id: 's1-record', durationMinutes: 12 })],
        routines: [],
        routineScheduleDays: [],
        routineRecords: []
      })
    } finally {
      reopened.close()
    }

    const afterInspection = new Database(path, { readonly: true })
    try {
      expect(afterInspection.prepare('SELECT key, value FROM metadata').all()).toEqual(
        metadataBefore
      )
      expect(
        afterInspection
          .prepare(
            'SELECT (SELECT COUNT(*) FROM routines) AS routines, (SELECT COUNT(*) FROM routine_schedule_days) AS schedule_days, (SELECT COUNT(*) FROM routine_records) AS routine_records'
          )
          .get()
      ).toEqual({ routines: 0, schedule_days: 0, routine_records: 0 })
    } finally {
      afterInspection.close()
    }
  })

  it('writes and reads every v1 collection atomically, then persists it across reopen', async () => {
    const { path, connection } = await openTestDatabase()
    connection.transaction(populate)
    const beforeReopen = connection.repository.readSnapshot()
    connection.close()

    const reopened = SqliteConnection.open(path)
    try {
      expect(reopened.repository.readSnapshot()).toEqual(beforeReopen)
      expect(beforeReopen.actions[0]?.title).toBe("safe '); DROP TABLE goals; --")
      expect(beforeReopen.routineRecords[0]?.plannedForDate).toBe(true)
    } finally {
      reopened.close()
    }
  })

  it('rolls back a failed multi-step write and enforces foreign keys and check constraints', async () => {
    const { connection } = await openTestDatabase()

    expect(() =>
      connection.transaction((repository) => {
        repository.saveGoal({
          id: 'rolled-back',
          title: 'Rollback',
          description: null,
          status: 'active',
          currentNextActionId: null,
          createdAt: timestamp,
          updatedAt: timestamp
        })
        repository.saveAction({
          id: 'invalid-action',
          goalId: 'missing-goal',
          title: 'Invalid',
          description: null,
          status: 'pending',
          createdAt: timestamp,
          updatedAt: timestamp
        })
      })
    ).toThrow(/FOREIGN KEY constraint failed/)
    expect(connection.repository.readSnapshot().goals).toEqual([])

    expect(() =>
      connection.repository.saveAction({
        id: 'negative-duration',
        goalId: null,
        title: 'Action',
        description: null,
        status: 'pending',
        createdAt: timestamp,
        updatedAt: timestamp
      })
    ).not.toThrow()
    expect(() =>
      connection.repository.saveActionRecord({
        id: 'invalid-record',
        actionId: 'negative-duration',
        occurredOn: '2026-08-09',
        durationMinutes: -1,
        outcome: 'stopped',
        nextStep: null,
        note: null,
        createdAt: timestamp,
        updatedAt: timestamp
      })
    ).toThrow(/CHECK constraint failed/)
    connection.close()
  })

  it('refuses unknown non-empty databases and future schema versions before exposing a repository', async () => {
    const unknown = await openTestDatabase()
    unknown.connection.close()
    const rawUnknown = new Database(unknown.path)
    rawUnknown.exec('DROP TABLE metadata; CREATE TABLE unrelated_data (id TEXT PRIMARY KEY);')
    rawUnknown.close()
    expect(() => SqliteConnection.open(unknown.path)).toThrow(/without metadata/)

    const future = await openTestDatabase()
    future.connection.close()
    const rawFuture = new Database(future.path)
    rawFuture.prepare("UPDATE metadata SET value = '2' WHERE key = 'schemaVersion'").run()
    rawFuture.close()
    expect(() => SqliteConnection.open(future.path)).toThrow(/newer than supported/)
  })
})
