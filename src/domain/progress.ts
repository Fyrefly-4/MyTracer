import { createLocalDate, type LocalDate } from './local-date'

export class ProgressDomainError extends Error {
  public constructor(
    readonly code: 'validation',
    message: string
  ) {
    super(message)
    this.name = 'ProgressDomainError'
  }
}

export interface ProgressFilter {
  readonly goalId: string | null
  readonly from: LocalDate | null
  readonly through: LocalDate | null
}

export interface ProgressRecordFact {
  readonly recordId: string
  readonly actionId: string
  readonly goalId: string | null
  readonly actionTitle: string
  readonly hasRecordedText: boolean
  readonly occurredOn: string
  readonly durationMinutes: number
  readonly outcome: 'completed' | 'partial' | 'stopped'
  readonly createdAt: string
  readonly understandings: readonly {
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

export interface RoutineProgressRecordFact {
  readonly recordId: string
  readonly routineId: string
  readonly goalId: string | null
  readonly routineName: string
  readonly occurredOn: string
  readonly outcome: 'target_met' | 'acted' | 'intentional_rest' | 'not_done'
  readonly plannedForDate: boolean
  readonly durationMinutes: number | null
  readonly note: string | null
  readonly createdAt: string
}

export interface ProgressView {
  readonly filter: ProgressFilter
  readonly totalDurationMinutes: number
  readonly realActionCount: number
  readonly targetMetCount: number
  readonly plannedTargetMetCount: number
  readonly records: readonly ProgressRecordFact[]
  readonly routineRecords: readonly RoutineProgressRecordFact[]
}

function optionalLocalDate(value: string | null | undefined): LocalDate | null {
  if (value === undefined || value === null) return null
  try {
    return createLocalDate(value)
  } catch {
    throw new ProgressDomainError('validation', 'Progress dates must be valid LocalDate values.')
  }
}

export function normalizeProgressFilter(input: {
  readonly goalId?: string | null
  readonly from?: string | null
  readonly through?: string | null
}): ProgressFilter {
  const from = optionalLocalDate(input.from)
  const through = optionalLocalDate(input.through)
  if (from && through && from > through) {
    throw new ProgressDomainError(
      'validation',
      'The Progress start date must not be later than the end date.'
    )
  }
  return Object.freeze({
    goalId: input.goalId ?? null,
    from,
    through
  })
}

export function buildProgressView(
  filter: ProgressFilter,
  records: readonly ProgressRecordFact[],
  routineRecords: readonly RoutineProgressRecordFact[] = []
): ProgressView {
  const actedRoutineRecords = routineRecords.filter(
    (record) => record.outcome === 'target_met' || record.outcome === 'acted'
  )
  const targetMetRecords = routineRecords.filter((record) => record.outcome === 'target_met')
  return Object.freeze({
    filter,
    totalDurationMinutes:
      records.reduce((total, record) => total + record.durationMinutes, 0) +
      actedRoutineRecords.reduce((total, record) => total + (record.durationMinutes ?? 0), 0),
    realActionCount: records.length + actedRoutineRecords.length,
    targetMetCount: targetMetRecords.length,
    plannedTargetMetCount: targetMetRecords.filter((record) => record.plannedForDate).length,
    records: Object.freeze([...records]),
    routineRecords: Object.freeze([...routineRecords])
  })
}
