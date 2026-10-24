import type { ClockPort } from './ports/clock'
import {
  asRoutineRepository,
  type GoalPersistenceRecord,
  type RepositoryPort,
  type RoutinePersistenceRecord,
  type RoutineRepositoryPort,
  type RoutineStatus,
  type UnitOfWorkPort
} from './ports/persistence'
import {
  createRoutine,
  normalizeRoutineArrangement,
  replaceRoutineSchedule,
  RoutineDomainError,
  transitionRoutine,
  updateRoutineDetails,
  type Routine
} from '../domain/routine'

export type RoutineApplicationErrorCode =
  'validation' | 'not-found' | 'invalid-transition' | 'invariant-violation'

export class RoutineApplicationError extends Error {
  public constructor(
    readonly code: RoutineApplicationErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'RoutineApplicationError'
  }
}

export interface RoutineGoalSummaryView {
  readonly id: string
  readonly name: string
  readonly status: GoalPersistenceRecord['status']
}

export interface RoutineSummaryView {
  readonly id: string
  readonly goalId: string | null
  readonly name: string
  readonly description: string | null
  readonly minimumAction: string
  readonly status: RoutineStatus
  readonly arrangementMode: 'weekly' | 'unscheduled'
  readonly weekdays: readonly number[]
  readonly createdAt: string
  readonly updatedAt: string
}

export interface RoutineDetailView extends RoutineSummaryView {
  readonly goal: RoutineGoalSummaryView | null
}

export interface RoutineServiceDependencies {
  readonly repository: RepositoryPort
  readonly unitOfWork: UnitOfWorkPort
  readonly clock: ClockPort
  readonly generateId: () => string
}

function mapDomainError(error: unknown): never {
  if (error instanceof RoutineDomainError) {
    throw new RoutineApplicationError(error.code, error.message)
  }
  throw error
}

function loadRoutine(
  repository: RoutineRepositoryPort,
  routineId: string
): RoutinePersistenceRecord {
  const routine = repository.findRoutineById(routineId)
  if (!routine) throw new RoutineApplicationError('not-found', 'Routine was not found.')
  return routine
}

function routineFromPersistence(
  repository: RoutineRepositoryPort,
  record: RoutinePersistenceRecord
): Routine {
  return Object.freeze({
    ...record,
    weekdays: normalizeRoutineArrangement(
      record.arrangementMode,
      repository.listRoutineScheduleDays(record.id).map((item) => item.weekday)
    )
  })
}

function routineToPersistence(routine: Routine): RoutinePersistenceRecord {
  return Object.freeze({
    id: routine.id,
    goalId: routine.goalId,
    name: routine.name,
    description: routine.description,
    minimumAction: routine.minimumAction,
    status: routine.status,
    arrangementMode: routine.arrangementMode,
    createdAt: routine.createdAt,
    updatedAt: routine.updatedAt
  })
}

function toSummary(
  repository: RoutineRepositoryPort,
  record: RoutinePersistenceRecord
): RoutineSummaryView {
  return Object.freeze({
    ...record,
    weekdays: normalizeRoutineArrangement(
      record.arrangementMode,
      repository.listRoutineScheduleDays(record.id).map((item) => item.weekday)
    )
  })
}

function linkedGoal(
  repository: RepositoryPort,
  goalId: string | null
): GoalPersistenceRecord | null {
  if (!goalId) return null
  const goal = repository.findGoalById(goalId)
  if (!goal) {
    throw new RoutineApplicationError('invariant-violation', 'The linked Goal was not found.')
  }
  return goal
}

export function buildRoutineDetail(
  repository: RoutineRepositoryPort,
  record: RoutinePersistenceRecord
): RoutineDetailView {
  const goal = linkedGoal(repository, record.goalId)
  return Object.freeze({
    ...toSummary(repository, record),
    goal: goal ? Object.freeze({ id: goal.id, name: goal.title, status: goal.status }) : null
  })
}

export class RoutineService {
  public constructor(private readonly dependencies: RoutineServiceDependencies) {}

