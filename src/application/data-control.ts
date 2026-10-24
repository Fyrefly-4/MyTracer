import type { ClockPort } from './ports/clock'
import {
  asDataControlRepository,
  type ActionRecordPersistenceRecord,
  type ConfusionPersistenceRecord,
  type CorePersistenceSnapshot,
  type DataControlRepositoryPort,
  type RepositoryPort,
  type RoutineRecordPersistenceRecord,
  type UnderstandingPersistenceRecord,
  type UnitOfWorkPort
} from './ports/persistence'
import {
  ActionRecordDomainError,
  createActionRecord,
  createManualUnderstanding,
  createOpenConfusion,
  updateActionRecord,
  updateConfusion,
  updateUnderstanding,
  type ActionRecordOutcome
} from '../domain/action-record'
import {
  createRoutineRecord,
  RoutineRecordDomainError,
  updateRoutineRecord,
  type RoutineRecordOutcome
} from '../domain/routine-record'
import { createLocalDate } from '../domain/local-date'
import {
  countDeleteImpact,
  DataControlDomainError,
  fingerprintDeleteImpact,
  normalizeDeleteImpact,
  normalizeDeleteTarget,
  type DeleteImpact,
  type DeleteImpactCounts,
  type DeleteTarget
} from '../domain/data-control'

export type DataControlApplicationErrorCode =
  | 'validation'
  | 'not-found'
  | 'invalid-transition'
  | 'record-already-exists'
  | 'delete-preview-stale'
  | 'invariant-violation'

export class DataControlApplicationError extends Error {
  public constructor(
    readonly code: DataControlApplicationErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'DataControlApplicationError'
  }
}

export interface DeletePreviewView {
  readonly target: DeleteTarget
  readonly counts: DeleteImpactCounts
  readonly fingerprint: string
}

export interface DataControlServiceDependencies {
  readonly repository: RepositoryPort
  readonly unitOfWork: UnitOfWorkPort
  readonly clock: ClockPort
  readonly generateId: () => string
}

function mapDomainError(error: unknown): never {
  if (
    error instanceof ActionRecordDomainError ||
    error instanceof RoutineRecordDomainError ||
    error instanceof DataControlDomainError
  ) {
    throw new DataControlApplicationError('validation', error.message)
  }
  throw error
}

function actionRecordView(record: ActionRecordPersistenceRecord): ActionRecordPersistenceRecord {
  return Object.freeze({ ...record })
}

function routineRecordView(record: RoutineRecordPersistenceRecord): RoutineRecordPersistenceRecord {
  return Object.freeze({ ...record })
}

function assertUpdated(changed: boolean, entity: string): void {
  if (!changed) {
    throw new DataControlApplicationError('not-found', `${entity} was not found.`)
  }
}

