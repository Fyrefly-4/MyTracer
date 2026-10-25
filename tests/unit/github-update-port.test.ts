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
  restrict: vi.fn()
}))
vi.mock('electron', () => ({
  session: { fromPartition: () => ({ webRequest: { onBeforeRequest: mocks.restrict } }) }
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
