import type { ClockPort } from './ports/clock'
import {
  asActionRepository,
  type ActionRepositoryPort,
  type RepositoryPort,
  type UnitOfWorkPort
} from './ports/persistence'
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

export interface TodayView {
  readonly localDate: string
  readonly focuses: readonly ActionDetailView[]
  readonly availableActions: readonly ActionDetailView[]
}

export interface TodayServiceDependencies {
  readonly repository: RepositoryPort
  readonly unitOfWork: UnitOfWorkPort
  readonly clock: ClockPort
}

function mapDomainError(error: unknown): never {
  if (error instanceof ActionDomainError) {
    throw new ActionApplicationError(error.code, error.message)
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
  const focuses = repository
    .listTodaySelectionsOn(localDate)
    .filter((selection) => selection.kind === 'focus')
    .map((selection) => buildActionDetail(repository, selection.actionId, localDate))
  const availableActions = repository
    .listActions()
    .map((action) => buildActionDetail(repository, action.id, localDate))
  return Object.freeze({
    localDate,
    focuses: Object.freeze(focuses),
    availableActions: Object.freeze(availableActions)
  })
}

export class TodayService {
  public constructor(private readonly dependencies: TodayServiceDependencies) {}

  public selectActionForToday(actionId: string): ActionDetailView {
    const snapshot = this.dependencies.clock.snapshot()
    try {
      return this.dependencies.unitOfWork.transaction((baseRepository) => {
        const repository = asActionRepository(baseRepository)
        const current = loadAction(repository, actionId)
        const goal = linkedGoal(repository, current.goalId)
        assertActionCanBeSelectedForToday(actionFromPersistence(current), goal)
        const existing = repository.findTodaySelection(actionId, String(snapshot.localDate))
        if (existing && existing.kind !== 'focus') {
          throw new ActionApplicationError(
            'invariant-violation',
            'This Action already has another Today commitment.'
          )
        }
        const restored = restoreRescheduledActionForToday(
          actionFromPersistence(current),
          snapshot.instant
        )
        if (restored !== current && current.status === 'rescheduled') {
          repository.saveAction(restored)
        }
        if (!existing) {
          repository.saveTodaySelection({
            actionId,
            selectedFor: String(snapshot.localDate),
            kind: 'focus',
            selectedBy: 'user',
            createdAt: snapshot.instant
          })
        }
        return buildActionDetail(repository, actionId, String(snapshot.localDate))
      })
    } catch (error) {
      mapDomainError(error)
    }
  }

  public removeActionFromToday(actionId: string): TodayView {
    const snapshot = this.dependencies.clock.snapshot()
    return this.dependencies.unitOfWork.transaction((baseRepository) => {
      const repository = asActionRepository(baseRepository)
      loadAction(repository, actionId)
      const existing = repository.findTodaySelection(actionId, String(snapshot.localDate))
      if (existing?.kind === 'intention') {
        throw new ActionApplicationError(
          'invariant-violation',
          'T012 cannot remove an intention selection.'
        )
      }
      if (existing) {
        repository.deleteTodaySelection(actionId, String(snapshot.localDate))
      }
      return buildTodayView(repository, String(snapshot.localDate))
    })
  }

  public getToday(): TodayView {
    const snapshot = this.dependencies.clock.snapshot()
    return buildTodayView(
      asActionRepository(this.dependencies.repository),
      String(snapshot.localDate)
    )
  }
}
