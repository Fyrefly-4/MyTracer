import type { LocalDate } from '../../domain/local-date'

export interface ClockSnapshot {
  readonly instant: string
  readonly localDate: LocalDate
  readonly timeZone: string
}

export interface ClockPort {
  nowInstant(): string
  currentLocalDate(): LocalDate
  currentTimeZone(): string
  snapshot(): ClockSnapshot
}
