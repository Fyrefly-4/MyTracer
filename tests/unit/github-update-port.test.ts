import { createHash } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  construct: vi.fn(),
  check: vi.fn(),
  download: vi.fn(),
  install: vi.fn(),
  restrict: vi.fn(),
  headers: vi.fn(),
  redirect: vi.fn(),
  requestError: vi.fn()
}))
vi.mock('electron', () => ({
  session: {
    fromPartition: () => ({
      webRequest: {
        onBeforeRequest: mocks.restrict,
        onHeadersReceived: mocks.headers,
        onBeforeRedirect: mocks.redirect,
        onErrorOccurred: mocks.requestError
      }
    })
  }
}))
vi.mock('electron-updater', () => ({
  default: {
    NsisUpdater: class {
      constructor(options: unknown) {
        mocks.construct(options, this)
      }
      checkForUpdates = mocks.check
      downloadUpdate = mocks.download
      install = mocks.install
      on = vi.fn()
      removeAllListeners = vi.fn()
    }
  }
}))
import { GithubUpdatePort } from '../../src/infrastructure/update/github-update-port'
import { UpdateDiagnostics } from '../../src/infrastructure/update/update-diagnostics'

const bytes = Buffer.from('synthetic installer; never executed')
const checksum = createHash('sha512').update(bytes).digest('base64')
const info = {
  version: '0.1.3',
  tag: 'v0.1.3',
  files: [{ url: 'MyTracer-0.1.3-x64-setup.exe', sha512: checksum }]
}
let root: string
beforeEach(async () => {
  vi.clearAllMocks()
  vi.stubEnv('MYTRACER_UPDATE_DIAGNOSTICS', '')
  root = await mkdtemp(join(tmpdir(), 'mytracer-public-update-'))
  mocks.check.mockResolvedValue({ updateInfo: info })
  mocks.download.mockResolvedValue([join(root, 'setup.exe')])
  await writeFile(join(root, 'setup.exe'), bytes)
})
afterEach(async () => {
  vi.unstubAllEnvs()
  await rm(root, { recursive: true, force: true })
})

