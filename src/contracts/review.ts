import type { ProgressRecordFactDto, RoutineProgressRecordFactDto } from './progress'

export const REVIEW_CHANNELS = Object.freeze({
  begin: 'review:begin',
  getSummary: 'review:get-summary',
  cancel: 'review:cancel-context'
} as const)

export type BeginReviewInputDto = Readonly<Record<string, never>>
export interface ReviewContextInputDto {
  readonly reviewContextId: string
}
export interface BeginReviewDto extends ReviewContextInputDto {
  readonly periodStartedOn: string
  readonly periodEndedOn: string
}
export interface ReviewChildFactDto {
  readonly id: string
  readonly actionRecordId: string
  readonly actionTitle: string
  readonly occurredOn: string
  readonly text: string
  readonly createdAt: string
}
export interface ReviewRoutineOutcomeFactsDto {
  readonly targetMet: readonly RoutineProgressRecordFactDto[]
  readonly acted: readonly RoutineProgressRecordFactDto[]
  readonly intentionalRest: readonly RoutineProgressRecordFactDto[]
  readonly notDone: readonly RoutineProgressRecordFactDto[]
}
export interface ReviewSummaryDto {
  readonly periodStartedOn: string
  readonly periodEndedOn: string
  readonly totalDurationMinutes: number
  readonly realActionCount: number
  readonly actionRecords: readonly ProgressRecordFactDto[]
  readonly routineRecords: readonly RoutineProgressRecordFactDto[]
  readonly understandings: readonly ReviewChildFactDto[]
  readonly openConfusions: readonly ReviewChildFactDto[]
  readonly routineOutcomeFacts: ReviewRoutineOutcomeFactsDto
  readonly routineOutcomeCounts: {
    readonly targetMet: number
    readonly acted: number
    readonly intentionalRest: number
    readonly notDone: number
  }
  readonly unknownPolicy: 'absence-is-unknown-not-counted-as-not-done'
}
export type ReviewErrorCode =
  'validation' | 'context-invalid' | 'context-stale' | 'persistence-failed'
export type ReviewResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false
      readonly error: { readonly code: ReviewErrorCode; readonly message: string }
    }
export interface ReviewApi {
  readonly begin: (input: BeginReviewInputDto) => Promise<ReviewResult<BeginReviewDto>>
  readonly getSummary: (input: ReviewContextInputDto) => Promise<ReviewResult<ReviewSummaryDto>>
  readonly cancel: (
    input: ReviewContextInputDto
  ) => Promise<ReviewResult<{ readonly cancelled: true }>>
}
