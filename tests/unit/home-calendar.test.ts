import { describe, expect, it } from 'vitest'
import {
  addCalendarDays,
  buildCalendarDays,
  calendarMonths,
  calendarLevel,
  countCalendarRecords,
  visibleCalendarSelection,
  parseCalendarPreferences,
  readCalendarPreferences,
  saveCalendarPreferences,
  CALENDAR_PREFERENCES_KEY,
  type HomeCalendarRecord
} from '../../src/renderer/src/features/home/calendar'

const record = (
  id: string,
  occurredOn: string,
  type: HomeCalendarRecord['type'] = 'action-record'
): HomeCalendarRecord => ({ id, occurredOn, type, title: id })

describe('Home record calendar', () => {
  it('uses 12 complete Monday–Sunday weeks ending in the current week', () => {
    const days = buildCalendarDays('2026-10-22', 12, [])
    expect(days).toHaveLength(84)
    expect(days[0].date).toBe('2026-08-03')
    expect(days.at(-1)?.date).toBe('2026-10-25')
    expect(days.filter((d) => d.future).map((d) => d.date)).toEqual([
      '2026-10-23',
      '2026-10-24',
      '2026-10-25'
    ])
    expect(buildCalendarDays('2026-10-22', 26, [])[0].date).toBe('2026-04-27')
  })
  it('handles Monday, Sunday, leap day, year and DST boundaries without timezone conversion', () => {
    expect(buildCalendarDays('2026-01-05', 12, []).at(-1)?.date).toBe('2026-01-11')
    expect(buildCalendarDays('2026-01-04', 12, []).filter((d) => d.future)).toEqual([])
    expect(addCalendarDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addCalendarDays('2024-02-29', 1)).toBe('2024-03-01')
    expect(addCalendarDays('2026-01-01', -1)).toBe('2025-12-31')
    for (const today of ['2026-03-08', '2026-03-29', '2026-10-25', '2026-11-01']) {
      const days = buildCalendarDays(today, 26, [])
      expect(new Set(days.map((d) => d.date)).size).toBe(182)
      days
        .slice(1)
        .forEach((day, index) => expect(day.date).toBe(addCalendarDays(days[index].date, 1)))
    }
    expect(() => addCalendarDays('2025-02-29', 1)).toThrow('Invalid calendar date')
    expect(() => addCalendarDays('2026-2-01', 1)).toThrow('Invalid calendar date')
  })
  it('aligns month labels with week columns and leaves narrow partial months unlabeled', () => {
    expect(calendarMonths(buildCalendarDays('2026-10-22', 12, []))).toEqual([
      { month: '2026-08', start: 0, span: 5 },
      { month: '2026-09', start: 5, span: 4 },
      { month: '2026-10', start: 9, span: 3 }
    ])
  })
  it('counts factual action and routine records equally, with no completion filter', () => {
    const records = [
      record('acted', '2026-10-21'),
      record('intentional_rest', '2026-10-21', 'routine-record'),
      record('not_done', '2026-10-21', 'routine-record'),
      record('invalid', '2026-02-30')
    ]
    expect([...countCalendarRecords(records)]).toEqual([['2026-10-21', 3]])
    const days = buildCalendarDays('2026-10-22', 12, records)
    expect(days.find((d) => d.date === '2026-10-21')?.count).toBe(3)
    expect(days.find((d) => d.date === '2026-10-22')?.count).toBe(0)
    expect([0, 1, 2, 3, 4, 8].map((n) => calendarLevel(n, true))).toEqual([0, 1, 2, 3, 4, 4])
    expect([0, 1, 8].map((n) => calendarLevel(n, false))).toEqual([0, 2, 2])
  })
  it('clears out-of-range/future selections while retaining an empty visible day', () => {
    const short = buildCalendarDays('2026-10-22', 12, [])
    const long = buildCalendarDays('2026-10-22', 26, [])
    expect(visibleCalendarSelection('2026-05-01', long)).toBe('2026-05-01')
    expect(visibleCalendarSelection('2026-05-01', short)).toBeNull()
    expect(visibleCalendarSelection('2026-10-23', short)).toBeNull()
    expect(visibleCalendarSelection('2026-10-22', short)).toBe('2026-10-22')
    expect(visibleCalendarSelection(null, short)).toBeNull()
  })
})

describe('Calendar preferences', () => {
  it('validates saved values and safely defaults malformed data', () => {
    for (const raw of [null, '', '{', 'null', '[]', '42', '{"weeks":"26","intensity":"true"}']) {
      expect(parseCalendarPreferences(raw)).toEqual({ weeks: 12, intensity: false })
    }
    expect(parseCalendarPreferences('{"weeks":26,"intensity":true}')).toEqual({
      weeks: 26,
      intensity: true
    })
    expect(parseCalendarPreferences('{"weeks":999,"intensity":true}')).toEqual({
      weeks: 12,
      intensity: true
    })
  })
  it('round-trips under the product key and tolerates blocked getters/reads/writes', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value)
      }
    }
    saveCalendarPreferences({ weeks: 26, intensity: true }, () => storage)
    expect(values.has(CALENDAR_PREFERENCES_KEY)).toBe(true)
    expect(readCalendarPreferences(() => storage)).toEqual({ weeks: 26, intensity: true })
    const blocked = () => {
      throw new Error('Blocked')
    }
    expect(readCalendarPreferences(blocked)).toEqual({ weeks: 12, intensity: false })
    expect(readCalendarPreferences(() => ({ getItem: blocked }))).toEqual({
      weeks: 12,
      intensity: false
    })
    expect(() => saveCalendarPreferences({ weeks: 12, intensity: false }, blocked)).not.toThrow()
    expect(() =>
      saveCalendarPreferences({ weeks: 12, intensity: false }, () => ({ setItem: blocked }))
    ).not.toThrow()
  })
})
