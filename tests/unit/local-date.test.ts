import { describe, expect, it } from 'vitest'
import {
  addLocalDateDays,
  createLocalDate,
  decideOccurrenceDate,
  isoWeekday,
  weekContaining
} from '../../src/domain/local-date'

describe('LocalDate', () => {
  it.each([
    '2026-8-09',
    '2026-08-9',
    '2026-02-29',
    '2026-13-01',
    '0000-01-01',
    '2026-08-09T00:00:00Z'
  ])('rejects invalid or non-canonical input %s', (value) =>
    expect(() => createLocalDate(value)).toThrow(/LocalDate/)
  )

  it('accepts valid leap days without applying a time zone conversion', () => {
    expect(createLocalDate('2024-02-29')).toBe('2024-02-29')
  })

  it('adds days across month, year, and leap-year boundaries', () => {
    expect(addLocalDateDays(createLocalDate('2024-02-28'), 2)).toBe('2024-03-01')
    expect(addLocalDateDays(createLocalDate('2026-01-01'), -1)).toBe('2025-12-31')
  })

  it.each([
    ['2026-08-10', '2026-08-10', '2026-08-16'],
    ['2026-08-16', '2026-08-10', '2026-08-16'],
    ['2026-01-01', '2025-12-29', '2026-01-04'],
    ['2024-03-10', '2024-03-04', '2024-03-10']
  ])('returns the Monday-to-Sunday week containing %s', (value, monday, sunday) => {
    expect(weekContaining(createLocalDate(value))).toEqual({ monday, sunday })
  })

  it.each([
    ['2026-08-10', 1],
    ['2026-08-14', 5],
    ['2026-08-16', 7],
    ['2025-12-31', 3],
    ['2026-01-01', 4]
  ])('maps %s to ISO weekday %i', (value, weekday) => {
    expect(isoWeekday(createLocalDate(value))).toBe(weekday)
  })

  it('requires an explicit choice after the captured local date crosses midnight', () => {
    const captured = createLocalDate('2026-08-09')
    const today = createLocalDate('2026-08-10')

    expect(decideOccurrenceDate(captured, today)).toEqual({
      kind: 'requires-confirmation',
      capturedOn: captured,
      currentLocalDate: today
    })
    expect(decideOccurrenceDate(captured, today, 'keep-original')).toEqual({
      kind: 'resolved',
      choice: 'keep-original',
      occurredOn: captured
    })
    expect(decideOccurrenceDate(captured, today, 'use-today')).toEqual({
      kind: 'resolved',
      choice: 'use-today',
      occurredOn: today
    })
  })
})
