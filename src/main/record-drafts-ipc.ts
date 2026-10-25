import type { IpcMainInvokeEvent } from 'electron'
import { DRAFT_CHANNELS, type RecordDraft } from '../contracts/record-drafts'
import type { RecordContinuity } from './record-continuity'
import type { ActionRecordingContextStore } from './action-recording-contexts'
import type { RoutineRecordingContextStore } from './routine-recording-contexts'
import type { RecordIpcMain } from './records-ipc'
export function registerRecordDraftIpc(options: {
  ipc: RecordIpcMain
  service: RecordContinuity
  actions: ActionRecordingContextStore
  routines: RoutineRecordingContextStore
  assertSender(event: IpcMainInvokeEvent): void
}) {
  for (const channel of [
    DRAFT_CHANNELS.load,
    DRAFT_CHANNELS.retain,
    DRAFT_CHANNELS.review,
    DRAFT_CHANNELS.reconcile
  ]) {
    options.ipc.removeHandler(channel)
    options.ipc.handle(channel, (event, ...args) => {
      options.assertSender(event)
      if (channel === DRAFT_CHANNELS.load) {
        if (args.length) throw new Error('Unexpected draft request.')
        return options.service.load(event.sender.id)
      }
      if (args.length !== 1 || !args[0] || typeof args[0] !== 'object')
        throw new Error('Invalid draft request.')
      const input = args[0] as Record<string, unknown>
      if (!['first', 'action', 'routine'].includes(String(input.kind)))
        throw new Error('Invalid record kind.')
      if (channel === DRAFT_CHANNELS.review || channel === DRAFT_CHANNELS.reconcile) {
        if (Object.keys(input).some((key) => !['kind', 'contextId'].includes(key)))
          throw new Error('Invalid review request.')
        // Ownership is checked against the same trusted sender capabilities as normal commands.
        const contextId = String(input.contextId)
        if (input.kind === 'routine') options.routines.requireSender(event.sender.id, contextId)
        else options.actions.requireSender(event.sender.id, contextId)
        return channel === DRAFT_CHANNELS.reconcile
          ? options.service.reconcile(contextId)
          : options.service.review(contextId)
      }
      if (Object.keys(input).some((key) => !['kind', 'draft', 'revision'].includes(key)))
        throw new Error('Unexpected draft request.')
      const value = input as unknown as RecordDraft & { revision: number }
      const context = value.draft?.context
      if (!context || typeof context.recordingContextId !== 'string')
        throw new Error('Invalid record context.')
      if (value.kind === 'routine')
        options.routines.require(
          event.sender.id,
          value.draft.context.routineId,
          context.recordingContextId
        )
      else
        options.actions.require(
          event.sender.id,
          value.draft.context.actionId,
          context.recordingContextId
        )
      return options.service.retain(
        context.recordingContextId,
        value.kind,
        value.draft,
        value.revision
      )
    })
  }
}
