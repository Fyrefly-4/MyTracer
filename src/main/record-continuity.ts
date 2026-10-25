import { createHash } from 'node:crypto'
import {
  hasRecordInput,
  type RecordDraft,
  type RecordReconciliation
} from '../contracts/record-drafts'
import { createLocalDate } from '../domain/local-date'
import type { RecordContinuityPort } from '../application/ports/record-continuity'
import type { ActionRecordingContextStore } from './action-recording-contexts'
import type { RoutineRecordingContextStore } from './routine-recording-contexts'

type Kind = RecordDraft['kind']
interface Binding {
  operationId: string
  kind: Kind
  objectId: string
  capturedOn: string
  basis: string
  referenceId?: string
  offset: number
}
interface StoredInput {
  version: 1
  kind: Kind
  objectId: string
  capturedOn: string
  basis: string
  referenceId?: string
  fields: Record<string, string | boolean>
}
export class ContinuityError extends Error {
  constructor(readonly code: 'already-saved' | 'context-changed' | 'invalid-recording-context') {
    super(code)
  }
}
const common = ['durationMinutes', 'summary', 'note', 'outcome']
const fields: Record<Kind, readonly string[]> = {
  first: [...common, 'title', 'goalId', 'unknownDuration', 'lifecycle'],
  action: [
    ...common,
    'understanding',
    'confusion',
    'nextStep',
    'postAction',
    'nextMode',
    'replacementActionId',
    'applyRecordedNextStep'
    // Expansion is reading state, not retained input.
  ],
  routine: common
}
const booleans = ['unknownDuration', 'applyRecordedNextStep', 'deepExpanded', 'postExpanded']
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export function draftFields(kind: Kind, value: unknown): Record<string, string | boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid record input.')
  const input = value as Record<string, unknown>
  if (
    Object.keys(input).some(
      (key) =>
        ![...fields[kind], 'context', 'uncertainInput', 'deepExpanded', 'postExpanded'].includes(
          key
        )
    )
  )
    throw new Error('Unexpected record field.')
  const result: Record<string, string | boolean> = {}
  for (const key of fields[kind]) {
    const value = input[key]
    if (booleans.includes(key)) {
      if (typeof value !== 'boolean') throw new Error('Invalid record choice.')
    } else if (typeof value !== 'string' || value.length > 100_000)
      throw new Error('Invalid record text.')
    result[key] = value as string | boolean
  }
  const outcomes =
    kind === 'routine'
      ? ['acted', 'target_met', 'intentional_rest', 'not_done']
      : kind === 'first'
        ? ['', 'partial', 'completed', 'stopped']
        : ['partial', 'completed', 'stopped']
  if (!outcomes.includes(String(result.outcome))) throw new Error('Invalid record outcome.')
  if (kind === 'first' && !['', 'keep-pending', 'complete'].includes(String(result.lifecycle)))
    throw new Error('Invalid record lifecycle.')
  if (
    kind === 'action' &&
    (!['keep-pending', 'complete', 'cancel', 'reschedule'].includes(String(result.postAction)) ||
      !['clear', 'use-existing', 'recorded-next'].includes(String(result.nextMode)))
  )
    throw new Error('Invalid record choice.')
  if (JSON.stringify(result).length > 500_000) throw new Error('Record input is too large.')
  return result
}

