import { addLocalDateDays, createLocalDate } from '../domain/local-date'
import { createAction } from '../domain/action'
import { setGoalCurrentNextAction, type Goal } from '../domain/goal'
import {
  buildReviewSummary,
  createReviewResult,
  currentReviewPeriod,
  reviewPeriodEndedOn,
  updateReviewResult,
  type ReviewResult,
  type ReviewSummary
} from '../domain/review'
import { normalizeProgressFilter } from '../domain/progress'
import { buildProgressViewFromSnapshot } from './progress'
import type { ClockPort } from './ports/clock'
import {
  asReviewRepository,
  type ActionPersistenceRecord,
  type GoalPersistenceRecord,
  type RepositoryPort,
  type ReviewResultPersistenceRecord,
  type UnitOfWorkPort
} from './ports/persistence'

export interface ReviewPeriod {
  readonly periodStartedOn: string
  readonly periodEndedOn: string
}

export interface ReviewServiceDependencies {
  readonly repository: RepositoryPort
  readonly clock: ClockPort
  readonly unitOfWork?: UnitOfWorkPort
  readonly generateId?: () => string
}

export type ReviewNextStepChange =
  | { readonly kind: 'none' }
  | { readonly kind: 'use-existing'; readonly actionId: string }
  | {
      readonly kind: 'create-and-use'
      readonly title: string
      readonly description?: string | null
    }

export class ReviewApplicationError extends Error {
  public constructor(
    readonly code: 'validation' | 'related-goal-invalid' | 'next-step-invalid',
    message: string
  ) {
    super(message)
    this.name = 'ReviewApplicationError'
  }
}

function reviewFromPersistence(record: ReviewResultPersistenceRecord): ReviewResult {
  return Object.freeze({
    id: record.id,
    periodStartedOn: record.periodStartedOn as ReviewResult['periodStartedOn'],
    confirmedProgress: record.confirmedProgress,
    mainObstacle: record.mainObstacle,
    nextAdjustment: record.nextAdjustment,
    relatedGoalId: record.goalId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  })
}

function reviewToPersistence(result: ReviewResult): ReviewResultPersistenceRecord {
  return Object.freeze({
    id: result.id,
    periodStartedOn: String(result.periodStartedOn),
    confirmedProgress: result.confirmedProgress,
    mainObstacle: result.mainObstacle,
    nextAdjustment: result.nextAdjustment,
    goalId: result.relatedGoalId,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt
  })
}

function goalFromPersistence(record: GoalPersistenceRecord): Goal {
  return Object.freeze({
    id: record.id,
    name: record.title,
    description: record.description,
    status: record.status,
    currentNextActionId: record.currentNextActionId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  })
}

function goalToPersistence(goal: Goal): GoalPersistenceRecord {
  return Object.freeze({
    id: goal.id,
    title: goal.name,
    description: goal.description,
    status: goal.status,
    currentNextActionId: goal.currentNextActionId,
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt
  })
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

  public getReviewResult(period: ReviewPeriod): ReviewResult | null {
    this.assertPeriod(period)
    const repository = asReviewRepository(this.dependencies.repository)
    if (typeof repository.findReviewResultByPeriodStartedOn !== 'function') {
      throw new TypeError('Repository does not provide the ReviewResult query contract.')
    }
    const record = repository.findReviewResultByPeriodStartedOn(period.periodStartedOn)
    return record ? reviewFromPersistence(record) : null
  }

  public getPreviousAdjustment(
    period: ReviewPeriod
  ): ReviewPeriod & { readonly nextAdjustment: string | null } {
    this.assertPeriod(period)
    const previousStart = String(addLocalDateDays(createLocalDate(period.periodStartedOn), -7))
    const previous = {
      periodStartedOn: previousStart,
      periodEndedOn: String(reviewPeriodEndedOn(previousStart))
    }
    const result = this.getReviewResult(previous)
    return Object.freeze({ ...previous, nextAdjustment: result?.nextAdjustment ?? null })
  }

  public completeReview(
    period: ReviewPeriod,
    input: {
      readonly confirmedProgress: string
      readonly mainObstacle: string
      readonly nextAdjustment: string
      readonly relatedGoalId?: string | null
      readonly nextStepChange: ReviewNextStepChange
    }
  ): ReviewResult {
    this.assertPeriod(period)
    if (!this.dependencies.unitOfWork || !this.dependencies.generateId) {
      throw new ReviewApplicationError('validation', 'Review completion is not configured.')
    }
    const now = this.dependencies.clock.snapshot().instant
    try {
      return this.dependencies.unitOfWork.transaction((repository) => {
        const reviews = asReviewRepository(repository)
        if (typeof reviews.findReviewResultByPeriodStartedOn !== 'function') {
          throw new TypeError('Repository does not provide the ReviewResult query contract.')
        }
        const existing = reviews.findReviewResultByPeriodStartedOn(period.periodStartedOn)
        const relatedGoal = input.relatedGoalId
          ? repository.findGoalById(input.relatedGoalId)
          : null
        if (input.relatedGoalId && (!relatedGoal || relatedGoal.status !== 'active')) {
          throw new ReviewApplicationError(
            'related-goal-invalid',
            'The related Goal must exist and be active.'
          )
        }
        if (input.nextStepChange.kind !== 'none' && !relatedGoal) {
          throw new ReviewApplicationError(
            'related-goal-invalid',
            'An active related Goal is required to update its current next action.'
          )
        }

        const result = existing
          ? updateReviewResult(reviewFromPersistence(existing), { ...input, now })
          : createReviewResult({
              id: this.dependencies.generateId!(),
              periodStartedOn: period.periodStartedOn,
              ...input,
              now
            })

        if (input.nextStepChange.kind !== 'none' && relatedGoal) {
          let action: ActionPersistenceRecord
          if (input.nextStepChange.kind === 'use-existing') {
            const existingAction = repository.findActionById(input.nextStepChange.actionId)
            if (
              !existingAction ||
              existingAction.goalId !== relatedGoal.id ||
              existingAction.status !== 'pending'
            ) {
              throw new ReviewApplicationError(
                'next-step-invalid',
                'The selected Action must be pending and belong to the related Goal.'
              )
            }
            action = existingAction
          } else {
            action = createAction({
              id: this.dependencies.generateId!(),
              goalId: relatedGoal.id,
              title: input.nextStepChange.title,
              description: input.nextStepChange.description,
              now
            })
            repository.saveAction(action)
          }
          repository.saveGoal(
            goalToPersistence(
              setGoalCurrentNextAction(goalFromPersistence(relatedGoal), action, now)
            )
          )
        }
        repository.saveReviewResult(reviewToPersistence(result))
        return result
      })
    } catch (error) {
      if (error instanceof ReviewApplicationError) throw error
      if (
        error instanceof TypeError ||
        (error instanceof Error && /must not be blank|Monday/.test(error.message))
      ) {
        throw new ReviewApplicationError('validation', error.message)
      }
      throw error
    }
  }

  private assertPeriod(period: ReviewPeriod): void {
    const expectedEnd = String(reviewPeriodEndedOn(period.periodStartedOn))
    if (period.periodEndedOn !== expectedEnd) {
      throw new ReviewApplicationError('validation', 'Review period is invalid.')
    }
  }
}
