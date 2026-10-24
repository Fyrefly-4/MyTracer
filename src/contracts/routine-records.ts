export const ROUTINE_RECORD_CHANNELS = Object.freeze({
  begin: 'routine-records:begin',
  cancel: 'routine-records:cancel',
  record: 'routine-records:record',
  getDayState: 'routine-records:get-day-state'
} as const)

export type RoutineRecordOutcomeDto = 'target_met' | 'acted' | 'intentional_rest' | 'not_done'
export type RoutineRecordStateDto = RoutineRecordOutcomeDto | 'unknown'
export type RoutinePlannedForDateBasisDto = 'schedule_at_recording' | 'user_confirmed_history'
export type RoutineRecordingDateChoiceDto = 'keep-captured-on' | 'use-current-on'

export interface RoutineRecordDto {
  readonly id: string
  readonly routineId: string
  readonly occurredOn: string
  readonly outcome: RoutineRecordOutcomeDto
  readonly plannedForDate: boolean
  readonly plannedForDateBasis: RoutinePlannedForDateBasisDto
  readonly durationMinutes: number | null
  readonly summary: string | null
  readonly note: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface BeginRoutineRecordingInputDto {
  readonly routineId: string
}

export interface BeginRoutineRecordingDto {
  readonly routineId: string
  readonly recordingContextId: string
  readonly capturedOn: string
}

export interface CancelRoutineRecordingInputDto {
  readonly recordingContextId: string
}

export interface RecordRoutineInputDto {
  readonly routineId: string
  readonly recordingContextId: string
  readonly dateChoice?: RoutineRecordingDateChoiceDto
  readonly outcome: RoutineRecordOutcomeDto
  readonly durationMinutes?: number | null
  readonly summary?: string | null
  readonly note?: string | null
}

export interface GetRoutineDayStateInputDto {
  readonly routineId: string
  readonly localDate: string
}

export interface RoutineDayStateDto {
  readonly routineId: string
  readonly localDate: string
  readonly plannedByCurrentSchedule: boolean
  readonly recordState: RoutineRecordStateDto
  readonly record: RoutineRecordDto | null
}

export type RecordRoutineValueDto =
  | {
      readonly kind: 'date-confirmation-required'
      readonly capturedOn: string
      readonly currentLocalDate: string
    }
  | { readonly kind: 'saved'; readonly record: RoutineRecordDto }

export type RoutineRecordErrorCode =
  | 'validation'
  | 'not-found'
  | 'invalid-transition'
  | 'invariant-violation'
  | 'record-already-exists'
  | 'invalid-recording-context'
  | 'persistence-failed'

export type RoutineRecordResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false
      readonly error: { readonly code: RoutineRecordErrorCode; readonly message: string }
    }