describe('public-only update adapter', () => {
  it('keeps diagnostic observers off unless enabled', () => {
    new GithubUpdatePort({ isPackaged: true })
    expect(mocks.headers).not.toHaveBeenCalled()
    expect(mocks.redirect).not.toHaveBeenCalled()
    expect(mocks.requestError).not.toHaveBeenCalled()
  })

  it('records wrapped provider errors without changing the UI error mapping', async () => {
    const lines: string[] = []
    const port = new GithubUpdatePort({
      isPackaged: true,
      diagnostics: new UpdateDiagnostics((line) => lines.push(line))
    })
    mocks.check.mockRejectedValueOnce(
      Object.assign(new Error('secret response net::ERR_PROXY_CONNECTION_FAILED'), {
        code: 'ERR_UPDATER_INVALID_RELEASE_FEED'
      })
    )
    await expect(port.check(new AbortController().signal)).rejects.toThrow('network')
    expect(JSON.parse(lines.at(-1)!)).toMatchObject({
      stage: 'check-provider',
      result: 'failed',
      code: 'ERR_UPDATER_INVALID_RELEASE_FEED',
      networkCodes: ['ERR_PROXY_CONNECTION_FAILED']
    })
    expect(lines.join('')).not.toContain('secret response')
  })

  it('captures HTTP responses, redirects and denied paths with the original policy', () => {
    const lines: string[] = []
    new GithubUpdatePort({
      isPackaged: true,
      diagnostics: new UpdateDiagnostics((line) => lines.push(line))
    })
    const callback = vi.fn()
    const url = 'https://github.com/Fyrefly-4/MyTracer/releases/tag/v1.13.0?token=secret'
    mocks.restrict.mock.calls[0][0]({ id: 7, url }, callback)
    expect(callback).toHaveBeenLastCalledWith({ cancel: true })
    expect(JSON.parse(lines[0])).toMatchObject({
      event: 'blocked',
      requestId: 7,
      path: '/Fyrefly-4/MyTracer/releases/tag/v1.13.0',
      hasQuery: true
    })
    mocks.headers.mock.calls[0][0](
      { id: 7, url, statusCode: 403, responseHeaders: { Authorization: ['secret'] } },
      callback
    )
    expect(callback).toHaveBeenLastCalledWith({})
    expect(JSON.parse(lines[1])).toMatchObject({ event: 'response', httpStatus: 403 })
    mocks.redirect.mock.calls[0][0]({
      id: 7,
      url,
      statusCode: 302,
      redirectURL: 'https://release-assets.githubusercontent.com/private/secret?sig=secret'
    })
    expect(JSON.parse(lines[2])).toMatchObject({
      event: 'redirect',
      httpStatus: 302,
      redirect: { path: '[redacted]', hasQuery: true }
    })
    mocks.requestError.mock.calls[0][0]({ id: 7, url, error: 'net::ERR_BLOCKED_BY_CLIENT' })
    expect(JSON.parse(lines[3])).toMatchObject({
      event: 'request-error',
      networkCodes: ['ERR_BLOCKED_BY_CLIENT']
    })
    expect(lines.join('')).not.toContain('secret')
    mocks.restrict.mock.calls[0][0](
      { id: 8, url: 'https://github.com/Fyrefly-4/MyTracer/releases.atom' },
      callback
    )
    expect(callback).toHaveBeenLastCalledWith({ cancel: false })
  })

  it('distinguishes metadata and download failures, and tolerates a broken log sink', async () => {
    const lines: string[] = []
    const port = new GithubUpdatePort({
      isPackaged: true,
      diagnostics: new UpdateDiagnostics((line) => lines.push(line))
    })
    mocks.check.mockResolvedValueOnce({ updateInfo: {} })
    await expect(port.check(new AbortController().signal)).rejects.toThrow('invalid-metadata')
    expect(JSON.parse(lines.at(-1)!)).toMatchObject({
      stage: 'check-metadata',
      result: 'failed',
      code: 'invalid-metadata'
    })
    const checked = await port.check(new AbortController().signal)
    mocks.download.mockRejectedValueOnce(Object.assign(new Error('secret'), { statusCode: 503 }))
    await expect(checked.download(new AbortController().signal, vi.fn())).rejects.toThrow('network')
    expect(JSON.parse(lines.at(-1)!)).toMatchObject({
      stage: 'download-file',
      result: 'failed',
      httpStatus: 503
    })
    const broken = new GithubUpdatePort({
      isPackaged: true,
      diagnostics: new UpdateDiagnostics(() => {
        throw new Error('disk full')
      })
    })
    await expect(broken.check(new AbortController().signal)).resolves.toMatchObject({
      version: info.version
    })
    const callback = vi.fn()
    mocks.restrict.mock.calls.at(-1)![0](
      { id: 9, url: 'https://untrusted.invalid/secret' },
      callback
    )
    expect(callback).toHaveBeenCalledWith({ cancel: true })
  })
  it.each([undefined, 'synthetic-invalid-token'])(
    'checks and downloads without credentials: %s',
    async (token) => {
      for (const name of ['MYTRACER_UPDATE_TOKEN', 'GH_TOKEN', 'GITHUB_TOKEN'])
        vi.stubEnv(name, token)
      const port = new GithubUpdatePort({ isPackaged: true })
      const checked = await port.check(new AbortController().signal)
      expect(mocks.download).not.toHaveBeenCalled()
      const downloaded = await checked.download(new AbortController().signal, vi.fn())
      expect(mocks.check).toHaveBeenCalledTimes(2)
      expect(mocks.download).toHaveBeenCalledTimes(1)
      expect(mocks.install).not.toHaveBeenCalled()
      for (const [options, updater] of mocks.construct.mock.calls) {
        expect(options).toEqual({
          provider: 'github',
          owner: 'Fyrefly-4',
          repo: 'MyTracer',
          private: false
        })
        expect(updater).toMatchObject({
          autoDownload: false,
          autoInstallOnAppQuit: false,
          allowPrerelease: false,
          allowDowngrade: false,
          disableWebInstaller: true,
          disableDifferentialDownload: true
        })
      }
      expect(await downloaded.verify()).toBe(true)
      await writeFile(join(root, 'setup.exe'), 'tampered')
      expect(await downloaded.verify()).toBe(false)
    }
  )
  it('rejects changed candidates before downloading', async () => {
    const checked = await new GithubUpdatePort({ isPackaged: true }).check(
      new AbortController().signal
    )
    mocks.check.mockResolvedValueOnce({
      updateInfo: {
        ...info,
        files: [{ ...info.files[0], sha512: Buffer.alloc(64).toString('base64') }]
      }
    })
    await expect(checked.download(new AbortController().signal, vi.fn())).rejects.toThrow(
      'invalid-metadata'
    )
    expect(mocks.download).not.toHaveBeenCalled()
  })
  it('rejects corrupted downloads', async () => {
    const checked = await new GithubUpdatePort({ isPackaged: true }).check(
      new AbortController().signal
    )
    await writeFile(join(root, 'setup.exe'), 'corrupt')
    await expect(checked.download(new AbortController().signal, vi.fn())).rejects.toThrow(
      'integrity'
    )
  })
  it('does not contact the provider from an unpackaged app', async () => {
    await expect(
      new GithubUpdatePort({ isPackaged: false }).check(new AbortController().signal)
    ).rejects.toThrow('unavailable')
    expect(mocks.construct).not.toHaveBeenCalled()
  })
})
