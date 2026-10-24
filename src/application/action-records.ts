import type { ClockPort } from './ports/clock'
import {
  asActionRecordRepository,
  type ActionPersistenceRecord,
  type ActionRecordPersistenceRecord,
  type ActionRecordRepositoryPort,
  type GoalPersistenceRecord,
  type RepositoryPort,
  type UnitOfWorkPort
} from './ports/persistence'
import {
  actionFromPersistence,
  buildActionDetail,
  loadAction,
  type ActionDetailView
} from './actions'
import {
  ActionDomainError,
  createAction,
  resolveCurrentNextActionId,
  transitionAction,
  type Action
} from '../domain/action'
import {
  ActionRecordDomainError,
  createActionRecord,
  createConfirmedAiUnderstanding,
  createManualUnderstanding,
  createOpenConfusion,
  type ActionRecordOutcome
} from '../domain/action-record'
import { decideOccurrenceDate, type OccurrenceDateChoice } from '../domain/local-date'

export type ActionRecordApplicationErrorCode =
  'validation' | 'not-found' | 'invalid-transition' | 'invariant-violation'

export class ActionRecordApplicationError extends Error {
  public constructor(
    readonly code: ActionRecordApplicationErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'ActionRecordApplicationError'
  }
}

export type RecordingDateChoice = 'keep-captured-on' | 'use-current-on'

export type RecordedCurrentNextResolution =
  | { readonly kind: 'clear' }
  | { readonly kind: 'use-existing'; readonly actionId: string }
  | { readonly kind: 'create-from-recorded-next-step' }

export interface PostRecordChoice {
  readonly action?: 'keep-pending' | 'complete' | 'cancel' | 'reschedule'
  readonly currentNextResolution?: RecordedCurrentNextResolution
  readonly applyRecordedNextStep?: boolean
}

export interface ActionRecordSummaryView {
  readonly id: string
  readonly actionId: string
  readonly occurredOn: string
  readonly durationMinutes: number | null
  readonly outcome: ActionRecordPersistenceRecord['outcome']
  readonly nextStep: string | null
  readonly note: string | null
  readonly createdAt: string
}

export interface UnderstandingView {
  readonly id: string
  readonly text: string
  readonly source: 'manual' | 'ai_candidate_confirmed'
  readonly createdAt: string
}

export interface ConfusionView {
  readonly id: string
  readonly text: string
  readonly status: 'open'
  readonly createdAt: string
}

export interface ActionRecordDetailView extends ActionRecordSummaryView {
  readonly updatedAt: string
  readonly understandings: readonly UnderstandingView[]
  readonly confusions: readonly ConfusionView[]
}

export interface BeginActionRecordingView {
  readonly actionId: string
  readonly capturedOn: string
}

export type RecordActionResult =
  | {
      readonly kind: 'date-confirmation-required'
      readonly capturedOn: string
      readonly currentLocalDate: string
    }
  | {
      readonly kind: 'saved'
      readonly record: ActionRecordDetailView
      readonly action: ActionDetailView
      readonly appliedNextActionId: string | null
    }

export interface ActionRecordServiceDependencies {
  readonly repository: RepositoryPort
  readonly unitOfWork: UnitOfWorkPort
  readonly clock: ClockPort
  readonly generateId: () => string
}

function loadLinkedGoal(
  repository: RepositoryPort,
  action: ActionPersistenceRecord
): GoalPersistenceRecord | null {
  if (!action.goalId) return null
  const goal = repository.findGoalById(action.goalId)
  if (!goal) {
    throw new ActionRecordApplicationError('invariant-violation', 'The linked Goal was not found.')
  }
  return goal
}

function assertRecordable(
  repository: RepositoryPort,
  actionId: string
): { readonly action: ActionPersistenceRecord; readonly goal: GoalPersistenceRecord | null } {
  const action = loadAction(repository, actionId)
  const goal = loadLinkedGoal(repository, action)
  if (action.status !== 'pending') {
    throw new ActionRecordApplicationError(
      'invalid-transition',
      'Only a pending Action can receive a new record.'
    )
  }
  if (goal && goal.status !== 'active') {
    throw new ActionRecordApplicationError(
      'invalid-transition',
      'An Action linked to a paused or ended Goal cannot receive a new record.'
    )
  }
  return { action, goal }
}

function summary(record: ActionRecordPersistenceRecord): ActionRecordSummaryView {
  return Object.freeze({
    id: record.id,
    actionId: record.actionId,
    occurredOn: record.occurredOn,
    durationMinutes: record.durationMinutes,
    outcome: record.outcome,
    nextStep: record.nextStep,
    note: record.note,
    createdAt: record.createdAt
  })
}

