import { describe, expect, it } from 'vitest'
import { AiStartHelpService } from '../../src/application/ai-start-help'
import type { StartHelpRequestDto } from '../../src/application/ports/ai-start-help'
import { FakeAiProvider } from '../support/fake-ai-provider'

const request: StartHelpRequestDto = Object.freeze({
  requestId: 'request-1',
  locale: 'zh-CN',
  userInput: '我现在不想开始',
  goal: { name: '学习' },
  action: { title: '读一页资料' },
  recentRelevantRecords: []
})
const validResponse = {
  acknowledgement: '我们只找一个小起点。',
  suggestions: [{ text: '先打开资料。' }]
}

describe('AiStartHelpService', () => {
  it('degrades an unexpected capabilities failure to retryable internal', async () => {
    const result = await new AiStartHelpService({
      provider: {
        capabilities: () => {
          throw new Error('synthetic capabilities failure')
        },
        requestStartHelp: () => Promise.reject(new Error('must not be called'))
      },
      generateCandidateId: () => 'candidate-1'
    }).execute(request, new AbortController().signal)

    expect(result).toEqual({ ok: false, error: { code: 'internal', retryable: true } })
  })

  it('passes the frozen request and AbortSignal through the narrow provider port', async () => {
    const provider = new FakeAiProvider([{ kind: 'success', draft: validResponse }])
    const result = await new AiStartHelpService({
      provider,
      generateCandidateId: () => 'candidate-1'
    }).execute(request, new AbortController().signal)
    expect(result.ok).toBe(true)
    expect(provider.calls).toHaveLength(1)
    expect(provider.calls[0]?.request).toEqual(request)
  })

  it('enforces the Main deadline and does not retry automatically', async () => {
    const provider = new FakeAiProvider([{ kind: 'timeout' }])
    const result = await new AiStartHelpService({
      provider,
      generateCandidateId: () => 'candidate-1',
      deadlineMs: 5
    }).execute(request, new AbortController().signal)
    expect(result).toEqual({ ok: false, error: { code: 'timeout', retryable: true } })
    expect(provider.calls).toHaveLength(1)
    expect(provider.calls[0]?.aborted).toBe(true)
  })

  it('settles at the Main deadline even when the provider ignores cancellation', async () => {
    let calls = 0
    const result = await new AiStartHelpService({
      provider: {
        capabilities: () => ({ configured: true, available: true }),
        requestStartHelp: () => {
          calls += 1
          return new Promise<unknown>(() => undefined)
        }
      },
      generateCandidateId: () => 'candidate-1',
      deadlineMs: 5
    }).execute(request, new AbortController().signal)
    expect(result).toEqual({ ok: false, error: { code: 'timeout', retryable: true } })
    expect(calls).toBe(1)
  })

  it.each([
    ['authentication-failure', 'authentication', false],
    ['quota-failure', 'quota', false],
    ['rate-limit-failure', 'rate-limited', true],
    ['network-failure', 'network', true],
    ['provider-unavailable', 'provider-unavailable', true],
    ['internal-failure', 'internal', true]
  ] as const)('seals %s as %s', async (kind, code, retryable) => {
    const provider = new FakeAiProvider([{ kind }])
    const result = await new AiStartHelpService({
      provider,
      generateCandidateId: () => 'candidate-1'
    }).execute(request, new AbortController().signal)
    expect(result).toEqual({ ok: false, error: { code, retryable } })
  })
})
