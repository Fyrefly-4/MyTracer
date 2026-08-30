import { createLocalDate, localDateParts, type LocalDate } from './local-date'
import type { ProgressView } from './progress'

export interface RecoveryGoalFact {
  readonly id: string
  readonly name: string
  readonly status: 'active' | 'paused' | 'ended'
  readonly currentNextActionId: string | null
}

export interface RecoveryActionFact {
  readonly id: string
  readonly title: string
  readonly description: string | null
  readonly status: 'pending' | 'completed' | 'cancelled' | 'rescheduled'
  readonly createdAt: string
}

export type RecoveryActionView = RecoveryActionFact

export type RecoveryLatestRealRecord =
  | {
      readonly kind: 'action'
      readonly recordId: string
      readonly subjectId: string
      readonly title: string
      readonly occurredOn: string
      readonly durationMinutes: number
      readonly outcome: 'completed' | 'partial' | 'stopped'
      readonly createdAt: string
    }
  | {
      readonly kind: 'routine'
      readonly recordId: string
      readonly subjectId: string
      readonly title: string
      readonly occurredOn: string
      readonly durationMinutes: number | null
      readonly outcome: 'target_met' | 'acted'
      readonly createdAt: string
    }

export interface RecoveryContext {
  readonly asOfLocalDate: LocalDate
  readonly goal: Omit<RecoveryGoalFact, 'currentNextActionId'>
  readonly lastRealActionOn: LocalDate | null
  readonly daysSinceLastRealAction: number | null
  readonly currentNextAction: RecoveryActionView | null
  readonly pendingActions: readonly RecoveryActionView[]
  readonly latestRealRecord: RecoveryLatestRealRecord | null
  readonly confirmedUnderstandings: readonly {
    readonly id: string
    readonly text: string
    readonly createdAt: string
  }[]
  readonly openConfusions: readonly {
    readonly id: string
    readonly text: string
    readonly createdAt: string
  }[]
}

function daysBeforeYear(year: number): number {
  const prior = year - 1
  return prior * 365 + Math.floor(prior / 4) - Math.floor(prior / 100) + Math.floor(prior / 400)
}

function localDateOrdinal(value: LocalDate): number {
  const { year, month, day } = localDateParts(value)
  const monthOffsets = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
  const leapAdjustment =
    month > 2 && year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 1 : 0
  return daysBeforeYear(year) + monthOffsets[month - 1] + leapAdjustment + day
}

export function differenceInLocalDateDays(later: LocalDate, earlier: LocalDate): number {
  return localDateOrdinal(later) - localDateOrdinal(earlier)
}

function byCreatedAtThenId<T extends { readonly createdAt: string; readonly id: string }>(
  a: T,
  b: T
): number {
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
}

function newestRecordFirst(a: RecoveryLatestRealRecord, b: RecoveryLatestRealRecord): number {
  return (
    b.occurredOn.localeCompare(a.occurredOn) ||
    b.createdAt.localeCompare(a.createdAt) ||
    a.recordId.localeCompare(b.recordId)
  )
}

function actionView(action: RecoveryActionFact): RecoveryActionView {
  return Object.freeze({ ...action })
}

export function buildRecoveryContext(input: {
  readonly asOfLocalDate: string
  readonly goal: RecoveryGoalFact
  readonly actions: readonly RecoveryActionFact[]
  readonly progress: ProgressView
}): RecoveryContext {
  const asOfLocalDate = createLocalDate(input.asOfLocalDate)
  const realRecords: RecoveryLatestRealRecord[] = [
    ...input.progress.records.map((record): RecoveryLatestRealRecord =>
      Object.freeze({
        kind: 'action',
        recordId: record.recordId,
        subjectId: record.actionId,
        title: record.actionTitle,
        occurredOn: record.occurredOn,
        durationMinutes: record.durationMinutes,
        outcome: record.outcome,
        createdAt: record.createdAt
      })
    ),
    ...input.progress.routineRecords
      .filter((record) => record.outcome === 'target_met' || record.outcome === 'acted')
      .map((record): RecoveryLatestRealRecord =>
        Object.freeze({
          kind: 'routine',
          recordId: record.recordId,
          subjectId: record.routineId,
          title: record.routineName,
          occurredOn: record.occurredOn,
          durationMinutes: record.durationMinutes,
          outcome: record.outcome as 'target_met' | 'acted',
          createdAt: record.createdAt
        })
      )
  ].sort(newestRecordFirst)
  const latestRealRecord = realRecords[0] ?? null
  const lastRealActionOn = latestRealRecord ? createLocalDate(latestRealRecord.occurredOn) : null
  const pendingActions = input.actions
    .filter((action) => action.status === 'pending')
    .sort(byCreatedAtThenId)
    .map(actionView)
  const currentNextAction =
    input.actions.find((action) => action.id === input.goal.currentNextActionId) ?? null
  const understandings = input.progress.records
    .flatMap((record) => record.understandings)
    .sort(byCreatedAtThenId)
  const confusions = input.progress.records
    .flatMap((record) => record.openConfusions)
    .sort(byCreatedAtThenId)

  return Object.freeze({
    asOfLocalDate,
    goal: Object.freeze({ id: input.goal.id, name: input.goal.name, status: input.goal.status }),
    lastRealActionOn,
    daysSinceLastRealAction: lastRealActionOn
      ? differenceInLocalDateDays(asOfLocalDate, lastRealActionOn)
      : null,
    currentNextAction: currentNextAction ? actionView(currentNextAction) : null,
    pendingActions: Object.freeze(pendingActions),
    latestRealRecord,
    confirmedUnderstandings: Object.freeze(
      understandings.map((item) => Object.freeze({ ...item }))
    ),
    openConfusions: Object.freeze(confusions.map((item) => Object.freeze({ ...item })))
  })
}
