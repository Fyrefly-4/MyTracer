import type {
  AssistantProviderPort,
  AssistantProviderRequest,
  AssistantProviderResponse,
  AssistantProviderToolCall
} from '../../application/ports/assistant-provider'
import type { AssistantConnectionTest } from '../../contracts/assistant-service'
import {
  AssistantServiceError,
  type AssistantServiceConfigurationStore
} from '../configuration/assistant-service-configuration'

function record(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new AssistantServiceError('protocol')
  return v as Record<string, unknown>
}
function parse(v: unknown, requestId: string): AssistantProviderResponse {
  const root = record(v)
  if (!Array.isArray(root.choices) || root.choices.length !== 1)
    throw new AssistantServiceError('protocol')
  const choice = record(root.choices[0])
  const message = record(choice.message)
  if (
    message.role !== 'assistant' ||
    (message.content !== null && typeof message.content !== 'string') ||
    !['stop', 'tool_calls', 'length'].includes(String(choice.finish_reason))
  )
    throw new AssistantServiceError('protocol')
  if (message.tool_calls !== undefined && !Array.isArray(message.tool_calls))
    throw new AssistantServiceError('protocol')
  const calls: AssistantProviderToolCall[] = (
    (message.tool_calls as unknown[] | undefined) ?? []
  ).map((v) => {
    const call = record(v)
    const fn = record(call.function)
    if (
      call.type !== 'function' ||
      typeof call.id !== 'string' ||
      !call.id ||
      call.id.length > 128 ||
      typeof fn.name !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,64}$/.test(fn.name) ||
      typeof fn.arguments !== 'string'
    )
      throw new AssistantServiceError('protocol')
    return { id: call.id, name: fn.name, arguments: fn.arguments }
  })
  if (
    calls.length > 16 ||
    new Set(calls.map((c) => c.id)).size !== calls.length ||
    (choice.finish_reason === 'tool_calls') !== calls.length > 0 ||
    (!calls.length && !message.content)
  )
    throw new AssistantServiceError('protocol')
  return {
    requestId,
    text: (message.content as string) ?? '',
    toolCalls: calls,
    finishReason: choice.finish_reason as AssistantProviderResponse['finishReason']
  }
}
/** No SDK, redirects, repository access, or raw service errors escape this boundary. */
export class OpenAiAssistantProvider implements AssistantProviderPort {
  constructor(
    private readonly configuration: Pick<AssistantServiceConfigurationStore, 'readForRequest'>,
    private readonly fetcher: typeof fetch = fetch
  ) {}
  async complete(request: AssistantProviderRequest): Promise<AssistantProviderResponse> {
    const { timeoutMs, maxOutputTokens, maxResponseBytes } = request.budget
    if (
      ![timeoutMs, maxOutputTokens, maxResponseBytes].every(Number.isSafeInteger) ||
      timeoutMs < 1 ||
      timeoutMs > 120000 ||
      maxOutputTokens < 1 ||
      maxOutputTokens > 16384 ||
      maxResponseBytes < 1 ||
      maxResponseBytes > 1048576
    )
      throw new AssistantServiceError('budget')
    if (request.signal.aborted) throw new AssistantServiceError('cancelled')
    const config = this.configuration.readForRequest()
    const controller = new AbortController()
    let timedOut = false
    const cancel = (): void => controller.abort()
    request.signal.addEventListener('abort', cancel, { once: true })
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeoutMs)
    // Race also bounds misbehaving mock/custom transports which ignore AbortSignal.
    let onAbort: (() => void) | undefined
    const aborted = new Promise<never>((_resolve, reject) => {
      onAbort = () => reject(new AssistantServiceError(timedOut ? 'timeout' : 'cancelled'))
      controller.signal.addEventListener('abort', onAbort, { once: true })
    })
    try {
      const execute = async (): Promise<AssistantProviderResponse> => {
        const body = JSON.stringify({
          model: config.model,
          stream: false,
          max_tokens: maxOutputTokens,
          messages: request.messages.map((m) => ({
            role: m.role,
            content: m.content,
            ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
            ...(m.toolCalls?.length
              ? {
                  tool_calls: m.toolCalls.map((c) => ({
                    id: c.id,
                    type: 'function',
                    function: { name: c.name, arguments: c.arguments }
                  }))
                }
              : {})
          })),
          ...(request.tools?.length
            ? { tools: request.tools.map((t) => ({ type: 'function', function: t })) }
            : {})
        })
        if (Buffer.byteLength(body) > 524288) throw new AssistantServiceError('budget')
        const response = await this.fetcher(`${config.endpoint}/chat/completions`, {
          method: 'POST',
          redirect: 'error',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
          body
        })
        if (!response.ok)
          throw new AssistantServiceError(
            response.status === 401 || response.status === 403 ? 'authentication' : 'network'
          )
        if (!response.body) throw new AssistantServiceError('protocol')
        const reader = response.body.getReader()
        const chunks: Uint8Array[] = []
        let size = 0
        try {
          while (true) {
            const chunk = await reader.read()
            if (controller.signal.aborted)
              throw new AssistantServiceError(timedOut ? 'timeout' : 'cancelled')
            if (chunk.done) break
            size += chunk.value.byteLength
            if (size > maxResponseBytes) throw new AssistantServiceError('budget')
            chunks.push(chunk.value)
          }
        } finally {
          void reader.cancel().catch(() => {})
          reader.releaseLock()
        }
        const raw = Buffer.concat(chunks).toString('utf8')
        // Even an echoing/malicious gateway must not reflect its bearer credential into sessions.
        if (raw.includes(config.apiKey)) throw new AssistantServiceError('protocol')
        let value: unknown
        try {
          value = JSON.parse(raw)
        } catch {
          throw new AssistantServiceError('protocol')
        }
        if (JSON.stringify(value).includes(config.apiKey))
          throw new AssistantServiceError('protocol')
        return parse(value, request.requestId)
      }
      return await Promise.race([execute(), aborted])
    } catch (error) {
      if (controller.signal.aborted)
        throw new AssistantServiceError(timedOut ? 'timeout' : 'cancelled')
      if (error instanceof AssistantServiceError) throw error
      throw new AssistantServiceError('network')
    } finally {
      clearTimeout(timer)
      request.signal.removeEventListener('abort', cancel)
      if (onAbort) controller.signal.removeEventListener('abort', onAbort)
    }
  }
  /** Only the explicit testConnection IPC invokes this synthetic, billable probe. */
  async testConnection(signal = new AbortController().signal): Promise<AssistantConnectionTest> {
    await this.complete({
      requestId: 'connection-test',
      signal,
      messages: [{ role: 'user', content: 'Reply OK.' }],
      budget: { timeoutMs: 10000, maxOutputTokens: 8, maxResponseBytes: 16384 }
    })
    return { connection: 'connected', tools: 'unknown', streaming: 'unknown' }
  }
}
