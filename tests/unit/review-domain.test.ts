import { describe, expect, it } from 'vitest'
import { buildProgressView, normalizeProgressFilter } from '../../src/domain/progress'
import {
  buildReviewSummary,
  createReviewResult,
  currentReviewPeriod,
  reviewPeriodEndedOn,
  REVIEW_UNKNOWN_POLICY,
  updateReviewResult
} from '../../src/domain/review'

describe('Review period and pure summary builder', () => {
  it('validates the three confirmed texts and derives period end without persisting it', () => {
    const result = createReviewResult({
      id: 'review-1',
      periodStartedOn: '2026-08-24',
      confirmedProgress: '  Shipped one slice  ',
      mainObstacle: '  Context switching  ',
      nextAdjustment: '  Protect one hour  ',
      now: '2026-08-30T08:00:00.000Z'
    })
    expect(result).toMatchObject({
      confirmedProgress: 'Shipped one slice',
      mainObstacle: 'Context switching',
      nextAdjustment: 'Protect one hour',
      relatedGoalId: null
    })
    expect(reviewPeriodEndedOn(String(result.periodStartedOn))).toBe('2026-08-30')
    expect(result).not.toHaveProperty('periodEndedOn')
    for (const field of ['confirmedProgress', 'mainObstacle', 'nextAdjustment'] as const) {
      expect(() =>
        createReviewResult({
          id: 'review-2',
          periodStartedOn: '2026-08-24',
          confirmedProgress: 'Progress',
          mainObstacle: 'Obstacle',
          nextAdjustment: 'Adjustment',
          [field]: '   ',
          now: '2026-08-30T08:00:00.000Z'
        })
      ).toThrow(/must not be blank/)
    }
  })

  it('edits the same stable result while preserving id, period, and createdAt', () => {
    const created = createReviewResult({
      id: 'review-1',
      periodStartedOn: '2026-08-24',
      confirmedProgress: 'One',
      mainObstacle: 'Two',
      nextAdjustment: 'Three',
      now: '2026-08-30T08:00:00.000Z'
    })
    expect(
      updateReviewResult(created, {
        confirmedProgress: 'Changed',
        mainObstacle: 'Still',
        nextAdjustment: 'Next',
        relatedGoalId: 'goal-1',
        now: '2026-08-30T09:00:00.000Z'
      })
    ).toMatchObject({
      id: created.id,
      periodStartedOn: created.periodStartedOn,
      createdAt: created.createdAt,
      updatedAt: '2026-08-30T09:00:00.000Z',
      confirmedProgress: 'Changed',
      relatedGoalId: 'goal-1'
    })
  })
  it.each([
    ['2026-08-31', '2026-08-31', '2026-09-06'],
    ['2026-09-06', '2026-08-31', '2026-09-06'],
    ['2027-01-01', '2026-12-28', '2027-01-03'],
    ['2028-02-29', '2028-02-28', '2028-03-05']
  ])('derives the inclusive Monday-through-Sunday week for %s', (current, monday, sunday) => {
    expect(currentReviewPeriod(current)).toEqual({ monday, sunday })
  })

  it('reuses Progress totals and keeps all four explicit Routine outcomes separate', () => {
    const period = currentReviewPeriod('2026-08-12')
    const progress = buildProgressView(
      normalizeProgressFilter({ from: '2026-08-10', through: '2026-08-16' }),
      [
        {
          recordId: 'action-record-1',
          actionId: 'action-1',
          goalId: null,
          actionTitle: 'Read one example',
          hasRecordedText: true,
          occurredOn: '2026-08-10',
          durationMinutes: 7,
          outcome: 'partial',
          createdAt: '2026-08-10T08:00:00.000Z',
          understandings: [{ id: 'u-1', text: 'A fact', createdAt: '2026-08-10T08:01:00.000Z' }],
          openConfusions: [{ id: 'c-1', text: 'A question', createdAt: '2026-08-10T08:02:00.000Z' }]
        }
      ],
      (['target_met', 'acted', 'intentional_rest', 'not_done'] as const).map((outcome, index) => ({
        recordId: `routine-record-${index + 1}`,
        routineId: `routine-${index + 1}`,
        goalId: null,
        routineName: outcome,
        occurredOn: `2026-08-${String(index + 11).padStart(2, '0')}`,
        outcome,
        plannedForDate: true,
        durationMinutes: outcome === 'target_met' ? 3 : null,
        summary: null,
        note: null,
        createdAt: `2026-08-${String(index + 11).padStart(2, '0')}T08:00:00.000Z`
      }))
    )

    const summary = buildReviewSummary(period, progress)
    expect(summary.actionRecords[0].hasRecordedText).toBe(progress.records[0].hasRecordedText)
    expect(summary.actionRecords[0]).not.toHaveProperty('nextStep')
    expect(summary).toMatchObject({
      periodStartedOn: '2026-08-10',
      periodEndedOn: '2026-08-16',
      totalDurationMinutes: progress.totalDurationMinutes,
      realActionCount: progress.realActionCount,
      confirmedUnderstandingCount: 1,
      openConfusionCount: 1,
      hasRecordedFacts: true,
      routineOutcomeCounts: { targetMet: 1, acted: 1, intentionalRest: 1, notDone: 1 },
      unknownPolicy: REVIEW_UNKNOWN_POLICY
    })
    expect(summary.understandings).toEqual([
      expect.objectContaining({ id: 'u-1', actionRecordId: 'action-record-1' })
    ])
    expect(summary.openConfusions).toEqual([
      expect.objectContaining({ id: 'c-1', actionRecordId: 'action-record-1' })
    ])
    expect(Object.values(summary.routineOutcomeFacts).flat()).toHaveLength(4)
    expect(summary.unknownDurationCount).toBe(1)
    expect(
      summary.routineRecords.every((record) =>
        ['target_met', 'acted', 'intentional_rest', 'not_done'].includes(record.outcome)
      )
    ).toBe(true)
    expect(JSON.stringify(summary)).not.toMatch(/failure|score|mastery|streak/i)
  })

  it('rejects facts from any different filter instead of creating a second truth', () => {
    const period = currentReviewPeriod('2026-08-12')
    const wrong = buildProgressView(normalizeProgressFilter({}), [], [])
    expect(() => buildReviewSummary(period, wrong)).toThrow(/captured all-goal period filter/)
  })
})
