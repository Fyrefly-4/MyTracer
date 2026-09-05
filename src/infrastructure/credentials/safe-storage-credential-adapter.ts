import type {
  CredentialProtectionAvailability,
  CredentialProtectionPort,
  CredentialStorePort
} from '../../application/ports/configuration'

export interface SafeStorageAvailability {
  isEncryptionAvailable(): boolean
}

export interface SafeStorageCapability extends SafeStorageAvailability {
  encryptString(plaintext: string): Buffer
  decryptString(ciphertext: Buffer): string
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

export class SafeStorageCredentialAdapter implements CredentialProtectionPort {
  public constructor(private readonly safeStorage: SafeStorageCapability) {}

  public protectionAvailability(): CredentialProtectionAvailability {
    try {
      return this.safeStorage.isEncryptionAvailable() ? 'available' : 'unavailable'
    } catch {
      return 'unavailable'
    }
  }

  public protect(plaintext: string): string {
    if (this.protectionAvailability() !== 'available' || !plaintext) {
      throw new Error('Credential protection is unavailable.')
    }
    return this.safeStorage.encryptString(plaintext).toString('base64')
  }

  public unprotect(ciphertext: string): string {
    if (this.protectionAvailability() !== 'available' || !ciphertext) {
      throw new Error('Credential protection is unavailable.')
    }
    const plaintext = this.safeStorage.decryptString(Buffer.from(ciphertext, 'base64'))
    if (!plaintext) throw new Error('Credential decryption returned an empty value.')
    return plaintext
  }
}
