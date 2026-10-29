import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createUpdateDiagnostics,
  describeUpdateError,
  describeUpdateUrl,
  UpdateDiagnostics
} from '../../src/infrastructure/update/update-diagnostics'

afterEach(() => vi.unstubAllEnvs())

describe('temporary update diagnostics', () => {
  it('drops secrets in URL credentials, queries, fragments, unknown paths and hosts', () => {
    const urls = [
      'https://user:secret@github.com/Fyrefly-4/MyTracer/releases/latest?token=secret#secret',
      'https://release-assets.githubusercontent.com/secret/installer.exe?sig=secret',
      'https://secret.invalid/path/secret',
      'https://github.com/Fyrefly-4/MyTracer/releases/download/secret/secret.exe',
      'not a URL secret'
    ]
    for (const url of urls) expect(JSON.stringify(describeUpdateUrl(url))).not.toContain('secret')
    expect(describeUpdateUrl(urls[0])).toMatchObject({
      path: '/Fyrefly-4/MyTracer/releases/latest',
      hasCredentials: true,
      hasQuery: true,
      hasFragment: true
    })
  })

  it('retains only recognized error symbols and valid numeric HTTP status', () => {
    expect(
      describeUpdateError(
        Object.assign(new Error('token=secret net::ERR_NAME_NOT_RESOLVED'), {
          code: 'ERR_UPDATER_INVALID_RELEASE_FEED',
          statusCode: 403,
          stack: 'secret'
        })
      )
    ).toEqual({
      code: 'ERR_UPDATER_INVALID_RELEASE_FEED',
      httpStatus: 403,
      networkCodes: ['ERR_NAME_NOT_RESOLVED']
    })
    expect(
      describeUpdateError({ code: 'secret', statusCode: '403 secret', message: 'net::ERR_SECRET' })
    ).toEqual({ code: '[unclassified]', httpStatus: null, networkCodes: [] })
    expect(describeUpdateError(null)).toMatchObject({ httpStatus: null })
  })

  it('bounds logging and ignores sink failures', () => {
    const sink = vi.fn()
    const diagnostics = new UpdateDiagnostics(sink)
    for (let index = 0; index < 1100; index++) diagnostics.phase('check-provider', 'started')
    expect(sink).toHaveBeenCalledTimes(1000)
    const broken = new UpdateDiagnostics(() => {
      throw new Error('secret file path')
    })
    expect(() => broken.phase('check-provider', 'started')).not.toThrow()
  })

  it('creates no default log and writes opt-in JSONL only in a temporary directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'mytracer-diagnostic-test-'))
    try {
      for (const name of ['TMPDIR', 'TMP', 'TEMP']) vi.stubEnv(name, root)
      vi.stubEnv('MYTRACER_UPDATE_DIAGNOSTICS', '')
      expect(createUpdateDiagnostics()).toBeUndefined()
      expect(readdirSync(root)).toEqual([])
      vi.stubEnv('MYTRACER_UPDATE_DIAGNOSTICS', '1')
      const diagnostics = createUpdateDiagnostics()!
      expect(readdirSync(root)).toEqual([])
      diagnostics.phase('check-provider', 'started')
      diagnostics.phase('check-provider', 'failed', { code: 'ENOTFOUND' })
      const files = readdirSync(root)
      expect(files).toHaveLength(1)
      expect(files[0]).toMatch(/^mytracer-update-diagnostics-.*\.jsonl$/)
      const rows = readFileSync(join(root, files[0]), 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
      expect(rows).toHaveLength(2)
      expect(rows[1]).toMatchObject({ result: 'failed', code: 'ENOTFOUND' })
    } finally {
      vi.unstubAllEnvs()
      rmSync(root, { recursive: true, force: true })
    }
  })
})
