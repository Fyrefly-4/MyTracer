import type { ClockPort } from './ports/clock'
import {
  asRoutineRecordRepository,
  type RepositoryPort,
  type RoutineRecordPersistenceRecord,
  type RoutineRecordRepositoryPort,
  type RoutinePersistenceRecord,
  type UnitOfWorkPort
} from './ports/persistence'
import {
  createLocalDate,
  decideOccurrenceDate,
  type OccurrenceDateChoice
} from '../domain/local-date'
import {
  createRoutineRecord,
  RoutineRecordDomainError,
  type RoutineRecord,
  type RoutineRecordOutcome,
  type RoutineRecordState
} from '../domain/routine-record'
import { isRoutinePlannedOn, normalizeRoutineArrangement, type Routine } from '../domain/routine'

export type RoutineRecordApplicationErrorCode =
  | 'validation'
  | 'not-found'
  | 'invalid-transition'
  | 'invariant-violation'
  | 'record-already-exists'

export class RoutineRecordApplicationError extends Error {
  public constructor(
    readonly code: RoutineRecordApplicationErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'RoutineRecordApplicationError'
  }
}

export type RoutineRecordingDateChoice = 'keep-captured-on' | 'use-current-on'

export interface RoutineRecordView {
  readonly id: string
  readonly routineId: string
  readonly occurredOn: string
  readonly outcome: RoutineRecordOutcome
  readonly plannedForDate: boolean
  readonly plannedForDateBasis: RoutineRecordPersistenceRecord['plannedForDateBasis']
  readonly durationMinutes: number | null
  readonly summary: string | null
  readonly note: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface RoutineDayStateView {
  readonly routineId: string
  readonly localDate: string
  readonly plannedByCurrentSchedule: boolean
  readonly recordState: RoutineRecordState
  readonly record: RoutineRecordView | null
}

export interface BeginRoutineRecordingView {
  readonly routineId: string
  readonly capturedOn: string
}

export type RecordRoutineResult =
  | {
      readonly kind: 'date-confirmation-required'
      readonly capturedOn: string
      readonly currentLocalDate: string
    }
  | { readonly kind: 'saved'; readonly record: RoutineRecordView }

export interface RoutineRecordServiceDependencies {
  readonly repository: RepositoryPort
  readonly unitOfWork: UnitOfWorkPort
  readonly clock: ClockPort
  readonly generateId: () => string
}

function loadRoutine(
  repository: RoutineRecordRepositoryPort,
  routineId: string
): RoutinePersistenceRecord {
  const routine = repository.findRoutineById(routineId)
  if (!routine) throw new RoutineRecordApplicationError('not-found', 'Routine was not found.')
  return routine
}

function assertRecordable(
  repository: RoutineRecordRepositoryPort,
  routineId: string
): RoutinePersistenceRecord {
  const routine = loadRoutine(repository, routineId)
  if (routine.status !== 'active') {
    throw new RoutineRecordApplicationError(
      'invalid-transition',
      'Only an active Routine can receive a current record.'
    )
  }
  return routine
}

function routineWithSchedule(
  repository: RoutineRecordRepositoryPort,
  record: RoutinePersistenceRecord
): Routine {
  return Object.freeze({
    ...record,
    weekdays: normalizeRoutineArrangement(
      record.arrangementMode,
      repository.listRoutineScheduleDays(record.id).map((item) => item.weekday)
    )
  })
}

export function routineRecordView(record: RoutineRecordPersistenceRecord): RoutineRecordView {
  return Object.freeze({ ...record })
}

function toPersistence(record: RoutineRecord): RoutineRecordPersistenceRecord {
  return Object.freeze({ ...record, occurredOn: String(record.occurredOn) })
}

function toDateChoice(
  choice: RoutineRecordingDateChoice | undefined
): OccurrenceDateChoice | undefined {
  return choice === 'keep-captured-on'
    ? 'keep-original'
    : choice === 'use-current-on'
      ? 'use-today'
      : undefined
}

function mapDomainError(error: unknown): never {
  if (error instanceof RoutineRecordDomainError) {
    throw new RoutineRecordApplicationError(error.code, error.message)
  }
  throw error
}

export class RoutineRecordService {
  public constructor(private readonly dependencies: RoutineRecordServiceDependencies) {}

