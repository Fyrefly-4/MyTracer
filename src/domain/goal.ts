export type GoalStatus = 'active' | 'paused' | 'ended'

export interface Goal {
  readonly id: string
  readonly name: string
  readonly description: string | null
  readonly status: GoalStatus
  readonly currentNextActionId: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface GoalActionReference {
  readonly id: string
  readonly goalId: string | null
  readonly status: 'pending' | 'completed' | 'cancelled' | 'rescheduled'
}

export type GoalDomainErrorCode = 'validation' | 'invalid-transition' | 'invariant-violation'

export class GoalDomainError extends Error {
  public constructor(
    readonly code: GoalDomainErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'GoalDomainError'
  }
}

function requiredText(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized) {
    throw new GoalDomainError('validation', `${field} must not be blank.`)
  }
  return normalized
}

function optionalText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null
  }
  const normalized = value.trim()
  return normalized || null
}

export function normalizeGoalActionText(value: string, field: string): string {
  return requiredText(value, field)
}

export function normalizeOptionalGoalText(value: string | null | undefined): string | null {
  return optionalText(value)
}

export function createGoal(input: {
  readonly id: string
  readonly name: string
  readonly description?: string | null
  readonly now: string
}): Goal {
  return Object.freeze({
    id: requiredText(input.id, 'Goal id'),
    name: requiredText(input.name, 'Goal name'),
    description: optionalText(input.description),
    status: 'active',
    currentNextActionId: null,
    createdAt: input.now,
    updatedAt: input.now
  })
}

export function updateGoalDetails(
  goal: Goal,
  input: { readonly name: string; readonly description?: string | null; readonly now: string }
): Goal {
  return Object.freeze({
    ...goal,
    name: requiredText(input.name, 'Goal name'),
    description: optionalText(input.description),
    updatedAt: input.now
  })
}

export function transitionGoal(
  goal: Goal,
  transition: 'pause' | 'resume' | 'end',
  now: string
): Goal {
  const target: GoalStatus | undefined =
    transition === 'pause' && goal.status === 'active'
      ? 'paused'
      : transition === 'resume' && goal.status === 'paused'
        ? 'active'
        : transition === 'end' && (goal.status === 'active' || goal.status === 'paused')
          ? 'ended'
          : undefined

  if (!target) {
    throw new GoalDomainError(
      'invalid-transition',
      `Goal cannot ${transition} from ${goal.status}.`
    )
  }

  return Object.freeze({ ...goal, status: target, updatedAt: now })
}

export function setGoalCurrentNextAction(
  goal: Goal,
  action: GoalActionReference | null,
  now: string
): Goal {
  if (goal.status !== 'active') {
    throw new GoalDomainError(
      'invalid-transition',
      'Only an active Goal can change its current next action.'
    )
  }

  if (action && (action.goalId !== goal.id || action.status !== 'pending')) {
    throw new GoalDomainError(
      'invariant-violation',
      'The current next action must be pending and belong to the same Goal.'
    )
  }

  return Object.freeze({
    ...goal,
    currentNextActionId: action?.id ?? null,
    updatedAt: now
  })
}
