export const ACTION_CHANNELS = Object.freeze({
  create: 'actions:create',
  updateDetails: 'actions:update-details',
  complete: 'actions:complete',
  cancel: 'actions:cancel',
  reschedule: 'actions:reschedule',
  getDetail: 'actions:get-detail'
} as const)

export type ActionStatusDto = 'pending' | 'completed' | 'cancelled' | 'rescheduled'
export type ActionUnavailableReasonDto =
  'action-completed' | 'action-cancelled' | 'action-rescheduled' | 'goal-paused' | 'goal-ended'

export interface ActionGoalSummaryDto {
  readonly id: string
  readonly name: string
  readonly status: 'active' | 'paused' | 'ended'
}

export interface ActionDetailDto {
  readonly id: string
  readonly goalId: string | null
  readonly title: string
  readonly description: string | null
  readonly status: ActionStatusDto
  readonly createdAt: string
  readonly updatedAt: string
  readonly goal: ActionGoalSummaryDto | null
  readonly isCurrentNextAction: boolean
  readonly selectedForToday: boolean
  readonly todayCommitment: 'focus' | 'intention' | null
  readonly canSelectForToday: boolean
  readonly canStart: boolean
  readonly unavailableReason: ActionUnavailableReasonDto | null
}

export type CurrentNextResolutionDto =
  | { readonly kind: 'clear' }
  | { readonly kind: 'use-existing'; readonly actionId: string }
  | {
      readonly kind: 'create-and-use'
      readonly title: string
      readonly description?: string | null
    }

export interface CreateActionInputDto {
  readonly goalId?: string | null
  readonly title: string
  readonly description?: string | null
}

export interface UpdateActionDetailsInputDto {
  readonly actionId: string
  readonly title: string
  readonly description?: string | null
}

export interface ActionIdInputDto {
  readonly actionId: string
}

export interface TransitionActionInputDto extends ActionIdInputDto {
  readonly currentNextResolution?: CurrentNextResolutionDto
}

export type ActionErrorCode =
  | 'validation'
  | 'not-found'
  | 'invalid-transition'
  | 'invariant-violation'
  | 'selection-conflict'
  | 'persistence-failed'

export type ActionResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false
      readonly error: { readonly code: ActionErrorCode; readonly message: string }
    }

export interface ActionApi {
  readonly create: (input: CreateActionInputDto) => Promise<ActionResult<ActionDetailDto>>
  readonly updateDetails: (
    input: UpdateActionDetailsInputDto
  ) => Promise<ActionResult<ActionDetailDto>>
  readonly complete: (input: TransitionActionInputDto) => Promise<ActionResult<ActionDetailDto>>
  readonly cancel: (input: TransitionActionInputDto) => Promise<ActionResult<ActionDetailDto>>
  readonly reschedule: (input: TransitionActionInputDto) => Promise<ActionResult<ActionDetailDto>>
  readonly getDetail: (input: ActionIdInputDto) => Promise<ActionResult<ActionDetailDto>>
}
