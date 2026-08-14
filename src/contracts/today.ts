import type { ActionDetailDto, ActionIdInputDto, ActionResult } from './actions'
import type { RoutineGoalSummaryDto } from './routines'

export const TODAY_CHANNELS = Object.freeze({
  selectAction: 'today:select-action',
  removeAction: 'today:remove-action',
  get: 'today:get'
} as const)

export interface TodayViewDto {
  readonly localDate: string
  readonly focuses: readonly ActionDetailDto[]
  readonly availableActions: readonly ActionDetailDto[]
  readonly plannedRoutines: readonly TodayPlannedRoutineDto[]
}

export interface TodayPlannedRoutineDto {
  readonly id: string
  readonly name: string
  readonly minimumAction: string
  readonly goal: RoutineGoalSummaryDto | null
  readonly plannedForToday: true
  readonly canRecord: true
}

export type GetTodayInputDto = Readonly<Record<string, never>>

export interface TodayApi {
  readonly selectAction: (input: ActionIdInputDto) => Promise<ActionResult<ActionDetailDto>>
  readonly removeAction: (input: ActionIdInputDto) => Promise<ActionResult<TodayViewDto>>
  readonly get: (input: GetTodayInputDto) => Promise<ActionResult<TodayViewDto>>
}
