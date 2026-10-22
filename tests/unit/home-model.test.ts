import { describe, expect, it } from 'vitest'
import type { DataControlListDto } from '../../src/contracts/data-control'
import type { GoalSummaryDto } from '../../src/contracts/goals'
import { homeGoals, homeRecords } from '../../src/renderer/src/features/home/home-model'

function data(): DataControlListDto {
  return {
    goals: [],
    actions: [{ id: 'a', goalId: 'g', title: '行动', status: 'pending' }],
    routines: [{ id: 'r', goalId: 'g', name: '例行', status: 'active' }],
    actionRecords: [],
    routineRecords: [],
    understandings: [],
    confusions: []
  }
}
function goal(
  id: string,
  updatedAt = '2026-01-01',
  status: GoalSummaryDto['status'] = 'active'
): GoalSummaryDto {
  return {
    id,
    name: id,
    description: null,
    status,
    currentNextActionId: null,
    createdAt: updatedAt,
    updatedAt
  }
}
describe('home read models', () => {
  it('uses occurrence dates, includes rest/not-done, omits future dates and never creates summaries', () => {
    const source = data()
    const records = homeRecords(
      {
        ...source,
        actionRecords: [
          {
            id: 'old',
            actionId: 'a',
            occurredOn: '2026-01-01',
            createdAt: '2026-10-22',
            updatedAt: '2026-10-22',
            outcome: 'partial',
            durationMinutes: 0,
            nextStep: null,
            note: '真实备注'
          },
          {
            id: 'future',
            actionId: 'a',
            occurredOn: '2027-01-01',
            createdAt: '2026-10-22',
            updatedAt: '2026-10-22',
            outcome: 'partial',
            durationMinutes: 1,
            nextStep: null,
            note: null
          }
        ],
        routineRecords: ['intentional_rest', 'not_done'].map((outcome, i) => ({
          id: `r${i}`,
          routineId: 'r',
          occurredOn: '2026-10-21',
          createdAt: '2026-10-21',
          updatedAt: '2026-10-21',
          outcome: outcome as 'intentional_rest' | 'not_done',
          durationMinutes: null,
          note: null,
          plannedForDate: true,
          plannedForDateBasis: 'schedule_at_recording'
        }))
      },
      '2026-10-22'
    )
    expect(records.map((record) => record.id)).toEqual(['r0', 'r1', 'old'])
    expect(records.map((record) => record.outcomeText)).toEqual([
      '主动休息',
      '未进行',
      '本次完成一部分'
    ])
    expect(records[2].note).toBe('真实备注')
    expect(records[2].durationMinutes).toBe(0)
  })
  it('uses only unrevoked actual understanding as action snippet and tolerates detached parents', () => {
    const records = homeRecords(
      {
        ...data(),
        actions: [],
        actionRecords: [
          {
            id: 'x',
            actionId: 'a',
            occurredOn: '2026-10-20',
            createdAt: '2026-10-20',
            updatedAt: '2026-10-20',
            outcome: 'stopped',
            durationMinutes: 1,
            nextStep: null,
            note: null
          }
        ],
        understandings: [
          {
            id: 'u0',
            actionRecordId: 'x',
            text: '撤回',
            source: 'manual',
            revokedAt: '2026-10-21',
            createdAt: '2026-10-20',
            updatedAt: '2026-10-21'
          },
          {
            id: 'u1',
            actionRecordId: 'x',
            text: '真实理解',
            source: 'manual',
            revokedAt: null,
            createdAt: '2026-10-20',
            updatedAt: '2026-10-20'
          }
        ]
      },
      '2026-10-22'
    )
    expect(records[0]).toMatchObject({ goalId: null, title: '历史行动', note: '真实理解' })
  })
  it('bounds active goal cards and orders by factual recency, updated time then stable ID', () => {
    const records = [
      {
        id: 'x',
        type: 'action-record' as const,
        occurredOn: '2026-10-20',
        title: 'x',
        goalId: 'a',
        note: null,
        outcomeText: 'x',
        durationMinutes: 1
      }
    ]
    const goals = [
      goal('d', '2026-10-22'),
      goal('c', '2026-10-22'),
      goal('b', '2026-10-22'),
      goal('a'),
      goal('z', '2026-10-23', 'paused'),
      goal('y', '2026-10-23', 'ended')
    ]
    expect(homeGoals(goals, records).map((goal) => goal.id)).toEqual(['a', 'b', 'c'])
    expect(goals).toHaveLength(6)
    expect(homeGoals([], records)).toEqual([])
  })
})
