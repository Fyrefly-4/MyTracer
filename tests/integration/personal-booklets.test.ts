import Database from 'better-sqlite3'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { IpcMainInvokeEvent } from 'electron'
import { BookletService } from '../../src/application/booklets'
import { ThoughtService } from '../../src/application/thoughts'
import { DataControlService } from '../../src/application/data-control'
import { buildCompleteExport, validateCompleteExport } from '../../src/application/complete-export'
import { SqliteBookletRepository } from '../../src/infrastructure/sqlite/booklet-repository'
import { SqliteThoughtRepository } from '../../src/infrastructure/sqlite/thought-repository'
import { SqliteRepository } from '../../src/infrastructure/sqlite/sqlite-repository'
import { SqliteConnection } from '../../src/infrastructure/sqlite/sqlite-connection'
import { migrateToCurrentSchema } from '../../src/infrastructure/sqlite/migrations'
import { SqliteHomeQuery } from '../../src/infrastructure/sqlite/home-query'
import { renderBookletHtml } from '../../src/infrastructure/export/booklet-html'
import { SystemExportAdapter } from '../../src/infrastructure/export/system-export-adapter'
import { registerBookletIpc } from '../../src/main/booklets-ipc'
import { BOOKLET_CHANNELS } from '../../src/contracts/booklets'
import type { Booklet, BookletSave } from '../../src/contracts/booklets'
import { FakeClock } from '../support/fake-clock'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'
const date = '2026-10-28'
const instant = '2026-10-28T01:00:00.000Z'
const clock = new FakeClock({ instant, localDate: date, timeZone: 'Etc/UTC' })
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
function input(book: Booklet): BookletSave {
  return {
    id: book.id,
    expectedRevision: book.revision,
    title: book.title,
    note: book.note,
    entries: book.entries
  }
}
function fixture() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  migrateToCurrentSchema(db)
  const core = new SqliteRepository(db)
  core.saveGoal({
    id: uuid(1),
    title: 'Synthetic goal',
    description: null,
    status: 'active',
    predecessorGoalId: null,
    currentNextActionId: null,
    createdAt: instant,
    updatedAt: instant
  })
  core.saveAction({
    id: uuid(2),
    goalId: uuid(1),
    title: 'Synthetic action',
    description: null,
    status: 'pending',
    createdAt: instant,
    updatedAt: instant
  })
  core.saveActionRecord({
    id: uuid(3),
    actionId: uuid(2),
    occurredOn: date,
    durationMinutes: null,
    outcome: 'partial',
    summary: 'Synthetic summary',
    note: 'Synthetic original',
    nextStep: null,
    createdAt: instant,
    updatedAt: instant
  })
  const thoughts = new ThoughtService(new SqliteThoughtRepository(db), clock)
  thoughts.create({ id: uuid(4), occurredOn: date, text: 'Synthetic thought' })
  const repository = new SqliteBookletRepository(db)
  const deliverBooklet = vi.fn(async () => ({ kind: 'cancelled' as const }))
  const service = new BookletService(repository, clock, { deliverBooklet })
  const create = (n = 10) =>
    service.save({
      id: uuid(n),
      expectedRevision: 0,
      title: '',
      note: '',
      entries: [
        { id: uuid(n + 1), kind: 'action-record', sourceId: uuid(3) },
        { id: uuid(n + 2), kind: 'thought', sourceId: uuid(4) }
      ]
    })
  return { db, core, thoughts, repository, service, create, deliverBooklet }
}
describe('personal booklets', () => {
  it('keeps current originals in chosen order, retries without duplicates, rejects stale orders and rolls failed writes back', () => {
    const f = fixture()
    try {
      const before = new SqliteHomeQuery(f.db).overview(date, '2026-10-01')
      const book = f.create()
      expect(f.service.save({ ...input(book), expectedRevision: 0 })).toEqual(book)
      const reversed = f.service.save({ ...input(book), entries: [...book.entries].reverse() })
      expect(f.service.save({ ...input(book), entries: [...book.entries].reverse() })).toEqual(
        reversed
      )
      expect(() =>
        f.service.save({ ...input(book), title: 'stale', entries: book.entries })
      ).toThrow(/变化/)
      f.thoughts.update({
        id: uuid(4),
        expectedText: 'Synthetic thought',
        text: 'Revised current thought'
      })
      expect(f.service.read(book.id).contents[0]?.fields[0].text).toBe('Revised current thought')
      f.db.exec(
        "CREATE TRIGGER fail_entry BEFORE INSERT ON booklet_entries BEGIN SELECT RAISE(ABORT, 'synthetic write failure'); END"
      )
      expect(() => f.service.save({ ...input(reversed), title: 'Must roll back' })).toThrow(
        'synthetic write failure'
      )
      expect(f.repository.find(book.id)).toEqual(reversed)
      f.db.exec('DROP TRIGGER fail_entry')
      const removed = f.service.save({ ...input(reversed), entries: reversed.entries.slice(1) })
      expect(f.thoughts.list(date)).toHaveLength(1)
      expect(f.core.readSnapshot().actionRecords).toHaveLength(1)
      f.service.delete({ id: book.id, expectedRevision: removed.revision, confirmed: true })
      expect(f.service.list()).toEqual([])
      expect(new SqliteHomeQuery(f.db).overview(date, '2026-10-01')).toEqual(before)
    } finally {
      f.db.close()
    }
  })
  for (const type of ['action-record', 'action', 'goal'] as const)
    it(`preserves every booklet position after normal ${type} deletion and refuses stale cached additions`, () => {
      const f = fixture()
      try {
        const first = f.create(),
          second = f.create(20)
        const data = new DataControlService({
          repository: f.core,
          unitOfWork: { transaction: (work) => f.db.transaction(() => work(f.core))() },
          clock,
          generateId: () => uuid(99)
        })
        const target = { type, id: uuid(type === 'goal' ? 1 : type === 'action' ? 2 : 3) }
        const preview = data.previewDelete(target)
        data.confirmDelete(target, preview.fingerprint)
        for (const book of [first, second]) {
          const read = f.service.read(book.id)
          expect(read.contents).toEqual([null, expect.objectContaining({ kind: 'thought' })])
          expect(read.booklet.entries[0]).toEqual({ ...book.entries[0], sourceId: null })
          expect(read.booklet.revision).toBeGreaterThan(book.revision)
          expect(JSON.stringify(read)).not.toContain('Synthetic original')
          expect(() => f.service.save({ ...input(book), title: 'stale' })).toThrow(/变化/)
        }
        expect(() =>
          f.service.save({
            id: uuid(30),
            expectedRevision: 0,
            title: '',
            note: '',
            entries: [{ id: uuid(31), kind: 'action-record', sourceId: uuid(3) }]
          })
        ).toThrow(/来源已删除/)
        const document = buildCompleteExport(f.core.readCompleteCoreSnapshot(), clock)
        validateCompleteExport(document)
        expect(document.data.booklets).toHaveLength(2)
        expect(document.data.actionRecords).toEqual([])
        expect(document.data.booklets.every((book) => book.entries[0].sourceId === null)).toBe(true)
      } finally {
        f.db.close()
      }
    })
  it('handles independent thought deletion in all books without retaining text, permits removing placeholders, and exports a frozen file', async () => {
    const f = fixture()
    const root = await createTemporaryTestRoot()
    try {
      const book = f.create()
      f.create(20)
      const destination = join(root.exports, 'synthetic-booklet.html')
      const delivery = new SystemExportAdapter({
        dialog: { showSaveDialog: async () => ({ canceled: false, filePath: destination }) },
        generateToken: () => 'owned'
      })
      const service = new BookletService(f.repository, clock, delivery)
      await expect(service.export(book.id)).resolves.toMatchObject({ kind: 'exported' })
      const frozen = readFileSync(destination, 'utf8')
      expect(frozen).toContain('Synthetic thought')
      f.thoughts.delete({ id: uuid(4), expectedText: 'Synthetic thought', confirmed: true })
      for (const current of f.service.list()) {
        const read = f.service.read(current.id)
        expect(read.contents[1]).toBeNull()
        expect(read.booklet.entries[1].sourceId).toBeNull()
        expect(renderBookletHtml(read)).not.toContain('Synthetic thought')
        expect(renderBookletHtml(read)).toContain('来源已删除')
        f.service.save({ ...input(current), entries: current.entries.slice(0, 1) })
      }
      expect(readFileSync(destination, 'utf8')).toBe(frozen)
      expect(
        f.db.prepare('SELECT * FROM booklet_entries WHERE thought_id IS NOT NULL').all()
      ).toEqual([])
    } finally {
      f.db.close()
      await removeTemporaryTestRoot(root)
    }
  })
  it('uses one transaction for original resolution and a frozen export before the dialog; serializes exports', async () => {
    const f = fixture()
    try {
      const book = f.create()
      const sources = f.repository.sources.bind(f.repository)
      const observed = vi.spyOn(f.repository, 'sources').mockImplementation(() => {
        expect(f.db.inTransaction).toBe(true)
        return sources()
      })
      f.service.read(book.id)
      expect(observed).toHaveBeenCalledOnce()
      let finish!: () => void
      const service = new BookletService(f.repository, clock, {
        deliverBooklet: async (snapshot) => {
          f.thoughts.delete({ id: uuid(4), expectedText: 'Synthetic thought', confirmed: true })
          expect(snapshot.contents[1]?.fields[0].text).toBe('Synthetic thought')
          await new Promise<void>((resolve) => {
            finish = resolve
          })
          return { kind: 'cancelled' }
        }
      })
      const pending = service.export(book.id)
      await expect(service.export(book.id)).rejects.toThrow(/导出仍在进行/)
      finish()
      await pending
      expect(service.read(book.id).contents[1]).toBeNull()
    } finally {
      f.db.close()
    }
  })
  it('strictly validates v8 booklet fields and links while independently accepting the legacy v7 envelope', () => {
    const f = fixture()
    try {
      f.create()
      const document = buildCompleteExport(f.core.readCompleteCoreSnapshot(), clock)
      const { booklets, ...v7Data } = document.data
      expect(booklets).toHaveLength(1)
      expect(Object.isFrozen(booklets[0].entries[0])).toBe(true)
      expect(() =>
        validateCompleteExport({
          ...document,
          exportVersion: 7,
          sourceDataVersion: 9,
          data: v7Data
        })
      ).not.toThrow()
      expect(() =>
        validateCompleteExport({ ...document, exportVersion: 7, sourceDataVersion: 9 })
      ).toThrow()
      expect(() => validateCompleteExport({ ...document, data: v7Data })).toThrow()
      for (const change of [
        { revision: 0 },
        { note: 'x'.repeat(4001) },
        { hiddenText: 'must not retain' },
        { entries: [{ ...booklets[0].entries[0], sourceId: 'missing' }] },
        { entries: [{ ...booklets[0].entries[0], kind: 'review' }] },
        { entries: [booklets[0].entries[0], booklets[0].entries[0]] },
        { entries: [{ ...booklets[0].entries[0], body: 'cached' }] }
      ])
        expect(() =>
          validateCompleteExport({
            ...document,
            data: { ...document.data, booklets: [{ ...booklets[0], ...change }] }
          })
        ).toThrow()
    } finally {
      f.db.close()
    }
  })
  it('checks sender and exact IPC shapes before commands', async () => {
    const f = fixture()
    try {
      const handlers = new Map<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown>()
      const assertSender = vi.fn()
      registerBookletIpc({
        ipc: {
          removeHandler: () => {},
          handle: (channel, listener) => {
            handlers.set(channel, listener)
          }
        },
        service: f.service,
        assertSender
      })
      const event = {} as IpcMainInvokeEvent
      const call = (name: keyof typeof BOOKLET_CHANNELS, ...args: unknown[]) =>
        handlers.get(BOOKLET_CHANNELS[name])!(event, ...args)
      for (const value of [null, {}, { id: 'bad' }, { id: uuid(10), extra: true }])
        expect(await call('read', value)).toMatchObject({ ok: false })
      expect(await call('list', {})).toMatchObject({ ok: false })
      const valid = { id: uuid(10), expectedRevision: 0, title: '', note: '', entries: [] }
      for (const value of [
        { ...valid, expectedRevision: -1 },
        {
          ...valid,
          entries: [{ id: uuid(11), kind: 'thought', sourceId: uuid(4), text: 'cache' }]
        },
        { ...valid, entries: [{ id: uuid(11), kind: 'review', sourceId: uuid(4) }] }
      ])
        expect(await call('save', value)).toMatchObject({ ok: false })
      expect(f.service.list()).toEqual([])
      expect(await call('save', valid)).toMatchObject({ ok: true })
      assertSender.mockImplementation(() => {
        throw new Error('untrusted')
      })
      await expect(call('list')).rejects.toThrow('untrusted')
    } finally {
      f.db.close()
    }
  })
  it('backs up populated v9 once, migrates forward, preserves records and rolls a failed migration back', async () => {
    const root = await createTemporaryTestRoot()
    const path = join(root.database, 'synthetic-v9.sqlite3')
    try {
      const db = new Database(path)
      const folder = join(process.cwd(), 'src/infrastructure/sqlite/migrations')
      // Construct the old fixture atomically instead of fsyncing each DDL on Windows.
      // The production migration and its rollback assertions below remain separate.
      db.transaction(() => {
        for (const file of readdirSync(folder)
          .filter((name) => /^00[1-9]_.*\.sql$/.test(name))
          .sort())
          db.exec(readFileSync(join(folder, file), 'utf8'))
      })()
      db.exec(
        "INSERT INTO metadata(key,value) VALUES('schemaVersion','9'); CREATE TRIGGER fail_v10 BEFORE UPDATE ON metadata WHEN NEW.value = '10' BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END"
      )
      new ThoughtService(new SqliteThoughtRepository(db), clock).create({
        id: uuid(4),
        occurredOn: date,
        text: 'Before migration'
      })
      expect(() => migrateToCurrentSchema(db)).toThrow('synthetic failure')
      expect(
        db.prepare("SELECT name FROM sqlite_master WHERE name = 'booklets'").get()
      ).toBeUndefined()
      expect(
        db.prepare("SELECT value FROM metadata WHERE key = 'schemaVersion'").pluck().get()
      ).toBe('9')
      db.exec('DROP TRIGGER fail_v10')
      db.close()
      let connection = SqliteConnection.open(path)
      expect(connection.thoughts.list()[0].text).toBe('Before migration')
      new BookletService(connection.booklets, clock, {
        deliverBooklet: async () => ({ kind: 'cancelled' })
      }).save({
        id: uuid(10),
        expectedRevision: 0,
        title: 'After migration',
        note: '',
        entries: []
      })
      connection.close()
      connection = SqliteConnection.open(path)
      expect(connection.booklets.list()[0].title).toBe('After migration')
      connection.close()
      const backups = readdirSync(root.database).filter((name) =>
        name.includes('before-personal-booklets-v10')
      )
      expect(backups).toHaveLength(1)
      const backup = new Database(join(root.database, backups[0]), { readonly: true })
      expect(backup.pragma('integrity_check', { simple: true })).toBe('ok')
      expect(
        backup.prepare("SELECT value FROM metadata WHERE key = 'schemaVersion'").pluck().get()
      ).toBe('9')
      expect(backup.prepare('SELECT text FROM thoughts').pluck().get()).toBe('Before migration')
      backup.close()
    } finally {
      await removeTemporaryTestRoot(root)
    }
  })
})
