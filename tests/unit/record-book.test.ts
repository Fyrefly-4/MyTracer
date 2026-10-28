import { describe, expect, it } from 'vitest'
import { buildRecordBook } from '../../src/application/record-book'
import type { CorePersistenceSnapshot } from '../../src/application/ports/persistence'

const empty: CorePersistenceSnapshot = {
  goals: [],
  actions: [],
  routines: [],
  routineScheduleDays: [],
  todaySelections: [],
  actionRecords: [],
  routineRecords: [],
  understandings: [],
  confusions: [],
  booklets: [],
  thoughts: [],
  reviewResults: []
}
const instant = '2026-01-01T00:30:00.000Z'
const action = {
  id: 'a',
  title: '当前名称',
  goalId: null,
  description: null,
  status: 'cancelled' as const,
  createdAt: instant,
  updatedAt: instant
}
const record = {
  id: 'r',
  actionId: 'a',
  occurredOn: '2025-12-31',
  durationMinutes: null,
  outcome: 'partial' as const,
  nextStep: '当时下一步',
  summary: null,
  note: '</script><img src=x onerror=alert(1)>',
  createdAt: instant,
  updatedAt: instant
}

describe('record book read model', () => {
  it('has an honest empty book and explicitly excludes undated objects and plans', () => {
    const book = buildRecordBook({ ...empty, actions: [action] })
    expect(book.months).toEqual([])
    expect(book.exclusions).toContainEqual({ label: '未有日期记录的行动', text: '1' })
    expect(book.exclusions.some((row) => row.text.includes('不是备份或恢复验证'))).toBe(true)
  })
  it('preserves exact original text, current status qualifiers, unknown versus zero, and local dates', () => {
    const book = buildRecordBook({
      ...empty,
      actions: [action],
      actionRecords: [
        record,
        { ...record, id: 'zero', occurredOn: '2026-01-01', durationMinutes: 0 }
      ]
    })
    expect(book.months.map((month) => month.key)).toEqual(['2025-12', '2026-01'])
    const entry = book.months[0].days[0].entries[0]
    expect(entry.date).toBe('2025-12-31')
    expect(entry.fields).toContainEqual({ label: '原备注', text: record.note })
    expect(entry.fields).toContainEqual({ label: '时长', text: '未记录' })
    expect(entry.fields).toContainEqual({ label: '行动状态（读取时）', text: '已取消' })
    expect(entry.fields).toContainEqual({ label: '记录时写下的下一步', text: '当时下一步' })
    expect(book.months[1].days[0].entries[0].fields).toContainEqual({
      label: '时长',
      text: '0 分钟'
    })
  })
  it('keeps revoked understandings, resolved confusions and review originals', () => {
    const book = buildRecordBook({
      ...empty,
      actions: [action],
      actionRecords: [record],
      understandings: [
        {
          id: 'u',
          actionRecordId: 'r',
          text: '原理解',
          source: 'manual',
          revokedAt: instant,
          createdAt: instant,
          updatedAt: instant
        }
      ],
      confusions: [
        {
          id: 'c',
          actionRecordId: 'r',
          text: '原困惑',
          status: 'resolved',
          resolvedAt: instant,
          resolution: '原解决说明',
          createdAt: instant,
          updatedAt: instant
        }
      ],
      reviewResults: [
        {
          id: 'v',
          periodStartedOn: '2025-12-29',
          confirmedProgress: '原进展',
          mainObstacle: '原障碍',
          nextAdjustment: '原调整',
          goalId: null,
          createdAt: instant,
          updatedAt: instant
        }
      ]
    })
    expect(book.months[0].days.map((day) => day.date)).toEqual(['2025-12-29', '2025-12-31'])
    const fields = book.months[0].days[1].entries[0].fields
    expect(fields).toContainEqual({ label: '理解（已撤销）', text: '原理解' })
    expect(fields).toContainEqual({ label: '困惑（当前已解决）', text: '原困惑' })
    expect(fields).toContainEqual({ label: '解决说明', text: '原解决说明' })
    expect(book.months[0].days[0].entries[0].fields).toContainEqual({
      label: '主要障碍',
      text: '原障碍'
    })
  })
  it('retains every routine outcome and historical schedule basis without inventing missing days', () => {
    const book = buildRecordBook({
      ...empty,
      routineRecords: (['acted', 'target_met', 'intentional_rest', 'not_done'] as const).map(
        (outcome, index) => ({
          id: `r${index}`,
          routineId: 'routine',
          occurredOn: '2026-02-02',
          outcome,
          plannedForDate: false,
          plannedForDateBasis: 'user_confirmed_history',
          durationMinutes: null,
          summary: null,
          note: null,
          createdAt: instant,
          updatedAt: instant
        })
      )
    })
    expect(book.months[0].days).toHaveLength(1)
    expect(
      book.months[0].days[0].entries.map(
        (entry) => entry.fields.find((row) => row.label === '本次结果')?.text
      )
    ).toEqual(['有所行动', '达到目标', '主动休息', '未进行'])
    expect(book.months[0].days[0].entries[0].fields).toContainEqual({
      label: '计划日依据',
      text: '用户确认的历史'
    })
  })
  it('keeps dense months and long multilingual originals intact in deterministic order', () => {
    const note = '合成原文 Test\n'.repeat(1000)
    const rows = Array.from({ length: 500 }, (_, i) => ({
      ...record,
      id: String(i).padStart(3, '0'),
      note
    }))
    const book = buildRecordBook({
      ...empty,
      actions: [action],
      actionRecords: [...rows].reverse()
    })
    expect(book.months[0].days[0].entries).toHaveLength(500)
    expect(book.months[0].days[0].entries[0].id).toBe('000')
    expect(book.months[0].days[0].entries[499].fields).toContainEqual({
      label: '原备注',
      text: note
    })
  })
})
