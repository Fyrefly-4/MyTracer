import type { ClockPort } from './ports/clock'
import type {
  ActionPersistenceRecord,
  GoalPersistenceRecord,
  GoalStatus,
  RepositoryPort,
  UnitOfWorkPort
} from './ports/persistence'
import {
  createGoal,
  GoalDomainError,
  normalizeGoalActionText,
  normalizeOptionalGoalText,
  setGoalCurrentNextAction,
  transitionGoal,
  updateGoalDetails,
  type Goal
} from '../domain/goal'

export type GoalApplicationErrorCode =
  'validation' | 'not-found' | 'invalid-transition' | 'invariant-violation'

export class GoalApplicationError extends Error {
  public constructor(
    readonly code: GoalApplicationErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'GoalApplicationError'
  }
}

export interface GoalSummaryView {
  readonly id: string
  readonly name: string
  readonly description: string | null
  readonly status: GoalStatus
  readonly currentNextActionId: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface GoalActionSummaryView {
  readonly id: string
  readonly title: string
  readonly description: string | null
  readonly status: ActionPersistenceRecord['status']
  readonly isCurrentNextAction: boolean
  readonly selectedForToday: boolean
}

export interface GoalRecordSummaryView {
  readonly id: string
  readonly actionId: string
  readonly actionTitle: string
  readonly occurredOn: string
  readonly durationMinutes: number | null
  readonly outcome: 'completed' | 'partial' | 'stopped'
  readonly nextStep: string | null
  readonly summary: string | null
  readonly note: string | null
  readonly createdAt: string
}

export interface GoalStageReferenceView {
  readonly id: string
  readonly name: string
}

export interface GoalDetailView extends GoalSummaryView {
  readonly previousStage: GoalStageReferenceView | null
  readonly subsequentStages: readonly GoalStageReferenceView[]
  readonly currentNextAction: GoalActionSummaryView | null
  readonly actions: readonly GoalActionSummaryView[]
  readonly records: readonly GoalRecordSummaryView[]
}

export interface GoalServiceDependencies {
  readonly repository: RepositoryPort
  readonly unitOfWork: UnitOfWorkPort
  readonly clock: ClockPort
  readonly generateId: () => string
}

function toDomain(record: GoalPersistenceRecord): Goal {
  return Object.freeze({
    id: record.id,
    name: record.title,
    description: record.description,
    status: record.status,
    predecessorGoalId: record.predecessorGoalId,
    currentNextActionId: record.currentNextActionId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  })
}

function toPersistence(goal: Goal): GoalPersistenceRecord {
  return Object.freeze({
    id: goal.id,
    title: goal.name,
    description: goal.description,
    status: goal.status,
    predecessorGoalId: goal.predecessorGoalId,
    currentNextActionId: goal.currentNextActionId,
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt
  })
}

function toSummary(record: GoalPersistenceRecord): GoalSummaryView {
  return Object.freeze({
    id: record.id,
    name: record.title,
    description: record.description,
    status: record.status,
    currentNextActionId: record.currentNextActionId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  })
}

function toStageReference(record: GoalPersistenceRecord): GoalStageReferenceView {
  return Object.freeze({ id: record.id, name: record.title })
}

function loadGoal(repository: RepositoryPort, goalId: string): GoalPersistenceRecord {
  const record = repository.findGoalById(goalId)
  if (!record) {
    throw new GoalApplicationError('not-found', 'Goal was not found.')
  }
  return record
}

function mapDomainError(error: unknown): never {
  if (error instanceof GoalDomainError) {
    throw new GoalApplicationError(error.code, error.message)
  }
  throw error
}

export class GoalService {
  public constructor(private readonly dependencies: GoalServiceDependencies) {}

