import type {
  CredentialProtectionAvailability,
  CredentialStorePort
} from '../../application/ports/configuration'

export interface SafeStorageAvailability {
  isEncryptionAvailable(): boolean
}

export class EmptySafeStorageCredentialAdapter implements CredentialStorePort {
  public constructor(private readonly safeStorage: SafeStorageAvailability) {}

  public protectionAvailability(): CredentialProtectionAvailability {
    try {
      return this.safeStorage.isEncryptionAvailable() ? 'available' : 'unavailable'
    } catch {
      return 'unavailable'
    }
  }

  public readCredential(): null {
    return null
  }
}
