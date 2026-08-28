import { buildRecoveryContext, type RecoveryContext } from '../domain/recovery'
import { ProgressService } from './progress'
import type { ClockPort } from './ports/clock'
import {
  asRecoveryRepository,
  type ProgressQueryFilterPersistence,
  type ProgressQuerySnapshotPersistence,
  type RepositoryPort
} from './ports/persistence'

export class RecoveryApplicationError extends Error {
  public constructor(
    readonly code: 'validation' | 'not-found',
    message: string
  ) {
    super(message)
    this.name = 'RecoveryApplicationError'
  }
}

export interface RecoveryServiceDependencies {
  readonly repository: RepositoryPort
  readonly clock: ClockPort
}

export class RecoveryService {
  public constructor(private readonly dependencies: RecoveryServiceDependencies) {}

  public getContext(input: { readonly goalId: string }): RecoveryContext {
    if (!input.goalId) throw new RecoveryApplicationError('validation', 'A Goal ID is required.')
    const clock = this.dependencies.clock.snapshot()
    const snapshot = asRecoveryRepository(this.dependencies.repository).queryRecoverySnapshot(
      input.goalId
    )
    if (!snapshot.goal)
      throw new RecoveryApplicationError('not-found', 'The requested Goal was not found.')
    const snapshotRepository = {
      findGoalById: (id: string) => (id === snapshot.goal?.id ? snapshot.goal : null),
      queryProgressSnapshot: (
        filter: ProgressQueryFilterPersistence
      ): ProgressQuerySnapshotPersistence => {
        if (filter.goalId !== input.goalId || filter.from !== null || filter.through !== null) {
          throw new TypeError('Recovery requested an unexpected Progress snapshot.')
        }
        return snapshot.progress
      }
    } as unknown as RepositoryPort
    const progress = new ProgressService({ repository: snapshotRepository }).getProgress({
      goalId: input.goalId
    })
    return buildRecoveryContext({
      asOfLocalDate: clock.localDate,
      goal: {
        id: snapshot.goal.id,
        name: snapshot.goal.title,
        status: snapshot.goal.status,
        currentNextActionId: snapshot.goal.currentNextActionId
      },
      actions: snapshot.actions,
      progress
    })
  }
}
