import OpenAI from 'openai'
import type {
  AiStartHelpProvider,
  ProviderCapabilities,
  ProviderRequestOptions,
  StartHelpRequestDto
} from '../../application/ports/ai-start-help'
import { AiProviderError } from '../../application/ports/ai-start-help'

export const LITELLM_BASE_URL = 'https://litellm-gateway-811499828950.us-central1.run.app/v1'
export const LITELLM_ORIGIN = 'https://litellm-gateway-811499828950.us-central1.run.app'
export const LITELLM_MODEL = 'gemini-3.7-flash'
const REQUEST_BYTE_LIMIT = 49_152

const RESPONSE_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['acknowledgement', 'suggestions'],
  properties: {
    acknowledgement: { type: 'string' },
    clarifyingQuestion: { type: 'string' },
    suggestions: {
      type: 'array',
      minItems: 1,
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text'],
        properties: { text: { type: 'string' } }
      }
    },
    understandingCandidates: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text'],
        properties: { text: { type: 'string' } }
      }
    },
    safetyNotes: {
      type: 'array',
      maxItems: 2,
      items: { type: 'string' }
    }
  }
})

export interface LiteLlmTransport {
  create(body: Record<string, unknown>, signal: AbortSignal): Promise<unknown>
}

function approvedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = new Request(input, { ...init, redirect: 'manual' })
  if (new URL(request.url).origin !== LITELLM_ORIGIN) {
    throw new AiProviderError('internal')
  }
  return fetch(request).then((response) => {
    if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
      throw new AiProviderError('provider-unavailable')
    }
    if (response.url && new URL(response.url).origin !== LITELLM_ORIGIN) {
      throw new AiProviderError('provider-unavailable')
    }
    return response
  })
}

class OpenAiLiteLlmTransport implements LiteLlmTransport {
  private readonly client: OpenAI

  public constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: LITELLM_BASE_URL,
      logLevel: 'off',
      maxRetries: 0,
      timeout: 18_000,
      fetch: approvedFetch
    })
  }

  public create(body: Record<string, unknown>, signal: AbortSignal): Promise<unknown> {
    return this.client.chat.completions.create(body as never, { signal })
  }
}

function mapSdkError(error: unknown): AiProviderError {
  if (error instanceof AiProviderError) return error
  if (error instanceof OpenAI.APIConnectionTimeoutError) return new AiProviderError('timeout')
  if (error instanceof OpenAI.APIConnectionError) return new AiProviderError('network')
  if (
    error instanceof OpenAI.AuthenticationError ||
    error instanceof OpenAI.PermissionDeniedError
  ) {
    return new AiProviderError('authentication')
  }
  if (error instanceof OpenAI.RateLimitError) return new AiProviderError('rate-limited')
  if (error instanceof OpenAI.APIError) {
    if (error.status === 402) return new AiProviderError('quota')
    if (error.status !== undefined && error.status >= 500) {
      return new AiProviderError('provider-unavailable')
    }
    return new AiProviderError('internal')
  }
  if (error instanceof DOMException && error.name === 'AbortError') throw error
  return new AiProviderError('internal')
}

function extractResponse(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AiProviderError('invalid-response')
  }
  const envelope = value as Record<string, unknown>
  if (!Array.isArray(envelope.choices) || envelope.choices.length !== 1) {
    throw new AiProviderError('invalid-response')
  }
  const choice = envelope.choices[0]
  if (!choice || typeof choice !== 'object' || Array.isArray(choice)) {
    throw new AiProviderError('invalid-response')
  }
  const choiceRecord = choice as Record<string, unknown>
  if (choiceRecord.finish_reason !== 'stop') throw new AiProviderError('invalid-response')
  const message = choiceRecord.message
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    throw new AiProviderError('invalid-response')
  }
  const content = (message as Record<string, unknown>).content
  if (typeof content !== 'string' || !content.trim()) {
    throw new AiProviderError('invalid-response')
  }
  try {
    const parsed: unknown = JSON.parse(content)
    if (
      envelope._request_id !== undefined &&
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      typeof envelope._request_id === 'string'
    ) {
      return { ...(parsed as Record<string, unknown>), providerRequestId: envelope._request_id }
    }
    return parsed
  } catch (error) {
    if (error instanceof AiProviderError) throw error
    throw new AiProviderError('invalid-response')
  }
}

export interface LiteLlmStartHelpProviderOptions {
  readonly apiKey: string
  readonly transport?: LiteLlmTransport
}

export class LiteLlmStartHelpProvider implements AiStartHelpProvider {
  private readonly transport: LiteLlmTransport

  public constructor(private readonly options: LiteLlmStartHelpProviderOptions) {
    this.transport = options.transport ?? new OpenAiLiteLlmTransport(options.apiKey)
  }

  public capabilities(): ProviderCapabilities {
    return Object.freeze({
      configured: this.options.apiKey.length > 0,
      available: this.options.apiKey.length > 0,
      providerLabel: 'LiteLLM Gateway',
      modelLabel: 'Gemini 3.7 Flash'
    })
  }

  public async requestStartHelp(
    request: StartHelpRequestDto,
    options: ProviderRequestOptions
  ): Promise<unknown> {
    if (!this.options.apiKey) throw new AiProviderError('authentication')
    const body: Record<string, unknown> = {
      model: LITELLM_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'durationMinutes 为 null 表示时长未知，不是零投入；0 表示不足一分钟但确有行动。' +
            'Offer gentle, non-judgmental start help. Give one to three concrete small suggestions. Never claim the user completed or mastered anything, and never treat reasonable rest as procrastination. Return only the requested JSON.'
        },
        { role: 'user', content: JSON.stringify(request) }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'mytracer_start_help', strict: true, schema: RESPONSE_SCHEMA }
      },
      max_completion_tokens: 1_200,
      stream: false
    }
    if (Buffer.byteLength(JSON.stringify(body), 'utf8') > REQUEST_BYTE_LIMIT) {
      throw new AiProviderError('context-too-large')
    }
    try {
      return extractResponse(await this.transport.create(body, options.signal))
    } catch (error) {
      throw mapSdkError(error)
    }
  }
}
