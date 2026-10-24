import type { DataControlListDto } from '../../../../contracts/data-control'
import type { GoalSummaryDto } from '../../../../contracts/goals'
import { factOutcomeText } from '../../app/ui-text'

export interface HomeRecord {
  readonly id: string
  readonly type: 'action-record' | 'routine-record'
  readonly occurredOn: string
  readonly title: string
  readonly goalId: string | null
  readonly summary: string | null
  readonly hasNote: boolean
  readonly outcomeText: string
  readonly durationMinutes: number | null
}

// Occurrence date is the factual ordering key. IDs only break same-day ties;
// creation timestamps would incorrectly move a backfill to the present.
export function homeRecords(data: DataControlListDto, today: string): readonly HomeRecord[] {
  const actions = new Map(data.actions.map((action) => [action.id, action]))
  const routines = new Map(data.routines.map((routine) => [routine.id, routine]))
  return [
    ...data.actionRecords.map((record): HomeRecord => ({
      id: record.id,
      type: 'action-record',
      occurredOn: record.occurredOn,
      title: actions.get(record.actionId)?.title ?? '历史行动',
      goalId: actions.get(record.actionId)?.goalId ?? null,
      summary: record.summary,
      hasNote: Boolean(record.note),
      outcomeText: factOutcomeText[record.outcome],
      durationMinutes: record.durationMinutes
    })),
    ...data.routineRecords.map((record): HomeRecord => ({
      id: record.id,
      type: 'routine-record',
      occurredOn: record.occurredOn,
      title: routines.get(record.routineId)?.name ?? '历史例行',
      goalId: routines.get(record.routineId)?.goalId ?? null,
      summary: record.summary,
      hasNote: Boolean(record.note),
      outcomeText: factOutcomeText[record.outcome],
      durationMinutes: record.durationMinutes
    }))
  ]
    .filter((record) => record.occurredOn <= today)
    .sort(
      (a, b) =>
        b.occurredOn.localeCompare(a.occurredOn) ||
        a.type.localeCompare(b.type) ||
        a.id.localeCompare(b.id)
    )
}

export function homeGoals(
  goals: readonly GoalSummaryDto[],
  records: readonly HomeRecord[]
): readonly GoalSummaryDto[] {
  const recent = new Map<string, string>()
  for (const record of records) {
    if (
      record.goalId &&
      (!recent.has(record.goalId) || record.occurredOn > recent.get(record.goalId)!)
    )
      recent.set(record.goalId, record.occurredOn)
  }
  return goals
    .filter((goal) => goal.status === 'active')
    .sort(
      (a, b) =>
        (recent.get(b.id) ?? '').localeCompare(recent.get(a.id) ?? '') ||
        b.updatedAt.localeCompare(a.updatedAt) ||
        a.id.localeCompare(b.id)
    )
    .slice(0, 3)
}
