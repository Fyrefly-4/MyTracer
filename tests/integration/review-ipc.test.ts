import type { IpcMainInvokeEvent } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import type { ReviewService } from '../../src/application/review'
import { REVIEW_CHANNELS, type ReviewSummaryDto } from '../../src/contracts/review'

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown
const ipcModulePath = '../../src/main/review-ipc'
const contextModulePath = '../../src/main/review-contexts'
const { registerReviewIpc } = (await import(ipcModulePath)) as {
  readonly registerReviewIpc: (options: {
    readonly ipc: {
      removeHandler(channel: string): void
      handle(channel: string, listener: Handler): void
    }
    readonly service: ReviewService
    readonly contexts: {
      begin(senderId: number, period: unknown): unknown
      get(senderId: number, contextId: string): unknown
      cancel(senderId: number, contextId: string): void
    }
    readonly assertSender: (event: IpcMainInvokeEvent) => void
  }) => void
}
const { ReviewContextStore } = await import(contextModulePath)

const contextIds = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333'
]
const period = { periodStartedOn: '2026-08-24', periodEndedOn: '2026-08-30' }
const savedReview = {
  id: '44444444-4444-4444-8444-444444444444',
  ...period,
  confirmedProgress: 'Progress',
  mainObstacle: 'Obstacle',
  nextAdjustment: 'Adjustment',
  relatedGoalId: null,
  createdAt: '2026-08-30T08:00:00.000Z',
  updatedAt: '2026-08-30T08:00:00.000Z'
}
const summary: ReviewSummaryDto = {
  ...period,
  totalDurationMinutes: 12,
  realActionCount: 2,
  confirmedUnderstandingCount: 0,
  openConfusionCount: 0,
  hasRecordedFacts: false,
  actionRecords: [],
  routineRecords: [],
  understandings: [],
  openConfusions: [],
  routineOutcomeFacts: {
    targetMet: [],
    acted: [],
    intentionalRest: [],
    notDone: []
  },
  routineOutcomeCounts: { targetMet: 0, acted: 0, intentionalRest: 0, notDone: 0 },
  unknownPolicy: 'absence-is-unknown-not-counted-as-not-done'
}

function setup() {
  const handlers = new Map<string, Handler>()
  const service = {
    beginReview: vi.fn(() => period),
    getReviewSummary: vi.fn(() => summary),
    getReviewResult: vi.fn(() => null),
    completeReview: vi.fn(() => ({
      ...savedReview,
      periodStartedOn: savedReview.periodStartedOn as never
    }))
  }
  let idIndex = 0
  const contexts = new ReviewContextStore(() => contextIds[idIndex++]!)
  const assertSender = vi.fn()
  registerReviewIpc({
    ipc: {
      removeHandler: (channel) => handlers.delete(channel),
      handle: (channel, handler) => handlers.set(channel, handler)
    },
    service: service as unknown as ReviewService,
    contexts,
    assertSender
  })
  const event = (senderId: number) => ({ sender: { id: senderId } }) as IpcMainInvokeEvent
  const invoke = (channel: string, senderId: number, ...args: unknown[]) =>
    handlers.get(channel)!(event(senderId), ...args)
  return { handlers, service, contexts, assertSender, invoke }
}

