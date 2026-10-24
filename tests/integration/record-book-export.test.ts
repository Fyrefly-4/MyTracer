import { open, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  SystemExportAdapter,
  type ExportFileOperations
} from '../../src/infrastructure/export/system-export-adapter'
import {
  createTemporaryTestRoot,
  removeTemporaryTestRoot,
  type TemporaryTestRoot
} from '../support/temporary-test-root'
import { SqliteConnection } from '../../src/infrastructure/sqlite/sqlite-connection'
import { RecordBookService } from '../../src/application/record-book-service'
import { FakeClock } from '../support/fake-clock'
const roots: TemporaryTestRoot[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(removeTemporaryTestRoot))
})
const snapshot = { book: { months: [], exclusions: [] }, readAt: '2026-01-01T00:00:00.000Z' }
function operations(overrides: Partial<ExportFileOperations> = {}): ExportFileOperations {
  return { openExclusive: (path) => open(path, 'wx'), readFile, stat, rename, unlink, ...overrides }
}
describe('record book safe delivery', () => {
  it('supports repeated cancellation then successful self-contained HTML delivery', async () => {
    const root = await createTemporaryTestRoot()
    roots.push(root)
    const path = join(root.exports, 'book.html')
    let calls = 0
    const adapter = new SystemExportAdapter({
      dialog: {
        showSaveDialog: async (options) => {
          expect(options.filters).toEqual([{ name: 'HTML', extensions: ['html'] }])
          return ++calls <= 2 ? { canceled: true } : { canceled: false, filePath: path }
        }
      },
      generateToken: () => 'owned'
    })
    expect(await adapter.deliverRecordBook(snapshot, 'book.html')).toEqual({ kind: 'cancelled' })
    expect(await adapter.deliverRecordBook(snapshot, 'book.html')).toEqual({ kind: 'cancelled' })
    expect(await readdir(root.exports)).toEqual([])
    expect(await adapter.deliverRecordBook(snapshot, 'book.html')).toMatchObject({
      kind: 'exported',
      fileName: 'book.html'
    })
    expect(await readFile(path, 'utf8')).toContain('固定导出时间 2026-01-01T00:00:00.000Z')
    expect(await readdir(root.exports)).toEqual(['book.html'])
  })
  it('preserves destinations and cleans its temp file on corruption, destination change and failed replacement', async () => {
    for (const failure of ['corrupt', 'changed', 'replace', 'write'] as const) {
      const root = await createTemporaryTestRoot()
      roots.push(root)
      const path = join(root.exports, 'book.html')
      await writeFile(path, 'existing')
      const files = operations({
        readFile: async (temporary) => {
          if (failure === 'corrupt') return Buffer.from('corrupt')
          if (failure === 'changed') await writeFile(path, 'externally changed destination')
          return readFile(temporary)
        },
        rename: async (from, to) => {
          if (failure === 'replace') throw Object.assign(new Error('private'), { code: 'EPERM' })
          await rename(from, to)
        },
        openExclusive: async (temporary) => {
          const handle = await open(temporary, 'wx')
          if (failure !== 'write') return handle
          return {
            writeFile: async () => {
              throw new Error('private')
            },
            sync: () => handle.sync(),
            close: () => handle.close()
          }
        }
      })
      const adapter = new SystemExportAdapter({
        dialog: { showSaveDialog: async () => ({ canceled: false, filePath: path }) },
        generateToken: () => 'owned',
        files
      })
      await expect(adapter.deliverRecordBook(snapshot, 'book.html')).rejects.toMatchObject({
        code: {
          corrupt: 'export-validation-failed',
          changed: 'destination-changed',
          replace: 'replace-not-supported',
          write: 'write-failed'
        }[failure]
      })
      expect(await readFile(path, 'utf8')).toBe(
        failure === 'changed' ? 'externally changed destination' : 'existing'
      )
      expect(await readdir(root.exports)).toEqual(['book.html'])
    }
  })
  it('reads real SQLite facts freshly without mutating the database and exports all months', async () => {
    const root = await createTemporaryTestRoot()
    roots.push(root)
    const connection = SqliteConnection.open(join(root.database, 'book.sqlite3'))
    try {
      connection.transaction((repository) => {
        repository.saveAction({
          id: 'a',
          title: '合成原文',
          description: null,
          goalId: null,
          status: 'pending',
          createdAt: snapshot.readAt,
          updatedAt: snapshot.readAt
        })
        for (const [index, date] of ['2024-12-31', '2026-01-01'].entries())
          repository.saveActionRecord({
            id: `r${index}`,
            actionId: 'a',
            occurredOn: date,
            durationMinutes: index === 0 ? null : 0,
            outcome: 'partial',
            summary: null,
            note: '</script> 合成文字',
            nextStep: null,
            createdAt: snapshot.readAt,
            updatedAt: snapshot.readAt
          })
      })
      const destination = join(root.exports, 'book.html')
      const service = new RecordBookService({
        repository: connection.repository,
        clock: new FakeClock({
          instant: snapshot.readAt,
          localDate: '2026-01-01',
          timeZone: 'Asia/Shanghai'
        }),
        delivery: new SystemExportAdapter({
          dialog: { showSaveDialog: async () => ({ canceled: false, filePath: destination }) },
          generateToken: () => 'owned'
        })
      })
      const before = connection.repository.readSnapshot()
      expect(service.read().book.months).toHaveLength(2)
      await expect(service.export()).resolves.toMatchObject({
        kind: 'exported',
        exportedAt: snapshot.readAt
      })
      const html = await readFile(destination, 'utf8')
      expect(html).toContain('2024年12月')
      expect(html).toContain('2026年1月')
      expect(html).toContain('&lt;/script&gt; 合成文字')
      expect(html).toContain('0 分钟')
      expect(html).toContain('未记录')
      expect(connection.repository.readSnapshot()).toEqual(before)
      connection.transaction((repository) =>
        repository.saveAction({ ...before.actions[0], title: '当前更名' })
      )
      expect(service.read().book.months[0].days[0].entries[0].title).toBe('当前更名')
    } finally {
      connection.close()
    }
  })
})
