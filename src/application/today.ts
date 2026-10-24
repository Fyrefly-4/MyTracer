import type { ClockPort } from './ports/clock'
import {
  asActionRepository,
  asRoutineRecordRepository,
  type ActionRepositoryPort,
  type RepositoryPort,
  type UnitOfWorkPort
} from './ports/persistence'
import { buildRoutineDetail } from './routines'
import {
  ActionApplicationError,
  actionFromPersistence,
  buildActionDetail,
  loadAction,
  type ActionDetailView
} from './actions'
import {
  ActionDomainError,
  assertActionCanBeSelectedForToday,
  restoreRescheduledActionForToday
} from '../domain/action'
import { createLocalDate } from '../domain/local-date'
import { isRoutinePlannedOn, normalizeRoutineArrangement } from '../domain/routine'
import { routineRecordView, type RoutineRecordView } from './routine-records'
import type { RoutineRecordState } from '../domain/routine-record'
import {
  assertTodayCommitmentChange,
  assertTodaySelectionCanBeRemoved,
  decideTodaySelectionCreate,
  TodaySelectionDomainError,
  type TodayCommitment
} from '../domain/today-selection'

export type TodayApplicationErrorCode = ActionApplicationError['code'] | 'selection-conflict'

export class TodayApplicationError extends Error {
  public constructor(
    readonly code: TodayApplicationErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'TodayApplicationError'
  }
}

export interface TodayActionView extends ActionDetailView {
  readonly commitment: TodayCommitment
}

export interface TodayPlannedRoutineView {
  readonly id: string
  readonly name: string
  readonly minimumAction: string
  readonly goal: ReturnType<typeof buildRoutineDetail>['goal']
  readonly plannedForToday: boolean
  readonly canRecord: true
  readonly recordState: RoutineRecordState
  readonly record: RoutineRecordView | null
}

export interface TodayView {
  readonly localDate: string
  readonly focuses: readonly TodayActionView[]
  readonly intentions: readonly TodayActionView[]
  readonly availableActions: readonly ActionDetailView[]
  readonly plannedRoutines: readonly TodayPlannedRoutineView[]
  readonly unscheduledRoutines: readonly TodayPlannedRoutineView[]
}

export interface TodayServiceDependencies {
  readonly repository: RepositoryPort
  readonly unitOfWork: UnitOfWorkPort
  readonly clock: ClockPort
}

function mapDomainError(error: unknown): never {
  if (error instanceof ActionDomainError) {
    throw new TodayApplicationError(error.code, error.message)
  }
  if (error instanceof TodaySelectionDomainError) {
    throw new TodayApplicationError(error.code, error.message)
  }
  throw error
}

function linkedGoal(repository: RepositoryPort, goalId: string | null) {
  if (!goalId) return null
  const goal = repository.findGoalById(goalId)
  if (!goal) {
    throw new ActionApplicationError('invariant-violation', 'The linked Goal was not found.')
  }
  return goal
}

export function buildTodayView(repository: ActionRepositoryPort, localDate: string): TodayView {
  const selections = repository.listTodaySelectionsOn(localDate)
  const toTodayAction = (selection: (typeof selections)[number]): TodayActionView =>
    Object.freeze({
      ...buildActionDetail(repository, selection.actionId, localDate),
      commitment: selection.kind
    })
  const focuses = selections.filter((selection) => selection.kind === 'focus').map(toTodayAction)
  const intentions = selections
    .filter((selection) => selection.kind === 'intention')
    .map(toTodayAction)
  const availableActions = repository
    .listActions()
    .map((action) => buildActionDetail(repository, action.id, localDate))
  const routineRepository = asRoutineRecordRepository(repository)
  const activeRoutines = routineRepository
    .listRoutines('active')
    .map((record) => buildRoutineDetail(routineRepository, record))
    .map((routine) => ({
      routine,
      planned: isRoutinePlannedOn(
        Object.freeze({
          ...routine,
          weekdays: normalizeRoutineArrangement(routine.arrangementMode, routine.weekdays)
        }),
        createLocalDate(localDate)
      )
    }))
    .filter(({ routine, planned }) => planned || routine.arrangementMode === 'unscheduled')
    .map(({ routine, planned }) => {
      const record = routineRepository.findRoutineRecordByRoutineAndDate(routine.id, localDate)
      return Object.freeze<TodayPlannedRoutineView>({
        id: routine.id,
        name: routine.name,
        minimumAction: routine.minimumAction,
        goal: routine.goal,
        plannedForToday: planned,
        canRecord: true,
        recordState: record?.outcome ?? 'unknown',
        record: record ? routineRecordView(record) : null
      })
    })
  return Object.freeze({
    localDate,
    focuses: Object.freeze(focuses),
    intentions: Object.freeze(intentions),
    availableActions: Object.freeze(availableActions),
    plannedRoutines: Object.freeze(activeRoutines.filter((routine) => routine.plannedForToday)),
    unscheduledRoutines: Object.freeze(activeRoutines.filter((routine) => !routine.plannedForToday))
  })
}

