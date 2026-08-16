import type { ClockPort } from './ports/clock'
import { asActionRepository } from './ports/persistence'
import type {
  ActionPersistenceRecord,
  ActionRepositoryPort,
  GoalPersistenceRecord,
  RepositoryPort,
  UnitOfWorkPort
} from './ports/persistence'
import {
  ActionDomainError,
  createAction,
  resolveCurrentNextActionId,
  transitionAction,
  updateActionDetails,
  type Action
} from '../domain/action'
import type { TodayCommitment } from '../domain/today-selection'

export type ActionApplicationErrorCode =
  'validation' | 'not-found' | 'invalid-transition' | 'invariant-violation'

export class ActionApplicationError extends Error {
  public constructor(
    readonly code: ActionApplicationErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'ActionApplicationError'
  }
}

export interface ActionGoalSummaryView {
  readonly id: string
  readonly name: string
  readonly status: GoalPersistenceRecord['status']
}

export type ActionUnavailableReason =
  'action-completed' | 'action-cancelled' | 'action-rescheduled' | 'goal-paused' | 'goal-ended'

export interface ActionDetailView {
  readonly id: string
  readonly goalId: string | null
  readonly title: string
  readonly description: string | null
  readonly status: ActionPersistenceRecord['status']
  readonly createdAt: string
  readonly updatedAt: string
  readonly goal: ActionGoalSummaryView | null
  readonly isCurrentNextAction: boolean
  readonly selectedForToday: boolean
  readonly todayCommitment: TodayCommitment | null
  readonly canSelectForToday: boolean
  readonly canStart: boolean
  readonly unavailableReason: ActionUnavailableReason | null
}

export type CurrentNextResolution =
  | { readonly kind: 'clear' }
  | { readonly kind: 'use-existing'; readonly actionId: string }
  | {
      readonly kind: 'create-and-use'
      readonly title: string
      readonly description?: string | null
    }

export interface ActionServiceDependencies {
  readonly repository: RepositoryPort
  readonly unitOfWork: UnitOfWorkPort
  readonly clock: ClockPort
  readonly generateId: () => string
}

export function actionFromPersistence(record: ActionPersistenceRecord): Action {
  return Object.freeze({ ...record })
}

function toPersistence(action: Action): ActionPersistenceRecord {
  return Object.freeze({ ...action })
}

export function loadAction(repository: RepositoryPort, actionId: string): ActionPersistenceRecord {
  const action = repository.findActionById(actionId)
  if (!action) {
    throw new ActionApplicationError('not-found', 'Action was not found.')
  }
  return action
}

function loadLinkedGoal(
  repository: RepositoryPort,
  action: ActionPersistenceRecord
): GoalPersistenceRecord | null {
  if (!action.goalId) {
    return null
  }
  const goal = repository.findGoalById(action.goalId)
  if (!goal) {
    throw new ActionApplicationError('invariant-violation', 'The linked Goal was not found.')
  }
  return goal
}

function unavailableReason(
  action: ActionPersistenceRecord,
  goal: GoalPersistenceRecord | null
): ActionUnavailableReason | null {
  if (action.status === 'completed') return 'action-completed'
  if (action.status === 'cancelled') return 'action-cancelled'
  if (action.status === 'rescheduled') return 'action-rescheduled'
  if (goal?.status === 'paused') return 'goal-paused'
  if (goal?.status === 'ended') return 'goal-ended'
  return null
}

export function buildActionDetail(
  repository: ActionRepositoryPort,
  actionId: string,
  currentLocalDate: string
): ActionDetailView {
  const action = loadAction(repository, actionId)
  const goal = loadLinkedGoal(repository, action)
  const reason = unavailableReason(action, goal)
  const activeContext = !goal || goal.status === 'active'
  const currentSelection = repository.findTodaySelection(action.id, currentLocalDate)
  return Object.freeze({
    ...action,
    goal: goal ? Object.freeze({ id: goal.id, name: goal.title, status: goal.status }) : null,
    isCurrentNextAction: goal?.currentNextActionId === action.id,
    selectedForToday: currentSelection?.kind === 'focus',
    todayCommitment: currentSelection?.kind ?? null,
    canSelectForToday:
      activeContext && (action.status === 'pending' || action.status === 'rescheduled'),
    canStart: activeContext && action.status === 'pending',
    unavailableReason: reason
  })
}

function mapDomainError(error: unknown): never {
  if (error instanceof ActionDomainError) {
    throw new ActionApplicationError(error.code, error.message)
  }
  throw error
}

export class ActionService {
  public constructor(private readonly dependencies: ActionServiceDependencies) {}

