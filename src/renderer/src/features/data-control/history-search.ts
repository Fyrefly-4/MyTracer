import type { DataControlListDto } from '../../../../contracts/data-control'

export interface HistoryFilter {
  readonly query: string
  readonly kind: 'all' | 'action-record' | 'routine-record'
  readonly goalId: string
  readonly date: string
}

export interface HistoryMatch {
  readonly label: string
  readonly snippet: string
}

export interface DataHistoryRow {
  readonly type: 'action-record' | 'routine-record'
  readonly id: string
  readonly objectName: string
  readonly goalId: string | null
  readonly occurredOn: string
  readonly createdAt: string
  readonly outcome: string
  readonly durationMinutes: number | null
  readonly matches: readonly HistoryMatch[]
}

// Keep offsets in original code points: lowercasing can expand characters (e.g. İ).
function snippet(text: string, index: number): string {
  const points = Array.from(text)
  let offset = 0
  let point = 0
  while (point < points.length && offset < index) {
    offset += points[point].toLowerCase().length
    point++
  }
  const start = Math.max(0, point - 32)
  const end = Math.min(points.length, start + 160)
  return `${start ? '…' : ''}${points.slice(start, end).join('')}${end < points.length ? '…' : ''}`
}

export function searchHistory(data: DataControlListDto, filter: HistoryFilter): DataHistoryRow[] {
  const query = filter.query.trim().toLowerCase()
  const matches = (
    fields: readonly (readonly [string, string | null | undefined])[]
  ): HistoryMatch[] =>
    query
      ? fields.flatMap(([label, text]) => {
          if (!text) return []
          const index = text.toLowerCase().indexOf(query)
          return index < 0 ? [] : [{ label, snippet: snippet(text, index) }]
        })
      : []
  const actions = new Map(data.actions.map((action) => [action.id, action]))
  const routines = new Map(data.routines.map((routine) => [routine.id, routine]))
  const facts = new Map<string, [string, string | null][]>()
  const add = (id: string, label: string, text: string | null): void => {
    const fields = facts.get(id) ?? []
    fields.push([label, text])
    facts.set(id, fields)
  }
  if (query) {
    for (const fact of data.understandings) {
      add(fact.actionRecordId, `理解 · ${fact.revokedAt ? '已撤销' : '保留'}`, fact.text)
    }
    for (const fact of data.confusions) {
      const status = fact.status === 'resolved' ? '已解决' : '未解决'
      add(fact.actionRecordId, `困惑 · ${status}`, fact.text)
      add(fact.actionRecordId, `解决说明 · ${status}`, fact.resolution)
    }
  }
  const rows: DataHistoryRow[] = [
    ...data.actionRecords.map((record) => {
      const action = actions.get(record.actionId)
      return {
        ...record,
        type: 'action-record' as const,
        objectName: action?.title ?? '已删除的行动',
        goalId: action?.goalId ?? null,
        matches: matches([
          ['行动标题（当前）', action?.title],
          ['备注', record.note],
          ['记录下一步', record.nextStep],
          ...(facts.get(record.id) ?? [])
        ])
      }
    }),
    ...data.routineRecords.map((record) => {
      const routine = routines.get(record.routineId)
      return {
        ...record,
        type: 'routine-record' as const,
        objectName: routine?.name ?? '已删除的例行',
        goalId: routine?.goalId ?? null,
        matches: matches([
          ['例行名称（当前）', routine?.name],
          ['备注', record.note]
        ])
      }
    })
  ]
  return rows
    .filter((row) => !query || row.matches.length > 0)
    .filter((row) => filter.kind === 'all' || row.type === filter.kind)
    .filter(
      (row) =>
        filter.goalId === 'all' ||
        (filter.goalId === 'none' ? row.goalId === null : row.goalId === filter.goalId)
    )
    .filter((row) => !filter.date || row.occurredOn === filter.date)
    .sort(
      (left, right) =>
        right.occurredOn.localeCompare(left.occurredOn) ||
        right.createdAt.localeCompare(left.createdAt)
    )
}
