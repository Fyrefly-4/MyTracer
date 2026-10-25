import type Database from 'better-sqlite3'
import type { ContinuityRow, RecordContinuityPort } from '../../application/ports/record-continuity'
export class SqliteRecordContinuityStore implements RecordContinuityPort {
  constructor(private readonly database: Database.Database) {}
  list(): readonly ContinuityRow[] {
    return this.database
      .prepare(
        "SELECT operation_id AS operationId, state, revision, payload, object_id AS objectId, occurred_on AS occurredOn FROM record_continuity WHERE state = 'open' AND payload IS NOT NULL"
      )
      .all() as ContinuityRow[]
  }
  find(id: string): ContinuityRow | undefined {
    return this.database
      .prepare(
        'SELECT operation_id AS operationId, state, revision, payload, object_id AS objectId, occurred_on AS occurredOn FROM record_continuity WHERE operation_id = ?'
      )
      .get(id) as ContinuityRow | undefined
  }
  write(row: ContinuityRow): void {
    this.database
      .prepare(
        'INSERT INTO record_continuity (operation_id, state, revision, payload, object_id, occurred_on) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(operation_id) DO UPDATE SET state=excluded.state, revision=excluded.revision, payload=excluded.payload, object_id=excluded.object_id, occurred_on=excluded.occurred_on'
      )
      .run(
        row.operationId,
        row.state,
        row.revision,
        row.payload,
        row.objectId ?? null,
        row.occurredOn ?? null
      )
  }
  transaction<T>(work: () => T): T {
    return this.database.transaction(work)()
  }
}
