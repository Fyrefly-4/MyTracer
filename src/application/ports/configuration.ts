export type CredentialProtectionAvailability = 'available' | 'unavailable'

export interface CredentialStorePort {
  protectionAvailability(): CredentialProtectionAvailability
  readCredential(): null
}

export interface AiConfigurationState {
  readonly configured: false
  readonly availability: 'not-configured'
  readonly credentialProtection: CredentialProtectionAvailability
}

export interface AiConfigurationPort {
  readState(): AiConfigurationState
}
