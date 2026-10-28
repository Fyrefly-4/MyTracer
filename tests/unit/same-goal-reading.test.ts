import { describe, expect, it } from 'vitest'
import type { DataControlListDto } from '../../src/contracts/data-control'
import { sameGoalReading } from '../../src/renderer/src/features/data-control/same-goal-reading'

function fixture(): DataControlListDto {
  return {
    goals: [
      { id: 'g', title: '同名目标', status: 'ended' },
      { id: 'other', title: '同名目标', status: 'active' }
    ],
    actions: [
      { id: 'a', goalId: 'g', title: '当前行动', status: 'pending' },
      { id: 'b', goalId: 'g', title: '另一个行动', status: 'cancelled' },
      { id: 'c', goalId: 'other', title: '其他目标行动', status: 'completed' },
      { id: 'free', goalId: null, title: '独立行动', status: 'pending' }
    ],
    actionRecords: [
      ['now', 'a', '2026-08-20'],
      ['same', 'b', '2026-08-20'],
      ['old', 'b', '2026-08-01'],
      ['future', 'a', '2026-08-21'],
      ['different', 'c', '2026-08-01'],
      ['free', 'free', '2026-08-01'],
      ['orphan', 'missing', '2026-08-01']
    ].map(([id, actionId, occurredOn]) => ({
      id,
      actionId,
      occurredOn,
      outcome: 'partial',
      durationMinutes: null,
      note: '未改写的原文',
      summary: null,
      nextStep: null,
      createdAt: '2026-09-01',
      updatedAt: '2026-09-01'
    })),
    routines: [],
    routineRecords: [],
    understandings: [],
    confusions: []
  }
}

describe('same goal reading from a saved action record', () => {
  it('uses goal identity and occurrence dates, includes same-day and ended history without mutating facts', () => {
    const data = fixture()
    const before = structuredClone(data)
    const result = sameGoalReading(data, 'now')
    expect(result.candidates.map((item) => item.record.id)).toEqual(['same', 'old'])
    expect(result.current?.durationMinutes).toBeNull()
    expect(result.current?.note).toBe('未改写的原文')
    expect(data).toEqual(before)
  })
  it('distinguishes missing records, no goal and no candidates', () => {
    expect(sameGoalReading(fixture(), 'missing').current).toBeUndefined()
    expect(sameGoalReading(fixture(), 'free').goal).toBeUndefined()
    expect(sameGoalReading(fixture(), 'old').candidates).toEqual([])
  })
  it('recomputes membership and content after edits, deletions and goal changes', () => {
    const data = fixture()
    const changed = {
      ...data,
      actionRecords: data.actionRecords
        .filter((r) => r.id !== 'same')
        .map((r) => (r.id === 'old' ? { ...r, note: '修订后的文字' } : r))
    }
    expect(sameGoalReading(changed, 'now').candidates[0].record.note).toBe('修订后的文字')
    expect(
      sameGoalReading(
        {
          ...changed,
          actions: changed.actions.map((a) => (a.id === 'b' ? { ...a, goalId: 'other' } : a))
        },
        'now'
      ).candidates
    ).toEqual([])
    expect(sameGoalReading({ ...changed, goals: [] }, 'now').goal).toBeUndefined()
  })
})
