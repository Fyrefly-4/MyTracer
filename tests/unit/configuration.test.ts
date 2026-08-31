import { describe, expect, it, vi } from 'vitest'
import { EmptyAiConfiguration } from '../../src/infrastructure/configuration/empty-ai-configuration'
import {
  EmptySafeStorageCredentialAdapter,
  SafeStorageCredentialAdapter
} from '../../src/infrastructure/credentials/safe-storage-credential-adapter'
import { afterEach } from 'vitest'
import { join } from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'
import { FileAiConfiguration } from '../../src/infrastructure/configuration/file-ai-configuration'
import {
  createTemporaryTestRoot,
  removeTemporaryTestRoot,
  type TemporaryTestRoot
} from '../support/temporary-test-root'

const roots: TemporaryTestRoot[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => removeTemporaryTestRoot(root)))
})

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

describe('file AI configuration', () => {
  it('round-trips only ciphertext through the safeStorage adapter', () => {
    const adapter = new SafeStorageCredentialAdapter({
      isEncryptionAvailable: () => true,
      encryptString: (value) => Buffer.from(`protected:${value}`, 'utf8'),
      decryptString: (value) => value.toString('utf8').replace('protected:', '')
    })
    const ciphertext = adapter.protect('synthetic-secret')
    expect(ciphertext).not.toContain('synthetic-secret')
    expect(adapter.unprotect(ciphertext)).toBe('synthetic-secret')
  })

  it('imports only through the Main-owned environment reader and persists ciphertext atomically', async () => {
    const root = await createTemporaryTestRoot()
    roots.push(root)
    const configuration = new FileAiConfiguration({
      userDataPath: root.root,
      credentialProtection: {
        protectionAvailability: () => 'available',
        protect: (value) => `encrypted:${value.length}`,
        unprotect: () => 'secret-from-protected-storage'
      },
      readEnvironment: (name) => (name === 'MYTRACER_LITELLM_API_KEY' ? 'test-secret' : undefined)
    })
    expect(configuration.importFromEnvironment()).toMatchObject({
      availability: 'configured-available'
    })
    const path = join(root.root, 'configuration', 'ai-provider.v1.json')
    const file = readFileSync(path, 'utf8')
    expect(file).toContain('encrypted:11')
    expect(file).not.toContain('test-secret')
    expect(configuration.readProviderCredential()).toBe('secret-from-protected-storage')
    expect(configuration.disable().availability).toBe('disabled')
    expect(configuration.enable().availability).toBe('configured-available')
    expect(configuration.deleteCredential().availability).toBe('not-configured')
  })

  it('degrades corrupted configuration and decryption failure without throwing', async () => {
    const root = await createTemporaryTestRoot()
    roots.push(root)
    const path = join(root.root, 'configuration', 'ai-provider.v1.json')
    const configuration = new FileAiConfiguration({
      userDataPath: root.root,
      credentialProtection: {
        protectionAvailability: () => 'available',
        protect: () => 'ciphertext',
        unprotect: () => {
          throw new Error('decrypt failed')
        }
      },
      readEnvironment: () => 'test-secret'
    })
    configuration.importFromEnvironment()
    expect(configuration.readState().availability).toBe('configured-unavailable')
    writeFileSync(path, '{broken', 'utf8')
    expect(configuration.readState().availability).toBe('not-configured')
    expect(configuration.readProviderCredential()).toBeNull()
  })
})
