export const PROGRESS_CHANNELS = Object.freeze({
  get: 'progress:get',
  goalActivity: 'progress:goal-activity',
  compareWeeks: 'progress:compare-weeks'
} as const)

export interface GetProgressInputDto {
  readonly goalId?: string | null
  readonly from?: string | null
  readonly through?: string | null
}

export interface ProgressFilterDto {
  readonly goalId: string | null
  readonly from: string | null
  readonly through: string | null
}

export interface ProgressChildFactDto {
  readonly id: string
  readonly text: string
  readonly createdAt: string
}

export interface ProgressRecordFactDto {
  readonly recordId: string
  readonly actionId: string
  readonly goalId: string | null
  readonly actionTitle: string
  readonly occurredOn: string
  readonly durationMinutes: number
  readonly outcome: 'completed' | 'partial' | 'stopped'
  readonly createdAt: string
  readonly understandings: readonly ProgressChildFactDto[]
  readonly openConfusions: readonly ProgressChildFactDto[]
}

export interface RoutineProgressRecordFactDto {
  readonly recordId: string
  readonly routineId: string
  readonly goalId: string | null
  readonly routineName: string
  readonly occurredOn: string
  readonly outcome: 'target_met' | 'acted' | 'intentional_rest' | 'not_done'
  readonly plannedForDate: boolean
  readonly durationMinutes: number | null
  readonly note: string | null
  readonly createdAt: string
}

export interface ProgressViewDto {
  readonly filter: ProgressFilterDto
  readonly totalDurationMinutes: number
  readonly realActionCount: number
  readonly targetMetCount: number
  readonly plannedTargetMetCount: number
  readonly records: readonly ProgressRecordFactDto[]
  readonly routineRecords: readonly RoutineProgressRecordFactDto[]
}

export type ProgressErrorCode = 'validation' | 'not-found' | 'persistence-failed'

export type ProgressResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false
      readonly error: { readonly code: ProgressErrorCode; readonly message: string }
    }

export interface ProgressApi {
  readonly get: (input: GetProgressInputDto) => Promise<ProgressResult<ProgressViewDto>>
  readonly goalActivity: (
    input: Readonly<Record<string, never>>
  ) => Promise<ProgressResult<GoalActivityViewDto>>
  readonly compareWeeks: (input: {
    readonly goalId?: string | null
  }) => Promise<ProgressResult<WeekComparisonDto>>
}

export interface GoalActivityViewDto {
  readonly asOfLocalDate: string
  readonly goals: readonly {
    readonly goalId: string
    readonly lastRealActionOn: string | null
    readonly daysSinceLastRealAction: number | null
  }[]
}

export interface WeekFactDto {
  readonly from: string
  readonly through: string
  readonly totalDurationMinutes: number
  readonly realActionCount: number
  readonly hasRecordedFacts: boolean
}

export interface WeekComparisonDto {
  readonly goalId: string | null
  readonly asOfLocalDate: string
  readonly currentWeekEndedOn: string
  readonly current: WeekFactDto
  readonly previous: WeekFactDto
  readonly difference: {
    readonly totalDurationMinutes: number
    readonly realActionCount: number
  }
}
