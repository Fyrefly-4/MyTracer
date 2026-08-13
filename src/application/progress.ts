import {
  buildProgressView,
  normalizeProgressFilter,
  ProgressDomainError,
  type ProgressRecordFact,
  type ProgressView
} from '../domain/progress'
import {
  asProgressRepository,
  type ProgressQueryRowPersistenceRecord,
  type RepositoryPort
} from './ports/persistence'

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

export class ProgressService {
  public constructor(private readonly dependencies: ProgressServiceDependencies) {}

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
      const rows = asProgressRepository(this.dependencies.repository).queryProgressRows(filter)
      return buildProgressView(filter, recordsFromRows(rows))
    } catch (error) {
      if (error instanceof ProgressDomainError) {
        throw new ProgressApplicationError(error.code, error.message)
      }
      throw error
    }
  }
}
