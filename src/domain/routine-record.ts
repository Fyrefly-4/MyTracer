import { createLocalDate, type LocalDate } from './local-date'

export type RoutineRecordOutcome = 'target_met' | 'acted' | 'intentional_rest' | 'not_done'
export type RoutineRecordState = RoutineRecordOutcome | 'unknown'
export type RoutinePlannedForDateBasis = 'schedule_at_recording' | 'user_confirmed_history'

export interface RoutineRecord {
  readonly id: string
  readonly routineId: string
  readonly occurredOn: LocalDate
  readonly outcome: RoutineRecordOutcome
  readonly plannedForDate: boolean
  readonly plannedForDateBasis: RoutinePlannedForDateBasis
  readonly durationMinutes: number | null
  readonly note: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export class RoutineRecordDomainError extends Error {
  public constructor(
    readonly code: 'validation',
    message: string
  ) {
    super(message)
    this.name = 'RoutineRecordDomainError'
  }
}

function requiredText(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized) {
    throw new RoutineRecordDomainError('validation', `${field} must not be blank.`)
  }
  return normalized
}

function optionalText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const normalized = value.trim()
  return normalized || null
}

function normalizeDuration(
  outcome: RoutineRecordOutcome,
  value: number | null | undefined
): number | null {
  if (outcome === 'intentional_rest' || outcome === 'not_done') {
    if (value !== undefined && value !== null) {
      throw new RoutineRecordDomainError(
        'validation',
        'Rest and not-done Routine records cannot include duration.'
      )
    }
    return null
  }
  if (value === undefined || value === null) return null
  if (!Number.isInteger(value) || value < 0) {
    throw new RoutineRecordDomainError(
      'validation',
      'Routine record duration must be a non-negative integer.'
    )
  }
  return value
}

export function createRoutineRecord(input: {
  readonly id: string
  readonly routineId: string
  readonly occurredOn: string
  readonly outcome: RoutineRecordOutcome
  readonly plannedForDate: boolean
  readonly plannedForDateBasis: RoutinePlannedForDateBasis
  readonly durationMinutes?: number | null
  readonly note?: string | null
  readonly now: string
}): RoutineRecord {
  if (
    input.outcome !== 'target_met' &&
    input.outcome !== 'acted' &&
    input.outcome !== 'intentional_rest' &&
    input.outcome !== 'not_done'
  ) {
    throw new RoutineRecordDomainError('validation', 'Routine record outcome is invalid.')
  }
  if (
    input.plannedForDateBasis !== 'schedule_at_recording' &&
    input.plannedForDateBasis !== 'user_confirmed_history'
  ) {
    throw new RoutineRecordDomainError('validation', 'Routine record plan provenance is invalid.')
  }
  if (typeof input.plannedForDate !== 'boolean') {
    throw new RoutineRecordDomainError(
      'validation',
      'Routine record planned-for-date must be explicit.'
    )
  }
  let occurredOn: LocalDate
  try {
    occurredOn = createLocalDate(input.occurredOn)
  } catch {
    throw new RoutineRecordDomainError('validation', 'Routine occurrence date is invalid.')
  }
  return Object.freeze({
    id: requiredText(input.id, 'Routine record id'),
    routineId: requiredText(input.routineId, 'Routine id'),
    occurredOn,
    outcome: input.outcome,
    plannedForDate: input.plannedForDate,
    plannedForDateBasis: input.plannedForDateBasis,
    durationMinutes: normalizeDuration(input.outcome, input.durationMinutes),
    note: optionalText(input.note),
    createdAt: requiredText(input.now, 'Routine record created time'),
    updatedAt: requiredText(input.now, 'Routine record updated time')
  })
}

export function updateRoutineRecord(
  current: RoutineRecord,
  changes: {
    readonly occurredOn: string
    readonly outcome: RoutineRecordOutcome
    readonly plannedForDate: boolean
    readonly plannedForDateBasis: RoutinePlannedForDateBasis
    readonly durationMinutes?: number | null
    readonly note?: string | null
    readonly now: string
  }
): RoutineRecord {
  const validated = createRoutineRecord({
    id: current.id,
    routineId: current.routineId,
    ...changes
  })
  return Object.freeze({ ...validated, createdAt: current.createdAt })
}

export function projectRoutineRecordState(record: RoutineRecord | null): RoutineRecordState {
  return record?.outcome ?? 'unknown'
}
