import { describe, expect, it, vi } from 'vitest'
import OpenAI from 'openai'
import { LiteLlmStartHelpProvider } from '../../src/infrastructure/ai/litellm-start-help-provider'
import {
  AiProviderError,
  type StartHelpRequestDto
} from '../../src/application/ports/ai-start-help'
import { FakeAiProvider } from '../support/fake-ai-provider'

const request: StartHelpRequestDto = {
  requestId: 'request-1',
  locale: 'zh-CN',
  userInput: '我不想开始',
  goal: { name: '学习' },
  action: { title: '阅读' },
  recentRelevantRecords: []
}
const response = { acknowledgement: '先慢一点。', suggestions: [{ text: '打开资料。' }] }

describe('AiStartHelpProvider shared offline contract', () => {
  it('keeps fake capture deep-cloned and offline', async () => {
    const provider = new FakeAiProvider([{ kind: 'success', draft: response }])
    const result = await provider.requestStartHelp(request, {
      signal: new AbortController().signal,
      requestId: request.requestId
    })
    expect(result).toEqual(response)
    expect(provider.calls).toHaveLength(1)
    expect(provider.calls[0]?.request).toEqual(request)
  })

  it('uses the fixed model, json_schema, no streaming, and caller signal with fake transport', async () => {
    const create = vi.fn<(body: Record<string, unknown>, signal: AbortSignal) => Promise<unknown>>(
      async () => ({
        _request_id: 'gateway-request-1',
        choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(response) } }]
      })
    )
    const provider = new LiteLlmStartHelpProvider({
      apiKey: 'synthetic-key',
      transport: { create }
    })
    const signal = new AbortController().signal
    expect(
      await provider.requestStartHelp(request, { signal, requestId: request.requestId })
    ).toEqual({
      ...response,
      providerRequestId: 'gateway-request-1'
    })
    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      model: 'gemini-3.7-flash',
      stream: false,
      max_completion_tokens: 1200,
      response_format: { type: 'json_schema' }
    })
    expect(create.mock.calls[0]?.[1]).toBe(signal)
  })

  it.each([
    [{ choices: [] }, 'invalid-response'],
    [{ choices: [{ finish_reason: 'length', message: { content: '{}' } }] }, 'invalid-response'],
    [{ choices: [{ finish_reason: 'stop', message: { content: 'not-json' } }] }, 'invalid-response']
  ] as const)('rejects malformed production envelopes offline', async (envelope, code) => {
    const provider = new LiteLlmStartHelpProvider({
      apiKey: 'synthetic-key',
      transport: { create: async () => envelope }
    })
    await expect(
      provider.requestStartHelp(request, {
        signal: new AbortController().signal,
        requestId: request.requestId
      })
    ).rejects.toMatchObject({ code } satisfies Partial<AiProviderError>)
  })

  it('classifies the approved SDK timeout as timeout rather than a generic network failure', async () => {
    const provider = new LiteLlmStartHelpProvider({
      apiKey: 'synthetic-key',
      transport: {
        create: async () => {
          throw new OpenAI.APIConnectionTimeoutError({})
        }
      }
    })
    await expect(
      provider.requestStartHelp(request, {
        signal: new AbortController().signal,
        requestId: request.requestId
      })
    ).rejects.toMatchObject({ code: 'timeout' } satisfies Partial<AiProviderError>)
  })

  it.skipIf(process.env.MYTRACER_AI_LIVE_CONTRACT !== '1')(
    'live LiteLLM contract uses one synthetic request only',
    async () => {
      const apiKey = process.env.MYTRACER_LITELLM_API_KEY
      if (!apiKey)
        throw new Error('MYTRACER_LITELLM_API_KEY is required for the explicit live contract.')
      const provider = new LiteLlmStartHelpProvider({ apiKey })
      const value = await provider.requestStartHelp(request, {
        signal: AbortSignal.timeout(20_000),
        requestId: request.requestId
      })
      expect(value).toBeTypeOf('object')
    }
  )
})
