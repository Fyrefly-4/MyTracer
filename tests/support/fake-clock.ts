import type { ClockPort, ClockSnapshot } from '../../src/application/ports/clock'
import { createLocalDate, type LocalDate } from '../../src/domain/local-date'

export interface FakeClockState {
  readonly instant: string
  readonly localDate: string
  readonly timeZone: string
}

function copyState(state: FakeClockState): ClockSnapshot {
  if (!state.instant || !state.localDate || !state.timeZone) {
    throw new TypeError('FakeClock requires explicit instant, localDate, and timeZone values.')
  }

  return Object.freeze({ ...state, localDate: createLocalDate(state.localDate) })
}

export class FakeClock implements ClockPort {
  private state: ClockSnapshot

  public constructor(initialState: FakeClockState) {
    this.state = copyState(initialState)
  }

  public nowInstant(): string {
    return this.state.instant
  }

  public currentLocalDate(): LocalDate {
    return this.state.localDate
  }

  public currentTimeZone(): string {
    return this.state.timeZone
  }

  public setState(nextState: FakeClockState): void {
    this.state = copyState(nextState)
  }

  public snapshot(): ClockSnapshot {
    return Object.freeze({ ...this.state })
  }
}
