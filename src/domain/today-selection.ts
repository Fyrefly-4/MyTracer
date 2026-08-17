export type TodayCommitment = 'focus' | 'intention'

export type TodaySelectionDomainErrorCode = 'selection-conflict' | 'invariant-violation'

export class TodaySelectionDomainError extends Error {
  public constructor(
    readonly code: TodaySelectionDomainErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'TodaySelectionDomainError'
  }
}

export function decideTodaySelectionCreate(
  current: TodayCommitment | null,
  requested: TodayCommitment
): 'create' | 'already-selected' {
  if (current === null) return 'create'
  if (current === requested) return 'already-selected'
  throw new TodaySelectionDomainError(
    'selection-conflict',
    'The Action already has a different Today commitment.'
  )
}

export function assertTodayCommitmentChange(
  current: TodayCommitment | null,
  requested: TodayCommitment
): asserts current is TodayCommitment {
  if (current === null) {
    throw new TodaySelectionDomainError(
      'invariant-violation',
      'A Today commitment can only be changed for an existing selection.'
    )
  }
  if (current === requested) {
    throw new TodaySelectionDomainError(
      'invariant-violation',
      'The requested Today commitment is already selected.'
    )
  }
}

export function assertTodaySelectionCanBeRemoved(
  current: TodayCommitment | null,
  requested: TodayCommitment
): void {
  if (current !== null && current !== requested) {
    throw new TodaySelectionDomainError(
      'selection-conflict',
      'The Action has a different Today commitment.'
    )
  }
}
