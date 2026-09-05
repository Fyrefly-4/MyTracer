import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type {
  AiConfigurationState,
  CredentialProtectionPort,
  MutableAiConfigurationPort
} from '../../application/ports/configuration'

const PROVIDER_LABEL = 'LiteLLM Gateway'
const MODEL_LABEL = 'Gemini 3.7 Flash'
const PROVIDER_ID = 'litellm-gateway'
const MODEL_ID = 'gemini-3.7-flash'
export const AI_CONFIGURATION_RELATIVE_PATH = 'configuration/ai-provider.v1.json'
export const AI_CREDENTIAL_ENVIRONMENT_VARIABLE = 'MYTRACER_LITELLM_API_KEY'

interface StoredConfiguration {
  readonly version: 1
  readonly enabled: boolean
  readonly providerId: typeof PROVIDER_ID
  readonly modelId: typeof MODEL_ID
  readonly encryptedCredential: string
}

function isStoredConfiguration(value: unknown): value is StoredConfiguration {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return (
    Object.keys(record).length === 5 &&
    record.version === 1 &&
    typeof record.enabled === 'boolean' &&
    record.providerId === PROVIDER_ID &&
    record.modelId === MODEL_ID &&
    typeof record.encryptedCredential === 'string' &&
    record.encryptedCredential.length > 0 &&
    record.encryptedCredential.length <= 32_768
  )
}

function freezeState(
  availability: AiConfigurationState['availability'],
  credentialProtection: AiConfigurationState['credentialProtection']
): AiConfigurationState {
  const configured =
    availability === 'configured-available' || availability === 'configured-unavailable'
  return Object.freeze({
    configured,
    availability,
    credentialProtection,
    providerLabel: PROVIDER_LABEL,
    modelLabel: MODEL_LABEL
  })
}

export interface FileAiConfigurationOptions {
  readonly userDataPath: string
  readonly credentialProtection: CredentialProtectionPort
  readonly readEnvironment?: (name: string) => string | undefined
}

export class FileAiConfiguration implements MutableAiConfigurationPort {
  private readonly path: string
  private readonly readEnvironment: (name: string) => string | undefined

  public constructor(private readonly options: FileAiConfigurationOptions) {
    this.path = join(options.userDataPath, AI_CONFIGURATION_RELATIVE_PATH)
    this.readEnvironment = options.readEnvironment ?? ((name) => process.env[name])
  }

  public readState(): AiConfigurationState {
    const protection = this.options.credentialProtection.protectionAvailability()
    const stored = this.readStored()
    if (!stored) return freezeState('not-configured', protection)
    if (!stored.enabled) return freezeState('disabled', protection)
    if (protection !== 'available') return freezeState('configured-unavailable', protection)
    try {
      this.options.credentialProtection.unprotect(stored.encryptedCredential)
      return freezeState('configured-available', protection)
    } catch {
      return freezeState('configured-unavailable', protection)
    }
  }

  public importFromEnvironment(): AiConfigurationState {
    const plaintext = this.readEnvironment(AI_CREDENTIAL_ENVIRONMENT_VARIABLE)
    if (!plaintext?.trim()) return this.readState()
    const encryptedCredential = this.options.credentialProtection.protect(plaintext)
    this.writeStored({
      version: 1,
      enabled: true,
      providerId: PROVIDER_ID,
      modelId: MODEL_ID,
      encryptedCredential
    })
    return this.readState()
  }

  public enable(): AiConfigurationState {
    const stored = this.readStored()
    if (!stored) return this.readState()
    this.options.credentialProtection.unprotect(stored.encryptedCredential)
    this.writeStored({ ...stored, enabled: true })
    return this.readState()
  }

  public disable(): AiConfigurationState {
    const stored = this.readStored()
    if (stored) this.writeStored({ ...stored, enabled: false })
    return this.readState()
  }

  public deleteCredential(): AiConfigurationState {
    rmSync(this.path, { force: true })
    return this.readState()
  }

  public readProviderCredential(): string | null {
    const stored = this.readStored()
    if (
      !stored?.enabled ||
      this.options.credentialProtection.protectionAvailability() !== 'available'
    ) {
      return null
    }
    try {
      return this.options.credentialProtection.unprotect(stored.encryptedCredential)
    } catch {
      return null
    }
  }

  private readStored(): StoredConfiguration | null {
    try {
      const value: unknown = JSON.parse(readFileSync(this.path, 'utf8'))
      return isStoredConfiguration(value) ? value : null
    } catch {
      return null
    }
  }

  private writeStored(configuration: StoredConfiguration): void {
    const directory = dirname(this.path)
    const temporaryPath = `${this.path}.tmp`
    mkdirSync(directory, { recursive: true })
    const serialized = `${JSON.stringify(configuration)}\n`
    writeFileSync(temporaryPath, serialized, { encoding: 'utf8', flag: 'w', mode: 0o600 })
    const verified: unknown = JSON.parse(readFileSync(temporaryPath, 'utf8'))
    if (!isStoredConfiguration(verified)) {
      rmSync(temporaryPath, { force: true })
      throw new Error('AI configuration validation failed.')
    }
    renameSync(temporaryPath, this.path)
  }
}