function assertDeleteResult(repository: DataControlRepositoryPort, impact: DeleteImpact): void {
  if (repository.findDeleteImpact(impact.target) !== null) {
    throw new DataControlApplicationError(
      'invariant-violation',
      'The delete target remained after deletion.'
    )
  }
  const snapshot = repository.readSnapshot()
  const remaining = {
    goals: new Set(snapshot.goals.map((item) => item.id)),
    actions: new Set(snapshot.actions.map((item) => item.id)),
    routines: new Set(snapshot.routines.map((item) => item.id)),
    actionRecords: new Set(snapshot.actionRecords.map((item) => item.id)),
    routineRecords: new Set(snapshot.routineRecords.map((item) => item.id)),
    understandings: new Set(snapshot.understandings.map((item) => item.id)),
    confusions: new Set(snapshot.confusions.map((item) => item.id)),
    reviewResults: new Set(snapshot.reviewResults.map((item) => item.id))
  }
  const remainingScheduleDays = new Set(
    snapshot.routineScheduleDays.map((item) => `${item.routineId}|${item.weekday}`)
  )
  const remainingTodaySelections = new Set(
    snapshot.todaySelections.map((item) => `${item.actionId}|${item.selectedFor}`)
  )
  for (const key of [
    'goals',
    'actions',
    'routines',
    'actionRecords',
    'routineRecords',
    'understandings',
    'confusions',
    'reviewResults'
  ] as const) {
    if (impact[key].some((id) => remaining[key].has(id))) {
      throw new DataControlApplicationError(
        'invariant-violation',
        `Delete result did not match preview for ${key}.`
      )
    }
  }
  if (
    impact.routineScheduleDays.some((id) => remainingScheduleDays.has(id)) ||
    impact.todaySelections.some((id) => remainingTodaySelections.has(id))
  ) {
    throw new DataControlApplicationError(
      'invariant-violation',
      'Delete result did not match previewed dependent facts.'
    )
  }
  const detachedRoutineIds = impact.detachedRoutines.map((relation) => relation.split('|')[0])
  const detachedReviewIds = impact.detachedReviewResults.map((relation) => relation.split('|')[0])
  const clearedGoalIds = impact.clearedCurrentNext.map((relation) => relation.split('|')[0])
  if (
    snapshot.routines.some(
      (item) => detachedRoutineIds.includes(item.id) && item.goalId !== null
    ) ||
    snapshot.reviewResults.some(
      (item) => detachedReviewIds.includes(item.id) && item.goalId !== null
    ) ||
    snapshot.goals.some(
      (item) => clearedGoalIds.includes(item.id) && item.currentNextActionId !== null
    )
  ) {
    throw new DataControlApplicationError(
      'invariant-violation',
      'Delete result did not match previewed relationship changes.'
    )
  }
}

function deletedIds<T extends { readonly id: string }>(before: readonly T[], after: readonly T[]) {
  const remaining = new Set(after.map((item) => item.id))
  return before.filter((item) => !remaining.has(item.id)).map((item) => item.id)
}

function actualDeleteImpact(
  target: DeleteTarget,
  before: CorePersistenceSnapshot,
  after: CorePersistenceSnapshot
): DeleteImpact {
  const afterRoutines = new Map(after.routines.map((item) => [item.id, item]))
  const afterReviews = new Map(after.reviewResults.map((item) => [item.id, item]))
  const afterGoals = new Map(after.goals.map((item) => [item.id, item]))
  const afterScheduleDays = new Set(
    after.routineScheduleDays.map((item) => `${item.routineId}|${item.weekday}`)
  )
  const afterTodaySelections = new Set(
    after.todaySelections.map((item) => `${item.actionId}|${item.selectedFor}`)
  )
  return normalizeDeleteImpact({
    target,
    goals: deletedIds(before.goals, after.goals),
    actions: deletedIds(before.actions, after.actions),
    routines: deletedIds(before.routines, after.routines),
    routineScheduleDays: before.routineScheduleDays
      .map((item) => `${item.routineId}|${item.weekday}`)
      .filter((id) => !afterScheduleDays.has(id)),
    todaySelections: before.todaySelections
      .map((item) => `${item.actionId}|${item.selectedFor}`)
      .filter((id) => !afterTodaySelections.has(id)),
    actionRecords: deletedIds(before.actionRecords, after.actionRecords),
    routineRecords: deletedIds(before.routineRecords, after.routineRecords),
    understandings: deletedIds(before.understandings, after.understandings),
    confusions: deletedIds(before.confusions, after.confusions),
    reviewResults: deletedIds(before.reviewResults, after.reviewResults),
    detachedRoutines: before.routines
      .filter((item) => item.goalId !== null && afterRoutines.get(item.id)?.goalId === null)
      .map((item) => `${item.id}|${item.goalId}`),
    detachedReviewResults: before.reviewResults
      .filter((item) => item.goalId !== null && afterReviews.get(item.id)?.goalId === null)
      .map((item) => `${item.id}|${item.goalId}`),
    clearedCurrentNext: before.goals
      .filter(
        (item) =>
          item.currentNextActionId !== null && afterGoals.get(item.id)?.currentNextActionId === null
      )
      .map((item) => `${item.id}|${item.currentNextActionId}`)
  })
}

