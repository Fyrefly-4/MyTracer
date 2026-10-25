import type { AssistantCandidatePayload, AssistantObjectRef } from '../../contracts/assistant'
import type { ActionService } from '../actions'
import type { DataControlService } from '../data-control'
import type { CorePersistenceSnapshot } from '../ports/persistence'
import { AssistantError, check } from './validation'
/** Whitelist adapter to existing commands. Never interprets arbitrary model command names. */
export function createAssistantWriter(deps: {
  readSnapshot(): CorePersistenceSnapshot
  dataControl: Pick<DataControlService, 'updateActionRecord' | 'updateRoutineRecord'>
  actions: Pick<ActionService, 'createAction'>
}) {
  return (target: AssistantObjectRef, payload: AssistantCandidatePayload): AssistantObjectRef => {
    if (payload.kind === 'action-create') {
      check(target.kind === 'goal')
      const action = deps.actions.createAction({
        goalId: target.id,
        title: payload.title,
        description: payload.description
      })
      return { kind: 'action', id: action.id }
    }
    if (payload.kind === 'review-draft') throw new AssistantError('unsupported')
    const snapshot = deps.readSnapshot()
    if (target.kind === 'action-record') {
      const record = snapshot.actionRecords.find((r) => r.id === target.id)
      check(record, 'not-found')
      deps.dataControl.updateActionRecord({
        ...record,
        recordId: record.id,
        ...(payload.kind === 'record-summary'
          ? { summary: payload.text }
          : { note: [record.note, payload.text].filter(Boolean).join('\n\n') })
      })
    } else if (target.kind === 'routine-record') {
      const record = snapshot.routineRecords.find((r) => r.id === target.id)
      check(record, 'not-found')
      deps.dataControl.updateRoutineRecord({
        ...record,
        recordId: record.id,
        ...(payload.kind === 'record-summary'
          ? { summary: payload.text }
          : { note: [record.note, payload.text].filter(Boolean).join('\n\n') })
      })
    } else throw new AssistantError('validation')
    return target
  }
}
