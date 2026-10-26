import type {
  AssistantObjectRef,
  AssistantScope,
  AssistantSource,
  AssistantToolCall,
  AssistantToolResult
} from '../../contracts/assistant'
import type { CorePersistenceSnapshot } from '../ports/persistence'
import { check, refKey } from './validation'

export interface ContextObject {
  origin?: AssistantSource['origin']
  ref: AssistantObjectRef
  revision: string
  label: string
  fields: Record<string, string | number | null>
  goalId?: string | null
  occurredOn?: string
  outcome?: string
  durationMinutes?: number | null
}
/** Only the explicit projection below may reach the provider; snapshots never do. */
export function project(
  data: CorePersistenceSnapshot,
  fingerprint: (value: string) => string
): ContextObject[] {
  const actions = new Map(data.actions.map((a) => [a.id, a]))
  const routines = new Map(data.routines.map((r) => [r.id, r]))
  const make = (
    kind: AssistantObjectRef['kind'],
    row: { id: string },
    label: string,
    fields: ContextObject['fields'],
    extra: Partial<ContextObject> = {}
  ): ContextObject => ({
    ref: { kind, id: row.id },
    revision: fingerprint(JSON.stringify({ row, label, fields, extra })),
    label,
    fields,
    ...extra
  })
  return [
    ...data.goals.map((g) =>
      make(
        'goal',
        g,
        g.title,
        { title: g.title, description: g.description, status: g.status },
        { goalId: g.id }
      )
    ),
    ...data.actions.map((a) =>
      make(
        'action',
        a,
        a.title,
        { title: a.title, description: a.description, status: a.status },
        { goalId: a.goalId }
      )
    ),
    ...data.actionRecords.map((r) =>
      make(
        'action-record',
        r,
        actions.get(r.actionId)?.title ?? '行动记录',
        {
          summary: r.summary,
          note: r.note,
          nextStep: r.nextStep,
          occurredOn: r.occurredOn,
          outcome: r.outcome,
          durationMinutes: r.durationMinutes
        },
        {
          goalId: actions.get(r.actionId)?.goalId,
          occurredOn: r.occurredOn,
          outcome: r.outcome,
          durationMinutes: r.durationMinutes
        }
      )
    ),
    ...data.routineRecords.map((r) =>
      make(
        'routine-record',
        r,
        routines.get(r.routineId)?.name ?? '例行记录',
        {
          summary: r.summary,
          note: r.note,
          occurredOn: r.occurredOn,
          outcome: r.outcome,
          durationMinutes: r.durationMinutes
        },
        {
          goalId: routines.get(r.routineId)?.goalId,
          occurredOn: r.occurredOn,
          outcome: r.outcome,
          durationMinutes: r.durationMinutes
        }
      )
    ),
    ...data.reviewResults.map((r) =>
      make(
        'review',
        r,
        '复盘',
        {
          confirmedProgress: r.confirmedProgress,
          mainObstacle: r.mainObstacle,
          nextAdjustment: r.nextAdjustment
        },
        { goalId: r.goalId, occurredOn: r.periodStartedOn }
      )
    )
  ]
}
export function resolveScope(
  scope: AssistantScope,
  all: readonly ContextObject[]
): ContextObject[] {
  const explicit = new Set(
    [scope.current, ...scope.selectedObjects].filter((r) => r.kind !== 'conversation').map(refKey)
  )
  check(
    [...explicit].every((key) => all.some((o) => refKey(o.ref) === key)),
    'not-found'
  )
  if (scope.goalId)
    check(
      all.some((o) => o.ref.kind === 'goal' && o.ref.id === scope.goalId),
      'not-found'
    )
  // Explicit selections UNION records matching the user-selected goal/date filter.
  const resolved = all.filter(
    (o) =>
      explicit.has(refKey(o.ref)) ||
      ((scope.goalId !== undefined || scope.dateRange !== undefined) &&
        (scope.goalId === undefined || o.goalId === scope.goalId) &&
        (scope.dateRange === undefined ||
          (o.occurredOn !== undefined &&
            o.occurredOn >= scope.dateRange.from &&
            o.occurredOn <= scope.dateRange.to)))
  )
  const order = [...explicit]
  return resolved.sort((a, b) => {
    const ai = order.indexOf(refKey(a.ref)),
      bi = order.indexOf(refKey(b.ref))
    return (ai < 0 ? order.length : ai) - (bi < 0 ? order.length : bi)
  })
}
export function source(o: ContextObject): AssistantSource {
  const excerpt = JSON.stringify(o.fields)
  return {
    ref: o.ref,
    sourceRevision: o.revision,
    label: o.label,
    excerpt: excerpt.slice(0, 2000),
    fields: Object.keys(o.fields),
    origin: o.origin ?? 'saved',
    truncated: excerpt.length > 2000
  }
}
export function executeTool(
  call: AssistantToolCall,
  authorized: readonly ContextObject[]
): AssistantToolResult {
  let selected = [...authorized]
  if (call.name === 'readGoal') {
    selected = selected.filter((o) => o.ref.kind === 'goal' && o.ref.id === call.goalId)
    check(selected.length === 1, 'out-of-scope')
  } else {
    selected = selected.filter(
      (o) => o.ref.kind === 'action-record' || o.ref.kind === 'routine-record'
    )
    if (call.name === 'findRecords')
      selected = selected.filter(
        (o) =>
          (!call.keyword ||
            JSON.stringify(o.fields)
              .toLocaleLowerCase()
              .includes(call.keyword.toLocaleLowerCase())) &&
          (!call.from || o.occurredOn! >= call.from) &&
          (!call.to || o.occurredOn! <= call.to)
      )
  }
  // Statistics cover exactly the returned bounded sources, never hidden records.
  const rows = selected.slice(0, 8)
  const sources = rows.map(source)
  const outcomes: Record<string, number> = {}
  for (const row of rows) if (row.outcome) outcomes[row.outcome] = (outcomes[row.outcome] ?? 0) + 1
  return {
    call,
    sources,
    truncated: selected.length > rows.length || sources.some((s) => s.truncated),
    omittedCount: selected.length - rows.length,
    ...(call.name === 'getStatistics'
      ? {
          statistics: {
            recordCount: rows.length,
            totalDurationMinutes: rows.reduce((sum, o) => sum + (o.durationMinutes ?? 0), 0),
            unknownDurationCount: rows.filter((o) => o.durationMinutes === null).length,
            outcomes,
            unknownPolicy: 'absence-is-unknown-not-counted-as-not-done' as const
          }
        }
      : {})
  }
}
