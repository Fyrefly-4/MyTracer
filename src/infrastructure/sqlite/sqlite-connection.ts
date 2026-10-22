import { SqliteHomeQuery } from './home-query'
import type { HomeQueryPort } from '../../application/home'
import { mkdirSync } from 'node:fs'
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
  readonly homeQuery: HomeQueryPort
  readonly repository: RepositoryPort
  private constructor(private readonly database: Database.Database) {
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