describe('Review IPC boundary', () => {
  it('exposes exact channels and returns exact begin/summary DTOs from a sender-bound context', () => {
    const { handlers, service, invoke } = setup()
    expect([...handlers.keys()]).toEqual([
      REVIEW_CHANNELS.begin,
      REVIEW_CHANNELS.getSummary,
      REVIEW_CHANNELS.getResult,
      REVIEW_CHANNELS.complete,
      REVIEW_CHANNELS.cancel
    ])
    const begun = invoke(REVIEW_CHANNELS.begin, 7, {})
    expect(begun).toEqual({
      ok: true,
      value: { reviewContextId: contextIds[0], ...period }
    })
    expect(Object.keys((begun as { value: object }).value)).toEqual([
      'reviewContextId',
      'periodStartedOn',
      'periodEndedOn'
    ])
    const result = invoke(REVIEW_CHANNELS.getSummary, 7, {
      reviewContextId: contextIds[0]
    })
    expect(result).toEqual({ ok: true, value: summary })
    expect(Object.keys((result as { value: object }).value)).toEqual([
      'periodStartedOn',
      'periodEndedOn',
      'totalDurationMinutes',
      'realActionCount',
      'confirmedUnderstandingCount',
      'openConfusionCount',
      'hasRecordedFacts',
      'actionRecords',
      'routineRecords',
      'understandings',
      'openConfusions',
      'routineOutcomeFacts',
      'routineOutcomeCounts',
      'unknownPolicy'
    ])
    expect(service.getReviewSummary).toHaveBeenCalledWith(
      expect.objectContaining({ senderId: 7, ...period })
    )
  })

  it('rejects extra fields, forged dates/statistics, invalid IDs, and cross-sender contexts', () => {
    const { invoke } = setup()
    const begun = invoke(REVIEW_CHANNELS.begin, 7, {}) as {
      readonly value: { readonly reviewContextId: string }
    }
    for (const args of [
      [],
      [null],
      [{ periodStartedOn: period.periodStartedOn }],
      [{ totalDurationMinutes: 99 }],
      [{ extra: true }]
    ]) {
      expect(invoke(REVIEW_CHANNELS.begin, 7, ...args)).toMatchObject({
        ok: false,
        error: { code: 'validation' }
      })
    }
    for (const args of [
      [],
      [{}],
      [{ reviewContextId: 'bad' }],
      [{ reviewContextId: begun.value.reviewContextId, periodEndedOn: period.periodEndedOn }],
      [{ reviewContextId: begun.value.reviewContextId, realActionCount: 99 }]
    ]) {
      expect(invoke(REVIEW_CHANNELS.getSummary, 7, ...args)).toMatchObject({
        ok: false,
        error: { code: 'validation' }
      })
    }
    expect(
      invoke(REVIEW_CHANNELS.getSummary, 8, {
        reviewContextId: begun.value.reviewContextId
      })
    ).toMatchObject({ ok: false, error: { code: 'context-invalid' } })
    expect(invoke(REVIEW_CHANNELS.getSummary, 7, { reviewContextId: contextIds[2] })).toMatchObject(
      { ok: false, error: { code: 'context-invalid' } }
    )
  })

  it('accepts only the three next-step variants and consumes context only after full success', () => {
    const { invoke, service } = setup()
    const begun = invoke(REVIEW_CHANNELS.begin, 7, {}) as {
      readonly value: { readonly reviewContextId: string }
    }
    const base = {
      reviewContextId: begun.value.reviewContextId,
      confirmedProgress: 'Progress',
      mainObstacle: 'Obstacle',
      nextAdjustment: 'Adjustment',
      relatedGoalId: null
    }
    expect(
      invoke(REVIEW_CHANNELS.complete, 7, { ...base, nextStepChange: { kind: 'none' } })
    ).toEqual({
      ok: true,
      value: savedReview
    })
    expect(
      invoke(REVIEW_CHANNELS.getSummary, 7, {
        reviewContextId: begun.value.reviewContextId
      })
    ).toMatchObject({ ok: false, error: { code: 'context-stale' } })

    const retry = invoke(REVIEW_CHANNELS.begin, 7, {}) as {
      readonly value: { readonly reviewContextId: string }
    }
    for (const nextStepChange of [
      { kind: 'automatic' },
      { kind: 'none', extra: true },
      { kind: 'use-existing', actionId: 'bad' },
      { kind: 'create-and-use' },
      { kind: 'create-and-use', title: 'Next', goalId: contextIds[2] }
    ]) {
      expect(
        invoke(REVIEW_CHANNELS.complete, 7, {
          ...base,
          reviewContextId: retry.value.reviewContextId,
          nextStepChange
        })
      ).toMatchObject({ ok: false, error: { code: 'validation' } })
    }
    service.completeReview.mockImplementationOnce(() => {
      throw new Error('transaction failed')
    })
    expect(
      invoke(REVIEW_CHANNELS.complete, 7, {
        ...base,
        reviewContextId: retry.value.reviewContextId,
        nextStepChange: { kind: 'none' }
      })
    ).toMatchObject({ ok: false, error: { code: 'persistence-failed' } })
    expect(
      invoke(REVIEW_CHANNELS.getSummary, 7, {
        reviewContextId: retry.value.reviewContextId
      })
    ).toEqual({ ok: true, value: summary })
  })

  it('makes cancelled, superseded, and cleared contexts stale without calling persistence', () => {
    const { invoke, contexts, service } = setup()
    const first = invoke(REVIEW_CHANNELS.begin, 7, {}) as {
      readonly value: { readonly reviewContextId: string }
    }
    expect(
      invoke(REVIEW_CHANNELS.cancel, 7, { reviewContextId: first.value.reviewContextId })
    ).toEqual({ ok: true, value: { cancelled: true } })
    expect(
      invoke(REVIEW_CHANNELS.getSummary, 7, { reviewContextId: first.value.reviewContextId })
    ).toMatchObject({ ok: false, error: { code: 'context-stale' } })

    const second = invoke(REVIEW_CHANNELS.begin, 7, {}) as {
      readonly value: { readonly reviewContextId: string }
    }
    const third = invoke(REVIEW_CHANNELS.begin, 7, {}) as {
      readonly value: { readonly reviewContextId: string }
    }
    expect(
      invoke(REVIEW_CHANNELS.getSummary, 7, { reviewContextId: second.value.reviewContextId })
    ).toMatchObject({ ok: false, error: { code: 'context-stale' } })
    contexts.clearSender(7)
    expect(
      invoke(REVIEW_CHANNELS.getSummary, 7, { reviewContextId: third.value.reviewContextId })
    ).toMatchObject({ ok: false, error: { code: 'context-stale' } })
    expect(service.getReviewSummary).not.toHaveBeenCalled()
  })

  it('maps persistence errors safely and preserves trusted-sender rejection', () => {
    const { invoke, service, assertSender } = setup()
    const begun = invoke(REVIEW_CHANNELS.begin, 7, {}) as {
      readonly value: { readonly reviewContextId: string }
    }
    service.getReviewSummary.mockImplementationOnce(() => {
      throw new Error('SELECT secret FROM C:\\Users\\real-user')
    })
    const failed = invoke(REVIEW_CHANNELS.getSummary, 7, {
      reviewContextId: begun.value.reviewContextId
    })
    expect(failed).toMatchObject({ ok: false, error: { code: 'persistence-failed' } })
    expect(JSON.stringify(failed)).not.toMatch(/SELECT|real-user/)
    assertSender.mockImplementationOnce(() => {
      throw new Error('untrusted renderer')
    })
    expect(() => invoke(REVIEW_CHANNELS.begin, 7, {})).toThrow(/untrusted renderer/)
  })
})