  public createAction(input: {
    readonly goalId?: string | null
    readonly title: string
    readonly description?: string | null
  }): ActionDetailView {
    const snapshot = this.dependencies.clock.snapshot()
    try {
      return this.dependencies.unitOfWork.transaction((baseRepository) => {
        const repository = asActionRepository(baseRepository)
        if (input.goalId) {
          const goal = repository.findGoalById(input.goalId)
          if (!goal) throw new ActionApplicationError('not-found', 'Goal was not found.')
          if (goal.status !== 'active') {
            throw new ActionApplicationError(
              'invalid-transition',
              'Only an active Goal can receive a new Action.'
            )
          }
        }
        const action = createAction({
          id: this.dependencies.generateId(),
          goalId: input.goalId,
          title: input.title,
          description: input.description,
          now: snapshot.instant
        })
        repository.saveAction(toPersistence(action))
        return buildActionDetail(repository, action.id, String(snapshot.localDate))
      })
    } catch (error) {
      mapDomainError(error)
    }
  }

  public updateActionDetails(input: {
    readonly actionId: string
    readonly title: string
    readonly description?: string | null
  }): ActionDetailView {
    const snapshot = this.dependencies.clock.snapshot()
    try {
      return this.dependencies.unitOfWork.transaction((baseRepository) => {
        const repository = asActionRepository(baseRepository)
        const current = loadAction(repository, input.actionId)
        const changed = updateActionDetails(actionFromPersistence(current), {
          title: input.title,
          description: input.description,
          now: snapshot.instant
        })
        repository.saveAction(toPersistence(changed))
        return buildActionDetail(repository, changed.id, String(snapshot.localDate))
      })
    } catch (error) {
      mapDomainError(error)
    }
  }

  public completeAction(input: {
    readonly actionId: string
    readonly currentNextResolution?: CurrentNextResolution
  }): ActionDetailView {
    return this.transition(input, 'complete')
  }

  public cancelAction(input: {
    readonly actionId: string
    readonly currentNextResolution?: CurrentNextResolution
  }): ActionDetailView {
    return this.transition(input, 'cancel')
  }

  public rescheduleAction(input: {
    readonly actionId: string
    readonly currentNextResolution?: CurrentNextResolution
  }): ActionDetailView {
    return this.transition(input, 'reschedule')
  }

  public getActionDetail(actionId: string): ActionDetailView {
    const snapshot = this.dependencies.clock.snapshot()
    return buildActionDetail(
      asActionRepository(this.dependencies.repository),
      actionId,
      String(snapshot.localDate)
    )
  }

  private transition(
    input: {
      readonly actionId: string
      readonly currentNextResolution?: CurrentNextResolution
    },
    transition: 'complete' | 'cancel' | 'reschedule'
  ): ActionDetailView {
    const snapshot = this.dependencies.clock.snapshot()
    try {
      return this.dependencies.unitOfWork.transaction((baseRepository) => {
        const repository = asActionRepository(baseRepository)
        const current = loadAction(repository, input.actionId)
        const goal = loadLinkedGoal(repository, current)
        const isCurrentNextAction = goal?.currentNextActionId === current.id
        if (isCurrentNextAction !== Boolean(input.currentNextResolution)) {
          throw new ActionApplicationError(
            'invariant-violation',
            isCurrentNextAction
              ? 'A current next resolution is required.'
              : 'A current next resolution is not allowed for this Action.'
          )
        }

        const changed = transitionAction(
          actionFromPersistence(current),
          transition,
          snapshot.instant
        )
        let replacement: Action | null = null
        if (goal && isCurrentNextAction && input.currentNextResolution) {
          if (input.currentNextResolution.kind === 'use-existing') {
            replacement = actionFromPersistence(
              loadAction(repository, input.currentNextResolution.actionId)
            )
          } else if (input.currentNextResolution.kind === 'create-and-use') {
            replacement = createAction({
              id: this.dependencies.generateId(),
              goalId: goal.id,
              title: input.currentNextResolution.title,
              description: input.currentNextResolution.description,
              now: snapshot.instant
            })
          }

          const currentNextActionId = resolveCurrentNextActionId({
            goal,
            transitionedActionId: current.id,
            replacement
          })
          repository.saveAction(toPersistence(changed))
          if (replacement && input.currentNextResolution.kind === 'create-and-use') {
            repository.saveAction(toPersistence(replacement))
          }
          repository.saveGoal({
            ...goal,
            currentNextActionId,
            updatedAt: snapshot.instant
          })
        } else {
          repository.saveAction(toPersistence(changed))
        }

        if (transition === 'reschedule') {
          repository.deleteTodaySelection(current.id, String(snapshot.localDate))
        }
        return buildActionDetail(repository, current.id, String(snapshot.localDate))
      })
    } catch (error) {
      mapDomainError(error)
    }
  }
}
