import type { RecordBook, RecordBookEntry, RecordBookField } from '../contracts/record-book'
import type { CorePersistenceSnapshot } from './ports/persistence'

const outcomes = {
  completed: '完成',
  partial: '完成一部分',
  stopped: '停下',
  target_met: '达到目标',
  acted: '有所行动',
  intentional_rest: '主动休息',
  not_done: '未进行'
} as const
const states = {
  active: '进行中',
  paused: '暂停',
  ended: '结束',
  pending: '待推进',
  completed: '已完成',
  cancelled: '已取消',
  rescheduled: '已重新安排'
} as const
const field = (label: string, text: string): RecordBookField => ({ label, text })
const original = (label: string, text: string | null): RecordBookField =>
  field(label, text === null ? '未记录' : text)

/** Dates are already local occurrence dates. Never reinterpret them as instants. */
export function buildRecordBook(data: CorePersistenceSnapshot): RecordBook {
  const goals = new Map(data.goals.map((row) => [row.id, row]))
  const actions = new Map(data.actions.map((row) => [row.id, row]))
  const routines = new Map(data.routines.map((row) => [row.id, row]))
  const association = (id: string | null) =>
    field('关联目标（读取时）', id === null ? '无关联目标' : (goals.get(id)?.title ?? '目标不可用'))
  const understandings = new Map<string, (typeof data.understandings)[number][]>()
  const confusions = new Map<string, (typeof data.confusions)[number][]>()
  for (const row of data.understandings)
    understandings.set(row.actionRecordId, [...(understandings.get(row.actionRecordId) ?? []), row])
  for (const row of data.confusions)
    confusions.set(row.actionRecordId, [...(confusions.get(row.actionRecordId) ?? []), row])
  const entries: RecordBookEntry[] = data.actionRecords.map((record) => {
    const action = actions.get(record.actionId)
    return {
      id: record.id,
      kind: 'action-record',
      date: record.occurredOn,
      title: action?.title ?? '行动不可用',
      fields: [
        field('名称说明', '行动标题为读取时的当前名称'),
        field('本次结果', outcomes[record.outcome]),
        field(
          '时长',
          record.durationMinutes === null ? '未记录' : `${record.durationMinutes} 分钟`
        ),
        field('行动状态（读取时）', action ? states[action.status] : '不可用'),
        association(action?.goalId ?? null),
        original('简述', record.summary),
        original('原备注', record.note),
        original('记录时写下的下一步', record.nextStep),
        ...(understandings.get(record.id) ?? []).flatMap((row) => [
          field(row.revokedAt === null ? '理解（当前有效）' : '理解（已撤销）', row.text)
        ]),
        ...(confusions.get(record.id) ?? []).flatMap((row) => [
          field(row.status === 'resolved' ? '困惑（当前已解决）' : '困惑（当前未解决）', row.text),
          original('解决说明', row.resolution)
        ])
      ]
    }
  })
  for (const record of data.routineRecords) {
    const routine = routines.get(record.routineId)
    entries.push({
      id: record.id,
      kind: 'routine-record',
      date: record.occurredOn,
      title: routine?.name ?? '例行不可用',
      fields: [
        field('名称说明', '例行名称为读取时的当前名称'),
        field('本次结果', outcomes[record.outcome]),
        field(
          '时长',
          record.durationMinutes === null ? '未记录' : `${record.durationMinutes} 分钟`
        ),
        field('例行状态（读取时）', routine ? states[routine.status] : '不可用'),
        association(routine?.goalId ?? null),
        field('记录时的计划日', record.plannedForDate ? '是' : '否'),
        field(
          '计划日依据',
          record.plannedForDateBasis === 'schedule_at_recording' ? '记录时日程' : '用户确认的历史'
        ),
        original('简述', record.summary),
        original('原备注', record.note)
      ]
    })
  }
  for (const review of data.reviewResults)
    entries.push({
      id: review.id,
      kind: 'review',
      date: review.periodStartedOn,
      title: '复盘原文',
      fields: [
        field('日期说明', '按复盘周期起始日收录'),
        association(review.goalId),
        field('确认的进展', review.confirmedProgress),
        field('主要障碍', review.mainObstacle),
        field('下一步调整', review.nextAdjustment)
      ]
    })
  entries.sort(
    (a, b) =>
      a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id)
  )
  const months = new Map<string, Map<string, RecordBookEntry[]>>()
  for (const entry of entries) {
    const key = entry.date.slice(0, 7)
    if (!months.has(key)) months.set(key, new Map())
    const days = months.get(key)!
    if (!days.has(entry.date)) days.set(entry.date, [])
    days.get(entry.date)!.push(entry)
  }
  const recordedActions = new Set(data.actionRecords.map((row) => row.actionId))
  const recordedRoutines = new Set(data.routineRecords.map((row) => row.routineId))
  return {
    months: [...months].map(([key, days]) => ({
      key,
      days: [...days].map(([date, rows]) => ({ date, entries: rows }))
    })),
    exclusions: [
      field(
        '未有日期记录的行动',
        String(data.actions.filter((row) => !recordedActions.has(row.id)).length)
      ),
      field(
        '未有日期记录的例行',
        String(data.routines.filter((row) => !recordedRoutines.has(row.id)).length)
      ),
      field(
        '未完整收录的对象与计划',
        `目标 ${data.goals.length}；行动 ${data.actions.length}；例行 ${data.routines.length}；日程项 ${data.routineScheduleDays.length}；今日选择 ${data.todaySelections.length}。本册仅引用当前名称、关联和状态，不包含完整对象属性或计划。`
      ),
      field('排除项', '设置、窗口状态、会话草稿、AI 草稿、凭据、技术日志与外部文件内容。'),
      field(
        '范围说明',
        '当前保存的行动记录、例行记录、关联理解与困惑及复盘原文；不包含已删除文字或历史版本。完整 JSON 是独立的结构化导出。本册不是备份或恢复验证。'
      )
    ]
  }
}
