import type Database from 'better-sqlite3'
import type { BookletRepository } from '../../application/booklets'
import type { Booklet } from '../../domain/booklet'
import { buildRecordBook } from '../../application/record-book'
import { SqliteRepository } from './sqlite-repository'
export class SqliteBookletRepository implements BookletRepository {
  constructor(private readonly database: Database.Database) {}
  list(): readonly Booklet[] {
    return (
      this.database.prepare('SELECT id FROM booklets ORDER BY id').all() as { id: string }[]
    ).map((row) => this.find(row.id)!)
  }
  find(id: string): Booklet | null {
    const row = this.database
      .prepare(
        'SELECT id, title, note, revision, created_at AS createdAt, updated_at AS updatedAt FROM booklets WHERE id = ?'
      )
      .get(id) as Omit<Booklet, 'entries'> | undefined
    if (!row) return null
    const entries = this.database
      .prepare(
        'SELECT id, kind, COALESCE(action_record_id, thought_id) AS sourceId FROM booklet_entries WHERE booklet_id = ? ORDER BY position'
      )
      .all(id) as Booklet['entries']
    return { ...row, entries }
  }
  write(booklet: Booklet): void {
    this.database
      .prepare(
        'INSERT INTO booklets (id, title, note, revision, created_at, updated_at) VALUES (@id, @title, @note, @revision, @createdAt, @updatedAt) ON CONFLICT(id) DO UPDATE SET title = excluded.title, note = excluded.note, revision = excluded.revision, updated_at = excluded.updated_at'
      )
      .run({
        id: booklet.id,
        title: booklet.title,
        note: booklet.note,
        revision: booklet.revision,
        createdAt: booklet.createdAt,
        updatedAt: booklet.updatedAt
      })
    this.database.prepare('DELETE FROM booklet_entries WHERE booklet_id = ?').run(booklet.id)
    const insert = this.database.prepare(
      'INSERT INTO booklet_entries (id, booklet_id, position, kind, action_record_id, thought_id) VALUES (?, ?, ?, ?, ?, ?)'
    )
    booklet.entries.forEach((entry, position) =>
      insert.run(
        entry.id,
        booklet.id,
        position,
        entry.kind,
        entry.kind === 'action-record' ? entry.sourceId : null,
        entry.kind === 'thought' ? entry.sourceId : null
      )
    )
  }
  remove(id: string): void {
    this.database.prepare('DELETE FROM booklets WHERE id = ?').run(id)
  }
  sources() {
    return buildRecordBook(new SqliteRepository(this.database).readSnapshot())
      .months.flatMap((month) => month.days.flatMap((day) => day.entries))
      .filter((entry) => entry.kind === 'action-record' || entry.kind === 'thought')
  }
  transaction<T>(work: () => T): T {
    return this.database.transaction(work)()
  }
}
