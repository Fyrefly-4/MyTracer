import type { ActionDetailDto } from './actions'

export const RECORD_CHANNELS = Object.freeze({
  beginFirst: 'records:begin-first-record',
  saveFirst: 'records:save-first-record',
  begin: 'records:begin-action-recording',
  cancel: 'records:cancel-action-recording',
  record: 'records:record-action',
  listForAction: 'records:list-for-action',
  getDetail: 'records:get-detail'
} as const)

export type ActionRecordOutcomeDto = 'completed' | 'partial' | 'stopped'
export type RecordingDateChoiceDto = 'keep-captured-on' | 'use-current-on'

export type RecordedCurrentNextResolutionDto =
  | { readonly kind: 'clear' }
  | { readonly kind: 'use-existing'; readonly actionId: string }
  | { readonly kind: 'create-from-recorded-next-step' }

export interface PostRecordChoiceDto {
  readonly action?: 'keep-pending' | 'complete' | 'cancel' | 'reschedule'
  readonly currentNextResolution?: RecordedCurrentNextResolutionDto
  readonly applyRecordedNextStep?: boolean
}

export interface BeginActionRecordingInputDto {
  readonly actionId: string
}

export interface BeginActionRecordingDto {
  readonly actionId: string
  readonly recordingContextId: string
  readonly capturedOn: string
}

export interface CancelActionRecordingInputDto {
  readonly recordingContextId: string
}

export interface FirstActionRecordInputDto {
  readonly actionId: string
  readonly recordingContextId: string
  readonly title: string
  readonly goalId: string | null
  readonly durationMinutes: number | null
  readonly outcome: ActionRecordOutcomeDto
  readonly lifecycle: 'keep-pending' | 'complete'
  readonly note?: string | null
  readonly dateChoice?: RecordingDateChoiceDto
}

export interface RecordActionInputDto {
  readonly actionId: string
  readonly recordingContextId: string
  readonly dateChoice?: RecordingDateChoiceDto
  readonly durationMinutes: number | null
  readonly outcome: ActionRecordOutcomeDto
  readonly understanding?: string | null
  readonly confusion?: string | null
  readonly nextStep?: string | null
  readonly note?: string | null
  readonly postRecord?: PostRecordChoiceDto
}

export interface ActionRecordIdInputDto {
  readonly recordId: string
}

export interface ListActionRecordsInputDto {
  readonly actionId: string
}

export interface ActionRecordSummaryDto {
  readonly id: string
  readonly actionId: string
  readonly occurredOn: string
  readonly durationMinutes: number | null
  readonly outcome: ActionRecordOutcomeDto
  readonly nextStep: string | null
  readonly note: string | null
  readonly createdAt: string
}

export interface ActionRecordDetailDto extends ActionRecordSummaryDto {
  readonly updatedAt: string
  readonly understandings: readonly {
    readonly id: string
    readonly text: string
    readonly source: 'manual' | 'ai_candidate_confirmed'
    readonly createdAt: string
  }[]
  readonly confusions: readonly {
    readonly id: string
    readonly text: string
    readonly status: 'open'
    readonly createdAt: string
  }[]
}

export type RecordActionValueDto =
  | {
      readonly kind: 'date-confirmation-required'
      readonly capturedOn: string
      readonly currentLocalDate: string
    }
  | {
      readonly kind: 'saved'
      readonly record: ActionRecordDetailDto
      readonly action: ActionDetailDto
      readonly appliedNextActionId: string | null
    }

export type RecordErrorCode =
  | 'validation'
  | 'not-found'
  | 'invalid-transition'
  | 'invariant-violation'
  | 'invalid-recording-context'
  | 'persistence-failed'

export type RecordResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false
      readonly error: { readonly code: RecordErrorCode; readonly message: string }
    }

export interface RecordApi {
  readonly beginFirst: () => Promise<RecordResult<BeginActionRecordingDto>>
  readonly saveFirst: (
    input: FirstActionRecordInputDto
  ) => Promise<RecordResult<RecordActionValueDto>>
  readonly begin: (
    input: BeginActionRecordingInputDto
  ) => Promise<RecordResult<BeginActionRecordingDto>>
  readonly cancel: (
    input: CancelActionRecordingInputDto
  ) => Promise<RecordResult<{ readonly cancelled: true }>>
  readonly record: (input: RecordActionInputDto) => Promise<RecordResult<RecordActionValueDto>>
  readonly listForAction: (
    input: ListActionRecordsInputDto
  ) => Promise<RecordResult<readonly ActionRecordSummaryDto[]>>
  readonly getDetail: (
    input: ActionRecordIdInputDto
  ) => Promise<RecordResult<ActionRecordDetailDto>>
}
