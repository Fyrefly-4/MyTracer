import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { migrateToCurrentSchema } from '../../src/infrastructure/sqlite/migrations'
import { SqliteRepository } from '../../src/infrastructure/sqlite/sqlite-repository'
import { SqliteHomeQuery } from '../../src/infrastructure/sqlite/home-query'
import { DataControlService } from '../../src/application/data-control'
import { buildCompleteExport, validateCompleteExport } from '../../src/application/complete-export'
import { buildRecordBook } from '../../src/application/record-book'
import { renderBookMonth } from '../../src/presentation/record-book'
import { FakeClock } from '../support/fake-clock'
import initial from '../../src/infrastructure/sqlite/migrations/001_initial.sql?raw'
import second from '../../src/infrastructure/sqlite/migrations/002_add_routine_record_planned_for_date_basis.sql?raw'
import third from '../../src/infrastructure/sqlite/migrations/003_review_results_v3.sql?raw'
import fourth from '../../src/infrastructure/sqlite/migrations/004_unknown_action_duration.sql?raw'
import fifth from '../../src/infrastructure/sqlite/migrations/005_routine_arrangement.sql?raw'
import sixth from '../../src/infrastructure/sqlite/migrations/006_goal_stages.sql?raw'

const instant = '2026-10-24T08:00:00.000Z'
const raw = '  # Legacy note\r\n\n**whole** <img src="https://example.invalid/pixel">\n'
function legacy() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  for (const sql of [initial, second, third, fourth, fifth, sixth]) db.exec(sql)
  db.exec("INSERT INTO metadata VALUES ('schemaVersion','6')")
  db.prepare("INSERT INTO actions VALUES ('a',NULL,'合成行动',NULL,'pending',?,?)").run(
    instant,
    instant
  )
  db.prepare(
    "INSERT INTO routines(id,name,minimum_action,status,created_at,updated_at,arrangement_mode) VALUES ('r','合成例行','一点','active',?,?,'unscheduled')"
  ).run(instant, instant)
  db.prepare(
    "INSERT INTO action_records(id,action_id,occurred_on,duration_minutes,outcome,note,created_at,updated_at) VALUES ('old-a','a','2026-10-24',NULL,'partial',?,?,?)"
  ).run(raw, instant, instant)
  db.prepare(
    "INSERT INTO routine_records(id,routine_id,occurred_on,outcome,planned_for_date,note,created_at,updated_at) VALUES ('old-r','r','2026-10-24','acted',0,?,?,?)"
  ).run(raw, instant, instant)
  return db
}

