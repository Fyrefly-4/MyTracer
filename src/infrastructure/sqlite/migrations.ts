import type Database from 'better-sqlite3'
import initialSchema from './migrations/001_initial.sql?raw'
import routineRecordPlannedForDateBasis from './migrations/002_add_routine_record_planned_for_date_basis.sql?raw'

export const schemaVersion = 2

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
  }
]

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
      database.exec(migration.sql)
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
