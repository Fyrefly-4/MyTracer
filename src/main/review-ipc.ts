import type { IpcMainInvokeEvent } from 'electron'
import type { ReviewService } from '../application/review'
import {
  REVIEW_CHANNELS,
  type BeginReviewDto,
  type ReviewErrorCode,
  type ReviewResult,
  type ReviewSummaryDto
} from '../contracts/review'
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
  options.ipc.handle(REVIEW_CHANNELS.cancel, (event, ...args) => {
    options.assertSender(event)
    return execute(() => {
      options.contexts.cancel(event.sender.id, parseContext(args))
      return Object.freeze({ cancelled: true as const })
    })
  })
}
