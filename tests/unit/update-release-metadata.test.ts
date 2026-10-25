import { describe, expect, it } from 'vitest'
import { validatePublicRelease } from '../../src/infrastructure/update/release-metadata'

const checksum = Buffer.alloc(64, 7).toString('base64')
const file = { url: 'MyTracer-0.1.3-x64-setup.exe', sha512: checksum }
function release(overrides: Record<string, unknown> = {}): unknown {
  return {
    version: '0.1.3',
    tag: 'v0.1.3',
    releaseNotes: '<b>plain text only</b>',
    files: [file],
    ...overrides
  }
}

describe('public Release metadata', () => {
  it('accepts the public provider tag and exactly one full installer', () => {
    expect(validatePublicRelease(release())).toEqual({
      version: '0.1.3',
      releaseNotes: '<b>plain text only</b>',
      file: { name: file.url, sha512: checksum }
    })
  })
  it.each([
    { version: '0.1.3-beta.1' },
    { version: '0.1.4' },
    { tag: undefined },
    { tag: 'v0.1.4' },
    { tag: '../v0.1.3' },
    { tag: 'v0.1.3?token=x' },
    { files: [] },
    { files: [file, file] },
    { files: [{ ...file, sha512: 'bad' }] },
    { files: [{ ...file, url: 'https://evil.invalid/payload.exe' }] },
    { files: [{ ...file, url: '../MyTracer-0.1.3-x64-setup.exe' }] },
    { files: [{ ...file, url: 'MyTracer-0.1.3-arm64-setup.exe' }] },
    { files: [{ ...file, url: file.url + '?token=x' }] },
    { path: 'other.exe' },
    { sha512: Buffer.alloc(64, 8).toString('base64') },
    { packages: { x64: { path: 'web.7z', sha512: checksum } } }
  ])('rejects ambiguous or inconsistent metadata: %j', (overrides) => {
    expect(() => validatePublicRelease(release(overrides))).toThrow('invalid-metadata')
  })
})
