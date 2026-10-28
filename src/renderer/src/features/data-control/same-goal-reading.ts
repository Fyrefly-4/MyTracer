import type { DataControlListDto } from '../../../../contracts/data-control'

// Dates are local occurrence dates, not creation timestamps. Same-day entries are
// eligible but do not imply an order of events. Never join through goal stages.
export function sameGoalReading(data: DataControlListDto, recordId: string) {
  const current = data.actionRecords.find((record) => record.id === recordId)
  const action = data.actions.find((item) => item.id === current?.actionId)
  const goal = data.goals.find((item) => item.id === action?.goalId)
  const actions = new Map(data.actions.map((item) => [item.id, item]))
  const candidates =
    current && goal
      ? data.actionRecords
          .filter(
            (record) =>
              record.id !== current.id &&
              record.occurredOn <= current.occurredOn &&
              actions.get(record.actionId)?.goalId === goal.id
          )
          .map((record) => ({ record, action: actions.get(record.actionId)! }))
          .sort(
            (a, b) =>
              b.record.occurredOn.localeCompare(a.record.occurredOn) ||
              a.record.id.localeCompare(b.record.id)
          )
      : []
  return { current, action, goal, candidates }
}