describe('summary migration and lossless storage', () => {
  it('adds nulls without touching any old value and rolls back both columns on failure', () => {
    for (const fail of [false, true]) {
      const db = legacy()
      try {
        const before = ['action_records', 'routine_records'].map((table) =>
          db.prepare(`SELECT * FROM ${table}`).all()
        )
        if (fail)
          db.exec(
            "CREATE TRIGGER fail_summary BEFORE UPDATE ON metadata WHEN NEW.value = '7' BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END"
          )
        if (fail) {
          expect(() => migrateToCurrentSchema(db)).toThrow(/synthetic failure/)
          expect(
            db.prepare("SELECT value FROM metadata WHERE key='schemaVersion'").pluck().get()
          ).toBe('6')
          for (const [i, table] of ['action_records', 'routine_records'].entries())
            expect(db.prepare(`SELECT * FROM ${table}`).all()).toEqual(before[i])
          db.exec('DROP TRIGGER fail_summary')
        }
        migrateToCurrentSchema(db)
        migrateToCurrentSchema(db)
        for (const [i, table] of ['action_records', 'routine_records'].entries())
          expect(db.prepare(`SELECT * FROM ${table}`).all()).toEqual(
            before[i].map((row) => ({ ...(row as object), summary: null }))
          )
        expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
      } finally {
        db.close()
      }
    }
  })
  it('roundtrips edits, optional combinations, strict versions, and offline safe reading without changing facts', () => {
    const db = legacy()
    try {
      migrateToCurrentSchema(db)
      const repository = new SqliteRepository(db)
      let seq = 0
      const clock = new FakeClock({ instant, localDate: '2026-10-24', timeZone: 'UTC' })
      const service = new DataControlService({
        repository,
        unitOfWork: { transaction: (work) => db.transaction(() => work(repository))() },
        clock,
        generateId: () => `new-${++seq}`
      })
      service.updateActionRecord({
        recordId: 'old-a',
        occurredOn: '2026-10-24',
        durationMinutes: null,
        outcome: 'partial',
        summary: '简述\n第二行'
      })
      service.updateRoutineRecord({
        recordId: 'old-r',
        occurredOn: '2026-10-24',
        outcome: 'acted',
        summary: '例行简述'
      })
      for (const summary of [null, '仅简述'])
        for (const note of [null, raw])
          service.backfillActionRecord({
            actionId: 'a',
            occurredOn: '2026-10-23',
            outcome: 'partial',
            durationMinutes: null,
            summary,
            note
          })
      expect(repository.findActionRecordById('old-a')).toMatchObject({
        summary: '简述\n第二行',
        note: raw
      })
      expect(repository.findRoutineRecordById('old-r')).toMatchObject({
        summary: '例行简述',
        note: raw
      })
      const before = repository.readSnapshot()
      expect(() =>
        service.updateActionRecord({
          recordId: 'old-a',
          occurredOn: '2026-10-24',
          durationMinutes: null,
          outcome: 'partial',
          summary: 'x'.repeat(501)
        })
      ).toThrow(/500/)
      expect(repository.readSnapshot()).toEqual(before)
      const home = new SqliteHomeQuery(db).day('2026-10-24', 1)
      expect(home.records).toHaveLength(2)
      expect(home.records.every((r) => r.hasNote && r.summary && !Object.hasOwn(r, 'note'))).toBe(
        true
      )
      const progress = repository.queryProgressSnapshot({ goalId: null, from: null, through: null })
      expect(progress.actionRows.filter((r) => r.hasRecordedText)).toHaveLength(4)
      const exported = buildCompleteExport(repository.readCompleteCoreSnapshot(), clock)
      const parsed = JSON.parse(JSON.stringify(exported))
      expect(() => validateCompleteExport(parsed)).not.toThrow()
      expect(parsed.data).toEqual(before)
      expect(parsed).toMatchObject({ exportVersion: 6, sourceDataVersion: 8 })
      for (const summary of [undefined, 1, {}, 'x'.repeat(501)]) {
        const bad = structuredClone(parsed)
        bad.data.actionRecords[0].summary = summary
        expect(() => validateCompleteExport(bad)).toThrow()
      }
      // Explicit old-format fixtures, not a product down-conversion API.
      for (const version of [1, 2, 3, 4, 5]) {
        const old = structuredClone(parsed)
        old.exportVersion = version
        old.sourceDataVersion = version + 1
        for (const record of [...old.data.actionRecords, ...old.data.routineRecords])
          delete record.summary
        if (version < 3) for (const record of old.data.actionRecords) record.durationMinutes = 0
        if (version < 4) {
          for (const routine of old.data.routines) delete routine.arrangementMode
        }
        expect(() => validateCompleteExport(old)).not.toThrow()
        old.data.actionRecords[0].summary = null
        expect(() => validateCompleteExport(old)).toThrow(/unsupported field/)
      }
      const html = renderBookMonth(buildRecordBook(before).months[0])
      expect(html).toContain('简述\n第二行')
      expect(html).toContain('<h1>Legacy note</h1>')
      expect(html).not.toMatch(/<img\b|<script\b|src="https:/)
      expect(repository.readSnapshot()).toEqual(before)
    } finally {
      db.close()
    }
  })
})
