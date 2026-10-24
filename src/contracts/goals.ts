export const GOAL_CHANNELS = Object.freeze({
  create: 'goals:create',
  updateDetails: 'goals:update-details',
  pause: 'goals:pause',
  resume: 'goals:resume',
  end: 'goals:end',
  setCurrentNextAction: 'goals:set-current-next-action',
  createAndSetCurrentNextAction: 'goals:create-and-set-current-next-action',
  list: 'goals:list',
  getDetail: 'goals:get-detail'
} as const)

export type GoalStatusDto = 'active' | 'paused' | 'ended'
export type ActionStatusDto = 'pending' | 'completed' | 'cancelled' | 'rescheduled'

export interface GoalSummaryDto {
  readonly id: string
  readonly name: string
  readonly description: string | null
  readonly status: GoalStatusDto
  readonly currentNextActionId: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface GoalActionSummaryDto {
  readonly id: string
  readonly title: string
  readonly description: string | null
  readonly status: ActionStatusDto
  readonly isCurrentNextAction: boolean
  readonly selectedForToday: boolean
}

export interface GoalRecordSummaryDto {
  readonly id: string
  readonly actionId: string
  readonly actionTitle: string
  readonly occurredOn: string
  readonly durationMinutes: number | null
  readonly outcome: 'completed' | 'partial' | 'stopped'
  readonly nextStep: string | null
  readonly note: string | null
  readonly createdAt: string
}

export interface GoalDetailDto extends GoalSummaryDto {
  readonly currentNextAction: GoalActionSummaryDto | null
  readonly actions: readonly GoalActionSummaryDto[]
  readonly records: readonly GoalRecordSummaryDto[]
}

export interface CreateGoalInputDto {
  readonly name: string
  readonly description?: string | null
  readonly initialNextAction?: {
    readonly title: string
    readonly description?: string | null
  } | null
}

export interface UpdateGoalDetailsInputDto {
  readonly goalId: string
  readonly name: string
  readonly description?: string | null
}

export interface GoalIdInputDto {
  readonly goalId: string
}

export interface SetGoalCurrentNextActionInputDto {
  readonly goalId: string
  readonly actionId: string | null
}

export interface CreateAndSetGoalCurrentNextActionInputDto {
  readonly goalId: string
  readonly title: string
  readonly description?: string | null
}

export interface ListGoalsInputDto {
  readonly status?: GoalStatusDto | null
}

export type GoalErrorCode =
  'validation' | 'not-found' | 'invalid-transition' | 'invariant-violation' | 'persistence-failed'

export type GoalResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false
      readonly error: { readonly code: GoalErrorCode; readonly message: string }
    }

export interface GoalApi {
  readonly create: (input: CreateGoalInputDto) => Promise<GoalResult<GoalDetailDto>>
  readonly updateDetails: (input: UpdateGoalDetailsInputDto) => Promise<GoalResult<GoalSummaryDto>>
  readonly pause: (input: GoalIdInputDto) => Promise<GoalResult<GoalSummaryDto>>
  readonly resume: (input: GoalIdInputDto) => Promise<GoalResult<GoalSummaryDto>>
  readonly end: (input: GoalIdInputDto) => Promise<GoalResult<GoalSummaryDto>>
  readonly setCurrentNextAction: (
    input: SetGoalCurrentNextActionInputDto
  ) => Promise<GoalResult<GoalSummaryDto>>
  readonly createAndSetCurrentNextAction: (
    input: CreateAndSetGoalCurrentNextActionInputDto
  ) => Promise<GoalResult<GoalDetailDto>>
  readonly list: (input: ListGoalsInputDto) => Promise<GoalResult<readonly GoalSummaryDto[]>>
  readonly getDetail: (input: GoalIdInputDto) => Promise<GoalResult<GoalDetailDto>>
}
