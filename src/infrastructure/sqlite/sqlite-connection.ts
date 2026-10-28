import { SqliteThoughtRepository } from './thought-repository'
import { SqliteRecordContinuityStore } from './record-continuity-store'
import { SqliteHomeQuery } from './home-query'
import type { HomeQueryPort } from '../../application/home'
import { mkdirSync, chmodSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import { migrateToCurrentSchema } from './migrations'
import { SqliteRepository } from './sqlite-repository'
import type { RepositoryPort, UnitOfWorkPort } from '../../application/ports/persistence'

export interface SqlitePragmas {
  readonly foreignKeys: number
  readonly journalMode: string
}

export class SqliteConnection implements UnitOfWorkPort {
  readonly thoughts: SqliteThoughtRepository
  readonly continuity: SqliteRecordContinuityStore
  readonly homeQuery: HomeQueryPort
  readonly repository: RepositoryPort
  private constructor(private readonly database: Database.Database) {
    this.thoughts = new SqliteThoughtRepository(database)
    this.continuity = new SqliteRecordContinuityStore(database)
    this.repository = new SqliteRepository(database)
    this.homeQuery = new SqliteHomeQuery(database)
  }

  static open(databasePath: string): SqliteConnection {
    mkdirSync(dirname(databasePath), { recursive: true })
    const database = new Database(databasePath)

    try {
      database.pragma('foreign_keys = ON')
      const foreignKeys = database.pragma('foreign_keys', { simple: true })
      if (foreignKeys !== 1) {
        throw new Error('SQLite foreign_keys pragma could not be enabled.')
      }

      database.pragma('journal_mode = WAL')
      const journalMode = database.pragma('journal_mode', { simple: true })
      if (typeof journalMode !== 'string' || journalMode.toLowerCase() !== 'wal') {
        throw new Error('SQLite WAL journal mode could not be enabled.')
      }

      database.pragma('synchronous = FULL')
      if (
        databasePath !== ':memory:' &&
        database.prepare("SELECT 1 FROM sqlite_master WHERE name = 'metadata'").get()
      ) {
        const version = database
          .prepare("SELECT value FROM metadata WHERE key = 'schemaVersion'")
          .get() as { value: string } | undefined
        if (version && Number(version.value) < 9) {
          const backupPath = `${databasePath}.before-${Number(version.value) < 8 ? 'record-continuity-v8' : 'standalone-thoughts-v9'}-${randomUUID()}.sqlite3`
          database.prepare('VACUUM INTO ?').run(backupPath)
          if (process.platform !== 'win32') chmodSync(backupPath, 0o600)
          const backup = new Database(backupPath, { readonly: true })
          try {
            if (backup.pragma('integrity_check', { simple: true }) !== 'ok')
              throw new Error('Migration backup validation failed.')
          } finally {
            backup.close()
          }
        }
      }
      migrateToCurrentSchema(database)
      return new SqliteConnection(database)
    } catch (error) {
      database.close()
      throw error
    }
  }

  transaction<T>(work: (repository: RepositoryPort) => T): T {
    return this.database.transaction(() => work(this.repository))()
  }

  inspectPragmas(): SqlitePragmas {
    const foreignKeys = this.database.pragma('foreign_keys', { simple: true })
    const journalMode = this.database.pragma('journal_mode', { simple: true })
    return {
      foreignKeys: typeof foreignKeys === 'number' ? foreignKeys : Number(foreignKeys),
      journalMode: String(journalMode).toLowerCase()
    }
  }

  close(): void {
    this.database.close()
  }
}
