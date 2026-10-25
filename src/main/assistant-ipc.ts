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
  const temporaryOwners = new Map<string, number>()
  const disposeSender = (senderId: number) => {
    const sessions = sessionsBySender.get(senderId)
    sessionsBySender.delete(senderId)
    for (const sessionId of sessions ?? []) {
      if (temporaryOwners.get(sessionId) === senderId) {
        temporaryOwners.delete(sessionId)
        options.service.deleteSession({ sessionId })
      } else {
        options.service.cancelSession(sessionId)
      }
    }
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
        ) {
          const session = options.service.getSession({ sessionId: input.sessionId })
          if (session.mode === 'temporary' && temporaryOwners.get(session.id) !== event.sender.id)
            throw new AssistantError('not-found')
          sessionsBySender.get(event.sender.id)!.add(session.id)
        }
        const invoke = () => {
          if (method === 'listSessions')
            return options.service
              .listSessions()
              .filter(
                (session) =>
                  session.mode === 'persistent' ||
                  temporaryOwners.get(session.id) === event.sender.id
              )
          const result = options.service[method](input)
          // Creation is synchronous: establish ownership before yielding to sender disposal.
          if (method === 'createSession' && result && 'id' in result) {
            sessionsBySender.get(event.sender.id)!.add(result.id)
            if ('mode' in result && result.mode === 'temporary')
              temporaryOwners.set(result.id, event.sender.id)
          }
          if (
            method === 'deleteSession' &&
            input &&
            typeof input === 'object' &&
            'sessionId' in input &&
            typeof input.sessionId === 'string'
          ) {
            temporaryOwners.delete(input.sessionId)
            for (const sessions of sessionsBySender.values()) sessions.delete(input.sessionId)
          }
          return result
        }
        // Cancellation remains available while the install gate is draining.
        const result = await (method === 'cancelTurn'
          ? invoke()
          : options.operationGate.run(invoke))
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
