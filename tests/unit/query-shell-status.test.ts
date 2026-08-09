import { describe, expect, it } from 'vitest'
import { queryShellStatus } from '../../src/application/query-shell-status'

describe('queryShellStatus', () => {
  it('keeps AI optional in the executable shell', () => {
    expect(queryShellStatus('0.1.0')).toEqual({
      appName: 'MyTracer',
      appVersion: '0.1.0',
      platform: 'windows',
      ai: {
        configured: false,
        availability: 'not-configured'
      }
    })
  })
})
