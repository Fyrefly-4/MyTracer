import { describe, expect, it } from 'vitest'
import { isAllowedUpdaterUrl } from '../../src/infrastructure/update/request-policy'

describe('T082 updater request policy', () => {
  it.each([
    'https://api.github.com/repos/Fyrefly-4/MyTracer/releases/latest',
    'https://api.github.com/repos/Fyrefly-4/MyTracer/releases/assets/123',
    'https://github.com/Fyrefly-4/MyTracer/releases/download/v0.1.3/MyTracer-0.1.3-x64-setup.exe',
    'https://release-assets.githubusercontent.com/signed-download?token=synthetic'
  ])('allows the fixed source and known GitHub asset hosts', (url) => {
    expect(isAllowedUpdaterUrl(url)).toBe(true)
  })

  it.each([
    'http://api.github.com/repos/Fyrefly-4/MyTracer/releases/latest',
    'https://api.github.com/repos/Other/MyTracer/releases/latest',
    'https://api.github.com/repos/Fyrefly-4/MyTracer/issues',
    'https://api.github.com/repos/Fyrefly-4/MyTracer/releases/assets/abc',
    'https://github.com/Other/MyTracer/releases/download/v0.1.3/setup.exe',
    'https://evil.invalid/file',
    'https://user:pass@api.github.com/repos/Fyrefly-4/MyTracer/releases/latest',
    'not a url'
  ])('rejects non-source requests and redirects', (url) => {
    expect(isAllowedUpdaterUrl(url)).toBe(false)
  })
})
