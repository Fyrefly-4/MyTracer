import { describe, expect, it, vi } from 'vitest'
import { ReviewService } from '../../src/application/review'
import type {
  ProgressQuerySnapshotPersistence,
  ReviewRepositoryPort
} from '../../src/application/ports/persistence'
import { FakeClock } from '../support/fake-clock'

const emptySnapshot = (): ProgressQuerySnapshotPersistence => ({
  actionRows: [],
  routineRecords: []
})

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
