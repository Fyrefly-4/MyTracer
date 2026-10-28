import type Database from 'better-sqlite3'
import type { ThoughtRepository } from '../../application/thoughts'
import type { Thought } from '../../domain/thought'
const columns =
  'id, occurred_on AS occurredOn, text, created_at AS createdAt, updated_at AS updatedAt'
export class SqliteThoughtRepository implements ThoughtRepository {
  constructor(private readonly database: Database.Database) {}
  list(date?: string): readonly Thought[] {
    return (
      date === undefined
        ? this.database.prepare(`SELECT ${columns} FROM thoughts ORDER BY occurred_on, id`).all()
        : this.database
            .prepare(
              `SELECT ${columns} FROM thoughts WHERE occurred_on = ? ORDER BY created_at, id`
            )
            .all(date)
    ) as Thought[]
  }
  find(id: string): Thought | null {
    return (
      (this.database.prepare(`SELECT ${columns} FROM thoughts WHERE id = ?`).get(id) as
        Thought | undefined) ?? null
    )
  }
  insert(thought: Thought): void {
    this.database
      .prepare(
        'INSERT INTO thoughts (id, occurred_on, text, created_at, updated_at) VALUES (@id, @occurredOn, @text, @createdAt, @updatedAt)'
      )
      .run(thought)
  }
  replace(thought: Thought): void {
    this.database
      .prepare('UPDATE thoughts SET text = @text, updated_at = @updatedAt WHERE id = @id')
      .run(thought)
  }
  remove(id: string): void {
    this.database.prepare('DELETE FROM thoughts WHERE id = ?').run(id)
  }
  transaction<T>(work: () => T): T {
    return this.database.transaction(work)()
  }
}
