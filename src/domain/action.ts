import type { GoalStatus } from './goal'

export type ActionStatus = 'pending' | 'completed' | 'cancelled' | 'rescheduled'

export interface Action {
  readonly id: string
  readonly goalId: string | null
  readonly title: string
  readonly description: string | null
  readonly status: ActionStatus
  readonly createdAt: string
  readonly updatedAt: string
}

export interface ActionGoalContext {
  readonly id: string
  readonly status: GoalStatus
  readonly currentNextActionId: string | null
}

export type ActionDomainErrorCode = 'validation' | 'invalid-transition' | 'invariant-violation'

export class ActionDomainError extends Error {
  public constructor(
    readonly code: ActionDomainErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'ActionDomainError'
  }
}

function requiredText(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized) {
    throw new ActionDomainError('validation', `${field} must not be blank.`)
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

export function createAction(input: {
  readonly id: string
  readonly goalId?: string | null
  readonly title: string
  readonly description?: string | null
  readonly now: string
}): Action {
  return Object.freeze({
    id: requiredText(input.id, 'Action id'),
    goalId: input.goalId ?? null,
    title: requiredText(input.title, 'Action title'),
    description: optionalText(input.description),
    status: 'pending',
    createdAt: input.now,
    updatedAt: input.now
  })
}

export function updateActionDetails(
  action: Action,
  input: { readonly title: string; readonly description?: string | null; readonly now: string }
): Action {
  return Object.freeze({
    ...action,
    title: requiredText(input.title, 'Action title'),
    description: optionalText(input.description),
    updatedAt: input.now
  })
}

export function transitionAction(
  action: Action,
  transition: 'complete' | 'cancel' | 'reschedule',
  now: string
): Action {
  if (action.status !== 'pending') {
    throw new ActionDomainError(
      'invalid-transition',
      `Action cannot ${transition} from ${action.status}.`
    )
  }

  const status: ActionStatus =
    transition === 'complete' ? 'completed' : transition === 'cancel' ? 'cancelled' : 'rescheduled'
  return Object.freeze({ ...action, status, updatedAt: now })
}

export function assertActionCanBeSelectedForToday(
  action: Action,
  goal: ActionGoalContext | null
): void {
  if (action.status !== 'pending' && action.status !== 'rescheduled') {
    throw new ActionDomainError(
      'invalid-transition',
      'Completed or cancelled Actions cannot be selected for Today.'
    )
  }
  if (action.goalId && (!goal || goal.id !== action.goalId)) {
    throw new ActionDomainError('invariant-violation', 'The linked Goal could not be verified.')
  }
  if (goal && goal.status !== 'active') {
    throw new ActionDomainError(
      'invalid-transition',
      'An Action linked to a paused or ended Goal cannot be selected for Today.'
    )
  }
}

export function restoreRescheduledActionForToday(action: Action, now: string): Action {
  if (action.status === 'pending') {
    return action
  }
  if (action.status !== 'rescheduled') {
    throw new ActionDomainError(
      'invalid-transition',
      'Only a rescheduled Action can be restored for Today.'
    )
  }
  return Object.freeze({ ...action, status: 'pending', updatedAt: now })
}

export function resolveCurrentNextActionId(input: {
  readonly goal: ActionGoalContext
  readonly transitionedActionId: string
  readonly replacement: Action | null
}): string | null {
  if (input.goal.currentNextActionId !== input.transitionedActionId) {
    throw new ActionDomainError(
      'invariant-violation',
      'The transitioned Action is not the Goal current next action.'
    )
  }
  if (input.goal.status !== 'active') {
    if (input.replacement) {
      throw new ActionDomainError(
        'invalid-transition',
        'A paused or ended Goal can only clear its current next action.'
      )
    }
    return null
  }
  if (!input.replacement) {
    return null
  }
  if (
    input.replacement.id === input.transitionedActionId ||
    input.replacement.goalId !== input.goal.id ||
    input.replacement.status !== 'pending'
  ) {
    throw new ActionDomainError(
      'invariant-violation',
      'A replacement must be another pending Action from the same Goal.'
    )
  }
  return input.replacement.id
}