/** Main-only adapter: fresh capabilities, encrypted inputs, atomic business commit + tombstone. */
export class RecordContinuity {
  private readonly bindings = new Map<string, Binding>()
  constructor(
    private readonly options: {
      store: RecordContinuityPort
      protect(text: string): string
      unprotect(text: string): string
      snapshot(kind: Kind, objectId: string, capturedOn: string): unknown
      actions: ActionRecordingContextStore
      routines: RoutineRecordingContextStore
    }
  ) {}
  private basis(kind: Kind, id: string, capturedOn: string): string {
    return createHash('sha256')
      .update(JSON.stringify(this.options.snapshot(kind, id, capturedOn)))
      .digest('hex')
  }
  bind(
    kind: Kind,
    objectId: string,
    context: { id: string; operationId: string; capturedOn: string },
    basis?: string,
    referenceId?: string
  ): void {
    for (const [id, previous] of this.bindings) {
      if (previous.kind === kind && previous.objectId === objectId) this.bindings.delete(id)
    }
    this.bindings.set(context.id, {
      kind,
      objectId,
      operationId: context.operationId,
      capturedOn: context.capturedOn,
      referenceId,
      basis: basis ?? this.basis(kind, kind === 'first' ? '' : objectId, context.capturedOn),
      offset: this.options.store.find(context.operationId)?.revision ?? 0
    })
  }
  private require(contextId: string): Binding {
    const binding = this.bindings.get(contextId)
    if (!binding) throw new ContinuityError('invalid-recording-context')
    return binding
  }
  review(contextId: string): void {
    const binding = this.require(contextId)
    binding.basis = this.basis(
      binding.kind,
      binding.kind === 'first' ? (binding.referenceId ?? '') : binding.objectId,
      binding.capturedOn
    )
  }
  retain(contextId: string, kind: Kind, draft: RecordDraft['draft'], revision: number): void {
    const b = this.require(contextId)
    if (b.kind !== kind || !Number.isSafeInteger(revision) || revision < 1)
      throw new Error('Invalid record revision.')
    const clean = draftFields(kind, draft)
    const normalized = { kind, draft: { ...clean, context: draft.context } } as RecordDraft
    this.options.store.transaction(() => {
      const previous = this.options.store.find(b.operationId)
      if (previous && (previous.state !== 'open' || previous.revision >= revision + b.offset))
        return
      if (!previous && !hasRecordInput(normalized)) return
      if (kind === 'first' && b.referenceId !== clean.goalId) {
        b.referenceId = String(clean.goalId)
        try {
          b.basis = this.basis(kind, b.referenceId, b.capturedOn)
        } catch {
          b.basis = 'unavailable'
        }
      }

      const payload = hasRecordInput(normalized)
        ? this.options.protect(
            JSON.stringify({
              version: 1,
              kind,
              objectId: b.objectId,
              capturedOn: b.capturedOn,
              basis: b.basis,
              referenceId: b.referenceId,
              fields: clean
            } satisfies StoredInput)
          )
        : null
      this.options.store.write({
        operationId: b.operationId,
        state: 'open',
        revision: revision + b.offset,
        payload
      })
    })
  }
  load(senderId: number): readonly RecordDraft[] {
    // Decode everything before granting any fresh capability. Corruption never erases stored inputs.
    const inputs = this.options.store.list().map((row) => {
      const value = JSON.parse(this.options.unprotect(row.payload!)) as StoredInput
      if (
        value.version !== 1 ||
        !['first', 'action', 'routine'].includes(value.kind) ||
        !uuid.test(value.objectId) ||
        typeof value.basis !== 'string'
      )
        throw new Error('Invalid retained input.')
      createLocalDate(value.capturedOn)
      draftFields(value.kind, value.fields)
      return { row, value }
    })
    return inputs.map(({ row, value }) => {
      let continuityIssue: 'changed' | 'unavailable' | undefined
      try {
        if (
          this.basis(
            value.kind,
            value.kind === 'first' ? (value.referenceId ?? '') : value.objectId,
            value.capturedOn
          ) !== value.basis
        )
          continuityIssue = 'changed'
      } catch {
        continuityIssue = 'unavailable'
      }
      const context =
        value.kind === 'routine'
          ? this.options.routines.begin(senderId, value.objectId, value.capturedOn, row.operationId)
          : this.options.actions.begin(
              senderId,
              value.objectId,
              value.capturedOn,
              value.kind === 'first',
              row.operationId
            )
      this.bind(value.kind, value.objectId, context, value.basis, value.referenceId)
      return {
        kind: value.kind,
        draft: {
          ...value.fields,
          ...(value.kind === 'action'
            ? {
                deepExpanded: Boolean(
                  value.fields.understanding || value.fields.confusion || value.fields.nextStep
                ),
                postExpanded:
                  value.fields.postAction !== 'keep-pending' ||
                  Boolean(value.fields.applyRecordedNextStep)
              }
            : {}),
          context: {
            ...(value.kind === 'routine'
              ? { routineId: value.objectId }
              : { actionId: value.objectId }),
            recordingContextId: context.id,
            capturedOn: value.capturedOn,
            continuityIssue
          }
        }
      } as RecordDraft
    })
  }
  reconcile(contextId: string): RecordReconciliation {
    const row = this.options.store.find(this.require(contextId).operationId)
    if (row?.state === 'saved') {
      if (!row.objectId || !row.occurredOn) throw new Error('Incomplete operation receipt.')
      return { state: 'saved', objectId: row.objectId, occurredOn: row.occurredOn }
    }
    return { state: row?.state ?? 'open' }
  }
  discard(contextId: string): void {
    const binding = this.require(contextId)
    this.options.store.transaction(() => {
      const row = this.options.store.find(binding.operationId)
      if (row?.state === 'saved') throw new ContinuityError('already-saved')
      this.options.store.write({
        operationId: binding.operationId,
        state: 'discarded',
        revision: row?.revision ?? 0,
        payload: null
      })
    })
  }
  commit<T extends { kind: string }>(contextId: string, work: () => T): T {
    const b = this.require(contextId)
    return this.options.store.transaction(() => {
      const row = this.options.store.find(b.operationId)
      if (row?.state === 'saved') throw new ContinuityError('already-saved')
      if (row?.state === 'discarded') throw new ContinuityError('invalid-recording-context')
      let currentBasis: string
      try {
        currentBasis = this.basis(
          b.kind,
          b.kind === 'first' ? (b.referenceId ?? '') : b.objectId,
          b.capturedOn
        )
      } catch {
        throw new ContinuityError('context-changed')
      }
      if (currentBasis !== b.basis) throw new ContinuityError('context-changed')
      const result = work()
      if (result.kind === 'saved') {
        const record = (result as { kind: string; record?: { occurredOn: string } }).record
        if (!record) throw new Error('Saved operation has no record result.')
        this.options.store.write({
          operationId: b.operationId,
          state: 'saved',
          revision: row?.revision ?? 0,
          payload: null,
          objectId: b.objectId,
          occurredOn: record.occurredOn
        })
      }
      return result
    })
  }
}
