import Database from 'better-sqlite3'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ThoughtService } from '../../src/application/thoughts'
import { buildCompleteExport, validateCompleteExport } from '../../src/application/complete-export'
import { buildRecordBook } from '../../src/application/record-book'
import { SqliteThoughtRepository } from '../../src/infrastructure/sqlite/thought-repository'
import { SqliteRepository } from '../../src/infrastructure/sqlite/sqlite-repository'
import { SqliteConnection } from '../../src/infrastructure/sqlite/sqlite-connection'
import { migrateToCurrentSchema } from '../../src/infrastructure/sqlite/migrations'
import { SqliteHomeQuery } from '../../src/infrastructure/sqlite/home-query'
import { FakeClock } from '../support/fake-clock'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'
import { renderBookMonth } from '../../src/presentation/record-book'
import { registerThoughtIpc } from '../../src/main/thoughts-ipc'
import { THOUGHT_CHANNELS } from '../../src/contracts/thoughts'
import type { IpcMainInvokeEvent } from 'electron'

const date = '2026-10-28'
const clock = new FakeClock({
  instant: '2026-10-28T01:00:00.000Z',
  localDate: date,
  timeZone: 'Etc/UTC'
})
const id = '00000000-0000-4000-8000-000000000001'
function fixture() {
  const db = new Database(':memory:')
  migrateToCurrentSchema(db)
  const repository = new SqliteThoughtRepository(db)
  return { db, repository, service: new ThoughtService(repository, clock) }
}