export class DataControlService {
  public constructor(private readonly dependencies: DataControlServiceDependencies) {}

  public listData() {
    const snapshot = this.dependencies.repository.readSnapshot()
    return Object.freeze({
      goals: Object.freeze(snapshot.goals.map(({ id, title, status }) => ({ id, title, status }))),
      actions: Object.freeze(
        snapshot.actions.map(({ id, goalId, title, status }) => ({ id, goalId, title, status }))
      ),
      routines: Object.freeze(
        snapshot.routines.map(({ id, goalId, name, status }) => ({ id, goalId, name, status }))
      ),
      actionRecords: Object.freeze([...snapshot.actionRecords]),
      routineRecords: Object.freeze([...snapshot.routineRecords]),
      understandings: Object.freeze([...snapshot.understandings]),
      confusions: Object.freeze([...snapshot.confusions])
    })
  }

  public backfillActionRecord(input: {
    readonly actionId: string
    readonly occurredOn: string
    readonly durationMinutes: number | null
    readonly outcome: ActionRecordOutcome
    readonly understanding?: string | null
    readonly confusion?: string | null
    readonly nextStep?: string | null
    readonly note?: string | null
  }): ActionRecordPersistenceRecord {
    const now = this.dependencies.clock.snapshot().instant
    try {
      return this.dependencies.unitOfWork.transaction((baseRepository) => {
        const repository = asDataControlRepository(baseRepository)
        if (!repository.findActionById(input.actionId)) {
          throw new DataControlApplicationError('not-found', 'Action was not found.')
        }
        const record = createActionRecord({
          id: this.dependencies.generateId(),
          ...input,
          now
        })
        if (!repository.createActionRecord(record)) {
          throw new DataControlApplicationError(
            'invariant-violation',
            'Action record id already exists.'
          )
        }
        if (input.understanding?.trim()) {
          repository.saveUnderstanding(
            createManualUnderstanding({
              id: this.dependencies.generateId(),
              actionRecordId: record.id,
              text: input.understanding,
              now
            })
          )
        }
        if (input.confusion?.trim()) {
          repository.saveConfusion(
            createOpenConfusion({
              id: this.dependencies.generateId(),
              actionRecordId: record.id,
              text: input.confusion,
              now
            })
          )
        }
        return actionRecordView(record)
      })
    } catch (error) {
      mapDomainError(error)
    }
  }

  public updateActionRecord(input: {
    readonly recordId: string
    readonly occurredOn: string
    readonly durationMinutes: number | null
    readonly outcome: ActionRecordOutcome
    readonly nextStep?: string | null
    readonly note?: string | null
  }): ActionRecordPersistenceRecord {
    const now = this.dependencies.clock.snapshot().instant
    try {
      return this.dependencies.unitOfWork.transaction((baseRepository) => {
        const repository = asDataControlRepository(baseRepository)
        const current = repository.findActionRecordById(input.recordId)
        if (!current) {
          throw new DataControlApplicationError('not-found', 'Action record was not found.')
        }
        const updated = updateActionRecord(current, { ...input, now })
        assertUpdated(repository.updateActionRecord(updated), 'Action record')
        return actionRecordView(updated)
      })
    } catch (error) {
      mapDomainError(error)
    }
  }

  public backfillRoutineRecord(input: {
    readonly routineId: string
    readonly occurredOn: string
    readonly outcome: RoutineRecordOutcome
    readonly plannedForDate: boolean
    readonly durationMinutes?: number | null
    readonly note?: string | null
  }): RoutineRecordPersistenceRecord {
    const now = this.dependencies.clock.snapshot().instant
    try {
      return this.dependencies.unitOfWork.transaction((baseRepository) => {
        const repository = asDataControlRepository(baseRepository)
        if (!repository.findRoutineById(input.routineId)) {
          throw new DataControlApplicationError('not-found', 'Routine was not found.')
        }
        if (repository.findRoutineRecordByRoutineAndDate(input.routineId, input.occurredOn)) {
          throw new DataControlApplicationError(
            'record-already-exists',
            'This Routine already has a record for the selected date.'
          )
        }
        const record = createRoutineRecord({
          id: this.dependencies.generateId(),
          ...input,
          plannedForDateBasis: 'user_confirmed_history',
          now
        })
        const persisted = { ...record, occurredOn: String(record.occurredOn) }
        if (!repository.createRoutineRecord(persisted)) {
          throw new DataControlApplicationError(
            'record-already-exists',
            'This Routine already has a record for the selected date.'
          )
        }
        return routineRecordView(persisted)
      })
    } catch (error) {
      mapDomainError(error)
    }
  }

