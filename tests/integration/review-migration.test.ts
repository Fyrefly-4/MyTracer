import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import initialSchema from '../../src/infrastructure/sqlite/migrations/001_initial.sql?raw'
import routineRecordV2 from '../../src/infrastructure/sqlite/migrations/002_add_routine_record_planned_for_date_basis.sql?raw'
import { SqliteConnection } from '../../src/infrastructure/sqlite/sqlite-connection'
import {
  createTemporaryTestRoot,
  removeTemporaryTestRoot,
  type TemporaryTestRoot
} from '../support/temporary-test-root'

const roots: TemporaryTestRoot[] = []
const instant = '2026-08-24T08:00:00.000Z'

async function createV2(): Promise<{ path: string; database: Database.Database }> {
  const root = await createTemporaryTestRoot()
  roots.push(root)
  const path = join(root.database, `review-v2-${crypto.randomUUID()}.sqlite3`)
  const database = new Database(path)
  database.pragma('foreign_keys = ON')
  database.exec(initialSchema)
  database.prepare('INSERT INTO metadata (key, value) VALUES (?, ?)').run('schemaVersion', '1')
  database.exec(routineRecordV2)
  database.prepare("UPDATE metadata SET value = '2' WHERE key = 'schemaVersion'").run()
  return { path, database }
}

function insertLegacy(
  database: Database.Database,
  id: string,
  periodStartedOn: string,
  summary = 'Progress',
  adjustment = 'Obstacle',
  nextFocus = 'Adjustment'
): void {
  database
    .prepare(
      `INSERT INTO review_results
       (id, period_started_on, summary, adjustment, next_focus, goal_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`
    )
    .run(id, periodStartedOn, summary, adjustment, nextFocus, instant, instant)
}

function inspectV2(path: string): { version: string; rows: readonly unknown[] } {
  const database = new Database(path, { readonly: true })
  try {
    return {
      version: String(
        (
          database.prepare("SELECT value FROM metadata WHERE key = 'schemaVersion'").get() as {
            value: string
          }
        ).value
      ),
      rows: database.prepare('SELECT * FROM review_results ORDER BY id').all()
    }
  } finally {
    database.close()
  }
}

afterEach(async () => Promise.all(roots.splice(0).map(removeTemporaryTestRoot)))

describe('ReviewResult v2 to v3 migration', () => {
  it('maps every legal legacy field losslessly and persists after reopen', async () => {
    const { path, database } = await createV2()
    insertLegacy(database, 'review-1', '2026-08-24')
    database.close()

    const migrated = SqliteConnection.open(path)
    expect(migrated.repository.readSnapshot().reviewResults).toEqual([
      {
        id: 'review-1',
        periodStartedOn: '2026-08-24',
        confirmedProgress: 'Progress',
        mainObstacle: 'Obstacle',
        nextAdjustment: 'Adjustment',
        goalId: null,
        createdAt: instant,
        updatedAt: instant
      }
    ])
    migrated.close()

    const reopened = SqliteConnection.open(path)
    try {
      expect(reopened.repository.readSnapshot().reviewResults[0]).toMatchObject({
        id: 'review-1',
        confirmedProgress: 'Progress'
      })
    } finally {
      reopened.close()
    }
  }, 30_000)

  it('stops on duplicate periods and leaves the complete v2 table and version unchanged', async () => {
    const { path, database } = await createV2()
    insertLegacy(database, 'review-1', '2026-08-24')
    insertLegacy(database, 'review-2', '2026-08-24')
    const before = database.prepare('SELECT * FROM review_results ORDER BY id').all()
    database.close()

    expect(() => SqliteConnection.open(path)).toThrow(/period is duplicated/)
    expect(inspectV2(path)).toEqual({ version: '2', rows: before })
  })

  it('stops on corrupt blank legacy text without inventing a replacement', async () => {
    const { path, database } = await createV2()
    database.pragma('ignore_check_constraints = ON')
    insertLegacy(database, 'review-blank', '2026-08-24', '   ')
    database.pragma('ignore_check_constraints = OFF')
    const before = database.prepare('SELECT * FROM review_results').all()
    database.close()

    expect(() => SqliteConnection.open(path)).toThrow(/legacy text is blank/)
    expect(inspectV2(path)).toEqual({ version: '2', rows: before })
  })

  it('rolls back a structural migration failure and preserves v2 metadata and rows', async () => {
    const { path, database } = await createV2()
    insertLegacy(database, 'review-1', '2026-08-24')
    const before = database.prepare('SELECT * FROM review_results').all()
    database.exec('CREATE TABLE review_results_v3 (id TEXT PRIMARY KEY)')
    database.close()

    expect(() => SqliteConnection.open(path)).toThrow(/already exists/)
    expect(inspectV2(path)).toEqual({ version: '2', rows: before })
  })
})
