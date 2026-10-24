import { describe, expect, it } from 'vitest'
import {
  buildGoalActivity,
  buildWeekComparison,
  comparisonPeriods
} from '../../src/domain/should-facts'
import {
  buildProgressView,
  normalizeProgressFilter,
  type ProgressRecordFact,
  type RoutineProgressRecordFact
} from '../../src/domain/progress'
import { ProgressService } from '../../src/application/progress'
import type { RepositoryPort } from '../../src/application/ports/persistence'
import { FakeClock } from '../support/fake-clock'

function action(
  occurredOn: string,
  durationMinutes = 0,
  outcome: ProgressRecordFact['outcome'] = 'partial'
): ProgressRecordFact {
  return {
    recordId: `${occurredOn}-${outcome}`,
    actionId: 'action',
    goalId: 'goal',
    actionTitle: 'Example',
    hasRecordedText: false,
    occurredOn,
    durationMinutes,
    outcome,
    createdAt: '2026-09-19T00:00:00Z',
    understandings: [],
    openConfusions: []
  }
}
function routine(
  outcome: RoutineProgressRecordFact['outcome'],
  occurredOn: string,
  durationMinutes: number | null = null
): RoutineProgressRecordFact {
  return {
    recordId: `${occurredOn}-${outcome}`,
    routineId: 'routine',
    goalId: 'goal',
    routineName: 'Example',
    occurredOn,
    durationMinutes,
    outcome,
    plannedForDate: false,
    summary: null,
    note: null,
    createdAt: '2026-09-19T00:00:00Z'
  }
}

describe('SHOULD factual projections', () => {
  it.each([
    ['2026-09-14', '2026-09-14', '2026-09-07', '2026-09-13'],
    ['2026-09-20', '2026-09-14', '2026-09-07', '2026-09-13'],
    ['2026-01-01', '2025-12-29', '2025-12-22', '2025-12-28'],
    ['2024-03-01', '2024-02-26', '2024-02-19', '2024-02-25']
  ])('keeps local week boundaries at %s', (today, start, previousStart, previousEnd) => {
    expect(comparisonPeriods(today)).toMatchObject({
      current: { from: start, through: today },
      previous: { from: previousStart, through: previousEnd }
    })
  })

  it('keeps unknown, same-day, leap-day and future date facts distinct', () => {
    expect(
      buildGoalActivity('2024-03-01', [
        { goalId: 'empty', lastRealActionOn: null },
        { goalId: 'leap', lastRealActionOn: '2024-02-28' },
        { goalId: 'today', lastRealActionOn: '2024-03-01' },
        { goalId: 'future', lastRealActionOn: '2024-03-02' }
      ]).goals.map((fact) => fact.daysSinceLastRealAction)
    ).toEqual([null, 2, 0, -1])
  })

  it('counts real outcomes including zero minutes and off-plan facts without counting rest as action', () => {
    const facts = buildProgressView(
      normalizeProgressFilter({ goalId: 'goal' }),
      [
        action('2026-09-07', 20, 'completed'),
        action('2026-09-13', 5, 'stopped'),
        action('2026-09-14'),
        action('2026-09-19', 10, 'stopped'),
        action('2026-09-20', 999)
      ],
      [
        routine('acted', '2026-09-19'),
        routine('target_met', '2026-09-19', 5),
        routine('intentional_rest', '2026-09-19'),
        routine('not_done', '2026-09-19')
      ]
    )
    expect(buildWeekComparison('2026-09-19', facts)).toMatchObject({
      goalId: 'goal',
      current: {
        totalDurationMinutes: 15,
        unknownDurationCount: 1,
        realActionCount: 4,
        hasRecordedFacts: true
      },
      previous: { totalDurationMinutes: 25, unknownDurationCount: 0, realActionCount: 2 },
      difference: { totalDurationMinutes: -10, realActionCount: 2 }
    })
  })

  it('retains recorded rest while distinguishing both empty weeks and one-sided facts', () => {
    const empty = buildProgressView(normalizeProgressFilter({}), [])
    expect(buildWeekComparison('2026-09-19', empty)).toMatchObject({
      current: { hasRecordedFacts: false, realActionCount: 0 },
      previous: { hasRecordedFacts: false },
      difference: { realActionCount: 0 }
    })
    const rest = buildProgressView(
      normalizeProgressFilter({}),
      [],
      [routine('intentional_rest', '2026-09-19')]
    )
    expect(buildWeekComparison('2026-09-19', rest)).toMatchObject({
      current: { hasRecordedFacts: true, realActionCount: 0 },
      previous: { hasRecordedFacts: false }
    })
  })

  it('takes one clock and one inclusive repository snapshot for the two weeks', () => {
    const clock = new FakeClock({
      instant: '2026-09-18T16:01:00Z',
      localDate: '2026-09-19',
      timeZone: 'Asia/Shanghai'
    })
    const filters: unknown[] = []
    const repository = {
      findGoalById: () => ({ id: 'goal' }),
      queryProgressSnapshot: (filter: unknown) => {
        filters.push(filter)
        return { actionRows: [], routineRecords: [] }
      },
      queryGoalActivityDates: () => [{ goalId: 'goal', lastRealActionOn: null }]
    } as unknown as RepositoryPort
    const service = new ProgressService({ repository, clock })
    expect(service.compareWeeks({ goalId: 'goal' }).asOfLocalDate).toBe('2026-09-19')
    expect(filters).toEqual([{ goalId: 'goal', from: '2026-09-07', through: '2026-09-19' }])
    expect(service.getGoalActivity().goals[0].lastRealActionOn).toBeNull()
    expect(() => new ProgressService({ repository }).compareWeeks({})).toThrow('ClockPort')
  })
})
