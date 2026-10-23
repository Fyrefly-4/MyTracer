import { describe, expect, it, vi } from 'vitest'
import { ReviewService } from '../../src/application/review'
import type {
  ActionPersistenceRecord,
  GoalPersistenceRecord,
  ProgressQuerySnapshotPersistence,
  RepositoryPort,
  ReviewRepositoryPort
} from '../../src/application/ports/persistence'
import { FakeClock } from '../support/fake-clock'

const emptySnapshot = (): ProgressQuerySnapshotPersistence => ({
  actionRows: [],
  routineRecords: []
})

function atomicHarness() {
  let state = {
    goal: {
      id: 'goal-1',
      title: 'Goal',
      description: null,
      status: 'active' as const,
      currentNextActionId: null as string | null,
      createdAt: '2026-08-24T08:00:00.000Z',
      updatedAt: '2026-08-24T08:00:00.000Z'
    } satisfies GoalPersistenceRecord,
    actions: new Map<string, ActionPersistenceRecord>(),
    reviews: new Map<string, Parameters<RepositoryPort['saveReviewResult']>[0]>(),
    failReviewSave: false
  }
  state.actions.set('action-1', {
    id: 'action-1',
    goalId: 'goal-1',
    title: 'Existing',
    description: null,
    status: 'pending',
    createdAt: state.goal.createdAt,
    updatedAt: state.goal.updatedAt
  })
  const repository = {
    queryReviewSummarySnapshot: emptySnapshot,
    findReviewResultByPeriodStartedOn: (period: string) => state.reviews.get(period) ?? null,
    findGoalById: (id: string) => (id === state.goal.id ? state.goal : null),
    findActionById: (id: string) => state.actions.get(id) ?? null,
    saveAction: (action: ActionPersistenceRecord) => state.actions.set(action.id, action),
    saveGoal: (goal: GoalPersistenceRecord) => {
      state.goal = goal as typeof state.goal
    },
    saveReviewResult: (review: Parameters<RepositoryPort['saveReviewResult']>[0]) => {
      if (state.failReviewSave) throw new Error('review save failed')
      state.reviews.set(review.periodStartedOn, review)
    }
  } as unknown as RepositoryPort
  return {
    repository,
    unitOfWork: {
      transaction<T>(work: (repository: RepositoryPort) => T): T {
        const before = structuredClone(state)
        try {
          return work(repository)
        } catch (error) {
          state = before
          throw error
        }
      }
    },
    state: () => state,
    failReviewSave: () => {
      state.failReviewSave = true
    }
  }
}

describe('Review application query', () => {
  it('captures the Main Clock once when beginning and keeps that period stable', () => {
    const clock = new FakeClock({
      instant: '2026-08-30T04:00:00.000Z',
      localDate: '2026-08-30',
      timeZone: 'Asia/Shanghai'
    })
    const snapshot = vi.spyOn(clock, 'snapshot')
    const repository = {
      queryReviewSummarySnapshot: vi.fn(emptySnapshot)
    } as unknown as ReviewRepositoryPort
    const service = new ReviewService({ repository, clock })

    const period = service.beginReview()
    expect(snapshot).toHaveBeenCalledOnce()
    expect(period).toEqual({
      periodStartedOn: '2026-08-24',
      periodEndedOn: '2026-08-30'
    })
    clock.setState({
      instant: '2026-08-31T04:00:00.000Z',
      localDate: '2026-08-31',
      timeZone: 'Asia/Shanghai'
    })
    expect(service.getReviewSummary(period)).toMatchObject(period)
    expect(snapshot).toHaveBeenCalledOnce()
    expect(repository.queryReviewSummarySnapshot).toHaveBeenCalledWith('2026-08-24', '2026-08-30')
    expect(service.beginReview()).toEqual({
      periodStartedOn: '2026-08-31',
      periodEndedOn: '2026-09-06'
    })
  })

  it('recalculates from each repository snapshot and preserves Progress formulas', () => {
    let current = emptySnapshot()
    const repository = {
      queryReviewSummarySnapshot: vi.fn(() => current)
    } as unknown as ReviewRepositoryPort
    const service = new ReviewService({
      repository,
      clock: new FakeClock({
        instant: '2026-08-12T08:00:00.000Z',
        localDate: '2026-08-12',
        timeZone: 'Asia/Shanghai'
      })
    })
    const period = service.beginReview()
    expect(service.getReviewSummary(period)).toMatchObject({
      totalDurationMinutes: 0,
      realActionCount: 0,
      confirmedUnderstandingCount: 0,
      openConfusionCount: 0,
      hasRecordedFacts: false
    })
    current = {
      actionRows: [
        {
          recordId: 'record-1',
          actionId: 'action-1',
          goalId: null,
          actionTitle: 'Act',
          hasRecordedText: false,
          occurredOn: '2026-08-12',
          durationMinutes: 8,
          outcome: 'partial',
          recordCreatedAt: '2026-08-12T08:00:00.000Z',
          understandingId: null,
          understandingText: null,
          understandingCreatedAt: null,
          confusionId: null,
          confusionText: null,
          confusionCreatedAt: null
        }
      ],
      routineRecords: [
        {
          recordId: 'routine-record-1',
          routineId: 'routine-1',
          goalId: null,
          routineName: 'Move',
          occurredOn: '2026-08-12',
          outcome: 'acted',
          plannedForDate: false,
          durationMinutes: 2,
          note: null,
          recordCreatedAt: '2026-08-12T09:00:00.000Z'
        }
      ]
    }
    expect(service.getReviewSummary(period)).toMatchObject({
      totalDurationMinutes: 10,
      realActionCount: 2,
      hasRecordedFacts: true,
      routineOutcomeCounts: { acted: 1 }
    })
    expect(repository.queryReviewSummarySnapshot).toHaveBeenCalledTimes(2)
  })

  it('rejects a non-week context period before querying persistence', () => {
    const repository = {
      queryReviewSummarySnapshot: vi.fn(emptySnapshot)
    } as unknown as ReviewRepositoryPort
    const service = new ReviewService({
      repository,
      clock: new FakeClock({
        instant: '2026-08-12T08:00:00.000Z',
        localDate: '2026-08-12',
        timeZone: 'Asia/Shanghai'
      })
    })
    expect(() =>
      service.getReviewSummary({
        periodStartedOn: '2026-08-11',
        periodEndedOn: '2026-08-17'
      })
    ).toThrow(/Monday-through-Sunday/)
    expect(repository.queryReviewSummarySnapshot).not.toHaveBeenCalled()
  })
})

