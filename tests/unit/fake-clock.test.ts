import { describe, expect, it } from 'vitest'
import { FakeClock } from '../support/fake-clock'

const initialState = {
  instant: '2026-08-08T01:00:00.000Z',
  localDate: '2026-08-08',
  timeZone: 'Asia/Shanghai'
} as const

describe('FakeClock', () => {
  it('returns only the explicit state supplied by the test', () => {
    const clock = new FakeClock(initialState)

    expect(clock.nowInstant()).toBe(initialState.instant)
    expect(clock.currentLocalDate()).toBe(initialState.localDate)
    expect(clock.currentTimeZone()).toBe(initialState.timeZone)
  })

  it('advances instant, local date, and time zone as one atomic state', () => {
    const clock = new FakeClock(initialState)
    const nextState = {
      instant: '2026-08-12T17:30:00.000Z',
      localDate: '2026-08-13',
      timeZone: 'Asia/Shanghai'
    } as const

    clock.setState(nextState)

    expect({
      instant: clock.nowInstant(),
      localDate: clock.currentLocalDate(),
      timeZone: clock.currentTimeZone()
    }).toEqual(nextState)
  })

  it('keeps separate fake instances isolated', () => {
    const first = new FakeClock(initialState)
    const second = new FakeClock(initialState)

    first.setState({
      instant: '2030-01-01T00:00:00.000Z',
      localDate: '2030-01-01',
      timeZone: 'UTC'
    })

    expect(second.nowInstant()).toBe(initialState.instant)
    expect(second.currentLocalDate()).toBe(initialState.localDate)
    expect(second.currentTimeZone()).toBe(initialState.timeZone)
  })

  it('rejects an implicit or incomplete clock state', () => {
    expect(
      () => new FakeClock({ instant: '', localDate: initialState.localDate, timeZone: 'UTC' })
    ).toThrow(/explicit instant/)
  })
})
