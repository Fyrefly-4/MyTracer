export type CredentialProtectionAvailability = 'available' | 'unavailable'

export interface CredentialStorePort {
  protectionAvailability(): CredentialProtectionAvailability
  readCredential(): null
}

export type AiConfigurationAvailability =
  'disabled' | 'not-configured' | 'configured-available' | 'configured-unavailable'

export interface AiConfigurationState {
  readonly configured: boolean
  readonly availability: AiConfigurationAvailability
  readonly credentialProtection: CredentialProtectionAvailability
  readonly providerLabel?: string
  readonly modelLabel?: string
}

export interface AiConfigurationPort {
  readState(): AiConfigurationState
}

export interface MutableAiConfigurationPort extends AiConfigurationPort {
  importFromEnvironment(): AiConfigurationState
  enable(): AiConfigurationState
  disable(): AiConfigurationState
  deleteCredential(): AiConfigurationState
  /** Main-only. Callers must never return this value through IPC, diagnostics, export, or logs. */
  readProviderCredential(): string | null
}

export interface CredentialProtectionPort {
  protectionAvailability(): CredentialProtectionAvailability
  protect(plaintext: string): string
  unprotect(ciphertext: string): string
}
