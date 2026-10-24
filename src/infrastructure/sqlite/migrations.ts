import type Database from 'better-sqlite3'
import initialSchema from './migrations/001_initial.sql?raw'
import routineRecordPlannedForDateBasis from './migrations/002_add_routine_record_planned_for_date_basis.sql?raw'
import reviewResultsV3 from './migrations/003_review_results_v3.sql?raw'
import unknownActionDuration from './migrations/004_unknown_action_duration.sql?raw'

import routineArrangement from './migrations/005_routine_arrangement.sql?raw'

import goalStages from './migrations/006_goal_stages.sql?raw'

import recordSummaries from './migrations/007_record_summaries.sql?raw'

export const schemaVersion = 7

interface Migration {
  readonly version: number
  readonly name: string
  readonly sql: string
}

const migrations: readonly Migration[] = [
  { version: 1, name: '001_initial', sql: initialSchema },
  {
    version: 2,
    name: '002_add_routine_record_planned_for_date_basis',
    sql: routineRecordPlannedForDateBasis
  },
  { version: 3, name: '003_review_results_v3', sql: reviewResultsV3 },
  { version: 4, name: '004_unknown_action_duration', sql: unknownActionDuration },
  { version: 5, name: '005_routine_arrangement', sql: routineArrangement },
  { version: 6, name: '006_goal_stages', sql: goalStages },
  { version: 7, name: '007_record_summaries', sql: recordSummaries }
]

function assertReviewResultsV2CanMigrate(database: Database.Database): void {
  const duplicate = database
    .prepare(
      `SELECT period_started_on FROM review_results
       GROUP BY period_started_on HAVING COUNT(*) > 1 LIMIT 1`
    )
    .get()
  if (duplicate) {
    throw new Error('SQLite review_results migration stopped because a period is duplicated.')
  }
  const blank = database
    .prepare(
      `SELECT 1 FROM review_results
       WHERE length(trim(summary)) = 0 OR length(trim(adjustment)) = 0 OR length(trim(next_focus)) = 0
       LIMIT 1`
    )
    .get()
  if (blank) {
    throw new Error('SQLite review_results migration stopped because legacy text is blank.')
  }
}

function assertMigrationManifest(): void {
  for (const [index, migration] of migrations.entries()) {
    if (migration.version !== index + 1 || !migration.name || !migration.sql.trim()) {
      throw new Error('SQLite migration manifest must contain consecutive, non-empty migrations.')
    }
  }
}

function hasTable(database: Database.Database, name: string): boolean {
  return Boolean(
    database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name)
  )
}

function readSchemaVersion(database: Database.Database): number {
  const row = database.prepare("SELECT value FROM metadata WHERE key = 'schemaVersion'").get() as
    { readonly value?: unknown } | undefined
  const value = row?.value

  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value)) {
    throw new Error('SQLite metadata.schemaVersion is missing or invalid.')
  }

  return Number(value)
}

function hasUnexpectedNonEmptyDatabase(database: Database.Database): boolean {
  return Boolean(
    database
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' LIMIT 1"
      )
      .get()
  )
}

export function migrateToCurrentSchema(database: Database.Database): void {
  assertMigrationManifest()

  let currentVersion = 0
  if (hasTable(database, 'metadata')) {
    currentVersion = readSchemaVersion(database)
  } else if (hasUnexpectedNonEmptyDatabase(database)) {
    throw new Error('Refusing to migrate a non-empty SQLite database without metadata.')
  }

  if (currentVersion > schemaVersion) {
    throw new Error(
      `SQLite schema version ${currentVersion} is newer than supported version ${schemaVersion}.`
    )
  }

  for (const migration of migrations) {
    if (migration.version <= currentVersion) {
      continue
    }
    if (migration.version !== currentVersion + 1) {
      throw new Error(
        `SQLite migration ${migration.name} does not follow version ${currentVersion}.`
      )
    }

    database.transaction(() => {
      if (migration.version === 3) assertReviewResultsV2CanMigrate(database)
      if (
        migration.version === 5 &&
        database
          .prepare(
            'SELECT id FROM routines WHERE NOT EXISTS (SELECT 1 FROM routine_schedule_days WHERE routine_id = routines.id) LIMIT 1'
          )
          .get()
      )
        throw new Error('Routine arrangement migration stopped: legacy weekdays are missing.')
      database.exec(migration.sql)
      if (
        (migration.version === 4 || migration.version === 6) &&
        database.prepare('PRAGMA foreign_key_check').all().length > 0
      ) {
        throw new Error(`SQLite migration ${migration.name} failed foreign-key validation.`)
      }
      database
        .prepare(
          `INSERT INTO metadata (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`
        )
        .run('schemaVersion', String(migration.version))
    })()
    currentVersion = migration.version
  }

  if (currentVersion !== schemaVersion) {
    throw new Error(`SQLite migrations did not reach schema version ${schemaVersion}.`)
  }
}
