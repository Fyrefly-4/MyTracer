import { describe, expect, it } from 'vitest'
import type { DataControlListDto } from '../../src/contracts/data-control'
import {
  searchHistory,
  type HistoryFilter
} from '../../src/renderer/src/features/data-control/history-search'

const filter: HistoryFilter = { query: '', kind: 'all', goalId: 'all', date: '' }
function fixture(): DataControlListDto {
  return {
    goals: [{ id: 'g', title: 'not-a-search-field', status: 'active' }],
    actions: [{ id: 'a', goalId: 'g', title: '植物 Café', status: 'pending' }],
    routines: [{ id: 'r', goalId: null, name: 'Piano ピアノ', status: 'active' }],
    actionRecords: Array.from({ length: 12 }, (_, i) => ({
      id: `a${i}`,
      actionId: 'a',
      occurredOn: `2026-08-${String(i + 1).padStart(2, '0')}`,
      createdAt: '2026-08-20',
      updatedAt: '2026-08-20',
      outcome: 'partial',
      durationMinutes: i === 0 ? null : i,
      summary: null,
      note: i === 0 ? '靠窗 Needle %_*.[x] <script> 注释' : null,
      nextStep: i === 1 ? '排水孔 NEEDLE' : null
    })),
    routineRecords: [
      {
        id: 'r1',
        routineId: 'r',
        occurredOn: '2026-08-13',
        createdAt: '2026-08-20',
        updatedAt: '2026-08-20',
        outcome: 'intentional_rest',
        durationMinutes: null,
        summary: null,
        note: '节奏 🎵 needle',
        plannedForDate: false,
        plannedForDateBasis: 'user_confirmed_history'
      }
    ],
    understandings: [
      {
        id: 'u0',
        actionRecordId: 'a0',
        text: 'Needle 旧理解',
        source: 'manual',
        revokedAt: '2026-08-21',
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'u1',
        actionRecordId: 'a2',
        text: '光照理解',
        source: 'manual',
        revokedAt: null,
        createdAt: '',
        updatedAt: ''
      }
    ],
    confusions: [
      {
        id: 'c0',
        actionRecordId: 'a0',
        text: 'Needle 困惑',
        status: 'resolved',
        resolvedAt: '2026-08-21',
        resolution: 'Needle 排查说明',
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'c1',
        actionRecordId: 'a3',
        text: '未解疑问',
        status: 'open',
        resolvedAt: null,
        resolution: null,
        createdAt: '',
        updatedAt: ''
      }
    ]
  }
}
const find = (query: string, changes: Partial<HistoryFilter> = {}, data = fixture()) =>
  searchHistory(data, { ...filter, ...changes, query })

describe('saved history literal search', () => {
  it('searches older records before pagination, deduplicates fields and retains date/source/duration', () => {
    expect(
      find('')
        .slice(0, 8)
        .map((r) => r.id)
    ).not.toContain('a0')
    const rows = find('needle')
    expect(rows.map((r) => r.id)).toEqual(['r1', 'a1', 'a0'])
    expect(rows[2]).toMatchObject({
      occurredOn: '2026-08-01',
      type: 'action-record',
      durationMinutes: null
    })
    expect(rows[2].matches.map((m) => m.label)).toEqual([
      '备注',
      '理解 · 已撤销',
      '困惑 · 已解决',
      '解决说明 · 已解决'
    ])
  })
  it.each([
    ['靠窗', 'a0', '备注'],
    ['排水孔', 'a1', '记录下一步'],
    ['光照', 'a2', '理解 · 保留'],
    ['未解疑问', 'a3', '困惑 · 未解决'],
    ['排查说明', 'a0', '解决说明 · 已解决'],
    ['ピアノ', 'r1', '例行名称（当前）'],
    ['CAFÉ', 'a11', '行动标题（当前）'],
    ['🎵', 'r1', '备注']
  ])('finds %s in its saved field', (query, id, label) => {
    expect(find(query)[0]).toMatchObject({ id, matches: [expect.objectContaining({ label })] })
  })
  it('trims only boundary whitespace and treats wildcard-like punctuation as text', () => {
    expect(find('  NeEdLe\n')).toEqual(find('needle'))
    expect(find(' \t ')).toEqual(find(''))
    expect(find('%_*.[x]')).toHaveLength(1)
    expect(find('.*')).toEqual([])
    expect(find('<script>')[0].matches[0].snippet).toContain('<script>')
    expect(find('not-a-search-field')).toEqual([])
    expect(find('Needle 旧')).toHaveLength(1)
    expect(find('Needle  旧')).toEqual([])
  })
  it('intersects query, type, goal and exact occurrence date', () => {
    expect(
      find('needle', { kind: 'action-record', goalId: 'g', date: '2026-08-01' }).map((r) => r.id)
    ).toEqual(['a0'])
    expect(find('needle', { goalId: 'none' }).map((r) => r.id)).toEqual(['r1'])
    expect(find('needle', { kind: 'routine-record', goalId: 'g' })).toEqual([])
  })
  it('uses current saved edits, statuses and deletions without retaining stale matches', () => {
    const data = fixture()
    const changed = {
      ...data,
      actionRecords: data.actionRecords.map((r) => (r.id === 'a0' ? { ...r, note: '新文字' } : r)),
      understandings: [],
      confusions: []
    }
    expect(find('靠窗', {}, changed)).toEqual([])
    expect(find('新文字', {}, changed).map((r) => r.id)).toEqual(['a0'])
    expect(
      find(
        'needle',
        {},
        { ...changed, actionRecords: changed.actionRecords.filter((r) => r.id !== 'a1') }
      ).map((r) => r.id)
    ).toEqual(['r1'])
    expect(find('植物', {}, { ...data, actions: [] })).toEqual([])
    expect(find('已删除的行动', {}, { ...data, actions: [] })).toEqual([])
  })
  it('centers bounded snippets on late matches without breaking surrogate pairs or lowercase offsets', () => {
    const data = fixture()
    const text = 'İ'.repeat(220) + '🌱'.repeat(100) + 'Needle 靠窗' + '余'.repeat(300)
    const rows = find(
      'needle',
      {},
      {
        ...data,
        actionRecords: [{ ...data.actionRecords[0], note: text }],
        routineRecords: [],
        understandings: [],
        confusions: []
      }
    )
    const value = rows[0].matches[0].snippet
    expect(value).toContain('Needle 靠窗')
    expect(value.startsWith('…')).toBe(true)
    expect(value.endsWith('…')).toBe(true)
    expect(Array.from(value).length).toBeLessThanOrEqual(162)
    expect(
      Array.from(value).every((point) => point.length === 2 || !/[\uD800-\uDFFF]/u.test(point))
    ).toBe(true)
  })
})