export class TodayService {
  public constructor(private readonly dependencies: TodayServiceDependencies) {}

  public selectActionForToday(actionId: string): ActionDetailView {
    return this.selectAction(actionId, 'focus')
  }

  public selectActionAsIntentionForToday(actionId: string): ActionDetailView {
    return this.selectAction(actionId, 'intention')
  }

  private selectAction(actionId: string, commitment: TodayCommitment): ActionDetailView {
    const snapshot = this.dependencies.clock.snapshot()
    try {
      return this.dependencies.unitOfWork.transaction((baseRepository) => {
        const repository = asActionRepository(baseRepository)
        const current = loadAction(repository, actionId)
        const goal = linkedGoal(repository, current.goalId)
        assertActionCanBeSelectedForToday(actionFromPersistence(current), goal)
        const existing = repository.findTodaySelection(actionId, String(snapshot.localDate))
        const decision = decideTodaySelectionCreate(existing?.kind ?? null, commitment)
        const restored = restoreRescheduledActionForToday(
          actionFromPersistence(current),
          snapshot.instant
        )
        if (restored !== current && current.status === 'rescheduled') {
          repository.saveAction(restored)
        }
        if (decision === 'create') {
          const created = repository.createTodaySelection({
            actionId,
            selectedFor: String(snapshot.localDate),
            kind: commitment,
            selectedBy: 'user',
            createdAt: snapshot.instant
          })
          if (!created) {
            const concurrent = repository.findTodaySelection(actionId, String(snapshot.localDate))
            decideTodaySelectionCreate(concurrent?.kind ?? null, commitment)
          }
        }
        return buildActionDetail(repository, actionId, String(snapshot.localDate))
      })
    } catch (error) {
      mapDomainError(error)
    }
  }

  public removeActionFromToday(actionId: string): TodayView {
    return this.removeAction(actionId, 'focus')
  }

  public removeActionIntentionFromToday(actionId: string): TodayView {
    return this.removeAction(actionId, 'intention')
  }

  private removeAction(actionId: string, commitment: TodayCommitment): TodayView {
    const snapshot = this.dependencies.clock.snapshot()
    try {
      return this.dependencies.unitOfWork.transaction((baseRepository) => {
        const repository = asActionRepository(baseRepository)
        loadAction(repository, actionId)
        const existing = repository.findTodaySelection(actionId, String(snapshot.localDate))
        assertTodaySelectionCanBeRemoved(existing?.kind ?? null, commitment)
        if (existing) {
          const deleted = repository.deleteTodaySelectionByKind(
            actionId,
            String(snapshot.localDate),
            commitment
          )
          if (!deleted) {
            throw new TodayApplicationError(
              'invariant-violation',
              'The Today commitment changed before it could be removed.'
            )
          }
        }
        return buildTodayView(repository, String(snapshot.localDate))
      })
    } catch (error) {
      mapDomainError(error)
    }
  }

  public changeActionTodayCommitment(
    actionId: string,
    commitment: TodayCommitment
  ): ActionDetailView {
    const snapshot = this.dependencies.clock.snapshot()
    try {
      return this.dependencies.unitOfWork.transaction((baseRepository) => {
        const repository = asActionRepository(baseRepository)
        const current = loadAction(repository, actionId)
        const goal = linkedGoal(repository, current.goalId)
        assertActionCanBeSelectedForToday(actionFromPersistence(current), goal)
        const existing = repository.findTodaySelection(actionId, String(snapshot.localDate))
        const currentCommitment = existing?.kind ?? null
        assertTodayCommitmentChange(currentCommitment, commitment)
        const changed = repository.updateTodaySelectionCommitment(
          actionId,
          String(snapshot.localDate),
          currentCommitment,
          commitment
        )
        if (!changed) {
          throw new TodayApplicationError(
            'invariant-violation',
            'The Today commitment changed before it could be updated.'
          )
        }
        return buildActionDetail(repository, actionId, String(snapshot.localDate))
      })
    } catch (error) {
      mapDomainError(error)
    }
  }

  public getToday(): TodayView {
    const snapshot = this.dependencies.clock.snapshot()
    return buildTodayView(
      asActionRepository(this.dependencies.repository),
      String(snapshot.localDate)
    )
  }
}
