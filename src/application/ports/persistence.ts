export type GoalStatus = 'active' | 'paused' | 'ended'
export type ActionStatus = 'pending' | 'completed' | 'cancelled' | 'rescheduled'
export type RoutineStatus = 'active' | 'paused' | 'ended'
export type RoutineRecordOutcome = 'target_met' | 'acted' | 'intentional_rest' | 'not_done'
export type RoutinePlannedForDateBasis = 'schedule_at_recording' | 'user_confirmed_history'

export interface GoalPersistenceRecord {
  readonly id: string
  readonly title: string
  readonly description: string | null
  readonly status: GoalStatus
  readonly currentNextActionId: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface ActionPersistenceRecord {
  readonly id: string
  readonly goalId: string | null
  readonly title: string
  readonly description: string | null
  readonly status: ActionStatus
  readonly createdAt: string
  readonly updatedAt: string
}

export interface RoutinePersistenceRecord {
  readonly id: string
  readonly goalId: string | null
  readonly name: string
  readonly minimumAction: string
  readonly description: string | null
  readonly status: RoutineStatus
  readonly createdAt: string
  readonly updatedAt: string
}

export interface RoutineScheduleDayPersistenceRecord {
  readonly routineId: string
  readonly weekday: number
}

export interface TodaySelectionPersistenceRecord {
  readonly actionId: string
  readonly selectedFor: string
  readonly kind: 'focus' | 'intention'
  readonly selectedBy: 'user'
  readonly createdAt: string
}

export interface ActionRecordPersistenceRecord {
  readonly id: string
  readonly actionId: string
  readonly occurredOn: string
  readonly durationMinutes: number
  readonly outcome: 'completed' | 'partial' | 'stopped'
  readonly nextStep: string | null
  readonly note: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface RoutineRecordPersistenceRecord {
  readonly id: string
  readonly routineId: string
  readonly occurredOn: string
  readonly outcome: RoutineRecordOutcome
  readonly plannedForDate: boolean
  readonly plannedForDateBasis: RoutinePlannedForDateBasis
  readonly durationMinutes: number | null
  readonly note: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface UnderstandingPersistenceRecord {
  readonly id: string
  readonly actionRecordId: string
  readonly text: string
  readonly source: 'manual' | 'ai_candidate_confirmed'
  readonly revokedAt: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface ConfusionPersistenceRecord {
  readonly id: string
  readonly actionRecordId: string
  readonly text: string
  readonly status: 'open' | 'resolved'
  readonly resolvedAt: string | null
  readonly resolution: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface ReviewResultPersistenceRecord {
  readonly id: string
  readonly periodStartedOn: string
  readonly summary: string
  readonly adjustment: string
  readonly nextFocus: string
  readonly goalId: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface GoalActionRecordSummaryPersistenceRecord {
  readonly id: string
  readonly actionId: string
  readonly actionTitle: string
  readonly occurredOn: string
  readonly durationMinutes: number
  readonly outcome: ActionRecordPersistenceRecord['outcome']
  readonly nextStep: string | null
  readonly note: string | null
  readonly createdAt: string
}

export interface ProgressQueryFilterPersistence {
  readonly goalId: string | null
  readonly from: string | null
  readonly through: string | null
}

export interface ProgressQueryRowPersistenceRecord {
  readonly recordId: string
  readonly actionId: string
  readonly goalId: string | null
  readonly actionTitle: string
  readonly occurredOn: string
  readonly durationMinutes: number
  readonly outcome: ActionRecordPersistenceRecord['outcome']
  readonly recordCreatedAt: string
  readonly understandingId: string | null
  readonly understandingText: string | null
  readonly understandingCreatedAt: string | null
  readonly confusionId: string | null
  readonly confusionText: string | null
  readonly confusionCreatedAt: string | null
}

export interface RoutineProgressQueryRecordPersistence {
  readonly recordId: string
  readonly routineId: string
  readonly goalId: string | null
  readonly routineName: string
  readonly occurredOn: string
  readonly outcome: RoutineRecordOutcome
  readonly plannedForDate: boolean
  readonly durationMinutes: number | null
  readonly note: string | null
  readonly recordCreatedAt: string
}

export interface ProgressQuerySnapshotPersistence {
  readonly actionRows: readonly ProgressQueryRowPersistenceRecord[]
  readonly routineRecords: readonly RoutineProgressQueryRecordPersistence[]
}

export interface RecoveryQuerySnapshotPersistence {
  readonly goal: GoalPersistenceRecord | null
  readonly actions: readonly ActionPersistenceRecord[]
  readonly progress: ProgressQuerySnapshotPersistence
}

export interface CorePersistenceSnapshot {
  readonly goals: readonly GoalPersistenceRecord[]
  readonly actions: readonly ActionPersistenceRecord[]
  readonly routines: readonly RoutinePersistenceRecord[]
  readonly routineScheduleDays: readonly RoutineScheduleDayPersistenceRecord[]
  readonly todaySelections: readonly TodaySelectionPersistenceRecord[]
  readonly actionRecords: readonly ActionRecordPersistenceRecord[]
  readonly routineRecords: readonly RoutineRecordPersistenceRecord[]
  readonly understandings: readonly UnderstandingPersistenceRecord[]
  readonly confusions: readonly ConfusionPersistenceRecord[]
  readonly reviewResults: readonly ReviewResultPersistenceRecord[]
}

export interface CompleteCorePersistenceSnapshot {
  readonly sourceDataVersion: number
  readonly coreSnapshot: CorePersistenceSnapshot
}

export interface RepositoryPort {
  saveGoal(record: GoalPersistenceRecord): void
  saveAction(record: ActionPersistenceRecord): void
  saveRoutine(record: RoutinePersistenceRecord): void
  saveRoutineScheduleDay(record: RoutineScheduleDayPersistenceRecord): void
  createTodaySelection(record: TodaySelectionPersistenceRecord): boolean
  saveActionRecord(record: ActionRecordPersistenceRecord): void
  saveRoutineRecord(record: RoutineRecordPersistenceRecord): void
  saveUnderstanding(record: UnderstandingPersistenceRecord): void
  saveConfusion(record: ConfusionPersistenceRecord): void
  saveReviewResult(record: ReviewResultPersistenceRecord): void
  findGoalById(id: string): GoalPersistenceRecord | null
  findActionById(id: string): ActionPersistenceRecord | null
  listGoals(status?: GoalStatus): readonly GoalPersistenceRecord[]
  listActionsByGoalId(goalId: string): readonly ActionPersistenceRecord[]
  listActionRecordSummariesByGoalId(
    goalId: string
  ): readonly GoalActionRecordSummaryPersistenceRecord[]
  listTodaySelectionActionIdsByGoalIdOn(goalId: string, selectedFor: string): readonly string[]
  readSnapshot(): CorePersistenceSnapshot
}

export interface CompleteExportRepositoryPort extends RepositoryPort {
  readCompleteCoreSnapshot(): CompleteCorePersistenceSnapshot
}

export function asCompleteExportRepository(
  repository: RepositoryPort
): CompleteExportRepositoryPort {
  if (
    typeof (repository as Partial<CompleteExportRepositoryPort>).readCompleteCoreSnapshot !==
    'function'
  ) {
    throw new TypeError('Repository does not provide the complete export snapshot contract.')
  }
  return repository as CompleteExportRepositoryPort
}

export interface ActionRepositoryPort extends RepositoryPort {
  findTodaySelection(actionId: string, selectedFor: string): TodaySelectionPersistenceRecord | null
  listActions(): readonly ActionPersistenceRecord[]
  listTodaySelectionsOn(selectedFor: string): readonly TodaySelectionPersistenceRecord[]
  deleteTodaySelection(actionId: string, selectedFor: string): void
  deleteTodaySelectionByKind(
    actionId: string,
    selectedFor: string,
    kind: TodaySelectionPersistenceRecord['kind']
  ): boolean
  updateTodaySelectionCommitment(
    actionId: string,
    selectedFor: string,
    current: TodaySelectionPersistenceRecord['kind'],
    requested: TodaySelectionPersistenceRecord['kind']
  ): boolean
}

export interface ActionRecordRepositoryPort extends ActionRepositoryPort {
  findActionRecordById(id: string): ActionRecordPersistenceRecord | null
  listActionRecordsByActionId(actionId: string): readonly ActionRecordPersistenceRecord[]
  listUnderstandingsByActionRecordId(
    actionRecordId: string
  ): readonly UnderstandingPersistenceRecord[]
  listConfusionsByActionRecordId(actionRecordId: string): readonly ConfusionPersistenceRecord[]
}

export interface ProgressRepositoryPort extends RepositoryPort {
  queryProgressSnapshot(filter: ProgressQueryFilterPersistence): ProgressQuerySnapshotPersistence
}

export interface RecoveryRepositoryPort extends RepositoryPort {
  queryRecoverySnapshot(goalId: string): RecoveryQuerySnapshotPersistence
}

export interface RoutineRepositoryPort extends RepositoryPort {
  findRoutineById(id: string): RoutinePersistenceRecord | null
  listRoutines(status?: RoutineStatus): readonly RoutinePersistenceRecord[]
  listRoutineScheduleDays(routineId: string): readonly RoutineScheduleDayPersistenceRecord[]
  replaceRoutineScheduleDays(
    routineId: string,
    records: readonly RoutineScheduleDayPersistenceRecord[]
  ): void
}

export interface RoutineRecordRepositoryPort extends RoutineRepositoryPort {
  createRoutineRecord(record: RoutineRecordPersistenceRecord): boolean
  findRoutineRecordByRoutineAndDate(
    routineId: string,
    occurredOn: string
  ): RoutineRecordPersistenceRecord | null
  listRoutineRecordsByRoutineId(routineId: string): readonly RoutineRecordPersistenceRecord[]
}

export interface DataControlRepositoryPort
  extends ActionRecordRepositoryPort, RoutineRecordRepositoryPort {
  createActionRecord(record: ActionRecordPersistenceRecord): boolean
  updateActionRecord(record: ActionRecordPersistenceRecord): boolean
  findUnderstandingById(id: string): UnderstandingPersistenceRecord | null
  updateUnderstanding(record: UnderstandingPersistenceRecord): boolean
  findConfusionById(id: string): ConfusionPersistenceRecord | null
  updateConfusion(record: ConfusionPersistenceRecord): boolean
  updateRoutineRecord(record: RoutineRecordPersistenceRecord): boolean
  findRoutineRecordById(id: string): RoutineRecordPersistenceRecord | null
  findDeleteImpact(target: DeleteTarget): DeleteImpact | null
  deleteRoot(target: DeleteTarget): boolean
}

export function asActionRepository(repository: RepositoryPort): ActionRepositoryPort {
  const candidate = repository as Partial<ActionRepositoryPort>
  if (
    typeof candidate.createTodaySelection !== 'function' ||
    typeof candidate.findTodaySelection !== 'function' ||
    typeof candidate.listActions !== 'function' ||
    typeof candidate.listTodaySelectionsOn !== 'function' ||
    typeof candidate.deleteTodaySelection !== 'function' ||
    typeof candidate.deleteTodaySelectionByKind !== 'function' ||
    typeof candidate.updateTodaySelectionCommitment !== 'function'
  ) {
    throw new TypeError('Repository does not provide the Action/Today contract.')
  }
  return repository as ActionRepositoryPort
}

export function asActionRecordRepository(repository: RepositoryPort): ActionRecordRepositoryPort {
  const candidate = repository as Partial<ActionRecordRepositoryPort>
  if (
    typeof candidate.findActionRecordById !== 'function' ||
    typeof candidate.listActionRecordsByActionId !== 'function' ||
    typeof candidate.listUnderstandingsByActionRecordId !== 'function' ||
    typeof candidate.listConfusionsByActionRecordId !== 'function'
  ) {
    throw new TypeError('Repository does not provide the ActionRecord contract.')
  }
  return repository as ActionRecordRepositoryPort
}

export function asProgressRepository(repository: RepositoryPort): ProgressRepositoryPort {
  const candidate = repository as Partial<ProgressRepositoryPort>
  if (typeof candidate.queryProgressSnapshot !== 'function') {
    throw new TypeError('Repository does not provide the Progress query contract.')
  }
  return repository as ProgressRepositoryPort
}

export function asRecoveryRepository(repository: RepositoryPort): RecoveryRepositoryPort {
  const candidate = repository as Partial<RecoveryRepositoryPort>
  if (typeof candidate.queryRecoverySnapshot !== 'function') {
    throw new TypeError('Repository does not provide the Recovery query contract.')
  }
  return repository as RecoveryRepositoryPort
}

export function asRoutineRecordRepository(repository: RepositoryPort): RoutineRecordRepositoryPort {
  const candidate = repository as Partial<RoutineRecordRepositoryPort>
  if (
    typeof candidate.createRoutineRecord !== 'function' ||
    typeof candidate.findRoutineRecordByRoutineAndDate !== 'function' ||
    typeof candidate.listRoutineRecordsByRoutineId !== 'function'
  ) {
    throw new TypeError('Repository does not provide the RoutineRecord contract.')
  }
  return repository as RoutineRecordRepositoryPort
}

export function asDataControlRepository(repository: RepositoryPort): DataControlRepositoryPort {
  const candidate = repository as Partial<DataControlRepositoryPort>
  asActionRecordRepository(repository)
  asRoutineRecordRepository(repository)
  if (
    typeof candidate.createActionRecord !== 'function' ||
    typeof candidate.updateActionRecord !== 'function' ||
    typeof candidate.findUnderstandingById !== 'function' ||
    typeof candidate.updateUnderstanding !== 'function' ||
    typeof candidate.findConfusionById !== 'function' ||
    typeof candidate.updateConfusion !== 'function' ||
    typeof candidate.updateRoutineRecord !== 'function' ||
    typeof candidate.findRoutineRecordById !== 'function' ||
    typeof candidate.findDeleteImpact !== 'function' ||
    typeof candidate.deleteRoot !== 'function'
  ) {
    throw new TypeError('Repository does not provide the data-control contract.')
  }
  return repository as DataControlRepositoryPort
}

export function asRoutineRepository(repository: RepositoryPort): RoutineRepositoryPort {
  const candidate = repository as Partial<RoutineRepositoryPort>
  if (
    typeof candidate.findRoutineById !== 'function' ||
    typeof candidate.listRoutines !== 'function' ||
    typeof candidate.listRoutineScheduleDays !== 'function' ||
    typeof candidate.replaceRoutineScheduleDays !== 'function'
  ) {
    throw new TypeError('Repository does not provide the Routine contract.')
  }
  return repository as RoutineRepositoryPort
}

export interface UnitOfWorkPort {
  transaction<T>(work: (repository: RepositoryPort) => T): T
}
import type { DeleteImpact, DeleteTarget } from '../../domain/data-control'
