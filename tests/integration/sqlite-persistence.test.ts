import { existsSync } from 'node:fs'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import type { RepositoryPort } from '../../src/application/ports/persistence'
import initialSchema from '../../src/infrastructure/sqlite/migrations/001_initial.sql?raw'
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

async function createV1Database(): Promise<{
  readonly path: string
  readonly database: Database.Database
}> {
  const root = await createTemporaryTestRoot()
  createdRoots.push(root)
  const path = join(root.database, `sqlite-v1-${crypto.randomUUID()}.sqlite3`)
  const database = new Database(path)
  database.pragma('foreign_keys = ON')
  database.exec(initialSchema)
  database.prepare('INSERT INTO metadata (key, value) VALUES (?, ?)').run('schemaVersion', '1')
  return { path, database }
}

const legacyFactQueries = {
  goals: 'SELECT * FROM goals ORDER BY id',
  actions: 'SELECT * FROM actions ORDER BY id',
  routines: 'SELECT * FROM routines ORDER BY id',
  routineScheduleDays: 'SELECT * FROM routine_schedule_days ORDER BY routine_id, weekday',
  todaySelections: 'SELECT * FROM today_selections ORDER BY selected_for, action_id',
  actionRecords: 'SELECT * FROM action_records ORDER BY occurred_on, id',
  routineRecords:
    'SELECT id, routine_id, occurred_on, outcome, planned_for_date, duration_minutes, note, created_at, updated_at FROM routine_records ORDER BY occurred_on, id',
  understandings: 'SELECT * FROM understandings ORDER BY id',
  confusions: 'SELECT * FROM confusions ORDER BY id',
  reviewResults: 'SELECT * FROM review_results ORDER BY period_started_on, id'
} as const

function readLegacyFacts(database: Database.Database): Record<string, readonly unknown[]> {
  return Object.fromEntries(
    Object.entries(legacyFactQueries).map(([name, sql]) => [name, database.prepare(sql).all()])
  )
}

