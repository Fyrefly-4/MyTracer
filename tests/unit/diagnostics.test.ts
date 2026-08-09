import { describe, expect, it, vi } from 'vitest'
import {
  SafeDiagnostics,
  type DiagnosticWriter
} from '../../src/infrastructure/diagnostics/safe-diagnostics'
import { FakeClock } from '../support/fake-clock'

const clock = new FakeClock({
  instant: '2026-08-09T08:00:00.000Z',
  localDate: '2026-08-09',
  timeZone: 'Asia/Shanghai'
})

describe('SafeDiagnostics', () => {
  it('emits only the closed diagnostic shape', () => {
    const write = vi.fn<DiagnosticWriter['write']>()
    const diagnostics = new SafeDiagnostics(clock, { write })

    diagnostics.record({
      code: 'sqlite-initialization-failed',
      severity: 'error',
      correlationId: 'startup.sqlite',
      category: 'persistence'
    })

    const serialized = JSON.stringify(write.mock.calls[0]?.[0])
    expect(JSON.parse(serialized)).toEqual({
      code: 'sqlite-initialization-failed',
      severity: 'error',
      correlationId: 'startup.sqlite',
      category: 'persistence',
      occurredAt: '2026-08-09T08:00:00.000Z'
    })
    expect(serialized).not.toMatch(
      /(?:[A-Z]:\\|API[_-]?KEY|SECRET|TOKEN|PASSWORD|credential|SELECT|userData)/i
    )
  })

  it('drops correlation IDs that could carry paths or free text without blocking the caller', () => {
    const write = vi.fn<DiagnosticWriter['write']>()
    const diagnostics = new SafeDiagnostics(clock, { write })
    expect(() =>
      diagnostics.record({
        code: 'unexpected-main-error',
        severity: 'error',
        correlationId: 'C:\\Users\\person\\secret.txt',
        category: 'unexpected'
      })
    ).not.toThrow()
    expect(write).not.toHaveBeenCalled()
  })

  it('does not let a diagnostic writer failure block the caller', () => {
    const diagnostics = new SafeDiagnostics(clock, {
      write: () => {
        throw new Error('writer unavailable')
      }
    })
    expect(() =>
      diagnostics.record({
        code: 'application-started',
        severity: 'info',
        correlationId: 'startup.complete'
      })
    ).not.toThrow()
  })

  it('does not let a diagnostic clock failure block the caller', () => {
    const diagnostics = new SafeDiagnostics(
      {
        nowInstant: () => {
          throw new Error('clock unavailable')
        },
        currentLocalDate: () => clock.currentLocalDate(),
        currentTimeZone: () => clock.currentTimeZone(),
        snapshot: () => clock.snapshot()
      },
      { write: vi.fn() }
    )
    expect(() =>
      diagnostics.record({
        code: 'application-started',
        severity: 'info',
        correlationId: 'startup.complete'
      })
    ).not.toThrow()
  })
})
