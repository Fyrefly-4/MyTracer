import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ElectronHttpExecutor } from 'electron-updater/out/electronHttpExecutor'
import { NsisUpdater } from 'electron-updater'
import { createClient } from 'electron-updater/out/providerFactory'
import { GitHubProvider } from 'electron-updater/out/providers/GitHubProvider'
import { validatePublicRelease } from '../../src/infrastructure/update/release-metadata'
import { isAllowedUpdaterUrl } from '../../src/infrastructure/update/request-policy'

const checksum = Buffer.alloc(64, 7).toString('base64')

afterEach(() => vi.unstubAllEnvs())
describe('locked public GitHub provider contract (synthetic transport)', () => {
  it.each([undefined, 'synthetic-invalid-token'])(
    'ignores ambient credentials: %s',
    async (token) => {
      for (const name of ['MYTRACER_UPDATE_TOKEN', 'GH_TOKEN', 'GITHUB_TOKEN'])
        vi.stubEnv(name, token)
      const updater = new NsisUpdater(null, {
        version: '0.1.2',
        name: 'synthetic',
        isPackaged: true,
        appUpdateConfigPath: '',
        userDataPath: '',
        baseCachePath: '',
        whenReady: async () => {},
        relaunch() {},
        quit() {},
        onQuit() {}
      })
      const request = vi.fn(
        async (options: {
          protocol: string
          hostname: string
          path: string
          headers?: Record<string, string>
        }) => {
          const url = `${options.protocol}//${options.hostname}${options.path}`
          expect(isAllowedUpdaterUrl(url)).toBe(true)
          expect(Object.keys(options.headers ?? {}).map((key) => key.toLowerCase())).not.toContain(
            'authorization'
          )
          expect(JSON.stringify(options)).not.toContain('synthetic-invalid-token')
          if (url.endsWith('.atom'))
            return '<feed><entry><title>Release</title><link href="https://github.com/Fyrefly-4/MyTracer/releases/tag/v0.1.3"/><content>Notes</content></entry></feed>'
          if (url.endsWith('/latest')) return JSON.stringify({ tag_name: 'v0.1.3' })
          if (url.endsWith('/v0.1.3/latest.yml'))
            return `version: 0.1.3\nfiles:\n  - url: MyTracer-0.1.3-x64-setup.exe\n    sha512: ${checksum}\n`
          throw new Error('Unexpected request')
        }
      )
      const provider = createClient(
        { provider: 'github', owner: 'Fyrefly-4', repo: 'MyTracer', private: false },
        updater,
        {
          platform: 'win32',
          isUseMultipleRangeRequest: false,
          executor: { request } as unknown as ElectronHttpExecutor
        }
      )
      expect(provider).toBeInstanceOf(GitHubProvider)
      const info = await provider.getLatestVersion()
      expect(validatePublicRelease(info).version).toBe('0.1.3')
      const files = provider.resolveFiles(info)
      expect(files).toHaveLength(1)
      expect(files[0].url.href).toBe(
        'https://github.com/Fyrefly-4/MyTracer/releases/download/v0.1.3/MyTracer-0.1.3-x64-setup.exe'
      )
      expect(isAllowedUpdaterUrl(files[0].url.href)).toBe(true)
      expect(provider.fileExtraDownloadHeaders).toBeNull()
      expect(request).toHaveBeenCalledTimes(3)
    }
  )
})
