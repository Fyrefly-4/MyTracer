export type DeleteTargetType = 'action-record' | 'routine-record' | 'action' | 'routine' | 'goal'

export interface DeleteTarget {
  readonly type: DeleteTargetType
  readonly id: string
}

export interface DeleteImpact {
  readonly target: DeleteTarget
  readonly goals: readonly string[]
  readonly actions: readonly string[]
  readonly routines: readonly string[]
  readonly routineScheduleDays: readonly string[]
  readonly todaySelections: readonly string[]
  readonly actionRecords: readonly string[]
  readonly routineRecords: readonly string[]
  readonly understandings: readonly string[]
  readonly confusions: readonly string[]
  readonly reviewResults: readonly string[]
  readonly detachedRoutines: readonly string[]
  readonly detachedReviewResults: readonly string[]
  readonly clearedCurrentNext: readonly string[]
}

export type DeleteImpactCounts = Readonly<Record<Exclude<keyof DeleteImpact, 'target'>, number>>

export class DataControlDomainError extends Error {
  public constructor(
    readonly code: 'validation',
    message: string
  ) {
    super(message)
    this.name = 'DataControlDomainError'
  }
}

const impactKeys = [
  'goals',
  'actions',
  'routines',
  'routineScheduleDays',
  'todaySelections',
  'actionRecords',
  'routineRecords',
  'understandings',
  'confusions',
  'reviewResults',
  'detachedRoutines',
  'detachedReviewResults',
  'clearedCurrentNext'
] as const

export function normalizeDeleteTarget(target: DeleteTarget): DeleteTarget {
  if (!['action-record', 'routine-record', 'action', 'routine', 'goal'].includes(target.type)) {
    throw new DataControlDomainError('validation', 'Delete target type is invalid.')
  }
  const id = target.id.trim()
  if (!id) throw new DataControlDomainError('validation', 'Delete target id must not be blank.')
  return Object.freeze({ type: target.type, id })
}

export function normalizeDeleteImpact(impact: DeleteImpact): DeleteImpact {
  const target = normalizeDeleteTarget(impact.target)
  const normalized = Object.fromEntries(
    impactKeys.map((key) => [key, Object.freeze([...new Set(impact[key])].sort())])
  ) as unknown as Omit<DeleteImpact, 'target'>
  return Object.freeze({ target, ...normalized })
}

export function fingerprintDeleteImpact(impact: DeleteImpact): string {
  return JSON.stringify(normalizeDeleteImpact(impact))
}

export function countDeleteImpact(impact: DeleteImpact): DeleteImpactCounts {
  const normalized = normalizeDeleteImpact(impact)
  return Object.freeze(
    Object.fromEntries(impactKeys.map((key) => [key, normalized[key].length]))
  ) as DeleteImpactCounts
}
