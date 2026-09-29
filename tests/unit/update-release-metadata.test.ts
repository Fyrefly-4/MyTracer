import { describe, expect, it } from 'vitest'
import { validatePrivateRelease } from '../../src/infrastructure/update/release-metadata'

const checksum = Buffer.alloc(64, 7).toString('base64')

function release(overrides: Record<string, unknown> = {}): unknown {
  return {
    version: '0.1.3',
    releaseNotes: '<b>plain text only</b>',
    files: [{ url: 'MyTracer-0.1.3-x64-setup.exe', sha512: checksum }],
    assets: [
      {
        name: 'MyTracer-0.1.3-x64-setup.exe',
        url: 'https://api.github.com/repos/Fyrefly-4/MyTracer/releases/assets/123'
      }
    ],
    ...overrides
  }
}

describe('T082 private Release metadata', () => {
  it('accepts only the fixed asset and a complete SHA-512 checksum', () => {
    expect(validatePrivateRelease(release())).toEqual({
      version: '0.1.3',
      releaseNotes: '<b>plain text only</b>',
      file: { name: 'MyTracer-0.1.3-x64-setup.exe', sha512: checksum }
    })
  })

  it.each([
    release({ version: '0.1.3-beta.1' }),
    release({ version: '0.1.4' }),
    release({ files: [{ url: 'MyTracer-0.1.3-x64-setup.exe', sha512: 'bad' }] }),
    release({
      assets: [
        {
          name: 'MyTracer-0.1.3-x64-setup.exe',
          url: 'http://api.github.com/repos/Fyrefly-4/MyTracer/releases/assets/123'
        }
      ]
    }),
    release({
      assets: [{ name: 'MyTracer-0.1.3-x64-setup.exe', url: 'https://evil.invalid/payload' }]
    }),
    release({
      assets: [
        {
          name: 'MyTracer-0.1.3-x64-setup.exe',
          url: 'https://api.github.com/repos/Other/MyTracer/releases/assets/123'
        }
      ]
    }),
    release({
      assets: [
        {
          name: 'MyTracer-0.1.3-x64-setup.exe',
          url: 'https://api.github.com/repos/Fyrefly-4/MyTracer/releases/assets/123?token=x'
        }
      ]
    }),
    release({ assets: [{ name: 'MyTracer-0.1.3-x64-setup.exe', url: 'not a url' }] })
  ])('rejects wrong version, hash or source', (value) => {
    expect(() => validatePrivateRelease(value)).toThrow('invalid-metadata')
  })
})
