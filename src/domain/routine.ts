import { isoWeekday, type IsoWeekday, type LocalDate } from './local-date'

export type RoutineStatus = 'active' | 'paused' | 'ended'
export type RoutineScheduleShortcut = 'daily' | 'weekdays'

export interface Routine {
  readonly id: string
  readonly goalId: string | null
  readonly name: string
  readonly description: string | null
  readonly minimumAction: string
  readonly status: RoutineStatus
  readonly weekdays: readonly IsoWeekday[]
  readonly createdAt: string
  readonly updatedAt: string
}

export type RoutineDomainErrorCode = 'validation' | 'invalid-transition'

export class RoutineDomainError extends Error {
  public constructor(
    readonly code: RoutineDomainErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'RoutineDomainError'
  }
}

function requiredText(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized) {
    throw new RoutineDomainError('validation', `${field} must not be blank.`)
  }
  return normalized
}

function optionalText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const normalized = value.trim()
  return normalized || null
}

export function normalizeRoutineWeekdays(values: readonly number[]): readonly IsoWeekday[] {
  if (values.length === 0) {
    throw new RoutineDomainError('validation', 'Routine weekdays must not be empty.')
  }
  const unique = new Set<number>()
  for (const value of values) {
    if (!Number.isInteger(value) || value < 1 || value > 7 || unique.has(value)) {
      throw new RoutineDomainError(
        'validation',
        'Routine weekdays must contain unique ISO weekday values from 1 through 7.'
      )
    }
    unique.add(value)
  }
  return Object.freeze([...unique].sort((left, right) => left - right) as IsoWeekday[])
}

export function expandRoutineScheduleShortcut(
  shortcut: RoutineScheduleShortcut
): readonly IsoWeekday[] {
  return shortcut === 'daily'
    ? Object.freeze([1, 2, 3, 4, 5, 6, 7] as IsoWeekday[])
    : Object.freeze([1, 2, 3, 4, 5] as IsoWeekday[])
}

export function createRoutine(input: {
  readonly id: string
  readonly goalId?: string | null
  readonly name: string
  readonly description?: string | null
  readonly minimumAction: string
  readonly weekdays: readonly number[]
  readonly now: string
}): Routine {
  return Object.freeze({
    id: requiredText(input.id, 'Routine id'),
    goalId: input.goalId ?? null,
    name: requiredText(input.name, 'Routine name'),
    description: optionalText(input.description),
    minimumAction: requiredText(input.minimumAction, 'Routine minimum action'),
    status: 'active',
    weekdays: normalizeRoutineWeekdays(input.weekdays),
    createdAt: input.now,
    updatedAt: input.now
  })
}

export function updateRoutineDetails(
  routine: Routine,
  input: {
    readonly name: string
    readonly description?: string | null
    readonly minimumAction: string
    readonly now: string
  }
): Routine {
  return Object.freeze({
    ...routine,
    name: requiredText(input.name, 'Routine name'),
    description: optionalText(input.description),
    minimumAction: requiredText(input.minimumAction, 'Routine minimum action'),
    updatedAt: input.now
  })
}

export function replaceRoutineSchedule(
  routine: Routine,
  weekdays: readonly number[],
  now: string
): Routine {
  return Object.freeze({
    ...routine,
    weekdays: normalizeRoutineWeekdays(weekdays),
    updatedAt: now
  })
}

export function transitionRoutine(
  routine: Routine,
  transition: 'pause' | 'resume' | 'end',
  now: string
): Routine {
  const target: RoutineStatus | undefined =
    transition === 'pause' && routine.status === 'active'
      ? 'paused'
      : transition === 'resume' && routine.status === 'paused'
        ? 'active'
        : transition === 'end' && (routine.status === 'active' || routine.status === 'paused')
          ? 'ended'
          : undefined
  if (!target) {
    throw new RoutineDomainError(
      'invalid-transition',
      `Routine cannot ${transition} from ${routine.status}.`
    )
  }
  return Object.freeze({ ...routine, status: target, updatedAt: now })
}

export function isRoutinePlannedOn(routine: Routine, localDate: LocalDate): boolean {
  return routine.weekdays.includes(isoWeekday(localDate))
}
