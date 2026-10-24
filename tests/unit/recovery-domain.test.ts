import { describe, expect, it } from 'vitest'
import { buildRecoveryContext, differenceInLocalDateDays } from '../../src/domain/recovery'
import { createLocalDate } from '../../src/domain/local-date'
import type { ProgressView } from '../../src/domain/progress'

const goal = {
  id: 'goal-1',
  name: 'Learn',
  status: 'active' as const,
  currentNextActionId: 'action-2'
}
const actions = [
  {
    id: 'action-2',
    title: 'Second',
    description: null,
    status: 'pending' as const,
    createdAt: '2026-08-02T00:00:00.000Z'
  },
  {
    id: 'action-1',
    title: 'First',
    description: null,
    status: 'pending' as const,
    createdAt: '2026-08-01T00:00:00.000Z'
  }
]
function progress(overrides: Partial<ProgressView> = {}): ProgressView {
  return {
    filter: { goalId: goal.id, from: null, through: null },
    totalDurationMinutes: 0,
    unknownDurationCount: 0,
    realActionCount: 0,
    targetMetCount: 0,
    plannedTargetMetCount: 0,
    records: [],
    routineRecords: [],
    ...overrides
  }
}

describe('Recovery pure projection', () => {
  it('calculates LocalDate differences across month, year, and leap-day boundaries', () => {
    expect(
      differenceInLocalDateDays(createLocalDate('2026-03-01'), createLocalDate('2026-02-28'))
    ).toBe(1)
    expect(
      differenceInLocalDateDays(createLocalDate('2025-01-01'), createLocalDate('2024-12-31'))
    ).toBe(1)
    expect(
      differenceInLocalDateDays(createLocalDate('2024-03-01'), createLocalDate('2024-02-28'))
    ).toBe(2)
  })

  it('returns null dates without real action and never substitutes Goal timestamps', () => {
    const result = buildRecoveryContext({
      asOfLocalDate: '2026-08-20',
      goal,
      actions,
      progress: progress()
    })
    expect(result).toMatchObject({
      lastRealActionOn: null,
      daysSinceLastRealAction: null,
      latestRealRecord: null
    })
    expect(result.currentNextAction?.id).toBe('action-2')
    expect(result.pendingActions.map((item) => item.id)).toEqual(['action-1', 'action-2'])
  })

  it('treats every ActionRecord and only target_met or acted Routine records as real, including zero minutes', () => {
    const result = buildRecoveryContext({
      asOfLocalDate: '2026-08-20',
      goal,
      actions,
      progress: progress({
        records: [
          {
            recordId: 'action-record',
            actionId: 'action-1',
            goalId: goal.id,
            actionTitle: 'First',
            hasRecordedText: true,
            occurredOn: '2026-08-17',
            durationMinutes: 0,
            outcome: 'stopped',
            createdAt: '2026-08-17T12:00:00.000Z',
            understandings: [{ id: 'u', text: 'Known', createdAt: '2026-08-17T12:01:00.000Z' }],
            openConfusions: [{ id: 'c', text: 'Question', createdAt: '2026-08-17T12:02:00.000Z' }]
          }
        ],
        routineRecords: [
          {
            recordId: 'rest',
            routineId: 'routine',
            goalId: goal.id,
            routineName: 'Move',
            occurredOn: '2026-08-20',
            outcome: 'intentional_rest',
            plannedForDate: true,
            durationMinutes: null,
            summary: null,
            note: null,
            createdAt: '2026-08-20T12:00:00.000Z'
          },
          {
            recordId: 'not-done',
            routineId: 'routine',
            goalId: goal.id,
            routineName: 'Move',
            occurredOn: '2026-08-19',
            outcome: 'not_done',
            plannedForDate: true,
            durationMinutes: null,
            summary: null,
            note: null,
            createdAt: '2026-08-19T12:00:00.000Z'
          },
          {
            recordId: 'acted',
            routineId: 'routine',
            goalId: goal.id,
            routineName: 'Move',
            occurredOn: '2026-08-18',
            outcome: 'acted',
            plannedForDate: false,
            durationMinutes: 0,
            summary: null,
            note: null,
            createdAt: '2026-08-18T12:00:00.000Z'
          },
          {
            recordId: 'met',
            routineId: 'routine',
            goalId: goal.id,
            routineName: 'Move',
            occurredOn: '2026-08-16',
            outcome: 'target_met',
            plannedForDate: true,
            durationMinutes: null,
            summary: null,
            note: null,
            createdAt: '2026-08-16T12:00:00.000Z'
          }
        ]
      })
    })
    expect(result).toMatchObject({
      lastRealActionOn: '2026-08-18',
      daysSinceLastRealAction: 2,
      latestRealRecord: { recordId: 'acted', durationMinutes: 0 }
    })
    expect(result.latestRealRecord).not.toHaveProperty('hasRecordedText')
    expect(result.confirmedUnderstandings).toEqual([
      { id: 'u', text: 'Known', createdAt: '2026-08-17T12:01:00.000Z' }
    ])
    expect(result.openConfusions).toEqual([
      { id: 'c', text: 'Question', createdAt: '2026-08-17T12:02:00.000Z' }
    ])
  })

  it('breaks same-day and same-createdAt cross-type ties by record ID', () => {
    const result = buildRecoveryContext({
      asOfLocalDate: '2026-08-20',
      goal,
      actions,
      progress: progress({
        records: [
          {
            recordId: 'record-b',
            actionId: 'action-1',
            goalId: goal.id,
            actionTitle: 'First',
            hasRecordedText: false,
            occurredOn: '2026-08-20',
            durationMinutes: 0,
            outcome: 'partial',
            createdAt: '2026-08-20T12:00:00.000Z',
            understandings: [],
            openConfusions: []
          }
        ],
        routineRecords: [
          {
            recordId: 'record-a',
            routineId: 'routine',
            goalId: goal.id,
            routineName: 'Move',
            occurredOn: '2026-08-20',
            outcome: 'target_met',
            plannedForDate: true,
            durationMinutes: null,
            summary: null,
            note: null,
            createdAt: '2026-08-20T12:00:00.000Z'
          }
        ]
      })
    })
    expect(result.latestRealRecord).toMatchObject({ recordId: 'record-a', kind: 'routine' })
  })
})
