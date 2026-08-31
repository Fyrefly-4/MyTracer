import { describe, expect, it, vi } from 'vitest'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore Main is compiled by the node project; Vitest exercises this exact store at runtime.
import { AiStartHelpSessionStore } from '../../src/main/ai-start-help-session'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore Main is compiled by the node project; this import is type-only for the exact options.
import type { AiStartHelpSessionStoreOptions } from '../../src/main/ai-start-help-session'
import type { StartAiStartHelpInputDto } from '../../src/contracts/ai-start-help'

const input: StartAiStartHelpInputDto = {
  actionId: 'action-1',
  locale: 'zh-CN',
  userInput: '卡住了',
  expectedActionUpdatedAt: 'action-v1'
}

function selected(requestId: string) {
  return Object.freeze({
    requestDto: Object.freeze({
      requestId,
      locale: 'zh-CN',
      userInput: '卡住了',
      goal: Object.freeze({ name: 'Goal' }),
      action: Object.freeze({ title: 'Action' }),
      recentRelevantRecords: Object.freeze([])
    }),
    manifest: Object.freeze({
      requestId,
      goalId: 'goal-1',
      actionId: 'action-1',
      currentNextActionId: 'action-current',
      selectedRecordIds: Object.freeze(['record-1']),
      eligibleUnderstandingTargetRecordIds: Object.freeze(['record-1']),
      fieldEntries: Object.freeze([]),
      excludedCounts: Object.freeze({
        otherGoals: 0,
        unrelatedRecords: 0,
        overFiveLimit: 0,
        overBudget: 0
      }),
      totalTextCharacters: 10,
      budget: 8_000
    }),
    expectedGoalUpdatedAt: 'goal-v1',
    expectedActionUpdatedAt: 'action-v1',
    expectedCurrentNextActionId: 'action-current',
    understandingTargets: Object.freeze([
      Object.freeze({
        recordId: 'record-1',
        actionTitle: 'Action',
        occurredOn: '2026-09-01'
      })
    ])
  })
}

function draft(requestId: string) {
  return Object.freeze({
    requestId,
    acknowledgement: '先从很小的一步开始。',
    suggestions: Object.freeze([
      Object.freeze({ candidateId: `suggestion-${requestId}`, text: '打开资料' })
    ]),
    understandingCandidates: Object.freeze([
      Object.freeze({ candidateId: `understanding-${requestId}`, text: '边界还不清楚' })
    ]),
    providerRequestId: 'must-not-reach-renderer'
  })
}

function options(
  overrides: Partial<AiStartHelpSessionStoreOptions> = {}
): AiStartHelpSessionStoreOptions {
  let request = 0
  let session = 0
  let target = 0
  return {
    readConfiguration: () => ({
      configured: true,
      availability: 'configured-available',
      credentialProtection: 'available'
    }),
    selectContext: () => selected(`request-${++request}`),
    execute: async (value) => ({ ok: true, draft: draft(value.requestId) }),
    confirmSuggestion: vi.fn(),
    confirmUnderstanding: vi.fn(),
    generateSessionId: () => `session-${++session}`,
    generateTargetRef: () => `target-${++target}`,
    ...overrides
  }
}

