export type AssistantServiceErrorCode =
  | 'invalid-configuration'
  | 'storage-unavailable'
  | 'not-configured'
  | 'disabled'
  | 'network'
  | 'authentication'
  | 'protocol'
  | 'cancelled'
  | 'timeout'
  | 'budget'
export type AssistantServiceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: AssistantServiceErrorCode } }
export interface AssistantServiceConfiguration {
  readonly endpoint: string
  readonly model: string
  readonly enabled: boolean
}
export interface AssistantSaveConfigurationInput extends AssistantServiceConfiguration {
  /** Omit to retain the credential only when endpoint is unchanged. Never returned. */
  readonly apiKey?: string
}
export interface AssistantServiceStatus extends AssistantServiceConfiguration {
  readonly credentialPresent: boolean
  readonly credentialProtection: 'available' | 'unavailable'
}
export interface AssistantConnectionTest {
  readonly connection: 'connected'
  readonly tools: 'unknown' | 'supported' | 'unsupported'
  readonly streaming: 'unknown' | 'supported' | 'unsupported'
}
export interface AssistantServiceApi {
  getStatus(): Promise<AssistantServiceResult<AssistantServiceStatus>>
  saveConfiguration(
    input: AssistantSaveConfigurationInput
  ): Promise<AssistantServiceResult<AssistantServiceStatus>>
  deleteCredential(): Promise<AssistantServiceResult<AssistantServiceStatus>>
  testConnection(): Promise<AssistantServiceResult<AssistantConnectionTest>>
}
export const ASSISTANT_SERVICE_CHANNELS = {
  getStatus: 'assistant-service:get-status',
  saveConfiguration: 'assistant-service:save-configuration',
  deleteCredential: 'assistant-service:delete-credential',
  testConnection: 'assistant-service:test-connection'
} as const
