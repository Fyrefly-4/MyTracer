import { buildReviewSummary, currentReviewPeriod, type ReviewSummary } from '../domain/review'
import { normalizeProgressFilter } from '../domain/progress'
import { buildProgressViewFromSnapshot } from './progress'
import type { ClockPort } from './ports/clock'
import { asReviewRepository, type RepositoryPort } from './ports/persistence'

export interface ReviewPeriod {
  readonly periodStartedOn: string
  readonly periodEndedOn: string
}

export interface ReviewServiceDependencies {
  readonly repository: RepositoryPort
  readonly clock: ClockPort
}

export class ReviewService {
  public constructor(private readonly dependencies: ReviewServiceDependencies) {}

  public beginReview(): ReviewPeriod {
    const captured = this.dependencies.clock.snapshot()
    const period = currentReviewPeriod(String(captured.localDate))
    return Object.freeze({
      periodStartedOn: String(period.monday),
      periodEndedOn: String(period.sunday)
    })
  }

  public getReviewSummary(period: ReviewPeriod): ReviewSummary {
    const filter = normalizeProgressFilter({
      goalId: null,
      from: period.periodStartedOn,
      through: period.periodEndedOn
    })
    if (!filter.from || !filter.through) {
      throw new TypeError('Review period endpoints are required.')
    }
    const expected = currentReviewPeriod(String(filter.from))
    if (expected.monday !== filter.from || expected.sunday !== filter.through) {
      throw new TypeError('Review period must be one Monday-through-Sunday week.')
    }
    const snapshot = asReviewRepository(this.dependencies.repository).queryReviewSummarySnapshot(
      String(filter.from),
      String(filter.through)
    )
    return buildReviewSummary(expected, buildProgressViewFromSnapshot(filter, snapshot))
  }
}
