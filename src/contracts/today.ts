import type { ActionDetailDto, ActionIdInputDto, ActionResult } from './actions'

export const TODAY_CHANNELS = Object.freeze({
  selectAction: 'today:select-action',
  removeAction: 'today:remove-action',
  get: 'today:get'
} as const)

export interface TodayViewDto {
  readonly localDate: string
  readonly focuses: readonly ActionDetailDto[]
  readonly availableActions: readonly ActionDetailDto[]
}

export type GetTodayInputDto = Readonly<Record<string, never>>

export interface TodayApi {
  readonly selectAction: (input: ActionIdInputDto) => Promise<ActionResult<ActionDetailDto>>
  readonly removeAction: (input: ActionIdInputDto) => Promise<ActionResult<TodayViewDto>>
  readonly get: (input: GetTodayInputDto) => Promise<ActionResult<TodayViewDto>>
}