  public createGoal(input: {
    readonly name: string
    readonly description?: string | null
    readonly initialNextAction?: {
      readonly title: string
      readonly description?: string | null
    } | null
  }): GoalDetailView {
    const now = this.dependencies.clock.nowInstant()
    const goalId = this.dependencies.generateId()
    const initialActionId = input.initialNextAction ? this.dependencies.generateId() : null

    try {
      const goal = createGoal({ id: goalId, name: input.name, description: input.description, now })
      const action = input.initialNextAction
        ? Object.freeze<ActionPersistenceRecord>({
            id: initialActionId as string,
            goalId,
            title: normalizeGoalActionText(input.initialNextAction.title, 'Action title'),
            description: normalizeOptionalGoalText(input.initialNextAction.description),
            status: 'pending',
            createdAt: now,
            updatedAt: now
          })
        : null

      this.dependencies.unitOfWork.transaction((repository) => {
        repository.saveGoal(toPersistence(goal))
        if (action) {
          repository.saveAction(action)
          repository.saveGoal(toPersistence(setGoalCurrentNextAction(goal, action, now)))
        }
      })
    } catch (error) {
      mapDomainError(error)
    }

    return this.getGoalDetail(goalId)
  }

  public createStage(input: {
    readonly goalId: string
    readonly predecessorGoalId: string
    readonly name: string
    readonly description?: string | null
  }): GoalDetailView {
    try {
      this.dependencies.unitOfWork.transaction((repository) => {
        const existing = repository.findGoalById(input.goalId)
        // A stable draft ID makes retries idempotent without copying any old content.
        if (existing) {
          if (existing.predecessorGoalId !== input.predecessorGoalId)
            throw new GoalApplicationError(
              'invariant-violation',
              'Stage request conflicts with an existing Goal.'
            )
          return
        }
        const predecessor = loadGoal(repository, input.predecessorGoalId)
        if (predecessor.status !== 'ended' || input.goalId === predecessor.id)
          throw new GoalApplicationError(
            'invalid-transition',
            'Only an ended Goal can start a new stage.'
          )
        const goal = createGoal({
          id: input.goalId,
          name: input.name,
          description: input.description,
          now: this.dependencies.clock.nowInstant()
        })
        repository.saveGoal(toPersistence({ ...goal, predecessorGoalId: predecessor.id }))
      })
    } catch (error) {
      mapDomainError(error)
    }
    return this.getGoalDetail(input.goalId)
  }

  public updateGoalDetails(input: {
    readonly goalId: string
    readonly name: string
    readonly description?: string | null
  }): GoalSummaryView {
    return this.changeGoal(input.goalId, (goal, now) =>
      updateGoalDetails(goal, { name: input.name, description: input.description, now })
    )
  }

  public pauseGoal(goalId: string): GoalSummaryView {
    return this.changeGoal(goalId, (goal, now) => transitionGoal(goal, 'pause', now))
  }

  public resumeGoal(goalId: string): GoalSummaryView {
    return this.changeGoal(goalId, (goal, now) => transitionGoal(goal, 'resume', now))
  }

  public endGoal(goalId: string): GoalSummaryView {
    return this.changeGoal(goalId, (goal, now) => transitionGoal(goal, 'end', now))
  }

  public setGoalCurrentNextAction(input: {
    readonly goalId: string
    readonly actionId: string | null
  }): GoalSummaryView {
    return this.changeGoal(input.goalId, (goal, now, repository) => {
      const action = input.actionId ? repository.findActionById(input.actionId) : null
      if (input.actionId && !action) {
        throw new GoalApplicationError('not-found', 'Action was not found.')
      }
      return setGoalCurrentNextAction(goal, action, now)
    })
  }