async function waitForState(store: AiStartHelpSessionStore, senderId: number, state: string) {
  for (let index = 0; index < 20; index += 1) {
    const value = store.status(senderId)
    if (value.state === state) return value
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  throw new Error(`Session did not reach ${state}.`)
}

describe('AI Start Help sender-bound in-memory session', () => {
  it('exposes BuildingContext before Requesting and returns only opaque target summaries', async () => {
    const holder: { store?: AiStartHelpSessionStore } = {}
    const selectContext = vi.fn(() => {
      expect(holder.store?.status(7)).toMatchObject({
        state: 'building-context',
        sessionId: 'session-1'
      })
      return selected('request-1')
    })
    const store = new AiStartHelpSessionStore(options({ selectContext }))
    holder.store = store

    const started = store.start(7, input)
    expect(started).toMatchObject({ state: 'requesting', sessionId: 'session-1' })
    const result = await waitForState(store, 7, 'draft-ready')

    expect(result).toMatchObject({
      state: 'draft-ready',
      sessionId: 'session-1',
      generation: 1,
      draft: {
        suggestions: [{ candidateId: 'suggestion-request-1', status: 'unconfirmed' }],
        understandingCandidates: [
          { candidateId: 'understanding-request-1', status: 'unconfirmed' }
        ],
        understandingTargets: [
          { targetRef: 'target-1', actionTitle: 'Action', occurredOn: '2026-09-01' }
        ]
      }
    })
    expect(JSON.stringify(result)).not.toContain('record-1')
    expect(JSON.stringify(result)).not.toContain('must-not-reach-renderer')
  })

  it('rebuilds current context with a new request and generation on explicit retry', async () => {
    const requestIds: string[] = []
    const store = new AiStartHelpSessionStore(
      options({
        selectContext: () => {
          const value = selected(`request-${requestIds.length + 1}`)
          requestIds.push(value.requestDto.requestId)
          return value
        },
        execute: async (value) =>
          value.requestId === 'request-1'
            ? { ok: false, error: { code: 'network', retryable: true } }
            : { ok: true, draft: draft(value.requestId) }
      })
    )
    const started = store.start(8, input)
    const failed = await waitForState(store, 8, 'failed')
    store.retry(8, started.sessionId!)
    const retried = await waitForState(store, 8, 'draft-ready')

    expect(failed).toMatchObject({ state: 'failed', generation: 1, requestId: 'request-1' })
    expect(retried).toMatchObject({
      state: 'draft-ready',
      sessionId: failed.sessionId,
      generation: 2,
      requestId: 'request-2'
    })
    expect(requestIds).toEqual(['request-1', 'request-2'])
  })

  it('binds cancel, retry and confirmation to both sender and session token', async () => {
    const confirmSuggestion = vi.fn()
    const store = new AiStartHelpSessionStore(options({ confirmSuggestion }))
    const started = store.start(9, input)
    const ready = await waitForState(store, 9, 'draft-ready')
    expect(ready.sessionId).toBe(started.sessionId)

    expect(store.cancel(10, ready.sessionId!)).toEqual({ state: 'idle', generation: 0 })
    expect(
      store.confirmSuggestion(10, {
        sessionId: ready.sessionId!,
        candidateId: 'suggestion-request-1',
        finalText: '不能保存'
      })
    ).toEqual({ state: 'idle', generation: 0 })
    expect(confirmSuggestion).not.toHaveBeenCalled()
    expect(store.status(9).state).toBe('draft-ready')
  })

  it('confirms one final Action text once and discards all remaining temporary data', async () => {
    const confirmSuggestion = vi.fn()
    const store = new AiStartHelpSessionStore(options({ confirmSuggestion }))
    store.start(11, input)
    const ready = await waitForState(store, 11, 'draft-ready')
    const command = {
      sessionId: ready.sessionId!,
      candidateId: 'suggestion-request-1',
      finalText: '  只打开资料标题  '
    }

    const confirmed = store.confirmSuggestion(11, command)
    const duplicate = store.confirmSuggestion(11, command)

    expect(confirmSuggestion).toHaveBeenCalledTimes(1)
    expect(confirmSuggestion).toHaveBeenCalledWith({
      goalId: 'goal-1',
      contextActionId: 'action-1',
      expectedActionUpdatedAt: 'action-v1',
      expectedGoalUpdatedAt: 'goal-v1',
      expectedCurrentNextActionId: 'action-current',
      finalText: '只打开资料标题'
    })
    expect(confirmed).toMatchObject({ state: 'confirmed', sessionId: ready.sessionId })
    expect(confirmed.draft).toBeUndefined()
    expect(duplicate.state).toBe('confirmed')
  })

  it('keeps a failed Action confirmation unpersisted and accurately retryable in DraftReady', async () => {
    const confirmSuggestion = vi.fn(() => {
      throw Object.assign(new Error('stale'), { code: 'invariant-violation' })
    })
    const store = new AiStartHelpSessionStore(options({ confirmSuggestion }))
    store.start(12, input)
    const ready = await waitForState(store, 12, 'draft-ready')

    const result = store.confirmSuggestion(12, {
      sessionId: ready.sessionId!,
      candidateId: 'suggestion-request-1',
      finalText: '打开资料'
    })

    expect(result).toMatchObject({
      state: 'draft-ready',
      error: { code: 'stale-context', retryable: true },
      draft: { suggestions: [{ status: 'failed' }] }
    })
  })

  it('confirms Understanding candidates independently through opaque targets', async () => {
    const confirmUnderstanding = vi.fn()
    const store = new AiStartHelpSessionStore(options({ confirmUnderstanding }))
    store.start(13, input)
    const ready = await waitForState(store, 13, 'draft-ready')
    const result = store.confirmUnderstanding(13, {
      sessionId: ready.sessionId!,
      candidateId: 'understanding-request-1',
      targetRef: 'target-1',
      finalText: '  下一步边界需要更具体  '
    })

    expect(confirmUnderstanding).toHaveBeenCalledWith({
      actionRecordId: 'record-1',
      expectedGoalId: 'goal-1',
      finalText: '下一步边界需要更具体'
    })
    expect(result).toMatchObject({
      state: 'draft-ready',
      draft: {
        suggestions: [{ status: 'unconfirmed' }],
        understandingCandidates: [{ status: 'confirmed' }]
      }
    })
    store.confirmUnderstanding(13, {
      sessionId: ready.sessionId!,
      candidateId: 'understanding-request-1',
      targetRef: 'target-1',
      finalText: '重复'
    })
    expect(confirmUnderstanding).toHaveBeenCalledTimes(1)
  })

  it('rejects and closes without invoking either core command', async () => {
    const confirmSuggestion = vi.fn()
    const confirmUnderstanding = vi.fn()
    const store = new AiStartHelpSessionStore(options({ confirmSuggestion, confirmUnderstanding }))
    store.start(14, input)
    const ready = await waitForState(store, 14, 'draft-ready')

    const rejected = store.reject(14, ready.sessionId!)
    expect(rejected).toMatchObject({ state: 'rejected', sessionId: ready.sessionId })
    expect(rejected.draft).toBeUndefined()
    expect(store.close(14, ready.sessionId!)).toMatchObject({ state: 'closed' })
    expect(confirmSuggestion).not.toHaveBeenCalled()
    expect(confirmUnderstanding).not.toHaveBeenCalled()
  })

  it('ignores late old-generation responses after retry or cleanup', async () => {
    const resolvers: Array<(value: never) => void> = []
    const store = new AiStartHelpSessionStore(
      options({
        execute: (_request, signal) =>
          new Promise((resolve) => {
            resolvers.push(resolve as (value: never) => void)
            signal.addEventListener('abort', () => undefined, { once: true })
          })
      })
    )
    store.start(15, input)
    const active = store.status(15)
    store.clearSender(15)
    resolvers[0]?.({ ok: true, draft: draft('request-1') } as never)

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(active.state).toBe('requesting')
    expect(store.status(15)).toEqual({ state: 'idle', generation: 0 })
  })

  it('clears every in-memory session when configuration changes', async () => {
    const store = new AiStartHelpSessionStore(options())
    store.start(16, input)
    store.configurationChanged()
    expect(store.status(16)).toEqual({ state: 'idle', generation: 0 })
  })
})
