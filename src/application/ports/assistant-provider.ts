export interface AssistantProviderToolCall {
  readonly id: string
  readonly name: string
  /** Untrusted JSON text: application validates names, arguments and authorization. */
  readonly arguments: string
}
export interface AssistantProviderMessage {
  readonly role: 'system' | 'user' | 'assistant' | 'tool'
  readonly content: string
  readonly toolCallId?: string
  readonly toolCalls?: readonly AssistantProviderToolCall[]
}
export interface AssistantProviderRequest {
  readonly requestId: string
  /** Main prepares context as messages. Provider has no repository access. */
  readonly messages: readonly AssistantProviderMessage[]
  readonly tools?: readonly {
    readonly name: string
    readonly description: string
    readonly parameters: Readonly<Record<string, unknown>>
  }[]
  readonly signal: AbortSignal
  readonly budget: {
    readonly timeoutMs: number
    readonly maxOutputTokens: number
    readonly maxResponseBytes: number
  }
}
export interface AssistantProviderResponse {
  readonly requestId: string
  readonly text: string
  readonly toolCalls: readonly AssistantProviderToolCall[]
  readonly finishReason: 'stop' | 'tool_calls' | 'length'
}
export interface AssistantProviderPort {
  /** Result is untrusted; application validates candidate/source/tool semantics. */
  complete(request: AssistantProviderRequest): Promise<AssistantProviderResponse>
}
