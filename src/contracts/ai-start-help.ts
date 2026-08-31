export const AI_START_HELP_CHANNELS = Object.freeze({
  status: 'ai-start-help:status',
  start: 'ai-start-help:start',
  cancel: 'ai-start-help:cancel',
  retry: 'ai-start-help:retry',
  reject: 'ai-start-help:reject',
  confirmSuggestion: 'ai-start-help:confirm-suggestion',
  confirmUnderstanding: 'ai-start-help:confirm-understanding',
  close: 'ai-start-help:close'
} as const)

export const AI_CONFIGURATION_CHANNELS = Object.freeze({
  status: 'ai-configuration:status',
  importFromEnvironment: 'ai-configuration:import-from-environment',
  enable: 'ai-configuration:enable',
  disable: 'ai-configuration:disable',
  deleteCredential: 'ai-configuration:delete-credential'
} as const)

export type AiStartHelpErrorCode =
  | 'disabled'
  | 'not-configured'
  | 'credential-unavailable'
  | 'context-not-found'
  | 'context-too-large'
  | 'stale-context'
  | 'timeout'
  | 'cancelled'
  | 'network'
  | 'authentication'
  | 'quota'
  | 'rate-limited'
  | 'provider-unavailable'
  | 'invalid-response'
  | 'internal'

export interface StartHelpSuggestionDto {
  readonly candidateId: string
  readonly text: string
  readonly status?: AiStartHelpCandidateState
}

export type AiStartHelpCandidateState =
  'unconfirmed' | 'editing' | 'confirming' | 'confirmed' | 'failed'

export interface StartHelpUnderstandingTargetDto {
  readonly targetRef: string
  readonly actionTitle: string
  readonly occurredOn: string
}

export interface StartHelpDraftDto {
  readonly requestId: string
  readonly acknowledgement: string
  readonly clarifyingQuestion?: string
  readonly suggestions: readonly StartHelpSuggestionDto[]
  readonly understandingCandidates?: readonly StartHelpSuggestionDto[]
  readonly understandingTargets?: readonly StartHelpUnderstandingTargetDto[]
  readonly safetyNotes?: readonly string[]
  readonly providerRequestId?: string
}

export type AiStartHelpSessionState =
  | 'idle'
  | 'building-context'
  | 'requesting'
  | 'draft-ready'
  | 'failed'
  | 'cancelled'
  | 'confirmed'
  | 'rejected'
  | 'closed'

export interface AiStartHelpSessionDto {
  readonly state: AiStartHelpSessionState
  readonly sessionId?: string
  readonly generation: number
  readonly requestId?: string
  readonly draft?: StartHelpDraftDto
  readonly error?: {
    readonly code: AiStartHelpErrorCode
    readonly retryable: boolean
  }
}

export type AiConfigurationAvailability =
  'disabled' | 'not-configured' | 'configured-available' | 'configured-unavailable'

export interface AiConfigurationStatusDto {
  readonly availability: AiConfigurationAvailability
  readonly providerLabel: 'LiteLLM Gateway'
  readonly modelLabel: 'Gemini 3.7 Flash'
}

export interface StartAiStartHelpInputDto {
  readonly actionId: string
  readonly locale: string
  readonly userInput: string
  readonly expectedActionUpdatedAt?: string
  readonly expectedGoalUpdatedAt?: string
}

export interface AiStartHelpSessionInputDto {
  readonly sessionId: string
}

export interface ConfirmAiStartHelpSuggestionInputDto extends AiStartHelpSessionInputDto {
  readonly candidateId: string
  readonly finalText: string
}

export interface ConfirmAiStartHelpUnderstandingInputDto extends ConfirmAiStartHelpSuggestionInputDto {
  readonly targetRef: string
}

export interface AiStartHelpApi {
  readonly status: () => Promise<AiStartHelpSessionDto>
  readonly start: (input: StartAiStartHelpInputDto) => Promise<AiStartHelpSessionDto>
  readonly cancel: (input: AiStartHelpSessionInputDto) => Promise<AiStartHelpSessionDto>
  readonly retry: (input: AiStartHelpSessionInputDto) => Promise<AiStartHelpSessionDto>
  readonly reject: (input: AiStartHelpSessionInputDto) => Promise<AiStartHelpSessionDto>
  readonly confirmSuggestion: (
    input: ConfirmAiStartHelpSuggestionInputDto
  ) => Promise<AiStartHelpSessionDto>
  readonly confirmUnderstanding: (
    input: ConfirmAiStartHelpUnderstandingInputDto
  ) => Promise<AiStartHelpSessionDto>
  readonly close: (input: AiStartHelpSessionInputDto) => Promise<AiStartHelpSessionDto>
}

export interface AiConfigurationApi {
  readonly status: () => Promise<AiConfigurationStatusDto>
  readonly importFromEnvironment: () => Promise<AiConfigurationStatusDto>
  readonly enable: () => Promise<AiConfigurationStatusDto>
  readonly disable: () => Promise<AiConfigurationStatusDto>
  readonly deleteCredential: () => Promise<AiConfigurationStatusDto>
}