  public beginRoutineRecording(routineId: string): BeginRoutineRecordingView {
    const snapshot = this.dependencies.clock.snapshot()
    assertRecordable(asRoutineRecordRepository(this.dependencies.repository), routineId)
    return Object.freeze({ routineId, capturedOn: String(snapshot.localDate) })
  }

  public recordRoutine(input: {
    readonly routineId: string
    readonly capturedOn: string
    readonly dateChoice?: RoutineRecordingDateChoice
    readonly outcome: RoutineRecordOutcome
    readonly durationMinutes?: number | null
    readonly summary?: string | null
    readonly note?: string | null
  }): RecordRoutineResult {
    const snapshot = this.dependencies.clock.snapshot()
    const currentLocalDate = String(snapshot.localDate)
    let capturedOn: Parameters<typeof decideOccurrenceDate>[0]
    try {
      capturedOn = createLocalDate(input.capturedOn)
    } catch {
      throw new RoutineRecordApplicationError('validation', 'Captured Routine date is invalid.')
    }
    if (input.capturedOn === currentLocalDate && input.dateChoice !== undefined) {
      throw new RoutineRecordApplicationError(
        'validation',
        'A date choice is not allowed when recording has not crossed midnight.'
      )
    }
    const decision = decideOccurrenceDate(
      capturedOn,
      snapshot.localDate,
      toDateChoice(input.dateChoice)
    )
    if (decision.kind === 'requires-confirmation') {
      return Object.freeze({
        kind: 'date-confirmation-required',
        capturedOn: String(decision.capturedOn),
        currentLocalDate: String(decision.currentLocalDate)
      })
    }

    try {
      return this.dependencies.unitOfWork.transaction((baseRepository) => {
        const repository = asRoutineRecordRepository(baseRepository)
        const routine = assertRecordable(repository, input.routineId)
        const occurredOn = String(decision.occurredOn)
        if (repository.findRoutineRecordByRoutineAndDate(routine.id, occurredOn)) {
          throw new RoutineRecordApplicationError(
            'record-already-exists',
            'This Routine already has a record for the selected date.'
          )
        }
        const record = createRoutineRecord({
          id: this.dependencies.generateId(),
          routineId: routine.id,
          occurredOn,
          outcome: input.outcome,
          plannedForDate: isRoutinePlannedOn(
            routineWithSchedule(repository, routine),
            decision.occurredOn
          ),
          plannedForDateBasis: 'schedule_at_recording',
          durationMinutes: input.durationMinutes,
          summary: input.summary,
          note: input.note,
          now: snapshot.instant
        })
        const persisted = toPersistence(record)
        if (!repository.createRoutineRecord(persisted)) {
          throw new RoutineRecordApplicationError(
            'record-already-exists',
            'This Routine already has a record for the selected date.'
          )
        }
        return Object.freeze({ kind: 'saved' as const, record: routineRecordView(persisted) })
      })
    } catch (error) {
      mapDomainError(error)
    }
  }

  public getRoutineDayState(routineId: string, localDate?: string): RoutineDayStateView {
    const repository = asRoutineRecordRepository(this.dependencies.repository)
    const routine = loadRoutine(repository, routineId)
    let normalizedDate: Parameters<typeof isRoutinePlannedOn>[1]
    try {
      normalizedDate = createLocalDate(localDate ?? this.dependencies.clock.currentLocalDate())
    } catch {
      throw new RoutineRecordApplicationError('validation', 'Routine day is invalid.')
    }
    const record = repository.findRoutineRecordByRoutineAndDate(routineId, String(normalizedDate))
    return Object.freeze({
      routineId,
      localDate: String(normalizedDate),
      plannedByCurrentSchedule: isRoutinePlannedOn(
        routineWithSchedule(repository, routine),
        normalizedDate
      ),
      recordState: record?.outcome ?? 'unknown',
      record: record ? routineRecordView(record) : null
    })
  }
}
