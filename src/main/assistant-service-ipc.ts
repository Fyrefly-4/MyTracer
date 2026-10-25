import type { IpcMainInvokeEvent } from 'electron'
import {
  ASSISTANT_SERVICE_CHANNELS,
  type AssistantServiceResult
} from '../contracts/assistant-service'
import {
  AssistantServiceConfigurationStore,
  AssistantServiceError,
  validateAssistantConfiguration
} from '../infrastructure/configuration/assistant-service-configuration'
import type { OpenAiAssistantProvider } from '../infrastructure/ai/assistant-openai-provider'

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown
export function registerAssistantServiceIpc(options: {
  ipc: { removeHandler(channel: string): void; handle(channel: string, handler: Handler): void }
  configuration: AssistantServiceConfigurationStore
  provider: Pick<OpenAiAssistantProvider, 'testConnection'>
  assertSender(event: IpcMainInvokeEvent): void
  /** Cancel active runs and invalidate previews when configuration changes. */
  configurationChanged(): void
}): { cancelConnectionTest(): void; hasPendingConnectionTest(): boolean } {
  let probe: AbortController | undefined
  const register = (channel: string, action: (...args: unknown[]) => unknown): void => {
    options.ipc.removeHandler(channel)
    options.ipc.handle(
      channel,
      async (event, ...args): Promise<AssistantServiceResult<unknown>> => {
        options.assertSender(event)
        try {
          return { ok: true, value: await action(...args) }
        } catch (error) {
          return {
            ok: false,
            error: {
              code: error instanceof AssistantServiceError ? error.code : 'storage-unavailable'
            }
          }
        }
      }
    )
  }
  const noInput = (args: unknown[]): void => {
    if (args.length) throw new AssistantServiceError('invalid-configuration')
  }
  const changed = (): void => {
    probe?.abort()
    options.configurationChanged()
  }
  register(ASSISTANT_SERVICE_CHANNELS.getStatus, (...args) => {
    noInput(args)
    return options.configuration.getStatus()
  })
  register(ASSISTANT_SERVICE_CHANNELS.saveConfiguration, (...args) => {
    if (args.length !== 1) throw new AssistantServiceError('invalid-configuration')
    const input = validateAssistantConfiguration(
      args[0] as Parameters<typeof validateAssistantConfiguration>[0]
    )
    const result = options.configuration.saveConfiguration(input)
    changed()
    return result
  })
  register(ASSISTANT_SERVICE_CHANNELS.deleteCredential, (...args) => {
    noInput(args)
    const result = options.configuration.deleteCredential()
    changed()
    return result
  })
  register(ASSISTANT_SERVICE_CHANNELS.testConnection, async (...args) => {
    noInput(args)
    probe?.abort()
    const current = new AbortController()
    probe = current
    try {
      return await options.provider.testConnection(current.signal)
    } finally {
      if (probe === current) probe = undefined
    }
  })
  return {
    cancelConnectionTest: () => probe?.abort(),
    hasPendingConnectionTest: () => probe !== undefined
  }
}
