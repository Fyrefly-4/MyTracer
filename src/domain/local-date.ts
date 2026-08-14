declare const localDateBrand: unique symbol

export type LocalDate = string & { readonly [localDateBrand]: true }
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

export interface LocalDateParts {
  readonly year: number
  readonly month: number
  readonly day: number
}

export interface LocalDateWeek {
  readonly monday: LocalDate
  readonly sunday: LocalDate
}

export type OccurrenceDateChoice = 'keep-original' | 'use-today'

export type OccurrenceDateDecision =
  | { readonly kind: 'unchanged'; readonly occurredOn: LocalDate }
  | {
      readonly kind: 'requires-confirmation'
      readonly capturedOn: LocalDate
      readonly currentLocalDate: LocalDate
    }
  | {
      readonly kind: 'resolved'
      readonly choice: OccurrenceDateChoice
      readonly occurredOn: LocalDate
    }

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

export function localDateFromParts(parts: LocalDateParts): LocalDate {
  const { year, month, day } = parts
  if (
    !Number.isInteger(year) ||
    year < 1 ||
    year > 9999 ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    !Number.isInteger(day) ||
    day < 1 ||
    day > daysInMonth(year, month)
  ) {
    throw new TypeError('LocalDate parts must describe a valid Gregorian calendar date.')
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` as LocalDate
}

export function createLocalDate(value: string): LocalDate {
  const match = LOCAL_DATE_PATTERN.exec(value)
  if (!match) {
    throw new TypeError('LocalDate must use the exact YYYY-MM-DD format.')
  }

  const parsed = localDateFromParts({
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  })
  if (parsed !== value) {
    throw new TypeError('LocalDate must use its canonical YYYY-MM-DD representation.')
  }
  return parsed
}

export function localDateParts(value: LocalDate): LocalDateParts {
  return {
    year: Number(value.slice(0, 4)),
    month: Number(value.slice(5, 7)),
    day: Number(value.slice(8, 10))
  }
}

export function addLocalDateDays(value: LocalDate, amount: number): LocalDate {
  if (!Number.isInteger(amount)) {
    throw new TypeError('LocalDate day offsets must be integers.')
  }

  let { year, month, day } = localDateParts(value)
  const step = Math.sign(amount)
  for (let remaining = Math.abs(amount); remaining > 0; remaining -= 1) {
    day += step
    if (day > daysInMonth(year, month)) {
      day = 1
      month += 1
      if (month > 12) {
        month = 1
        year += 1
      }
    } else if (day < 1) {
      month -= 1
      if (month < 1) {
        month = 12
        year -= 1
      }
      day = daysInMonth(year, month)
    }
  }

  return localDateFromParts({ year, month, day })
}

export function isoWeekday(value: LocalDate): IsoWeekday {
  const { month, day } = localDateParts(value)
  let { year } = localDateParts(value)
  const offsets = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4]
  if (month < 3) {
    year -= 1
  }
  const sundayBased =
    (year +
      Math.floor(year / 4) -
      Math.floor(year / 100) +
      Math.floor(year / 400) +
      offsets[month - 1] +
      day) %
    7
  return (sundayBased === 0 ? 7 : sundayBased) as IsoWeekday
}

export function weekContaining(value: LocalDate): LocalDateWeek {
  const weekday = isoWeekday(value)
  return Object.freeze({
    monday: addLocalDateDays(value, 1 - weekday),
    sunday: addLocalDateDays(value, 7 - weekday)
  })
}

export function decideOccurrenceDate(
  capturedOn: LocalDate,
  currentLocalDate: LocalDate,
  choice?: OccurrenceDateChoice
): OccurrenceDateDecision {
  if (capturedOn === currentLocalDate) {
    return Object.freeze({ kind: 'unchanged', occurredOn: capturedOn })
  }
  if (!choice) {
    return Object.freeze({ kind: 'requires-confirmation', capturedOn, currentLocalDate })
  }
  return Object.freeze({
    kind: 'resolved',
    choice,
    occurredOn: choice === 'keep-original' ? capturedOn : currentLocalDate
  })
}
