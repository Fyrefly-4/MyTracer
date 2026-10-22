import type { HomeDayDto, HomeDayInputDto, HomeOverviewDto } from '../contracts/home'
import { createLocalDate } from '../domain/local-date'
import type { ClockPort } from './ports/clock'
export interface HomeQueryPort {
  overview(today: string, from: string): HomeOverviewDto
  day(date: string, page: number): HomeDayDto
}
export class HomeValidationError extends Error {}
export function homeCalendarStart(today: string): string {
  const coordinate = new Date(`${createLocalDate(today)}T12:00:00Z`)
  coordinate.setUTCDate(coordinate.getUTCDate() - ((coordinate.getUTCDay() + 6) % 7) - 25 * 7)
  return coordinate.toISOString().slice(0, 10)
}
export class HomeService {
  constructor(
    private readonly query: HomeQueryPort,
    private readonly clock: ClockPort
  ) {}
  get(): HomeOverviewDto {
    const today = this.clock.currentLocalDate()
    return this.query.overview(today, homeCalendarStart(today))
  }
  day(input: HomeDayInputDto): HomeDayDto {
    const today = this.clock.currentLocalDate()
    try {
      createLocalDate(input.date)
    } catch {
      throw new HomeValidationError()
    }
    if (
      input.date < homeCalendarStart(today) ||
      input.date > today ||
      !Number.isSafeInteger(input.page) ||
      input.page < 1 ||
      input.page > 1000000
    )
      throw new HomeValidationError()
    return this.query.day(input.date, input.page)
  }
}