describe('standalone thoughts', () => {
  it('saves text alone, rejects whitespace/future dates, retries idempotently, edits and confirms deletion without touching action facts', () => {
    const { db, service } = fixture()
    try {
      const repository = new SqliteRepository(db)
      const home = new SqliteHomeQuery(db)
      const before = home.overview(date, '2026-10-01')
      for (const text of ['', '  \n\t', '\u3000'])
        expect(() => service.create({ id, text, occurredOn: date })).toThrow()
      expect(() => service.create({ id, text: 'x', occurredOn: '2026-10-29' })).toThrow()
      expect(() => service.list('2026-02-30')).toThrow()
      const text = '合成长段落 <script>alert(1)</script>\n'.repeat(300)
      const row = service.create({ id, text, occurredOn: date })
      expect(service.create({ id, text, occurredOn: date })).toEqual(row)
      expect(service.list(date)).toHaveLength(1)
      expect(service.list('2026-10-27')).toEqual([])
      expect(() => service.create({ id, text: 'different retry', occurredOn: date })).toThrow()
      expect(home.overview(date, '2026-10-01')).toEqual(before)
      const document = buildCompleteExport(repository.readCompleteCoreSnapshot(), clock)
      expect(document).toMatchObject({
        exportVersion: 7,
        sourceDataVersion: 9,
        data: { thoughts: [row], actions: [], actionRecords: [] }
      })
      validateCompleteExport(JSON.parse(JSON.stringify(document)))
      const { thoughts, ...legacyData } = document.data
      expect(thoughts).toHaveLength(1)
      expect(() => validateCompleteExport({ ...document, data: legacyData })).toThrow()
      expect(() =>
        validateCompleteExport({
          ...document,
          data: { ...document.data, thoughts: [{ ...row, text: ' ' }] }
        })
      ).toThrow()
      for (const sourceDataVersion of [7, 8])
        expect(() =>
          validateCompleteExport({
            ...document,
            exportVersion: 6,
            sourceDataVersion,
            data: legacyData
          })
        ).not.toThrow()
      const book = buildRecordBook(document.data)
      const html = renderBookMonth(book.months[0]!)
      expect(html).toContain('独立想法')
      expect(html).toContain('&lt;script&gt;')
      expect(html).not.toContain('<script>')
      const updated = service.update({ id, text: '修改后的合成想法', expectedText: row.text })
      expect(updated.createdAt).toBe(row.createdAt)
      expect(updated.occurredOn).toBe(date)
      expect(() => service.update({ id, text: ' ', expectedText: updated.text })).toThrow()
      expect(() => service.update({ id, text: 'stale edit', expectedText: row.text })).toThrow()
      expect(() => service.delete({ id, expectedText: row.text, confirmed: true })).toThrow()
      expect(service.list(date)).toEqual([updated])
      expect(() =>
        service.delete({ id, expectedText: updated.text, confirmed: false as never })
      ).toThrow()
      service.delete({ id, expectedText: updated.text, confirmed: true })
      service.delete({ id, expectedText: updated.text, confirmed: true })
      expect(service.list(date)).toEqual([])
      expect(home.overview(date, '2026-10-01')).toEqual(before)
    } finally {
      db.close()
    }
  })
  it('rolls failed writes back and validates IPC shape and sender before any command', () => {
    const { db, service } = fixture()
    try {
      db.exec(
        "CREATE TRIGGER fail_thought BEFORE INSERT ON thoughts BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END"
      )
      expect(() => service.create({ id, text: '合成失败', occurredOn: date })).toThrow()
      expect(service.list(date)).toEqual([])
      db.exec('DROP TRIGGER fail_thought')
      const handlers = new Map<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown>()
      registerThoughtIpc({
        ipc: {
          removeHandler: (channel) => {
            handlers.delete(channel)
          },
          handle: (channel, handler) => {
            handlers.set(channel, handler)
          }
        },
        service,
        assertSender: (event) => {
          if (event.sender.id !== 1) throw new Error('untrusted')
        }
      })
      const event = { sender: { id: 1 } } as IpcMainInvokeEvent
      const create = handlers.get(THOUGHT_CHANNELS.create)!
      expect(() =>
        create({ sender: { id: 2 } } as IpcMainInvokeEvent, { id, text: 'x', occurredOn: date })
      ).toThrow('untrusted')
      for (const input of [
        null,
        [],
        {},
        { id, text: 'x', occurredOn: date, goalId: 'x' },
        { id: 'not-uuid', text: 'x', occurredOn: date }
      ])
        expect(create(event, input)).toMatchObject({ ok: false, error: { code: 'validation' } })
      expect(service.list(date)).toEqual([])
      expect(create(event, { id, text: '合成保存', occurredOn: date })).toMatchObject({ ok: true })
      expect(create(event, { id, text: '合成保存', occurredOn: date })).toMatchObject({ ok: true })
      expect(service.list(date)).toHaveLength(1)
    } finally {
      db.close()
    }
  })
  it('rolls migration 9 back without removing existing data when metadata cannot advance', () => {
    const db = new Database(':memory:')
    try {
      const migrations = join(process.cwd(), 'src/infrastructure/sqlite/migrations')
      for (const file of readdirSync(migrations)
        .filter((name) => /^00[1-8]_.*\.sql$/.test(name))
        .sort())
        db.exec(readFileSync(join(migrations, file), 'utf8'))
      db.exec(
        "INSERT INTO metadata(key,value) VALUES('schemaVersion','8'); CREATE TRIGGER fail_v9 BEFORE UPDATE ON metadata WHEN NEW.value = '9' BEGIN SELECT RAISE(ABORT, 'synthetic migration failure'); END"
      )
      expect(() => migrateToCurrentSchema(db)).toThrow('synthetic migration failure')
      expect(db.prepare("SELECT value FROM metadata WHERE key='schemaVersion'").pluck().get()).toBe(
        '8'
      )
      expect(
        db.prepare("SELECT name FROM sqlite_master WHERE name='thoughts'").get()
      ).toBeUndefined()
      db.exec('DROP TRIGGER fail_v9')
      migrateToCurrentSchema(db)
      expect(db.prepare("SELECT value FROM metadata WHERE key='schemaVersion'").pluck().get()).toBe(
        '9'
      )
    } finally {
      db.close()
    }
  })
  it('migrates a populated real v8 schema, keeps originals and a checked backup, and reopens idempotently', async () => {
    const root = await createTemporaryTestRoot()
    const path = join(root.database, 'synthetic-v8.sqlite3')
    try {
      const db = new Database(path)
      const migrations = join(process.cwd(), 'src/infrastructure/sqlite/migrations')
      for (const file of readdirSync(migrations)
        .filter((name) => /^00[1-8]_.*\.sql$/.test(name))
        .sort())
        db.exec(readFileSync(join(migrations, file), 'utf8'))
      db.prepare("INSERT INTO metadata(key,value) VALUES('schemaVersion','8')").run()
      db.prepare(
        "INSERT INTO actions(id,title,status,created_at,updated_at) VALUES('old-action','合成旧行动','pending',?,?)"
      ).run(clock.nowInstant(), clock.nowInstant())
      const before = db.prepare('SELECT * FROM actions').all()
      db.close()
      let connection = SqliteConnection.open(path)
      expect(connection.repository.readSnapshot().actions[0]?.title).toBe('合成旧行动')
      expect(connection.repository.readSnapshot().thoughts).toEqual([])
      new ThoughtService(connection.thoughts, clock).create({
        id,
        text: '升级后合成想法',
        occurredOn: date
      })
      connection.close()
      connection = SqliteConnection.open(path)
      expect(connection.thoughts.list()).toHaveLength(1)
      connection.close()
      const backups = readdirSync(root.database).filter((name) =>
        name.includes('before-standalone-thoughts-v9')
      )
      expect(backups).toHaveLength(1)
      const backup = new Database(join(root.database, backups[0]!), { readonly: true })
      expect(backup.prepare('SELECT * FROM actions').all()).toEqual(before)
      expect(backup.pragma('integrity_check', { simple: true })).toBe('ok')
      expect(
        backup.prepare("SELECT value FROM metadata WHERE key='schemaVersion'").pluck().get()
      ).toBe('8')
      backup.close()
      const after = new Database(path)
      expect(after.prepare('SELECT * FROM actions').all()).toEqual(before)
      expect(
        after.prepare("SELECT value FROM metadata WHERE key='schemaVersion'").pluck().get()
      ).toBe('9')
      migrateToCurrentSchema(after)
      expect(after.prepare('SELECT count(*) FROM thoughts').pluck().get()).toBe(1)
      after.close()
    } finally {
      await removeTemporaryTestRoot(root)
    }
  })
})
