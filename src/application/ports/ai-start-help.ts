export type StartHelpActionRecordOutcome = 'completed' | 'partial' | 'stopped'

export interface StartHelpTextDto {
  readonly title: string
  readonly description?: string
}

export interface StartHelpGoalDto {
  readonly name: string
  readonly description?: string
}

export interface StartHelpRelevantRecordDto {
  readonly occurredOn: string
  readonly outcome: StartHelpActionRecordOutcome
  readonly durationMinutes: number | null
  readonly confirmedUnderstandings: readonly string[]
  readonly openConfusions: readonly string[]
  readonly nextStepCandidate?: string
}

export interface StartHelpRequestDto {
  readonly requestId: string
  readonly locale: string
  readonly userInput: string
  readonly goal: StartHelpGoalDto
  readonly action: StartHelpTextDto
  readonly currentNextAction?: StartHelpTextDto
  readonly recentRelevantRecords: readonly StartHelpRelevantRecordDto[]
}

/** T061-only request capture seam. It has no response, network, configuration, or write authority. */
export interface StartHelpRequestCapturePort {
  captureStartHelpRequest(request: StartHelpRequestDto): void
}

export interface ProviderCapabilities {
  readonly configured: boolean
  readonly available: boolean
  readonly providerLabel?: string
  readonly modelLabel?: string
}

export interface ProviderRequestOptions {
  readonly signal: AbortSignal
  readonly requestId: string
}

/** Single-purpose trust boundary: every provider result remains unknown until Main validates it. */
export interface AiStartHelpProvider {
  capabilities(): ProviderCapabilities
  requestStartHelp(request: StartHelpRequestDto, options: ProviderRequestOptions): Promise<unknown>
}

export type AiProviderFailureCode =
  | 'context-too-large'
  | 'timeout'
  | 'network'
  | 'authentication'
  | 'quota'
  | 'rate-limited'
  | 'provider-unavailable'
  | 'invalid-response'
  | 'internal'

export class AiProviderError extends Error {
  public constructor(readonly code: AiProviderFailureCode) {
    super('The AI provider request failed.')
    this.name = 'AiProviderError'
  }
}
