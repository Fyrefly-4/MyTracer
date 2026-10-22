import type { ProgressRecordFactDto, RoutineProgressRecordFactDto } from './progress'

export const REVIEW_CHANNELS = Object.freeze({
  begin: 'review:begin',
  getSummary: 'review:get-summary',
  getResult: 'review:get-result',
  complete: 'review:complete',
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
export interface ReviewResultDto {
  readonly id: string
  readonly periodStartedOn: string
  readonly periodEndedOn: string
  readonly confirmedProgress: string
  readonly mainObstacle: string
  readonly nextAdjustment: string
  readonly relatedGoalId: string | null
  readonly createdAt: string
  readonly updatedAt: string
}
export type ReviewNextStepChangeDto =
  | { readonly kind: 'none' }
  | { readonly kind: 'use-existing'; readonly actionId: string }
  | {
      readonly kind: 'create-and-use'
      readonly title: string
      readonly description?: string | null
    }
export interface CompleteReviewInputDto extends ReviewContextInputDto {
  readonly confirmedProgress: string
  readonly mainObstacle: string
  readonly nextAdjustment: string
  readonly relatedGoalId: string | null
  readonly nextStepChange: ReviewNextStepChangeDto
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
  readonly confirmedUnderstandingCount: number
  readonly openConfusionCount: number
  readonly hasRecordedFacts: boolean
  readonly actionRecords: readonly Omit<ProgressRecordFactDto, 'hasRecordedText'>[]
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
  | 'validation'
  | 'context-invalid'
  | 'context-stale'
  | 'related-goal-invalid'
  | 'next-step-invalid'
  | 'persistence-failed'
export type ReviewResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false
      readonly error: { readonly code: ReviewErrorCode; readonly message: string }
    }
export interface ReviewApi {
  readonly begin: (input: BeginReviewInputDto) => Promise<ReviewResult<BeginReviewDto>>
  readonly getSummary: (input: ReviewContextInputDto) => Promise<ReviewResult<ReviewSummaryDto>>
  readonly getResult: (
    input: ReviewContextInputDto
  ) => Promise<ReviewResult<ReviewResultDto | null>>
  readonly complete: (input: CompleteReviewInputDto) => Promise<ReviewResult<ReviewResultDto>>
  readonly cancel: (
    input: ReviewContextInputDto
  ) => Promise<ReviewResult<{ readonly cancelled: true }>>
}