  public updateRoutineRecord(input: {
    readonly recordId: string
    readonly occurredOn: string
    readonly outcome: RoutineRecordOutcome
    readonly plannedForDate?: boolean
    readonly durationMinutes?: number | null
    readonly note?: string | null
  }): RoutineRecordPersistenceRecord {
    const now = this.dependencies.clock.snapshot().instant
    try {
      return this.dependencies.unitOfWork.transaction((baseRepository) => {
        const repository = asDataControlRepository(baseRepository)
        const current = repository.findRoutineRecordById(input.recordId)
        if (!current) {
          throw new DataControlApplicationError('not-found', 'Routine record was not found.')
        }
        const dateChanged = current.occurredOn !== input.occurredOn
        if (dateChanged && input.plannedForDate === undefined) {
          throw new DataControlApplicationError(
            'validation',
            'Changing a Routine record date requires confirmed historical plan status.'
          )
        }
        const conflicting = repository.findRoutineRecordByRoutineAndDate(
          current.routineId,
          input.occurredOn
        )
        if (conflicting && conflicting.id !== current.id) {
          throw new DataControlApplicationError(
            'record-already-exists',
            'This Routine already has a record for the selected date.'
          )
        }
        const updated = updateRoutineRecord(
          { ...current, occurredOn: createLocalDate(current.occurredOn) },
          {
            ...input,
            plannedForDate: dateChanged ? input.plannedForDate! : current.plannedForDate,
            plannedForDateBasis: dateChanged
              ? 'user_confirmed_history'
              : current.plannedForDateBasis,
            durationMinutes:
              input.outcome === 'intentional_rest' || input.outcome === 'not_done'
                ? null
                : input.durationMinutes === undefined
                  ? current.durationMinutes
                  : input.durationMinutes,
            note: input.note === undefined ? current.note : input.note,
            now
          }
        )
        const persisted = { ...updated, occurredOn: String(updated.occurredOn) }
        assertUpdated(repository.updateRoutineRecord(persisted), 'Routine record')
        return routineRecordView(persisted)
      })
    } catch (error) {
      mapDomainError(error)
    }
  }

  public updateUnderstandingText(id: string, text: string): UnderstandingPersistenceRecord {
    return this.changeUnderstanding(id, (current, now) =>
      updateUnderstanding({ ...current, text, now })
    )
  }

  public revokeUnderstanding(id: string): UnderstandingPersistenceRecord {
    return this.changeUnderstanding(id, (current, now) => {
      if (current.revokedAt !== null) {
        throw new DataControlApplicationError(
          'invalid-transition',
          'Understanding is already revoked.'
        )
      }
      return updateUnderstanding({ ...current, revokedAt: now, now })
    })
  }

  public updateConfusionText(id: string, text: string): ConfusionPersistenceRecord {
    return this.changeConfusion(id, (current, now) => updateConfusion({ ...current, text, now }))
  }

  public resolveConfusion(id: string, resolution?: string | null): ConfusionPersistenceRecord {
    return this.changeConfusion(id, (current, now) => {
      if (current.status !== 'open') {
        throw new DataControlApplicationError(
          'invalid-transition',
          'Confusion is already resolved.'
        )
      }
      return updateConfusion({
        ...current,
        status: 'resolved',
        resolvedAt: now,
        resolution: resolution ?? null,
        now
      })
    })
  }

