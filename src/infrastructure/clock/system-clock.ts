import type { ClockPort, ClockSnapshot } from '../../application/ports/clock'
import { localDateFromParts, type LocalDate, type LocalDateParts } from '../../domain/local-date'

export interface SystemClockDependencies {
  readonly now?: () => Date
  readonly readLocalDateParts?: (instant: Date) => LocalDateParts
  readonly readTimeZone?: () => string
}

function defaultLocalDateParts(instant: Date): LocalDateParts {
  return {
    year: instant.getFullYear(),
    month: instant.getMonth() + 1,
    day: instant.getDate()
  }
}

function defaultTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export class SystemClock implements ClockPort {
  private readonly now: () => Date
  private readonly readLocalDateParts: (instant: Date) => LocalDateParts
  private readonly readTimeZone: () => string

  public constructor(dependencies: SystemClockDependencies = {}) {
    this.now = dependencies.now ?? (() => new Date())
    this.readLocalDateParts = dependencies.readLocalDateParts ?? defaultLocalDateParts
    this.readTimeZone = dependencies.readTimeZone ?? defaultTimeZone
  }

  private capture(): ClockSnapshot {
    const instant = this.now()
    if (Number.isNaN(instant.getTime())) {
      throw new TypeError('SystemClock received an invalid instant.')
    }
    const timeZone = this.readTimeZone()
    if (!timeZone) {
      throw new TypeError('SystemClock requires a non-empty time zone.')
    }
    return Object.freeze({
      instant: instant.toISOString(),
      localDate: localDateFromParts(this.readLocalDateParts(instant)),
      timeZone
    })
  }

  public nowInstant(): string {
    return this.capture().instant
  }

  public currentLocalDate(): LocalDate {
    return this.capture().localDate
  }

  public currentTimeZone(): string {
    return this.capture().timeZone
  }

  public snapshot(): ClockSnapshot {
    return this.capture()
  }
}
