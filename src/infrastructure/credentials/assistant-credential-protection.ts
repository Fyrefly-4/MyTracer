import {
  SafeStorageCredentialAdapter,
  type SafeStorageCapability
} from './safe-storage-credential-adapter'

/** Electron may report encryption available with Linux basic_text; explicitly reject it. */
export function createAssistantCredentialProtection(
  safeStorage: SafeStorageCapability & { getSelectedStorageBackend?(): string }
): SafeStorageCredentialAdapter {
  return new SafeStorageCredentialAdapter({
    isEncryptionAvailable: () =>
      safeStorage.isEncryptionAvailable() &&
      safeStorage.getSelectedStorageBackend?.() !== 'basic_text',
    encryptString: (value) => safeStorage.encryptString(value),
    decryptString: (value) => safeStorage.decryptString(value)
  })
}
