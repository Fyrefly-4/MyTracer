import { describe, expect, it } from 'vitest'
import { SystemClock } from '../../src/infrastructure/clock/system-clock'

describe('SystemClock', () => {
  it('derives the local date from local calendar fields instead of truncating the UTC instant', () => {
    const instant = new Date('2026-08-08T16:30:00.000Z')
    const clock = new SystemClock({
      now: () => instant,
      readLocalDateParts: () => ({ year: 2026, month: 8, day: 9 }),
      readTimeZone: () => 'Asia/Shanghai'
    })

    expect(clock.snapshot()).toEqual({
      instant: '2026-08-08T16:30:00.000Z',
      localDate: '2026-08-09',
      timeZone: 'Asia/Shanghai'
    })
  })

  it('captures one instant for an atomic snapshot', () => {
    let calls = 0
    const clock = new SystemClock({
      now: () => {
        calls += 1
        return new Date('2026-08-09T00:00:00.000Z')
      },
      readLocalDateParts: () => ({ year: 2026, month: 8, day: 9 }),
      readTimeZone: () => 'UTC'
    })

    expect(clock.snapshot().localDate).toBe('2026-08-09')
    expect(calls).toBe(1)
  })
})
