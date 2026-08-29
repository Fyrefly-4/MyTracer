import { createLocalDate, weekContaining, type LocalDate, type LocalDateWeek } from './local-date'
import type { ProgressRecordFact, ProgressView, RoutineProgressRecordFact } from './progress'

export const REVIEW_UNKNOWN_POLICY = 'absence-is-unknown-not-counted-as-not-done' as const

export interface ReviewUnderstandingFact {
  readonly id: string
  readonly actionRecordId: string
  readonly actionTitle: string
  readonly occurredOn: string
  readonly text: string
  readonly createdAt: string
}

export interface ReviewConfusionFact extends ReviewUnderstandingFact {}

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
  readonly actionRecords: readonly ProgressRecordFact[]
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

  return Object.freeze({
    periodStartedOn: period.monday,
    periodEndedOn: period.sunday,
    totalDurationMinutes: progress.totalDurationMinutes,
    realActionCount: progress.realActionCount,
    actionRecords: Object.freeze([...progress.records]),
    routineRecords: Object.freeze([...progress.routineRecords]),
    understandings: childFacts(progress.records, 'understandings'),
    openConfusions: childFacts(progress.records, 'openConfusions'),
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