function populateV1(database: Database.Database): void {
  database.transaction(() => {
    database
      .prepare(
        'INSERT INTO goals (id, title, description, status, current_next_action_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run('goal-1', 'Goal', null, 'active', null, timestamp, timestamp)
    database
      .prepare(
        'INSERT INTO actions (id, goal_id, title, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        'action-1',
        'goal-1',
        "safe '); DROP TABLE goals; --",
        null,
        'pending',
        timestamp,
        timestamp
      )
    database
      .prepare('UPDATE goals SET current_next_action_id = ? WHERE id = ?')
      .run('action-1', 'goal-1')
    database
      .prepare(
        'INSERT INTO routines (id, goal_id, name, minimum_action, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run('routine-1', 'goal-1', 'Routine', 'One minute', null, 'active', timestamp, timestamp)
    database
      .prepare('INSERT INTO routine_schedule_days (routine_id, weekday) VALUES (?, ?)')
      .run('routine-1', 1)
    database
      .prepare(
        'INSERT INTO today_selections (action_id, selected_for, kind, selected_by, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run('action-1', '2026-08-09', 'focus', 'user', timestamp)
    database
      .prepare(
        'INSERT INTO action_records (id, action_id, occurred_on, duration_minutes, outcome, next_step, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        'action-record-1',
        'action-1',
        '2026-08-09',
        12,
        'partial',
        'Continue',
        'Existing note',
        timestamp,
        timestamp
      )
    const insertRoutineRecord = database.prepare(
      'INSERT INTO routine_records (id, routine_id, occurred_on, outcome, planned_for_date, duration_minutes, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    for (const [index, outcome, planned, duration] of [
      [1, 'target_met', 1, 10],
      [2, 'acted', 0, 0],
      [3, 'intentional_rest', 1, null],
      [4, 'not_done', 0, null]
    ] as const) {
      insertRoutineRecord.run(
        `routine-record-${index}`,
        'routine-1',
        `2026-08-${String(8 + index).padStart(2, '0')}`,
        outcome,
        planned,
        duration,
        null,
        timestamp,
        timestamp
      )
    }
    database
      .prepare(
        'INSERT INTO understandings (id, action_record_id, text, source, revoked_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        'understanding-1',
        'action-record-1',
        'Observed fact',
        'manual',
        null,
        timestamp,
        timestamp
      )
    database
      .prepare(
        'INSERT INTO confusions (id, action_record_id, text, status, resolved_at, resolution, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        'confusion-1',
        'action-record-1',
        'Open question',
        'open',
        null,
        null,
        timestamp,
        timestamp
      )
    database
      .prepare(
        'INSERT INTO review_results (id, period_started_on, summary, adjustment, next_focus, goal_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        'review-1',
        '2026-08-03',
        'Summary',
        'Adjustment',
        'Focus',
        'goal-1',
        timestamp,
        timestamp
      )
  })()
}

function populate(repository: RepositoryPort): void {
  repository.saveGoal({
    id: 'goal-1',
    title: 'Goal',
    description: null,
    status: 'active',
    predecessorGoalId: null,
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
    predecessorGoalId: null,
    currentNextActionId: 'action-1',
    createdAt: timestamp,
    updatedAt: timestamp
  })
  repository.saveRoutine({
    arrangementMode: 'weekly' as const,
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
    summary: null,
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
    plannedForDateBasis: 'schedule_at_recording',
    durationMinutes: null,
    summary: null,
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
    confirmedProgress: 'Summary',
    mainObstacle: 'Adjustment',
    nextAdjustment: 'Focus',
    goalId: 'goal-1',
    createdAt: timestamp,
    updatedAt: timestamp
  })
}

afterEach(async () => {
  await Promise.all(createdRoots.splice(0).map((root) => removeTemporaryTestRoot(root)))
})

describe('SQLite persistence', () => {
  it('migrates a fresh isolated database to schema v3 with verified pragmas', async () => {
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
          { name: 'record_continuity' },
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

  it('migrates a populated v1 database to v3 without losing any existing fact', async () => {
    const { path, database } = await createV1Database()
    populateV1(database)
    const factsBefore = readLegacyFacts(database)
    database.close()

    const migrated = SqliteConnection.open(path)
    try {
      const snapshot = migrated.repository.readSnapshot()
      expect(snapshot.routineRecords).toHaveLength(4)
      expect(snapshot.routineRecords).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ outcome: 'target_met', plannedForDate: true }),
          expect.objectContaining({ outcome: 'acted', plannedForDate: false }),
          expect.objectContaining({ outcome: 'intentional_rest', plannedForDate: true }),
          expect.objectContaining({ outcome: 'not_done', plannedForDate: false })
        ])
      )
      expect(
        snapshot.routineRecords.every(
          (record) => record.plannedForDateBasis === 'schedule_at_recording'
        )
      ).toBe(true)
      expect(() =>
        migrated.repository.saveRoutineRecord({
          ...snapshot.routineRecords[0]!,
          plannedForDateBasis: 'invalid' as never
        })
      ).toThrow(/CHECK constraint failed/)
    } finally {
      migrated.close()
    }

    const inspected = new Database(path, { readonly: true })
    try {
      const legacyReview = factsBefore.reviewResults[0] as Record<string, unknown>
      expect(readLegacyFacts(inspected)).toEqual({
        ...factsBefore,
        actionRecords: factsBefore.actionRecords.map((r) => ({ ...(r as object), summary: null })),
        goals: factsBefore.goals.map((g) => ({ ...(g as object), predecessor_goal_id: null })),
        routines: factsBefore.routines.map((r) => ({
          ...(r as object),
          arrangement_mode: 'weekly'
        })),
        reviewResults: [
          {
            id: legacyReview.id,
            period_started_on: legacyReview.period_started_on,
            confirmed_progress: legacyReview.summary,
            main_obstacle: legacyReview.adjustment,
            next_adjustment: legacyReview.next_focus,
            goal_id: legacyReview.goal_id,
            created_at: legacyReview.created_at,
            updated_at: legacyReview.updated_at
          }
        ]
      })
      expect(inspected.prepare('PRAGMA foreign_key_check').all()).toEqual([])
      expect(
        inspected.prepare("SELECT value FROM metadata WHERE key = 'schemaVersion'").get()
      ).toEqual({ value: String(schemaVersion) })
      expect(
        inspected
          .prepare(
            "SELECT name, type, [notnull] AS is_not_null, dflt_value FROM pragma_table_info('routine_records') WHERE name = 'planned_for_date_basis'"
          )
          .get()
      ).toEqual({
        name: 'planned_for_date_basis',
        type: 'TEXT',
        is_not_null: 1,
        dflt_value: "'schedule_at_recording'"
      })
    } finally {
      inspected.close()
    }
  }, 30_000)

  it('migrates an S1-only v1 database without inventing any S2 fact', async () => {
    const { path, database } = await createV1Database()
    database.transaction(() => {
      database
        .prepare(
          'INSERT INTO goals (id, title, description, status, current_next_action_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .run('s1-goal', 'S1 Goal', null, 'active', null, timestamp, timestamp)
      database
        .prepare(
          'INSERT INTO actions (id, goal_id, title, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .run('s1-action', 's1-goal', 'S1 Action', null, 'pending', timestamp, timestamp)
      database
        .prepare('UPDATE goals SET current_next_action_id = ? WHERE id = ?')
        .run('s1-action', 's1-goal')
      database
        .prepare(
          'INSERT INTO action_records (id, action_id, occurred_on, duration_minutes, outcome, next_step, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run('s1-record', 's1-action', '2026-08-09', 2, 'partial', null, null, timestamp, timestamp)
    })()
    const factsBefore = readLegacyFacts(database)
    database.close()

    const migrated = SqliteConnection.open(path)
    try {
      const snapshot = migrated.repository.readSnapshot()
      expect(snapshot.goals).toEqual([expect.objectContaining({ id: 's1-goal' })])
      expect(snapshot.routines).toEqual([])
      expect(snapshot.routineScheduleDays).toEqual([])
      expect(snapshot.routineRecords).toEqual([])
    } finally {
      migrated.close()
    }
    const inspected = new Database(path, { readonly: true })
    try {
      expect(readLegacyFacts(inspected)).toEqual({
        ...factsBefore,
        actionRecords: factsBefore.actionRecords.map((r) => ({ ...(r as object), summary: null })),
        goals: factsBefore.goals.map((g) => ({ ...(g as object), predecessor_goal_id: null }))
      })
    } finally {
      inspected.close()
    }
  })

  it('rolls back the v1 to v2 migration when schema-version persistence fails', async () => {
    const { path, database } = await createV1Database()
    populateV1(database)
    const factsBefore = readLegacyFacts(database)
    database.exec(`
      CREATE TRIGGER reject_schema_version_update
      BEFORE UPDATE OF value ON metadata
      WHEN OLD.key = 'schemaVersion'
      BEGIN
        SELECT RAISE(ABORT, 'injected migration failure');
      END;
    `)
    database.close()

    expect(() => SqliteConnection.open(path)).toThrow(/injected migration failure/)

    const inspected = new Database(path)
    try {
      expect(readLegacyFacts(inspected)).toEqual(factsBefore)
      expect(
        inspected.prepare("SELECT value FROM metadata WHERE key = 'schemaVersion'").get()
      ).toEqual({ value: '1' })
      expect(
        inspected
          .prepare(
            "SELECT name FROM pragma_table_info('routine_records') WHERE name = 'planned_for_date_basis'"
          )
          .get()
      ).toBeUndefined()
      inspected.exec('DROP TRIGGER reject_schema_version_update')
    } finally {
      inspected.close()
    }

    const retried = SqliteConnection.open(path)
    retried.close()
  })

  it('writes and reads every v2 collection atomically, then persists it across reopen', async () => {
    const { path, connection } = await openTestDatabase()
    connection.transaction(populate)
    const beforeReopen = connection.repository.readSnapshot()
    connection.close()

    const reopened = SqliteConnection.open(path)
    try {
      expect(reopened.repository.readSnapshot()).toEqual(beforeReopen)
      expect(beforeReopen.actions[0]?.title).toBe("safe '); DROP TABLE goals; --")
      expect(beforeReopen.routineRecords[0]?.plannedForDate).toBe(true)
      expect(beforeReopen.routineRecords[0]?.plannedForDateBasis).toBe('schedule_at_recording')
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
          predecessorGoalId: null,
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
        summary: null,
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
    rawFuture
      .prepare('UPDATE metadata SET value = ? WHERE key = ?')
      .run(String(schemaVersion + 1), 'schemaVersion')
    rawFuture.close()
    expect(() => SqliteConnection.open(future.path)).toThrow(/newer than supported/)
  })
})
