export const RECOVERY_CHANNELS = Object.freeze({ getContext: 'recovery:get-context' })
export type GetRecoveryContextInputDto = { readonly goalId: string }
export interface RecoveryActionDto {
  readonly id: string
  readonly title: string
  readonly description: string | null
  readonly status: 'pending' | 'completed' | 'cancelled' | 'rescheduled'
  readonly createdAt: string
}
export type RecoveryLatestRealRecordDto =
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
export interface RecoveryContextDto {
  readonly asOfLocalDate: string
  readonly goal: {
    readonly id: string
    readonly name: string
    readonly status: 'active' | 'paused' | 'ended'
  }
  readonly lastRealActionOn: string | null
  readonly daysSinceLastRealAction: number | null
  readonly currentNextAction: RecoveryActionDto | null
  readonly pendingActions: readonly RecoveryActionDto[]
  readonly latestRealRecord: RecoveryLatestRealRecordDto | null
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
export type RecoveryErrorCode = 'validation' | 'not-found' | 'persistence-failed'
export type RecoveryResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false
      readonly error: { readonly code: RecoveryErrorCode; readonly message: string }
    }
export interface RecoveryApi {
  readonly getContext: (
    input: GetRecoveryContextInputDto
  ) => Promise<RecoveryResult<RecoveryContextDto>>
}
