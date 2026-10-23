import type { IpcMainInvokeEvent } from 'electron'
import { ReviewApplicationError, type ReviewService } from '../application/review'
import {
  REVIEW_CHANNELS,
  type BeginReviewDto,
  type PreviousReviewAdjustmentDto,
  type CompleteReviewInputDto,
  type ReviewErrorCode,
  type ReviewResult,
  type ReviewResultDto,
  type ReviewSummaryDto
} from '../contracts/review'
import { reviewPeriodEndedOn, type ReviewResult as DomainReviewResult } from '../domain/review'
import {
  InvalidReviewContextError,
  ReviewContextStore,
  StaleReviewContextError
} from './review-contexts'

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown
export interface ReviewIpcMain {
  removeHandler(channel: string): void
  handle(channel: string, listener: Handler): void
}
export interface RegisterReviewIpcOptions {
  readonly ipc: ReviewIpcMain
  readonly service: ReviewService
  readonly contexts: ReviewContextStore
  readonly assertSender: (event: IpcMainInvokeEvent) => void
}
class ReviewIpcValidationError extends Error {}

function fail<T>(code: ReviewErrorCode, message: string): ReviewResult<T> {
  return Object.freeze({ ok: false, error: Object.freeze({ code, message }) })
}

function exactObject(
  args: readonly unknown[],
  allowedKeys: readonly string[]
): Record<string, unknown> {
  if (args.length !== 1 || !args[0] || typeof args[0] !== 'object' || Array.isArray(args[0])) {
    throw new ReviewIpcValidationError()
  }
  const record = args[0] as Record<string, unknown>
  if (Object.keys(record).some((key) => !allowedKeys.includes(key))) {
    throw new ReviewIpcValidationError()
  }
  return record
}

function parseBegin(args: readonly unknown[]): void {
  const record = exactObject(args, [])
  if (Object.keys(record).length !== 0) throw new ReviewIpcValidationError()
}

function parseContext(args: readonly unknown[]): string {
  const record = exactObject(args, ['reviewContextId'])
  if (
    Object.keys(record).length !== 1 ||
    typeof record.reviewContextId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      record.reviewContextId
    )
  ) {
    throw new ReviewIpcValidationError()
  }
  return record.reviewContextId
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function uuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

function parseComplete(args: readonly unknown[]): CompleteReviewInputDto {
  const record = exactObject(args, [
    'reviewContextId',
    'confirmedProgress',
    'mainObstacle',
    'nextAdjustment',
    'relatedGoalId',
    'nextStepChange'
  ])
  if (
    Object.keys(record).length !== 6 ||
    !uuid(record.reviewContextId) ||
    typeof record.confirmedProgress !== 'string' ||
    typeof record.mainObstacle !== 'string' ||
    typeof record.nextAdjustment !== 'string' ||
    (record.relatedGoalId !== null && !uuid(record.relatedGoalId)) ||
    !record.nextStepChange ||
    typeof record.nextStepChange !== 'object' ||
    Array.isArray(record.nextStepChange)
  ) {
    throw new ReviewIpcValidationError()
  }
  const change = record.nextStepChange as Record<string, unknown>
  if (
    (change.kind === 'none' && Object.keys(change).length !== 1) ||
    (change.kind === 'use-existing' &&
      (Object.keys(change).length !== 2 || !uuid(change.actionId))) ||
    (change.kind === 'create-and-use' &&
      (Object.keys(change).some((key) => !['kind', 'title', 'description'].includes(key)) ||
        !Object.hasOwn(change, 'title') ||
        typeof change.title !== 'string' ||
        (change.description !== undefined &&
          change.description !== null &&
          typeof change.description !== 'string'))) ||
    !['none', 'use-existing', 'create-and-use'].includes(String(change.kind))
  ) {
    throw new ReviewIpcValidationError()
  }
  return record as unknown as CompleteReviewInputDto
}

function resultDto(result: DomainReviewResult): ReviewResultDto {
  return Object.freeze({
    id: result.id,
    periodStartedOn: String(result.periodStartedOn),
    periodEndedOn: String(reviewPeriodEndedOn(String(result.periodStartedOn))),
    confirmedProgress: result.confirmedProgress,
    mainObstacle: result.mainObstacle,
    nextAdjustment: result.nextAdjustment,
    relatedGoalId: result.relatedGoalId,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt
  })
}

function execute<T>(work: () => T): ReviewResult<T> {
  try {
    return Object.freeze({ ok: true, value: work() })
  } catch (error) {
    if (error instanceof ReviewIpcValidationError) {
      return fail('validation', 'The Review request was invalid.')
    }
    if (error instanceof InvalidReviewContextError) {
      return fail('context-invalid', 'The Review context was invalid.')
    }
    if (error instanceof StaleReviewContextError) {
      return fail('context-stale', 'The Review context is no longer active.')
    }
    if (error instanceof ReviewApplicationError) {
      return fail(error.code, error.message)
    }
    return fail('persistence-failed', 'MyTracer could not load Review facts.')
  }
}

export function registerReviewIpc(options: RegisterReviewIpcOptions): void {
  for (const channel of Object.values(REVIEW_CHANNELS)) options.ipc.removeHandler(channel)

  options.ipc.handle(REVIEW_CHANNELS.begin, (event, ...args) => {
    options.assertSender(event)
    return execute<BeginReviewDto>(() => {
      parseBegin(args)
      const context = options.contexts.begin(event.sender.id, options.service.beginReview())
      return Object.freeze({
        reviewContextId: context.id,
        periodStartedOn: context.periodStartedOn,
        periodEndedOn: context.periodEndedOn
      })
    })
  })
  options.ipc.handle(REVIEW_CHANNELS.getSummary, (event, ...args) => {
    options.assertSender(event)
    return execute<ReviewSummaryDto>(() => {
      const context = options.contexts.get(event.sender.id, parseContext(args))
      return options.service.getReviewSummary(context)
    })
  })
  options.ipc.handle(REVIEW_CHANNELS.getResult, (event, ...args) => {
    options.assertSender(event)
    return execute<ReviewResultDto | null>(() => {
      const context = options.contexts.get(event.sender.id, parseContext(args))
      const result = options.service.getReviewResult(context)
      return result ? resultDto(result) : null
    })
  })
  options.ipc.handle(REVIEW_CHANNELS.getPreviousAdjustment, (event, ...args) => {
    options.assertSender(event)
    return execute<PreviousReviewAdjustmentDto>(() => {
      const context = options.contexts.get(event.sender.id, parseContext(args))
      return options.service.getPreviousAdjustment(context)
    })
  })
  options.ipc.handle(REVIEW_CHANNELS.complete, (event, ...args) => {
    options.assertSender(event)
    return execute<ReviewResultDto>(() => {
      const input = parseComplete(args)
      const context = options.contexts.get(event.sender.id, input.reviewContextId)
      const result = options.service.completeReview(context, input)
      options.contexts.consume(event.sender.id, input.reviewContextId)
      return resultDto(result)
    })
  })
  options.ipc.handle(REVIEW_CHANNELS.cancel, (event, ...args) => {
    options.assertSender(event)
    return execute(() => {
      options.contexts.cancel(event.sender.id, parseContext(args))
      return Object.freeze({ cancelled: true as const })
    })
  })
}
