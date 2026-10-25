import { ASSISTANT_CHANNELS } from '../contracts/assistant'
import { AssistantSessionService } from '../application/assistant/service'
import { AssistantError } from '../application/assistant/validation'
import type { ExportIpcMain } from './exports-ipc'
import type { IpcMainInvokeEvent } from 'electron'
import type { InstallOperationGate } from './install-operation-gate'
/** All methods validate at the application boundary; the bridge also validates sender and arity. */
export function registerAssistantIpc(options: {
  ipc: ExportIpcMain
  service: AssistantSessionService
  assertSender(event: IpcMainInvokeEvent): void
  operationGate: InstallOperationGate
}): { disposeSender(senderId: number): void } {
  const sessionsBySender = new Map<number, Set<string>>()
  const disposeSender = (senderId: number) => {
    for (const sessionId of sessionsBySender.get(senderId) ?? [])
      options.service.cancelSession(sessionId)
    sessionsBySender.delete(senderId)
  }
  for (const method of Object.keys(ASSISTANT_CHANNELS) as (keyof typeof ASSISTANT_CHANNELS)[]) {
    const channel = ASSISTANT_CHANNELS[method]
    options.ipc.removeHandler(channel)
    options.ipc.handle(channel, async (event, ...args) => {
      options.assertSender(event)
      if (args.length !== (method === 'listSessions' ? 0 : 1))
        return { ok: false, error: { code: 'validation' } }
      try {
        if (!sessionsBySender.has(event.sender.id)) {
          sessionsBySender.set(event.sender.id, new Set())
          event.sender.once('destroyed', () => disposeSender(event.sender.id))
        }
        const input = args[0]
        if (
          input &&
          typeof input === 'object' &&
          'sessionId' in input &&
          typeof input.sessionId === 'string'
        )
          sessionsBySender.get(event.sender.id)!.add(input.sessionId)
        const invoke = () =>
          method === 'listSessions'
            ? options.service.listSessions()
            : options.service[method](input)
        // Cancellation remains available while the install gate is draining.
        const result = await (method === 'cancelTurn'
          ? invoke()
          : options.operationGate.run(invoke))
        if (
          method === 'createSession' &&
          result &&
          typeof result === 'object' &&
          'id' in result &&
          typeof result.id === 'string'
        )
          sessionsBySender.get(event.sender.id)!.add(result.id)
        return { ok: true, value: result }
      } catch (error) {
        return {
          ok: false,
          error: {
            code:
              error instanceof AssistantError
                ? error.code
                : options.operationGate.state !== 'open'
                  ? 'busy'
                  : 'persistence-failed'
          }
        }
      }
    })
  }
  return { disposeSender }
}