  public createRoutine(input: {
    readonly goalId?: string | null
    readonly name: string
    readonly description?: string | null
    readonly minimumAction: string
    readonly arrangementMode: 'weekly' | 'unscheduled'
    readonly weekdays: readonly number[]
  }): RoutineDetailView {
    const snapshot = this.dependencies.clock.snapshot()
    try {
      return this.dependencies.unitOfWork.transaction((baseRepository) => {
        const repository = asRoutineRepository(baseRepository)
        if (input.goalId && !repository.findGoalById(input.goalId)) {
          throw new RoutineApplicationError('not-found', 'Goal was not found.')
        }
        const routine = createRoutine({
          id: this.dependencies.generateId(),
          goalId: input.goalId,
          name: input.name,
          description: input.description,
          minimumAction: input.minimumAction,
          arrangementMode: input.arrangementMode,
          weekdays: input.weekdays,
          now: snapshot.instant
        })
        repository.saveRoutine(routineToPersistence(routine))
        for (const weekday of routine.weekdays) {
          repository.saveRoutineScheduleDay({ routineId: routine.id, weekday })
        }
        return buildRoutineDetail(repository, loadRoutine(repository, routine.id))
      })
    } catch (error) {
      mapDomainError(error)
    }
  }

  public updateRoutineDetails(input: {
    readonly routineId: string
    readonly name: string
    readonly description?: string | null
    readonly minimumAction: string
  }): RoutineDetailView {
    return this.changeRoutine(input.routineId, (routine, now) =>
      updateRoutineDetails(routine, {
        name: input.name,
        description: input.description,
        minimumAction: input.minimumAction,
        now
      })
    )
  }

  public replaceRoutineSchedule(input: {
    readonly routineId: string
    readonly arrangementMode: 'weekly' | 'unscheduled'
    readonly weekdays: readonly number[]
  }): RoutineDetailView {
    const snapshot = this.dependencies.clock.snapshot()
    try {
      return this.dependencies.unitOfWork.transaction((baseRepository) => {
        const repository = asRoutineRepository(baseRepository)
        const current = routineFromPersistence(repository, loadRoutine(repository, input.routineId))
        const changed = replaceRoutineSchedule(
          current,
          input.weekdays,
          snapshot.instant,
          input.arrangementMode
        )
        repository.replaceRoutineScheduleDays(
          changed.id,
          changed.weekdays.map((weekday) => ({ routineId: changed.id, weekday }))
        )
        repository.saveRoutine(routineToPersistence(changed))
        return buildRoutineDetail(repository, loadRoutine(repository, changed.id))
      })
    } catch (error) {
      mapDomainError(error)
    }
  }

  public pauseRoutine(routineId: string): RoutineDetailView {
    return this.changeRoutine(routineId, (routine, now) => transitionRoutine(routine, 'pause', now))
  }

  public resumeRoutine(routineId: string): RoutineDetailView {
    return this.changeRoutine(routineId, (routine, now) =>
      transitionRoutine(routine, 'resume', now)
    )
  }

  public endRoutine(routineId: string): RoutineDetailView {
    return this.changeRoutine(routineId, (routine, now) => transitionRoutine(routine, 'end', now))
  }

  public listRoutines(status?: RoutineStatus): readonly RoutineSummaryView[] {
    const repository = asRoutineRepository(this.dependencies.repository)
    return repository.listRoutines(status).map((routine) => toSummary(repository, routine))
  }

  public getRoutineDetail(routineId: string): RoutineDetailView {
    const repository = asRoutineRepository(this.dependencies.repository)
    return buildRoutineDetail(repository, loadRoutine(repository, routineId))
  }

  private changeRoutine(
    routineId: string,
    change: (routine: Routine, now: string) => Routine
  ): RoutineDetailView {
    const snapshot = this.dependencies.clock.snapshot()
    try {
      return this.dependencies.unitOfWork.transaction((baseRepository) => {
        const repository = asRoutineRepository(baseRepository)
        const current = routineFromPersistence(repository, loadRoutine(repository, routineId))
        const changed = change(current, snapshot.instant)
        repository.saveRoutine(routineToPersistence(changed))
        return buildRoutineDetail(repository, loadRoutine(repository, routineId))
      })
    } catch (error) {
      mapDomainError(error)
    }
  }
}
