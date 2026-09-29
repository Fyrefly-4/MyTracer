import { createHash } from 'node:crypto'
import { mkdtemp, rmdir, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { verifyDownloadedPackage } from '../../src/infrastructure/update/package-integrity'

describe('T082 downloaded package integrity', () => {
  it('rejects changed bytes even when a cached package path exists', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mytracer-update-integrity-'))
    const file = join(root, 'synthetic-setup.exe')
    try {
      const valid = Buffer.from('synthetic installer bytes')
      const checksum = createHash('sha512').update(valid).digest('base64')
      await writeFile(file, valid)
      expect(await verifyDownloadedPackage(file, checksum)).toBe(true)
      await writeFile(file, Buffer.from('tampered installer bytes'))
      expect(await verifyDownloadedPackage(file, checksum)).toBe(false)
    } finally {
      await unlink(file).catch(() => undefined)
      await rmdir(root)
    }
  })
})
