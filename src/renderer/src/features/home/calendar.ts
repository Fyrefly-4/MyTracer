/** Calendar dates are explicit local-date strings, never timestamps. UTC is used only
 * as a timezone-independent arithmetic coordinate (not to determine today's date). */
export type CalendarWeeks = 12 | 26
export interface HomeCalendarRecord {
  id: string
  type: 'action-record' | 'routine-record'
  occurredOn: string
  title: string
}
export interface CalendarDay {
  date: string
  count: number
  future: boolean
}
export interface CalendarPreferences {
  weeks: CalendarWeeks
  intensity: boolean
}
export const CALENDAR_PREFERENCES_KEY = 'mytracer.home.calendar.v1'
export const DEFAULT_CALENDAR_PREFERENCES: CalendarPreferences = { weeks: 12, intensity: false }

function dateCoordinate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid calendar date')
  const date = new Date(`${value}T12:00:00.000Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error('Invalid calendar date')
  }
  return date
}
export function addCalendarDays(value: string, amount: number): string {
  const date = dateCoordinate(value)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}
export function countCalendarRecords(records: readonly HomeCalendarRecord[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const record of records) {
    // Invalid dates must not be silently normalized into a different factual day.
    try {
      dateCoordinate(record.occurredOn)
    } catch {
      continue
    }
    counts.set(record.occurredOn, (counts.get(record.occurredOn) ?? 0) + 1)
  }
  return counts
}
export function buildCalendarDays(
  today: string,
  weeks: CalendarWeeks,
  records: readonly HomeCalendarRecord[]
): CalendarDay[] {
  const weekday = (dateCoordinate(today).getUTCDay() + 6) % 7
  const first = addCalendarDays(today, -weekday - (weeks - 1) * 7)
  const counts = countCalendarRecords(records)
  return Array.from({ length: weeks * 7 }, (_, offset) => {
    const date = addCalendarDays(first, offset)
    return { date, count: counts.get(date) ?? 0, future: date > today }
  })
}
export function calendarMonths(days: readonly CalendarDay[]) {
  const groups: { month: string; start: number; span: number }[] = []
  for (let index = 0; index < days.length; index += 7) {
    const month = days[index].date.slice(0, 7)
    const last = groups.at(-1)
    if (last?.month === month) last.span += 1
    else groups.push({ month, start: index / 7, span: 1 })
  }
  return groups.filter((group) => group.span >= 2)
}
export function visibleCalendarSelection(selected: string | null, days: readonly CalendarDay[]) {
  return selected && days.some((day) => day.date === selected && !day.future) ? selected : null
}
export function calendarLevel(count: number, intensity: boolean): number {
  return count <= 0 ? 0 : intensity ? Math.min(count, 4) : 2
}
export function parseCalendarPreferences(raw: string | null): CalendarPreferences {
  try {
    const value: unknown = JSON.parse(raw ?? 'null')
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { ...DEFAULT_CALENDAR_PREFERENCES }
    }
    const preferences = value as Record<string, unknown>
    return { weeks: preferences.weeks === 26 ? 26 : 12, intensity: preferences.intensity === true }
  } catch {
    return { ...DEFAULT_CALENDAR_PREFERENCES }
  }
}
// Storage getters themselves may throw in restricted browser contexts.
export function readCalendarPreferences(
  getStorage: () => Pick<Storage, 'getItem'> = () => window.localStorage
): CalendarPreferences {
  try {
    return parseCalendarPreferences(getStorage().getItem(CALENDAR_PREFERENCES_KEY))
  } catch {
    return { ...DEFAULT_CALENDAR_PREFERENCES }
  }
}
export function saveCalendarPreferences(
  preferences: CalendarPreferences,
  getStorage: () => Pick<Storage, 'setItem'> = () => window.localStorage
): void {
  try {
    getStorage().setItem(CALENDAR_PREFERENCES_KEY, JSON.stringify(preferences))
  } catch {
    // The current session remains usable if preferences cannot be persisted.
  }
}
