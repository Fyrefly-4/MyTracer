import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { CredentialProtectionPort } from '../../application/ports/configuration'
import type {
  AssistantSaveConfigurationInput,
  AssistantServiceErrorCode,
  AssistantServiceStatus
} from '../../contracts/assistant-service'

export class AssistantServiceError extends Error {
  constructor(public readonly code: AssistantServiceErrorCode) {
    super(code)
  }
}
export const ASSISTANT_CONFIGURATION_RELATIVE_PATH = 'configuration/assistant-service.v1.json'
interface Stored {
  version: 1
  endpoint: string
  model: string
  enabled: boolean
  encryptedCredential: string | null
}
export function validateAssistantConfiguration(
  input: AssistantSaveConfigurationInput
): AssistantSaveConfigurationInput {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((k) => !['endpoint', 'model', 'enabled', 'apiKey'].includes(k)) ||
    typeof input.endpoint !== 'string' ||
    input.endpoint.length > 2048 ||
    typeof input.model !== 'string' ||
    !input.model.trim() ||
    input.model.length > 200 ||
    Array.from(input.model).some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) ||
    typeof input.enabled !== 'boolean' ||
    (input.apiKey !== undefined &&
      (typeof input.apiKey !== 'string' ||
        !input.apiKey.trim() ||
        input.apiKey.length > 8192 ||
        Array.from(input.apiKey).some(
          (c) => /\s/.test(c) || c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127
        )))
  )
    throw new AssistantServiceError('invalid-configuration')
  let url: URL
  try {
    url = new URL(input.endpoint)
  } catch {
    throw new AssistantServiceError('invalid-configuration')
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
    throw new AssistantServiceError('invalid-configuration')
  return {
    endpoint: url.href.replace(/\/+$/, ''),
    model: input.model.trim(),
    enabled: input.enabled,
    ...(input.apiKey === undefined ? {} : { apiKey: input.apiKey })
  }
}
/** Separate from legacy AI configuration: no environment import or silent migration. */
export class AssistantServiceConfigurationStore {
  private readonly path: string
  constructor(
    private readonly options: {
      userDataPath: string
      credentialProtection: CredentialProtectionPort
    }
  ) {
    this.path = join(options.userDataPath, ASSISTANT_CONFIGURATION_RELATIVE_PATH)
  }
  private read(): Stored | null {
    try {
      const v = JSON.parse(readFileSync(this.path, 'utf8')) as Stored
      if (
        !v ||
        v.version !== 1 ||
        Object.keys(v).sort().join(',') !== 'enabled,encryptedCredential,endpoint,model,version' ||
        !(
          v.encryptedCredential === null ||
          (typeof v.encryptedCredential === 'string' &&
            v.encryptedCredential.length > 0 &&
            v.encryptedCredential.length <= 32768)
        )
      )
        return null
      const checked = validateAssistantConfiguration({
        endpoint: v.endpoint,
        model: v.model,
        enabled: v.enabled
      })
      return { version: 1, ...checked, encryptedCredential: v.encryptedCredential }
    } catch {
      return null
    }
  }
  getStatus(): AssistantServiceStatus {
    const v = this.read()
    return {
      endpoint: v?.endpoint ?? '',
      model: v?.model ?? '',
      enabled: v?.enabled ?? false,
      credentialPresent: Boolean(v?.encryptedCredential),
      credentialProtection: this.options.credentialProtection.protectionAvailability()
    }
  }
  saveConfiguration(input: AssistantSaveConfigurationInput): AssistantServiceStatus {
    const checked = validateAssistantConfiguration(input)
    const old = this.read()
    try {
      const encryptedCredential =
        checked.apiKey !== undefined
          ? this.options.credentialProtection.protect(checked.apiKey)
          : old?.endpoint === checked.endpoint
            ? old.encryptedCredential
            : null
      this.write({
        version: 1,
        endpoint: checked.endpoint,
        model: checked.model,
        enabled: checked.enabled,
        encryptedCredential
      })
      return this.getStatus()
    } catch {
      throw new AssistantServiceError('storage-unavailable')
    }
  }
  deleteCredential(): AssistantServiceStatus {
    try {
      const old = this.read()
      // Remove malformed remnants too. Never touch the separate legacy configuration.
      if (old) this.write({ ...old, enabled: false, encryptedCredential: null })
      else rmSync(this.path, { force: true })
      rmSync(`${this.path}.tmp`, { force: true })
      return this.getStatus()
    } catch {
      throw new AssistantServiceError('storage-unavailable')
    }
  }
  /** Main-only snapshot. Must never be returned over IPC or persisted in sessions. */
  readForRequest(): { endpoint: string; model: string; apiKey: string } {
    const v = this.read()
    if (!v?.encryptedCredential) throw new AssistantServiceError('not-configured')
    if (!v.enabled) throw new AssistantServiceError('disabled')
    try {
      if (this.options.credentialProtection.protectionAvailability() !== 'available')
        throw new Error()
      const apiKey = this.options.credentialProtection.unprotect(v.encryptedCredential)
      if (!apiKey) throw new Error()
      return { endpoint: v.endpoint, model: v.model, apiKey }
    } catch {
      throw new AssistantServiceError('storage-unavailable')
    }
  }
  private write(v: Stored): void {
    const temp = `${this.path}.tmp`
    try {
      mkdirSync(dirname(this.path), { recursive: true })
      writeFileSync(temp, JSON.stringify(v), { mode: 0o600 })
      renameSync(temp, this.path)
    } finally {
      rmSync(temp, { force: true })
    }
  }
}
