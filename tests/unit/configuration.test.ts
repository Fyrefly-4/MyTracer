import { describe, expect, it, vi } from 'vitest'
import { EmptyAiConfiguration } from '../../src/infrastructure/configuration/empty-ai-configuration'
import { EmptySafeStorageCredentialAdapter } from '../../src/infrastructure/credentials/safe-storage-credential-adapter'

describe('empty AI configuration and safeStorage boundary', () => {
  it.each([
    [true, 'available'],
    [false, 'unavailable']
  ] as const)('stays not configured when credential protection is %s', (available, expected) => {
    const isEncryptionAvailable = vi.fn(() => available)
    const credentialStore = new EmptySafeStorageCredentialAdapter({ isEncryptionAvailable })
    const configuration = new EmptyAiConfiguration(credentialStore)

    expect(configuration.readState()).toEqual({
      configured: false,
      availability: 'not-configured',
      credentialProtection: expected
    })
    expect(credentialStore.readCredential()).toBeNull()
    expect(isEncryptionAvailable).toHaveBeenCalledTimes(1)
  })

  it('degrades to unavailable if safeStorage capability detection fails', () => {
    const credentialStore = new EmptySafeStorageCredentialAdapter({
      isEncryptionAvailable: () => {
        throw new Error('safeStorage unavailable')
      }
    })
    expect(new EmptyAiConfiguration(credentialStore).readState()).toEqual({
      configured: false,
      availability: 'not-configured',
      credentialProtection: 'unavailable'
    })
  })
})
