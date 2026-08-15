export const ROUTINE_CHANNELS = Object.freeze({
  create: 'routines:create',
  updateDetails: 'routines:update-details',
  replaceSchedule: 'routines:replace-schedule',
  pause: 'routines:pause',
  resume: 'routines:resume',
  end: 'routines:end',
  list: 'routines:list',
  getDetail: 'routines:get-detail'
} as const)

export type RoutineStatusDto = 'active' | 'paused' | 'ended'

export interface RoutineGoalSummaryDto {
  readonly id: string
  readonly name: string
  readonly status: 'active' | 'paused' | 'ended'
}

export interface RoutineSummaryDto {
  readonly id: string
  readonly goalId: string | null
  readonly name: string
  readonly description: string | null
  readonly minimumAction: string
  readonly status: RoutineStatusDto
  readonly weekdays: readonly number[]
  readonly createdAt: string
  readonly updatedAt: string
}

export interface RoutineDetailDto extends RoutineSummaryDto {
  readonly goal: RoutineGoalSummaryDto | null
}

export interface CreateRoutineInputDto {
  readonly goalId?: string | null
  readonly name: string
  readonly description?: string | null
  readonly minimumAction: string
  readonly weekdays: readonly number[]
}

export interface UpdateRoutineDetailsInputDto {
  readonly routineId: string
  readonly name: string
  readonly description?: string | null
  readonly minimumAction: string
}

export interface ReplaceRoutineScheduleInputDto {
  readonly routineId: string
  readonly weekdays: readonly number[]
}

export interface RoutineIdInputDto {
  readonly routineId: string
}

export interface ListRoutinesInputDto {
  readonly status?: RoutineStatusDto | null
}

export type RoutineErrorCode =
  'validation' | 'not-found' | 'invalid-transition' | 'invariant-violation' | 'persistence-failed'

export type RoutineResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false
      readonly error: { readonly code: RoutineErrorCode; readonly message: string }
    }

export interface RoutineApi {
  readonly create: (input: CreateRoutineInputDto) => Promise<RoutineResult<RoutineDetailDto>>
  readonly updateDetails: (
    input: UpdateRoutineDetailsInputDto
  ) => Promise<RoutineResult<RoutineDetailDto>>
  readonly replaceSchedule: (
    input: ReplaceRoutineScheduleInputDto
  ) => Promise<RoutineResult<RoutineDetailDto>>
  readonly pause: (input: RoutineIdInputDto) => Promise<RoutineResult<RoutineDetailDto>>
  readonly resume: (input: RoutineIdInputDto) => Promise<RoutineResult<RoutineDetailDto>>
  readonly end: (input: RoutineIdInputDto) => Promise<RoutineResult<RoutineDetailDto>>
  readonly list: (
    input: ListRoutinesInputDto
  ) => Promise<RoutineResult<readonly RoutineSummaryDto[]>>
  readonly getDetail: (input: RoutineIdInputDto) => Promise<RoutineResult<RoutineDetailDto>>
  readonly beginRecording: (
    input: BeginRoutineRecordingInputDto
  ) => Promise<RoutineRecordResult<BeginRoutineRecordingDto>>
  readonly cancelRecording: (
    input: CancelRoutineRecordingInputDto
  ) => Promise<RoutineRecordResult<{ readonly cancelled: true }>>
  readonly record: (
    input: RecordRoutineInputDto
  ) => Promise<RoutineRecordResult<RecordRoutineValueDto>>
  readonly getDayState: (
    input: GetRoutineDayStateInputDto
  ) => Promise<RoutineRecordResult<RoutineDayStateDto>>
}
import type {
  BeginRoutineRecordingDto,
  BeginRoutineRecordingInputDto,
  CancelRoutineRecordingInputDto,
  GetRoutineDayStateInputDto,
  RecordRoutineInputDto,
  RecordRoutineValueDto,
  RoutineDayStateDto,
  RoutineRecordResult
} from './routine-records'
