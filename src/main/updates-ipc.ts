import type { IpcMainInvokeEvent } from 'electron'
import type { UpdateService } from '../application/update-service'
import { UPDATE_CHANNELS } from '../contracts/updates'

export interface UpdatesIpcMain {
  removeHandler(channel: string): void
  handle(
    channel: string,
    listener: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown
  ): void
}

function noArguments(args: unknown[]): void {
  if (args.length !== 0) throw new TypeError('Update request does not accept input.')
}

function candidateInput(args: unknown[]): {
  readonly operationId: string
  readonly version: string
} {
  if (
    args.length !== 1 ||
    !args[0] ||
    typeof args[0] !== 'object' ||
    Array.isArray(args[0]) ||
    Object.keys(args[0]).length !== 2
  ) {
    throw new TypeError('Invalid update candidate.')
  }
  const input = args[0] as Record<string, unknown>
  if (
    typeof input.operationId !== 'string' ||
    !/^[a-zA-Z0-9-]{1,80}$/.test(input.operationId) ||
    typeof input.version !== 'string' ||
    !/^[0-9]+\.[0-9]+\.[0-9]+$/.test(input.version)
  ) {
    throw new TypeError('Invalid update candidate.')
  }
  return { operationId: input.operationId, version: input.version }
}

function operationInput(args: unknown[]): { readonly operationId: string } {
  if (
    args.length !== 1 ||
    !args[0] ||
    typeof args[0] !== 'object' ||
    Array.isArray(args[0]) ||
    Object.keys(args[0]).length !== 1
  ) {
    throw new TypeError('Invalid update operation.')
  }
  const input = args[0] as Record<string, unknown>
  if (typeof input.operationId !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(input.operationId)) {
    throw new TypeError('Invalid update operation.')
  }
  return { operationId: input.operationId }
}

export function registerUpdatesIpc(options: {
  readonly ipc: UpdatesIpcMain
  readonly service: UpdateService
  readonly assertSender: (event: IpcMainInvokeEvent) => void
}): void {
  for (const channel of [
    UPDATE_CHANNELS.status,
    UPDATE_CHANNELS.check,
    UPDATE_CHANNELS.download,
    UPDATE_CHANNELS.cancel
  ]) {
    options.ipc.removeHandler(channel)
  }
  options.ipc.handle(UPDATE_CHANNELS.status, (event, ...args: unknown[]) => {
    options.assertSender(event)
    noArguments(args)
    return options.service.getStatus()
  })
  options.ipc.handle(UPDATE_CHANNELS.check, (event, ...args: unknown[]) => {
    options.assertSender(event)
    noArguments(args)
    return options.service.check()
  })
  options.ipc.handle(UPDATE_CHANNELS.download, (event, ...args: unknown[]) => {
    options.assertSender(event)
    return options.service.download(candidateInput(args))
  })
  options.ipc.handle(UPDATE_CHANNELS.cancel, (event, ...args: unknown[]) => {
    options.assertSender(event)
    return options.service.cancel(operationInput(args))
  })
}
