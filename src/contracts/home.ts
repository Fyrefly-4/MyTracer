import type { GoalSummaryDto } from './goals'
export const HOME_CHANNELS = Object.freeze({ get: 'home:get', day: 'home:day' } as const)
export interface HomeRecordDto {
  readonly id: string
  readonly type: 'action-record' | 'routine-record'
  readonly occurredOn: string
  readonly title: string
  readonly goalId: string | null
  readonly summary: string | null
  readonly hasNote: boolean
  readonly outcome:
    'completed' | 'partial' | 'stopped' | 'target_met' | 'acted' | 'intentional_rest' | 'not_done'
  readonly durationMinutes: number | null
}
export interface HomeOverviewDto {
  readonly localDate: string
  readonly goals: readonly GoalSummaryDto[]
  readonly activeGoalCount: number
  readonly totalGoalCount: number
  readonly latestByGoal: readonly HomeRecordDto[]
  readonly recentRecords: readonly HomeRecordDto[]
  readonly currentActions: readonly {
    id: string
    goalId: string | null
    title: string
    status: 'pending' | 'completed' | 'cancelled' | 'rescheduled'
  }[]
  readonly calendarCounts: readonly { date: string; count: number }[]
}
export interface HomeDayDto {
  readonly records: readonly HomeRecordDto[]
  readonly total: number
}
export interface HomeDayInputDto {
  readonly date: string
  readonly page: number
}
export type HomeResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false
      readonly error: {
        readonly code: 'validation' | 'persistence-failed'
        readonly message: string
      }
    }
export interface HomeApi {
  readonly get: (input: Readonly<Record<string, never>>) => Promise<HomeResult<HomeOverviewDto>>
  readonly day: (input: HomeDayInputDto) => Promise<HomeResult<HomeDayDto>>
}