  public createAndSetGoalCurrentNextAction(input: {
    readonly goalId: string
    readonly title: string
    readonly description?: string | null
    readonly expectedCurrentNextActionId?: string | null
    readonly expectedGoalUpdatedAt?: string
    readonly expectedContextActionId?: string
    readonly expectedContextActionUpdatedAt?: string
  }): GoalDetailView {
    const now = this.dependencies.clock.nowInstant()
    const actionId = this.dependencies.generateId()
    try {
      this.dependencies.unitOfWork.transaction((repository) => {
        const currentGoal = loadGoal(repository, input.goalId)
        if (
          input.expectedGoalUpdatedAt !== undefined &&
          currentGoal.updatedAt !== input.expectedGoalUpdatedAt
        ) {
          throw new GoalApplicationError('invariant-violation', 'The Goal context is stale.')
        }
        if (
          Object.prototype.hasOwnProperty.call(input, 'expectedCurrentNextActionId') &&
          currentGoal.currentNextActionId !== input.expectedCurrentNextActionId
        ) {
          throw new GoalApplicationError('invariant-violation', 'The current next Action is stale.')
        }
        if (input.expectedContextActionId !== undefined) {
          const contextAction = repository.findActionById(input.expectedContextActionId)
          if (
            !contextAction ||
            contextAction.goalId !== currentGoal.id ||
            contextAction.status !== 'pending' ||
            (input.expectedContextActionUpdatedAt !== undefined &&
              contextAction.updatedAt !== input.expectedContextActionUpdatedAt)
          ) {
            throw new GoalApplicationError('invariant-violation', 'The opened Action is stale.')
          }
        }
        const goal = toDomain(currentGoal)
        const action = Object.freeze<ActionPersistenceRecord>({
          id: actionId,
          goalId: goal.id,
          title: normalizeGoalActionText(input.title, 'Action title'),
          description: normalizeOptionalGoalText(input.description),
          status: 'pending',
          createdAt: now,
          updatedAt: now
        })
        const changedGoal = setGoalCurrentNextAction(goal, action, now)
        repository.saveAction(action)
        repository.saveGoal(toPersistence(changedGoal))
      })
    } catch (error) {
      mapDomainError(error)
    }
    return this.getGoalDetail(input.goalId)
  }

  public listGoals(status?: GoalStatus): readonly GoalSummaryView[] {
    return this.dependencies.repository.listGoals(status).map(toSummary)
  }

  public getGoalDetail(goalId: string): GoalDetailView {
    const goal = loadGoal(this.dependencies.repository, goalId)
    const selectedActionIds = new Set(
      this.dependencies.repository.listTodaySelectionActionIdsByGoalIdOn(
        goalId,
        String(this.dependencies.clock.currentLocalDate())
      )
    )
    const actions = this.dependencies.repository.listActionsByGoalId(goalId).map((action) =>
      Object.freeze<GoalActionSummaryView>({
        id: action.id,
        title: action.title,
        description: action.description,
        status: action.status,
        isCurrentNextAction: action.id === goal.currentNextActionId,
        selectedForToday: selectedActionIds.has(action.id)
      })
    )
    const currentNextAction =
      actions.find((action) => action.id === goal.currentNextActionId) ?? null

    return Object.freeze({
      ...toSummary(goal),
      previousStage: goal.predecessorGoalId
        ? toStageReference(loadGoal(this.dependencies.repository, goal.predecessorGoalId))
        : null,
      subsequentStages: Object.freeze(
        this.dependencies.repository
          .listGoals()
          .filter((item) => item.predecessorGoalId === goal.id)
          .map(toStageReference)
      ),
      currentNextAction,
      actions: Object.freeze(actions),
      records: Object.freeze(
        this.dependencies.repository
          .listActionRecordSummariesByGoalId(goalId)
          .map((record) => Object.freeze({ ...record }))
      )
    })
  }

  private changeGoal(
    goalId: string,
    change: (goal: Goal, now: string, repository: RepositoryPort) => Goal
  ): GoalSummaryView {
    try {
      return this.dependencies.unitOfWork.transaction((repository) => {
        const current = loadGoal(repository, goalId)
        const changed = change(toDomain(current), this.dependencies.clock.nowInstant(), repository)
        const persisted = toPersistence(changed)
        repository.saveGoal(persisted)
        return toSummary(persisted)
      })
    } catch (error) {
      mapDomainError(error)
    }
  }
}