describe('Review application atomic completion', () => {
  it('creates and selects a same-Goal pending Action in the ReviewResult transaction', () => {
    const harness = atomicHarness()
    const ids = ['review-1', 'action-created']
    const service = new ReviewService({
      repository: harness.repository,
      unitOfWork: harness.unitOfWork,
      generateId: () => ids.shift()!,
      clock: new FakeClock({
        instant: '2026-08-30T08:00:00.000Z',
        localDate: '2026-08-30',
        timeZone: 'Asia/Shanghai'
      })
    })
    service.completeReview(service.beginReview(), {
      confirmedProgress: 'Progress',
      mainObstacle: 'Obstacle',
      nextAdjustment: 'Adjustment',
      relatedGoalId: 'goal-1',
      nextStepChange: { kind: 'create-and-use', title: 'Created' }
    })
    expect(harness.state().goal.currentNextActionId).toBe('action-created')
    expect(harness.state().actions.get('action-created')).toMatchObject({
      goalId: 'goal-1',
      status: 'pending',
      title: 'Created'
    })
    expect(harness.state().reviews.get('2026-08-24')).toMatchObject({ id: 'review-1' })
  })

  it('rolls back current-next selection when ReviewResult persistence fails', () => {
    const harness = atomicHarness()
    harness.failReviewSave()
    const service = new ReviewService({
      repository: harness.repository,
      unitOfWork: harness.unitOfWork,
      generateId: () => 'review-1',
      clock: new FakeClock({
        instant: '2026-08-30T08:00:00.000Z',
        localDate: '2026-08-30',
        timeZone: 'Asia/Shanghai'
      })
    })
    expect(() =>
      service.completeReview(service.beginReview(), {
        confirmedProgress: 'Progress',
        mainObstacle: 'Obstacle',
        nextAdjustment: 'Adjustment',
        relatedGoalId: 'goal-1',
        nextStepChange: { kind: 'use-existing', actionId: 'action-1' }
      })
    ).toThrow(/review save failed/)
    expect(harness.state().goal.currentNextActionId).toBeNull()
    expect(harness.state().reviews.size).toBe(0)
  })
})

describe('previous calendar week adjustment reference', () => {
  it.each([
    ['2026-01-05', '2026-01-11', '2025-12-29', '2026-01-04'],
    ['2026-03-02', '2026-03-08', '2026-02-23', '2026-03-01'],
    ['2024-03-04', '2024-03-10', '2024-02-26', '2024-03-03'],
    ['2026-03-09', '2026-03-15', '2026-03-02', '2026-03-08'],
    ['2026-11-02', '2026-11-08', '2026-10-26', '2026-11-01']
  ])(
    'uses calendar arithmetic from %s regardless of the clock',
    (start, end, previousStart, previousEnd) => {
      const find = vi.fn(() => null)
      const service = new ReviewService({
        repository: {
          queryReviewSummarySnapshot: emptySnapshot,
          findReviewResultByPeriodStartedOn: find
        } as unknown as RepositoryPort,
        clock: new FakeClock({
          instant: '2030-01-01T23:30:00Z',
          localDate: '2030-01-02',
          timeZone: 'Asia/Shanghai'
        })
      })
      expect(service.getPreviousAdjustment({ periodStartedOn: start, periodEndedOn: end })).toEqual(
        {
          periodStartedOn: previousStart,
          periodEndedOn: previousEnd,
          nextAdjustment: null
        }
      )
      expect(find).toHaveBeenCalledExactlyOnceWith(previousStart)
    }
  )
  it('projects only the saved adjustment, preserving full multiline text', () => {
    const nextAdjustment = '一行\n二行' + '很长的原文'.repeat(200)
    const find = vi.fn(() => ({
      id: 'saved',
      periodStartedOn: '2025-12-29',
      confirmedProgress: 'private progress',
      mainObstacle: 'private obstacle',
      nextAdjustment,
      goalId: null,
      createdAt: 'now',
      updatedAt: 'now'
    }))
    const service = new ReviewService({
      repository: {
        queryReviewSummarySnapshot: emptySnapshot,
        findReviewResultByPeriodStartedOn: find
      } as unknown as RepositoryPort,
      clock: new FakeClock({
        instant: '2026-01-05T00:00:00Z',
        localDate: '2026-01-05',
        timeZone: 'UTC'
      })
    })
    expect(
      service.getPreviousAdjustment({ periodStartedOn: '2026-01-05', periodEndedOn: '2026-01-11' })
    ).toEqual({ periodStartedOn: '2025-12-29', periodEndedOn: '2026-01-04', nextAdjustment })
    expect(() =>
      service.getPreviousAdjustment({ periodStartedOn: '2026-01-06', periodEndedOn: '2026-01-11' })
    ).toThrow()
  })
})
