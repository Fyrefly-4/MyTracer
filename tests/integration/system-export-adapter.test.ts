import { open, readFile, rename, stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildCompleteExport } from '../../src/application/complete-export'
import type { ExportFileOperations } from '../../src/infrastructure/export/system-export-adapter'
import { SystemExportAdapter } from '../../src/infrastructure/export/system-export-adapter'
import { FakeClock } from '../support/fake-clock'
import {
  createTemporaryTestRoot,
  removeTemporaryTestRoot,
  type TemporaryTestRoot
} from '../support/temporary-test-root'

const roots: TemporaryTestRoot[] = []
const instant = '2026-08-20T08:00:00.000Z'
const document = () =>
  buildCompleteExport(
    {
      sourceDataVersion: 2,
      coreSnapshot: {
        goals: [],
        actions: [],
        routines: [],
        routineScheduleDays: [],
        todaySelections: [],
        actionRecords: [],
        routineRecords: [],
        understandings: [],
        confusions: [],
        reviewResults: []
      }
    },
    new FakeClock({ instant, localDate: '2026-08-20', timeZone: 'Asia/Shanghai' })
  )

function operations(overrides: Partial<ExportFileOperations> = {}): ExportFileOperations {
  return {
    openExclusive: (path) => open(path, 'wx'),
    readFile,
    stat,
    rename,
    unlink,
    ...overrides
  }
}

afterEach(async () => Promise.all(roots.splice(0).map(removeTemporaryTestRoot)))

describe('system export adapter', () => {
  it('writes UTF-8 JSON through an owned sibling and returns no path', async () => {
    const root = await createTemporaryTestRoot()
    roots.push(root)
    const destination = join(root.exports, 'backup.json')
    const adapter = new SystemExportAdapter({
      dialog: { showSaveDialog: async () => ({ canceled: false, filePath: destination }) },
      generateToken: () => 'owned'
    })
    await expect(adapter.deliverCompleteExport(document(), 'suggested.json')).resolves.toEqual({
      kind: 'exported',
      fileName: 'backup.json',
      byteLength: expect.any(Number)
    })
    const bytes = await readFile(destination)
    expect(bytes.subarray(0, 3)).not.toEqual(Buffer.from([0xef, 0xbb, 0xbf]))
    expect(JSON.parse(bytes.toString('utf8'))).toMatchObject({
      exportVersion: 1,
      sourceDataVersion: 2
    })
    await expect(stat(join(root.exports, '.backup.json.owned.tmp'))).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })

  it('returns cancelled before file operations', async () => {
    const adapter = new SystemExportAdapter({
      dialog: { showSaveDialog: async () => ({ canceled: true }) },
      generateToken: () => 'unused',
      files: operations({
        openExclusive: async () => {
          throw new Error('must not write')
        }
      })
    })
    await expect(adapter.deliverCompleteExport(document(), 'suggested.json')).resolves.toEqual({
      kind: 'cancelled'
    })
  })

  it('cleans only its temporary sibling and preserves an existing destination on each delivery failure', async () => {
    const root = await createTemporaryTestRoot()
    roots.push(root)
    const destination = join(root.exports, 'existing.json')
    await open(destination, 'w').then(async (handle) => {
      await handle.writeFile('old-valid-export')
      await handle.close()
    })
    const adapter = new SystemExportAdapter({
      dialog: { showSaveDialog: async () => ({ canceled: false, filePath: destination }) },
      generateToken: () => 'failure',
      files: operations({
        rename: async () => {
          const error = Object.assign(new Error('not supported'), { code: 'EPERM' })
          throw error
        }
      })
    })
    await expect(adapter.deliverCompleteExport(document(), 'suggested.json')).rejects.toMatchObject(
      { code: 'replace-not-supported' }
    )
    await expect(readFile(destination, 'utf8')).resolves.toBe('old-valid-export')
    await expect(stat(join(root.exports, '.existing.json.failure.tmp'))).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })

  it('does not replace a destination that changes after the dialog returns', async () => {
    const root = await createTemporaryTestRoot()
    roots.push(root)
    const destination = join(root.exports, 'changed.json')
    let reads = 0
    const adapter = new SystemExportAdapter({
      dialog: { showSaveDialog: async () => ({ canceled: false, filePath: destination }) },
      generateToken: () => 'changed',
      files: operations({
        readFile: async (path) => {
          reads += 1
          if (reads === 1)
            await open(destination, 'w').then(async (handle) => {
              await handle.writeFile('new-existing')
              await handle.close()
            })
          return readFile(path)
        }
      })
    })
    await expect(adapter.deliverCompleteExport(document(), 'suggested.json')).rejects.toMatchObject(
      { code: 'destination-changed' }
    )
    await expect(readFile(destination, 'utf8')).resolves.toBe('new-existing')
  })

  for (const phase of ['open', 'write', 'sync', 'close', 'read', 'parse-and-validate'] as const) {
    it(`preserves an existing target and cleans the owned sibling when ${phase} fails`, async () => {
      const root = await createTemporaryTestRoot()
      roots.push(root)
      const destination = join(root.exports, `${phase}.json`)
      await open(destination, 'w').then(async (handle) => {
        await handle.writeFile('old-valid-export')
        await handle.close()
      })
      const files = operations({
        openExclusive: async (path) => {
          if (phase === 'open') throw new Error('open failure')
          const handle = await open(path, 'wx')
          return {
            writeFile:
              phase === 'write'
                ? async () => {
                    throw new Error('write failure')
                  }
                : (data) => handle.writeFile(data),
            sync:
              phase === 'sync'
                ? async () => {
                    throw new Error('sync failure')
                  }
                : () => handle.sync(),
            close:
              phase === 'close'
                ? async () => {
                    await handle.close()
                    throw new Error('close failure')
                  }
                : () => handle.close()
          }
        },
        readFile:
          phase === 'read'
            ? async () => {
                throw new Error('read failure')
              }
            : phase === 'parse-and-validate'
              ? async () => Buffer.from('{"format":"not-valid"}', 'utf8')
              : readFile
      })
      const adapter = new SystemExportAdapter({
        dialog: { showSaveDialog: async () => ({ canceled: false, filePath: destination }) },
        generateToken: () => phase,
        files
      })
      await expect(
        adapter.deliverCompleteExport(document(), 'suggested.json')
      ).rejects.toMatchObject({
        code: phase === 'parse-and-validate' ? 'export-validation-failed' : 'write-failed'
      })
      await expect(readFile(destination, 'utf8')).resolves.toBe('old-valid-export')
      await expect(stat(join(root.exports, `.${phase}.json.${phase}.tmp`))).rejects.toMatchObject({
        code: 'ENOENT'
      })
    })
  }
})
