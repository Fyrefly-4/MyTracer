import {
  buildProgressView,
  normalizeProgressFilter,
  ProgressDomainError,
  type ProgressRecordFact,
  type RoutineProgressRecordFact,
  type ProgressView
} from '../domain/progress'
import {
  asProgressRepository,
  type ProgressQueryRowPersistenceRecord,
  type ProgressQuerySnapshotPersistence,
  type RepositoryPort
} from './ports/persistence'
import type { GoalActivityRepositoryPort } from './ports/persistence'
import type { ClockPort } from './ports/clock'
import { buildGoalActivity, buildWeekComparison, comparisonPeriods } from '../domain/should-facts'

export type ProgressApplicationErrorCode = 'validation' | 'not-found'

export class ProgressApplicationError extends Error {
  public constructor(
    readonly code: ProgressApplicationErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'ProgressApplicationError'
  }
}

export interface ProgressServiceDependencies {
  readonly repository: RepositoryPort
  readonly clock?: ClockPort
}

function pushUnique<T extends { readonly id: string }>(items: T[], item: T): void {
  if (!items.some((candidate) => candidate.id === item.id)) items.push(Object.freeze(item))
}

function recordsFromRows(rows: readonly ProgressQueryRowPersistenceRecord[]): ProgressRecordFact[] {
  const records = new Map<
    string,
    Omit<ProgressRecordFact, 'understandings' | 'openConfusions'> & {
      understandings: Array<ProgressRecordFact['understandings'][number]>
      openConfusions: Array<ProgressRecordFact['openConfusions'][number]>
    }
  >()

  for (const row of rows) {
    let record = records.get(row.recordId)
    if (!record) {
      record = {
        recordId: row.recordId,
        actionId: row.actionId,
        goalId: row.goalId,
        actionTitle: row.actionTitle,
        hasRecordedText: row.hasRecordedText,
        occurredOn: row.occurredOn,
        durationMinutes: row.durationMinutes,
        outcome: row.outcome,
        createdAt: row.recordCreatedAt,
        understandings: [],
        openConfusions: []
      }
      records.set(row.recordId, record)
    }
    if (
      row.understandingId &&
      row.understandingText !== null &&
      row.understandingCreatedAt !== null
    ) {
      pushUnique(record.understandings, {
        id: row.understandingId,
        text: row.understandingText,
        createdAt: row.understandingCreatedAt
      })
    }
    if (row.confusionId && row.confusionText !== null && row.confusionCreatedAt !== null) {
      pushUnique(record.openConfusions, {
        id: row.confusionId,
        text: row.confusionText,
        createdAt: row.confusionCreatedAt
      })
    }
  }

  return [...records.values()].map((record) =>
    Object.freeze({
      ...record,
      understandings: Object.freeze(record.understandings),
      openConfusions: Object.freeze(record.openConfusions)
    })
  )
}

export function buildProgressViewFromSnapshot(
  filter: ProgressView['filter'],
  snapshot: ProgressQuerySnapshotPersistence
): ProgressView {
  const routineRecords: RoutineProgressRecordFact[] = snapshot.routineRecords.map((record) =>
    Object.freeze({
      recordId: record.recordId,
      routineId: record.routineId,
      goalId: record.goalId,
      routineName: record.routineName,
      occurredOn: record.occurredOn,
      outcome: record.outcome,
      plannedForDate: record.plannedForDate,
      durationMinutes: record.durationMinutes,
      note: record.note,
      createdAt: record.recordCreatedAt
    })
  )
  return buildProgressView(filter, recordsFromRows(snapshot.actionRows), routineRecords)
}

export class ProgressService {
  public constructor(private readonly dependencies: ProgressServiceDependencies) {}

  private currentLocalDate(): string {
    if (!this.dependencies.clock) throw new Error('A ClockPort is required for dated facts.')
    return this.dependencies.clock.snapshot().localDate
  }

  public getGoalActivity() {
    const asOf = this.currentLocalDate()
    const repository = this.dependencies.repository as GoalActivityRepositoryPort
    return buildGoalActivity(asOf, repository.queryGoalActivityDates())
  }

  public compareWeeks(input: { readonly goalId?: string | null }) {
    const asOf = this.currentLocalDate()
    const periods = comparisonPeriods(asOf)
    // Both periods are derived from one repository snapshot, never two independent reads.
    const progress = this.getProgress({
      goalId: input.goalId,
      from: periods.previous.from,
      through: periods.current.through
    })
    return buildWeekComparison(asOf, progress)
  }

  public getProgress(input: {
    readonly goalId?: string | null
    readonly from?: string | null
    readonly through?: string | null
  }): ProgressView {
    try {
      const filter = normalizeProgressFilter(input)
      if (filter.goalId && !this.dependencies.repository.findGoalById(filter.goalId)) {
        throw new ProgressApplicationError('not-found', 'The requested Goal was not found.')
      }
      const snapshot = asProgressRepository(this.dependencies.repository).queryProgressSnapshot(
        filter
      )
      return buildProgressViewFromSnapshot(filter, snapshot)
    } catch (error) {
      if (error instanceof ProgressDomainError) {
        throw new ProgressApplicationError(error.code, error.message)
      }
      throw error
    }
  }
}
