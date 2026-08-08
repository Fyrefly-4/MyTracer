export interface FakeClockState {
  readonly instant: string
  readonly localDate: string
  readonly timeZone: string
}

function copyState(state: FakeClockState): FakeClockState {
  if (!state.instant || !state.localDate || !state.timeZone) {
    throw new TypeError('FakeClock requires explicit instant, localDate, and timeZone values.')
  }

  return Object.freeze({ ...state })
}

export class FakeClock {
  private state: FakeClockState

  public constructor(initialState: FakeClockState) {
    this.state = copyState(initialState)
  }

  public nowInstant(): string {
    return this.state.instant
  }

  public currentLocalDate(): string {
    return this.state.localDate
  }

  public currentTimeZone(): string {
    return this.state.timeZone
  }

  public setState(nextState: FakeClockState): void {
    this.state = copyState(nextState)
  }
}
