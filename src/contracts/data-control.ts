export interface DeleteTargetDto {
  readonly type: 'action-record' | 'routine-record' | 'action' | 'routine' | 'goal'
  readonly id: string
}

export type DeleteImpactCountsDto = Readonly<
  Record<
    | 'goals'
    | 'actions'
    | 'routines'
    | 'routineScheduleDays'
    | 'todaySelections'
    | 'actionRecords'
    | 'routineRecords'
    | 'understandings'
    | 'confusions'
    | 'reviewResults'
    | 'detachedRoutines'
    | 'detachedReviewResults'
    | 'clearedCurrentNext',
    number
  >
>

export interface ActionRecordDataDto {
  readonly id: string
  readonly actionId: string
  readonly occurredOn: string
  readonly durationMinutes: number | null
  readonly outcome: 'completed' | 'partial' | 'stopped'
  readonly nextStep: string | null
  readonly note: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface RoutineRecordDataDto {
  readonly id: string
  readonly routineId: string
  readonly occurredOn: string
  readonly outcome: 'target_met' | 'acted' | 'intentional_rest' | 'not_done'
  readonly plannedForDate: boolean
  readonly plannedForDateBasis: 'schedule_at_recording' | 'user_confirmed_history'
  readonly durationMinutes: number | null
  readonly note: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface UnderstandingDataDto {
  readonly id: string
  readonly actionRecordId: string
  readonly text: string
  readonly source: 'manual' | 'ai_candidate_confirmed'
  readonly revokedAt: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface ConfusionDataDto {
  readonly id: string
  readonly actionRecordId: string
  readonly text: string
  readonly status: 'open' | 'resolved'
  readonly resolvedAt: string | null
  readonly resolution: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export const DATA_CONTROL_CHANNELS = Object.freeze({
  list: 'data-control:list',
  backfillActionRecord: 'data-control:backfill-action-record',
  updateActionRecord: 'data-control:update-action-record',
  backfillRoutineRecord: 'data-control:backfill-routine-record',
  updateRoutineRecord: 'data-control:update-routine-record',
  updateUnderstanding: 'data-control:update-understanding',
  revokeUnderstanding: 'data-control:revoke-understanding',
  updateConfusion: 'data-control:update-confusion',
  resolveConfusion: 'data-control:resolve-confusion',
  reopenConfusion: 'data-control:reopen-confusion',
  previewDelete: 'data-control:preview-delete',
  cancelDelete: 'data-control:cancel-delete',
  confirmDelete: 'data-control:confirm-delete'
} as const)

export interface DataControlListDto {
  readonly goals: readonly {
    readonly id: string
    readonly title: string
    readonly status: 'active' | 'paused' | 'ended'
  }[]
  readonly actions: readonly {
    readonly id: string
    readonly goalId: string | null
    readonly title: string
    readonly status: 'pending' | 'completed' | 'cancelled' | 'rescheduled'
  }[]
  readonly routines: readonly {
    readonly id: string
    readonly goalId: string | null
    readonly name: string
    readonly status: 'active' | 'paused' | 'ended'
  }[]
  readonly actionRecords: readonly ActionRecordDataDto[]
  readonly routineRecords: readonly RoutineRecordDataDto[]
  readonly understandings: readonly UnderstandingDataDto[]
  readonly confusions: readonly ConfusionDataDto[]
}

export interface DeletePreviewDto {
  readonly previewId: string
  readonly target: DeleteTargetDto
  readonly counts: DeleteImpactCountsDto
  readonly generatedAt: string
}

export interface BackfillActionRecordInputDto {
  readonly actionId: string
  readonly occurredOn: string
  readonly durationMinutes: number | null
  readonly outcome: 'completed' | 'partial' | 'stopped'
  readonly understanding?: string | null
  readonly confusion?: string | null
  readonly nextStep?: string | null
  readonly note?: string | null
}

export interface UpdateActionRecordInputDto {
  readonly recordId: string
  readonly occurredOn: string
  readonly durationMinutes: number | null
  readonly outcome: 'completed' | 'partial' | 'stopped'
  readonly nextStep?: string | null
  readonly note?: string | null
}

export interface BackfillRoutineRecordInputDto {
  readonly routineId: string
  readonly occurredOn: string
  readonly outcome: 'target_met' | 'acted' | 'intentional_rest' | 'not_done'
  readonly plannedForDate: boolean
  readonly durationMinutes?: number | null
  readonly note?: string | null
}

export interface UpdateRoutineRecordInputDto {
  readonly recordId: string
  readonly occurredOn: string
  readonly outcome: 'target_met' | 'acted' | 'intentional_rest' | 'not_done'
  readonly plannedForDate?: boolean
  readonly durationMinutes?: number | null
  readonly note?: string | null
}

export interface TextFactInputDto {
  readonly id: string
  readonly text: string
}

export interface FactIdInputDto {
  readonly id: string
}

export interface ResolveConfusionInputDto {
  readonly id: string
  readonly resolution?: string | null
}

export type DataControlErrorCode =
  | 'validation'
  | 'not-found'
  | 'invalid-transition'
  | 'record-already-exists'
  | 'delete-preview-stale'
  | 'invalid-delete-preview'
  | 'invariant-violation'
  | 'persistence-failed'

export type DataControlResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false
      readonly error: { readonly code: DataControlErrorCode; readonly message: string }
    }

export interface DataControlApi {
  readonly list: () => Promise<DataControlResult<DataControlListDto>>
  readonly backfillActionRecord: (
    input: BackfillActionRecordInputDto
  ) => Promise<DataControlResult<ActionRecordDataDto>>
  readonly updateActionRecord: (
    input: UpdateActionRecordInputDto
  ) => Promise<DataControlResult<ActionRecordDataDto>>
  readonly backfillRoutineRecord: (
    input: BackfillRoutineRecordInputDto
  ) => Promise<DataControlResult<RoutineRecordDataDto>>
  readonly updateRoutineRecord: (
    input: UpdateRoutineRecordInputDto
  ) => Promise<DataControlResult<RoutineRecordDataDto>>
  readonly updateUnderstanding: (
    input: TextFactInputDto
  ) => Promise<DataControlResult<UnderstandingDataDto>>
  readonly revokeUnderstanding: (
    input: FactIdInputDto
  ) => Promise<DataControlResult<UnderstandingDataDto>>
  readonly updateConfusion: (
    input: TextFactInputDto
  ) => Promise<DataControlResult<ConfusionDataDto>>
  readonly resolveConfusion: (
    input: ResolveConfusionInputDto
  ) => Promise<DataControlResult<ConfusionDataDto>>
  readonly reopenConfusion: (input: FactIdInputDto) => Promise<DataControlResult<ConfusionDataDto>>
  readonly previewDelete: (input: {
    readonly target: DeleteTargetDto
  }) => Promise<DataControlResult<DeletePreviewDto>>
  readonly cancelDelete: (input: {
    readonly previewId: string
  }) => Promise<DataControlResult<{ readonly cancelled: true }>>
  readonly confirmDelete: (input: {
    readonly previewId: string
    readonly target: DeleteTargetDto
    readonly confirmation: 'permanently-delete'
  }) => Promise<DataControlResult<{ readonly counts: DeleteImpactCountsDto }>>
}
