export type GoalStatus = 'active' | 'paused' | 'ended'
export type ActionStatus = 'pending' | 'completed' | 'cancelled' | 'rescheduled'
export type RoutineRecordOutcome = 'target_met' | 'acted' | 'intentional_rest' | 'not_done'

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
  readonly status: GoalStatus
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

export interface RepositoryPort {
  saveGoal(record: GoalPersistenceRecord): void
  saveAction(record: ActionPersistenceRecord): void
  saveRoutine(record: RoutinePersistenceRecord): void
  saveRoutineScheduleDay(record: RoutineScheduleDayPersistenceRecord): void
  saveTodaySelection(record: TodaySelectionPersistenceRecord): void
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

export interface ActionRepositoryPort extends RepositoryPort {
  findTodaySelection(actionId: string, selectedFor: string): TodaySelectionPersistenceRecord | null
  listActions(): readonly ActionPersistenceRecord[]
  listTodaySelectionsOn(selectedFor: string): readonly TodaySelectionPersistenceRecord[]
  deleteTodaySelection(actionId: string, selectedFor: string): void
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
  queryProgressRows(
    filter: ProgressQueryFilterPersistence
  ): readonly ProgressQueryRowPersistenceRecord[]
}

export function asActionRepository(repository: RepositoryPort): ActionRepositoryPort {
  const candidate = repository as Partial<ActionRepositoryPort>
  if (
    typeof candidate.findTodaySelection !== 'function' ||
    typeof candidate.listActions !== 'function' ||
    typeof candidate.listTodaySelectionsOn !== 'function' ||
    typeof candidate.deleteTodaySelection !== 'function'
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
  if (typeof candidate.queryProgressRows !== 'function') {
    throw new TypeError('Repository does not provide the Progress query contract.')
  }
  return repository as ProgressRepositoryPort
}

export interface UnitOfWorkPort {
  transaction<T>(work: (repository: RepositoryPort) => T): T
}
