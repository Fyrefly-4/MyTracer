import type {
  AiConfigurationPort,
  AiConfigurationState,
  CredentialStorePort
} from '../../application/ports/configuration'

export class EmptyAiConfiguration implements AiConfigurationPort {
  public constructor(private readonly credentialStore: CredentialStorePort) {}

  public readState(): AiConfigurationState {
    return Object.freeze({
      configured: false,
      availability: 'not-configured',
      credentialProtection: this.credentialStore.protectionAvailability()
    })
  }
}
