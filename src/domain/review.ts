import {
  addLocalDateDays,
  createLocalDate,
  weekContaining,
  type LocalDate,
  type LocalDateWeek
} from './local-date'
import type { ProgressRecordFact, ProgressView, RoutineProgressRecordFact } from './progress'

export const REVIEW_UNKNOWN_POLICY = 'absence-is-unknown-not-counted-as-not-done' as const

export interface ReviewResult {
  readonly id: string
  readonly periodStartedOn: LocalDate
  readonly confirmedProgress: string
  readonly mainObstacle: string
  readonly nextAdjustment: string
  readonly relatedGoalId: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export class ReviewDomainError extends Error {
  public constructor(message: string) {
    super(message)
    this.name = 'ReviewDomainError'
  }
}

function requiredReviewText(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized) throw new ReviewDomainError(`${field} must not be blank.`)
  return normalized
}

export function reviewPeriodEndedOn(periodStartedOn: string): LocalDate {
  const startedOn = createLocalDate(periodStartedOn)
  const week = weekContaining(startedOn)
  if (week.monday !== startedOn) {
    throw new ReviewDomainError('Review period must start on Monday.')
  }
  return addLocalDateDays(startedOn, 6)
}

export function createReviewResult(input: {
  readonly id: string
  readonly periodStartedOn: string
  readonly confirmedProgress: string
  readonly mainObstacle: string
  readonly nextAdjustment: string
  readonly relatedGoalId?: string | null
  readonly now: string
}): ReviewResult {
  reviewPeriodEndedOn(input.periodStartedOn)
  return Object.freeze({
    id: requiredReviewText(input.id, 'ReviewResult id'),
    periodStartedOn: createLocalDate(input.periodStartedOn),
    confirmedProgress: requiredReviewText(input.confirmedProgress, 'Confirmed progress'),
    mainObstacle: requiredReviewText(input.mainObstacle, 'Main obstacle'),
    nextAdjustment: requiredReviewText(input.nextAdjustment, 'Next adjustment'),
    relatedGoalId: input.relatedGoalId ?? null,
    createdAt: input.now,
    updatedAt: input.now
  })
}

export function updateReviewResult(
  current: ReviewResult,
  input: {
    readonly confirmedProgress: string
    readonly mainObstacle: string
    readonly nextAdjustment: string
    readonly relatedGoalId?: string | null
    readonly now: string
  }
): ReviewResult {
  return Object.freeze({
    ...current,
    confirmedProgress: requiredReviewText(input.confirmedProgress, 'Confirmed progress'),
    mainObstacle: requiredReviewText(input.mainObstacle, 'Main obstacle'),
    nextAdjustment: requiredReviewText(input.nextAdjustment, 'Next adjustment'),
    relatedGoalId: input.relatedGoalId ?? null,
    updatedAt: input.now
  })
}

export interface ReviewUnderstandingFact {
  readonly id: string
  readonly actionRecordId: string
  readonly actionTitle: string
  readonly occurredOn: string
  readonly text: string
  readonly createdAt: string
}

export type ReviewConfusionFact = ReviewUnderstandingFact

export interface ReviewRoutineOutcomeFacts {
  readonly targetMet: readonly RoutineProgressRecordFact[]
  readonly acted: readonly RoutineProgressRecordFact[]
  readonly intentionalRest: readonly RoutineProgressRecordFact[]
  readonly notDone: readonly RoutineProgressRecordFact[]
}

export interface ReviewSummary {
  readonly periodStartedOn: LocalDate
  readonly periodEndedOn: LocalDate
  readonly totalDurationMinutes: number
  readonly realActionCount: number
  readonly confirmedUnderstandingCount: number
  readonly openConfusionCount: number
  readonly hasRecordedFacts: boolean
  readonly actionRecords: readonly Omit<ProgressRecordFact, 'note' | 'nextStep'>[]
  readonly routineRecords: readonly RoutineProgressRecordFact[]
  readonly understandings: readonly ReviewUnderstandingFact[]
  readonly openConfusions: readonly ReviewConfusionFact[]
  readonly routineOutcomeFacts: ReviewRoutineOutcomeFacts
  readonly routineOutcomeCounts: {
    readonly targetMet: number
    readonly acted: number
    readonly intentionalRest: number
    readonly notDone: number
  }
  readonly unknownPolicy: typeof REVIEW_UNKNOWN_POLICY
}

export function currentReviewPeriod(currentLocalDate: string): LocalDateWeek {
  return weekContaining(createLocalDate(currentLocalDate))
}

function childFacts(
  actionRecords: readonly ProgressRecordFact[],
  key: 'understandings' | 'openConfusions'
): readonly ReviewUnderstandingFact[] {
  return Object.freeze(
    actionRecords.flatMap((record) =>
      record[key].map((fact) =>
        Object.freeze({
          id: fact.id,
          actionRecordId: record.recordId,
          actionTitle: record.actionTitle,
          occurredOn: record.occurredOn,
          text: fact.text,
          createdAt: fact.createdAt
        })
      )
    )
  )
}

export function buildReviewSummary(period: LocalDateWeek, progress: ProgressView): ReviewSummary {
  if (
    progress.filter.goalId !== null ||
    progress.filter.from !== period.monday ||
    progress.filter.through !== period.sunday
  ) {
    throw new TypeError('Review facts must use the captured all-goal period filter.')
  }

  const outcomeFacts = Object.freeze({
    targetMet: Object.freeze(
      progress.routineRecords.filter((record) => record.outcome === 'target_met')
    ),
    acted: Object.freeze(progress.routineRecords.filter((record) => record.outcome === 'acted')),
    intentionalRest: Object.freeze(
      progress.routineRecords.filter((record) => record.outcome === 'intentional_rest')
    ),
    notDone: Object.freeze(
      progress.routineRecords.filter((record) => record.outcome === 'not_done')
    )
  })

  const understandings = childFacts(progress.records, 'understandings')
  const openConfusions = childFacts(progress.records, 'openConfusions')
  return Object.freeze({
    periodStartedOn: period.monday,
    periodEndedOn: period.sunday,
    totalDurationMinutes: progress.totalDurationMinutes,
    realActionCount: progress.realActionCount,
    confirmedUnderstandingCount: understandings.length,
    openConfusionCount: openConfusions.length,
    hasRecordedFacts: progress.records.length > 0 || progress.routineRecords.length > 0,
    actionRecords: Object.freeze(
      progress.records.map((record) =>
        Object.freeze({
          recordId: record.recordId,
          actionId: record.actionId,
          goalId: record.goalId,
          actionTitle: record.actionTitle,
          occurredOn: record.occurredOn,
          durationMinutes: record.durationMinutes,
          outcome: record.outcome,
          createdAt: record.createdAt,
          understandings: record.understandings,
          openConfusions: record.openConfusions
        })
      )
    ),
    routineRecords: Object.freeze([...progress.routineRecords]),
    understandings,
    openConfusions,
    routineOutcomeFacts: outcomeFacts,
    routineOutcomeCounts: Object.freeze({
      targetMet: outcomeFacts.targetMet.length,
      acted: outcomeFacts.acted.length,
      intentionalRest: outcomeFacts.intentionalRest.length,
      notDone: outcomeFacts.notDone.length
    }),
    unknownPolicy: REVIEW_UNKNOWN_POLICY
  })
}