function detail(
  repository: ActionRecordRepositoryPort,
  record: ActionRecordPersistenceRecord
): ActionRecordDetailView {
  const understandings = repository
    .listUnderstandingsByActionRecordId(record.id)
    .filter((item) => item.revokedAt === null)
    .map((item) =>
      Object.freeze({
        id: item.id,
        text: item.text,
        source: item.source,
        createdAt: item.createdAt
      })
    )
  const confusions = repository
    .listConfusionsByActionRecordId(record.id)
    .filter((item) => item.status === 'open')
    .map((item) =>
      Object.freeze({
        id: item.id,
        text: item.text,
        status: 'open' as const,
        createdAt: item.createdAt
      })
    )
  return Object.freeze({
    ...summary(record),
    updatedAt: record.updatedAt,
    understandings,
    confusions
  })
}

function mapDomainError(error: unknown): never {
  if (error instanceof ActionRecordDomainError || error instanceof ActionDomainError) {
    throw new ActionRecordApplicationError(error.code, error.message)
  }
  throw error
}

function toDateChoice(choice: RecordingDateChoice | undefined): OccurrenceDateChoice | undefined {
  return choice === 'keep-captured-on'
    ? 'keep-original'
    : choice === 'use-current-on'
      ? 'use-today'
      : undefined
}

export class ActionRecordService {
  public constructor(private readonly dependencies: ActionRecordServiceDependencies) {}

  public beginActionRecording(actionId: string): BeginActionRecordingView {
    const snapshot = this.dependencies.clock.snapshot()
    assertRecordable(this.dependencies.repository, actionId)
    return Object.freeze({ actionId, capturedOn: String(snapshot.localDate) })
  }

  public recordAction(input: {
    readonly actionId: string
    readonly capturedOn: string
    readonly dateChoice?: RecordingDateChoice
    readonly durationMinutes: number | null
    readonly outcome: ActionRecordOutcome
    readonly understanding?: string | null
    readonly confusion?: string | null
    readonly nextStep?: string | null
    readonly note?: string | null
    readonly postRecord?: PostRecordChoice
  }): RecordActionResult {
    const snapshot = this.dependencies.clock.snapshot()
    const currentLocalDate = String(snapshot.localDate)
    if (input.capturedOn === currentLocalDate && input.dateChoice !== undefined) {
      throw new ActionRecordApplicationError(
        'validation',
        'A date choice is not allowed when recording has not crossed midnight.'
      )
    }
    const decision = decideOccurrenceDate(
      input.capturedOn as Parameters<typeof decideOccurrenceDate>[0],
      snapshot.localDate,
      toDateChoice(input.dateChoice)
    )
    if (decision.kind === 'requires-confirmation') {
      return Object.freeze({
        kind: 'date-confirmation-required',
        capturedOn: String(decision.capturedOn),
        currentLocalDate: String(decision.currentLocalDate)
      })
    }

    try {
      return this.dependencies.unitOfWork.transaction((baseRepository) => {
        const repository = asActionRecordRepository(baseRepository)
        const { action, goal } = assertRecordable(repository, input.actionId)
        const record = createActionRecord({
          id: this.dependencies.generateId(),
          actionId: action.id,
          occurredOn: String(decision.occurredOn),
          durationMinutes: input.durationMinutes,
          outcome: input.outcome,
          nextStep: input.nextStep,
          note: input.note,
          now: snapshot.instant
        })
        repository.saveActionRecord(record)
        if (input.understanding?.trim()) {
          repository.saveUnderstanding(
            createManualUnderstanding({
              id: this.dependencies.generateId(),
              actionRecordId: record.id,
              text: input.understanding,
              now: snapshot.instant
            })
          )
        }
        if (input.confusion?.trim()) {
          repository.saveConfusion(
            createOpenConfusion({
              id: this.dependencies.generateId(),
              actionRecordId: record.id,
              text: input.confusion,
              now: snapshot.instant
            })
          )
        }

        const appliedNextActionId = this.applyPostRecord(
          repository,
          action,
          goal,
          record.nextStep,
          input.postRecord,
          snapshot.instant,
          currentLocalDate
        )
        return Object.freeze({
          kind: 'saved' as const,
          record: detail(repository, record),
          action: buildActionDetail(repository, action.id, currentLocalDate),
          appliedNextActionId
        })
      })
    } catch (error) {
      mapDomainError(error)
    }
  }

  public listActionRecordsForAction(actionId: string): readonly ActionRecordSummaryView[] {
    const repository = asActionRecordRepository(this.dependencies.repository)
    loadAction(repository, actionId)
    return Object.freeze(repository.listActionRecordsByActionId(actionId).map(summary))
  }

  public getActionRecordDetail(recordId: string): ActionRecordDetailView {
    const repository = asActionRecordRepository(this.dependencies.repository)
    const record = repository.findActionRecordById(recordId)
    if (!record) {
      throw new ActionRecordApplicationError('not-found', 'Action record was not found.')
    }
    return detail(repository, record)
  }

