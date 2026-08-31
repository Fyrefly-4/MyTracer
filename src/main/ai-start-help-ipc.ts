import type { IpcMainInvokeEvent } from 'electron'
import type { MutableAiConfigurationPort } from '../application/ports/configuration'
import type { AiConfigurationState } from '../application/ports/configuration'
import {
  AI_CONFIGURATION_CHANNELS,
  AI_START_HELP_CHANNELS,
  type AiConfigurationStatusDto,
  type StartAiStartHelpInputDto
} from '../contracts/ai-start-help'
import type { AiStartHelpSessionDto } from '../contracts/ai-start-help'

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown

export interface AiStartHelpIpcMain {
  removeHandler(channel: string): void
  handle(channel: string, listener: Handler): void
}

export interface RegisterAiStartHelpIpcOptions {
  readonly ipc: AiStartHelpIpcMain
  readonly sessions: {
    status(senderId: number): AiStartHelpSessionDto
    start(senderId: number, input: StartAiStartHelpInputDto): Promise<AiStartHelpSessionDto>
    cancel(senderId: number): AiStartHelpSessionDto
    retry(senderId: number): Promise<AiStartHelpSessionDto>
    close(senderId: number): AiStartHelpSessionDto
    configurationChanged(senderId?: number): void
  }
  readonly configuration: MutableAiConfigurationPort
  readonly assertSender: (event: IpcMainInvokeEvent) => void
}

class AiIpcValidationError extends Error {}

function oneObject(
  args: readonly unknown[],
  allowedKeys: readonly string[]
): Record<string, unknown> {
  if (args.length !== 1 || !args[0] || typeof args[0] !== 'object' || Array.isArray(args[0])) {
    throw new AiIpcValidationError()
  }
  const record = args[0] as Record<string, unknown>
  if (Object.keys(record).some((key) => !allowedKeys.includes(key)))
    throw new AiIpcValidationError()
  return record
}

function noInput(args: readonly unknown[]): void {
  if (args.length !== 0) throw new AiIpcValidationError()
}

function string(value: unknown, maximum: number): string {
  if (typeof value !== 'string') throw new AiIpcValidationError()
  const normalized = value.trim()
  if (!normalized || Array.from(normalized).length > maximum) throw new AiIpcValidationError()
  return normalized
}

function optionalString(value: unknown, maximum: number): string | undefined {
  return value === undefined ? undefined : string(value, maximum)
}

function parseStart(args: readonly unknown[]): StartAiStartHelpInputDto {
  const value = oneObject(args, [
    'actionId',
    'locale',
    'userInput',
    'expectedActionUpdatedAt',
    'expectedGoalUpdatedAt'
  ])
  const actionId = string(value.actionId, 64)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(actionId)) {
    throw new AiIpcValidationError()
  }
  const locale = string(value.locale, 32)
  if (!/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(locale)) throw new AiIpcValidationError()
  return Object.freeze({
    actionId,
    locale,
    userInput: string(value.userInput, 4_000),
    ...(optionalString(value.expectedActionUpdatedAt, 64)
      ? { expectedActionUpdatedAt: optionalString(value.expectedActionUpdatedAt, 64) }
      : {}),
    ...(optionalString(value.expectedGoalUpdatedAt, 64)
      ? { expectedGoalUpdatedAt: optionalString(value.expectedGoalUpdatedAt, 64) }
      : {})
  })
}

function configurationStatusFromState(state: AiConfigurationState): AiConfigurationStatusDto {
  return Object.freeze({
    availability: state.availability,
    providerLabel: 'LiteLLM Gateway',
    modelLabel: 'Gemini 3.7 Flash'
  })
}

function configurationStatus(configuration: MutableAiConfigurationPort): AiConfigurationStatusDto {
  return configurationStatusFromState(configuration.readState())
}

export function registerAiStartHelpIpc(options: RegisterAiStartHelpIpcOptions): void {
  const register = (channel: string, handler: Handler): void => {
    options.ipc.removeHandler(channel)
    options.ipc.handle(channel, (event, ...args) => {
      options.assertSender(event)
      return handler(event, ...args)
    })
  }

  register(AI_START_HELP_CHANNELS.status, (event, ...args) => {
    noInput(args)
    return options.sessions.status(event.sender.id)
  })
  register(AI_START_HELP_CHANNELS.start, (event, ...args) =>
    options.sessions.start(event.sender.id, parseStart(args))
  )
  register(AI_START_HELP_CHANNELS.cancel, (event, ...args) => {
    noInput(args)
    return options.sessions.cancel(event.sender.id)
  })
  register(AI_START_HELP_CHANNELS.retry, (event, ...args) => {
    noInput(args)
    return options.sessions.retry(event.sender.id)
  })
  register(AI_START_HELP_CHANNELS.close, (event, ...args) => {
    noInput(args)
    return options.sessions.close(event.sender.id)
  })

  register(AI_CONFIGURATION_CHANNELS.status, (_event, ...args) => {
    noInput(args)
    return configurationStatus(options.configuration)
  })
  register(AI_CONFIGURATION_CHANNELS.importFromEnvironment, (_event, ...args) => {
    noInput(args)
    try {
      const state = options.configuration.importFromEnvironment()
      options.sessions.configurationChanged()
      return configurationStatusFromState(state)
    } catch {
      return configurationStatus(options.configuration)
    }
  })
  register(AI_CONFIGURATION_CHANNELS.enable, (_event, ...args) => {
    noInput(args)
    try {
      options.configuration.enable()
    } catch {
      /* Degrade to the current safe state. */
    }
    options.sessions.configurationChanged()
    return configurationStatus(options.configuration)
  })
  register(AI_CONFIGURATION_CHANNELS.disable, (_event, ...args) => {
    noInput(args)
    try {
      options.configuration.disable()
    } catch {
      /* Degrade to the current safe state. */
    }
    options.sessions.configurationChanged()
    return configurationStatus(options.configuration)
  })
  register(AI_CONFIGURATION_CHANNELS.deleteCredential, (_event, ...args) => {
    noInput(args)
    try {
      options.configuration.deleteCredential()
    } catch {
      /* Degrade to the current safe state. */
    }
    options.sessions.configurationChanged()
    return configurationStatus(options.configuration)
  })
}
