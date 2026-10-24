import type { ActionDetailDto, ActionIdInputDto, ActionResult } from './actions'
import type { RoutineGoalSummaryDto } from './routines'
import type { RoutineRecordDto, RoutineRecordStateDto } from './routine-records'

export const TODAY_CHANNELS = Object.freeze({
  selectAction: 'today:select-action',
  selectActionAsIntention: 'today:select-action-as-intention',
  removeAction: 'today:remove-action',
  removeActionIntention: 'today:remove-action-intention',
  changeActionCommitment: 'today:change-action-commitment',
  get: 'today:get'
} as const)

export type TodayCommitmentDto = 'focus' | 'intention'

export interface TodayActionItemDto extends ActionDetailDto {
  readonly commitment: TodayCommitmentDto
}

export interface TodayViewDto {
  readonly localDate: string
  readonly focuses: readonly TodayActionItemDto[]
  readonly intentions: readonly TodayActionItemDto[]
  readonly availableActions: readonly ActionDetailDto[]
  readonly plannedRoutines: readonly TodayPlannedRoutineDto[]
  readonly unscheduledRoutines: readonly TodayPlannedRoutineDto[]
}

export interface TodayPlannedRoutineDto {
  readonly id: string
  readonly name: string
  readonly minimumAction: string
  readonly goal: RoutineGoalSummaryDto | null
  readonly plannedForToday: boolean
  readonly canRecord: true
  readonly recordState: RoutineRecordStateDto
  readonly record: RoutineRecordDto | null
}

export type GetTodayInputDto = Readonly<Record<string, never>>

export interface ChangeActionTodayCommitmentInputDto extends ActionIdInputDto {
  readonly commitment: TodayCommitmentDto
}

export interface TodayApi {
  readonly selectAction: (input: ActionIdInputDto) => Promise<ActionResult<ActionDetailDto>>
  readonly selectActionAsIntention: (
    input: ActionIdInputDto
  ) => Promise<ActionResult<ActionDetailDto>>
  readonly removeAction: (input: ActionIdInputDto) => Promise<ActionResult<TodayViewDto>>
  readonly removeActionIntention: (input: ActionIdInputDto) => Promise<ActionResult<TodayViewDto>>
  readonly changeActionCommitment: (
    input: ChangeActionTodayCommitmentInputDto
  ) => Promise<ActionResult<ActionDetailDto>>
  readonly get: (input: GetTodayInputDto) => Promise<ActionResult<TodayViewDto>>
}