  public addConfirmedUnderstandingToActionRecord(input: {
    readonly actionRecordId: string
    readonly expectedGoalId: string
    readonly text: string
  }): UnderstandingView {
    const now = this.dependencies.clock.nowInstant()
    try {
      return this.dependencies.unitOfWork.transaction((baseRepository) => {
        const repository = asActionRecordRepository(baseRepository)
        const record = repository.findActionRecordById(input.actionRecordId)
        if (!record) {
          throw new ActionRecordApplicationError('not-found', 'Action record was not found.')
        }
        const action = repository.findActionById(record.actionId)
        if (!action) {
          throw new ActionRecordApplicationError('not-found', 'Action was not found.')
        }
        if (action.goalId !== input.expectedGoalId) {
          throw new ActionRecordApplicationError(
            'invariant-violation',
            'The Action record no longer belongs to the expected Goal.'
          )
        }
        const goal = repository.findGoalById(input.expectedGoalId)
        if (!goal) {
          throw new ActionRecordApplicationError('not-found', 'Goal was not found.')
        }
        if (goal.status !== 'active') {
          throw new ActionRecordApplicationError(
            'invalid-transition',
            'A confirmed Understanding requires an active Goal.'
          )
        }
        const understanding = createConfirmedAiUnderstanding({
          id: this.dependencies.generateId(),
          actionRecordId: record.id,
          text: input.text,
          now
        })
        repository.saveUnderstanding(understanding)
        return Object.freeze({
          id: understanding.id,
          text: understanding.text,
          source: understanding.source,
          createdAt: understanding.createdAt
        })
      })
    } catch (error) {
      mapDomainError(error)
    }
  }

  private applyPostRecord(
    repository: ActionRecordRepositoryPort,
    current: ActionPersistenceRecord,
    goal: GoalPersistenceRecord | null,
    recordedNextStep: string | null,
    choice: PostRecordChoice | undefined,
    now: string,
    currentLocalDate: string
  ): string | null {
    const actionChoice = choice?.action ?? 'keep-pending'
    const transition =
      actionChoice === 'keep-pending'
        ? null
        : actionChoice === 'complete'
          ? 'complete'
          : actionChoice === 'cancel'
            ? 'cancel'
            : 'reschedule'
    const isCurrentNext = goal?.currentNextActionId === current.id
    const resolution = choice?.currentNextResolution
    const applyRecordedNextStep = choice?.applyRecordedNextStep === true

    if (applyRecordedNextStep && resolution) {
      throw new ActionRecordApplicationError(
        'invariant-violation',
        'Recorded next-step application cannot be combined with another current-next resolution.'
      )
    }
    if (!transition && resolution) {
      throw new ActionRecordApplicationError(
        'invariant-violation',
        'A current-next resolution is only allowed with an Action transition.'
      )
    }
    if (transition && isCurrentNext !== Boolean(resolution || applyRecordedNextStep)) {
      throw new ActionRecordApplicationError(
        'invariant-violation',
        isCurrentNext
          ? 'A current-next resolution is required.'
          : 'A current-next resolution is not allowed for this Action.'
      )
    }
    if (applyRecordedNextStep && (!goal || !recordedNextStep)) {
      throw new ActionRecordApplicationError(
        'invariant-violation',
        'Applying a recorded next step requires an active linked Goal and next-step text.'
      )
    }

    let replacement: Action | null = null
    const createFromRecord =
      applyRecordedNextStep || resolution?.kind === 'create-from-recorded-next-step'
    if (createFromRecord) {
      if (!goal || !recordedNextStep) {
        throw new ActionRecordApplicationError(
          'invariant-violation',
          'Creating the next Action requires an active linked Goal and recorded next-step text.'
        )
      }
      replacement = createAction({
        id: this.dependencies.generateId(),
        goalId: goal.id,
        title: recordedNextStep,
        now
      })
    } else if (resolution?.kind === 'use-existing') {
      replacement = actionFromPersistence(loadAction(repository, resolution.actionId))
    }

    if (transition) {
      const changed = transitionAction(actionFromPersistence(current), transition, now)
      repository.saveAction(changed)
      if (isCurrentNext && goal) {
        const currentNextActionId = resolveCurrentNextActionId({
          goal,
          transitionedActionId: current.id,
          replacement
        })
        if (replacement && createFromRecord) repository.saveAction(replacement)
        repository.saveGoal({ ...goal, currentNextActionId, updatedAt: now })
      }
      if (transition === 'reschedule') {
        repository.deleteTodaySelection(current.id, currentLocalDate)
      }
    } else if (replacement && goal) {
      repository.saveAction(replacement)
      repository.saveGoal({ ...goal, currentNextActionId: replacement.id, updatedAt: now })
    }

    if (transition && !isCurrentNext && replacement && goal) {
      repository.saveAction(replacement)
      repository.saveGoal({ ...goal, currentNextActionId: replacement.id, updatedAt: now })
    }
    return replacement?.id ?? null
  }
}