  public reopenConfusion(id: string): ConfusionPersistenceRecord {
    return this.changeConfusion(id, (current, now) => {
      if (current.status !== 'resolved') {
        throw new DataControlApplicationError('invalid-transition', 'Confusion is already open.')
      }
      return updateConfusion({
        ...current,
        status: 'open',
        resolvedAt: null,
        resolution: null,
        now
      })
    })
  }

  public previewDelete(targetInput: DeleteTarget): DeletePreviewView {
    try {
      const target = normalizeDeleteTarget(targetInput)
      return this.dependencies.unitOfWork.transaction((baseRepository) => {
        const impact = asDataControlRepository(baseRepository).findDeleteImpact(target)
        if (!impact)
          throw new DataControlApplicationError('not-found', 'Delete target was not found.')
        const normalized = normalizeDeleteImpact(impact)
        return Object.freeze({
          target,
          counts: countDeleteImpact(normalized),
          fingerprint: fingerprintDeleteImpact(normalized)
        })
      })
    } catch (error) {
      mapDomainError(error)
    }
  }

  public confirmDelete(targetInput: DeleteTarget, trustedFingerprint: string): DeleteImpactCounts {
    try {
      const target = normalizeDeleteTarget(targetInput)
      return this.dependencies.unitOfWork.transaction((baseRepository) => {
        const repository = asDataControlRepository(baseRepository)
        const impact = repository.findDeleteImpact(target)
        if (!impact) {
          throw new DataControlApplicationError(
            'delete-preview-stale',
            'Delete target changed after preview.'
          )
        }
        const normalized = normalizeDeleteImpact(impact)
        if (fingerprintDeleteImpact(normalized) !== trustedFingerprint) {
          throw new DataControlApplicationError(
            'delete-preview-stale',
            'Delete impact changed after preview.'
          )
        }
        const before = repository.readSnapshot()
        if (!repository.deleteRoot(target)) {
          throw new DataControlApplicationError('not-found', 'Delete target was not found.')
        }
        assertDeleteResult(repository, normalized)
        const actual = actualDeleteImpact(target, before, repository.readSnapshot())
        if (fingerprintDeleteImpact(actual) !== trustedFingerprint) {
          throw new DataControlApplicationError(
            'invariant-violation',
            'Actual delete effects did not match the preview.'
          )
        }
        return countDeleteImpact(normalized)
      })
    } catch (error) {
      mapDomainError(error)
    }
  }

  private changeUnderstanding(
    id: string,
    change: (current: UnderstandingPersistenceRecord, now: string) => UnderstandingPersistenceRecord
  ): UnderstandingPersistenceRecord {
    const now = this.dependencies.clock.snapshot().instant
    try {
      return this.dependencies.unitOfWork.transaction((baseRepository) => {
        const repository = asDataControlRepository(baseRepository)
        const current = repository.findUnderstandingById(id)
        if (!current) {
          throw new DataControlApplicationError('not-found', 'Understanding was not found.')
        }
        const updated = change(current, now)
        assertUpdated(repository.updateUnderstanding(updated), 'Understanding')
        return Object.freeze({ ...updated })
      })
    } catch (error) {
      mapDomainError(error)
    }
  }

  private changeConfusion(
    id: string,
    change: (current: ConfusionPersistenceRecord, now: string) => ConfusionPersistenceRecord
  ): ConfusionPersistenceRecord {
    const now = this.dependencies.clock.snapshot().instant
    try {
      return this.dependencies.unitOfWork.transaction((baseRepository) => {
        const repository = asDataControlRepository(baseRepository)
        const current = repository.findConfusionById(id)
        if (!current) {
          throw new DataControlApplicationError('not-found', 'Confusion was not found.')
        }
        const updated = change(current, now)
        assertUpdated(repository.updateConfusion(updated), 'Confusion')
        return Object.freeze({ ...updated })
      })
    } catch (error) {
      mapDomainError(error)
    }
  }
}
