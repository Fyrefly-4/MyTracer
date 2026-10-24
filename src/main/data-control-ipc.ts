import type { IpcMainInvokeEvent } from 'electron'
import { DataControlApplicationError, type DataControlService } from '../application/data-control'
import {
  DATA_CONTROL_CHANNELS,
  type BackfillActionRecordInputDto,
  type BackfillRoutineRecordInputDto,
  type DataControlErrorCode,
  type DataControlResult,
  type FactIdInputDto,
  type ResolveConfusionInputDto,
  type TextFactInputDto,
  type UpdateActionRecordInputDto,
  type UpdateRoutineRecordInputDto
} from '../contracts/data-control'
import { createLocalDate } from '../domain/local-date'
import type { DeleteTarget } from '../domain/data-control'
import {
  DeletePreviewContextStore,
  InvalidDeletePreviewContextError
} from './delete-preview-contexts'

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown

export interface DataControlIpcMain {
  removeHandler(channel: string): void
  handle(channel: string, listener: Handler): void
}

export interface RegisterDataControlIpcOptions {
  readonly ipc: DataControlIpcMain
  readonly service: DataControlService
  readonly contexts: DeletePreviewContextStore
  readonly assertSender: (event: IpcMainInvokeEvent) => void
  readonly now: () => string
}

class DataControlIpcValidationError extends Error {}

function fail<T>(code: DataControlErrorCode, message: string): DataControlResult<T> {
  return Object.freeze({ ok: false, error: Object.freeze({ code, message }) })
}

function execute<T>(work: () => T): DataControlResult<T> {
  try {
    return Object.freeze({ ok: true, value: work() })
  } catch (error) {
    if (error instanceof DataControlIpcValidationError) {
      return fail('validation', 'The data-control request was invalid.')
    }
    if (error instanceof InvalidDeletePreviewContextError) {
      return fail('invalid-delete-preview', 'This delete preview is no longer active.')
    }
    if (error instanceof DataControlApplicationError) {
      const messages: Record<DataControlApplicationError['code'], string> = {
        validation: 'Please check the record fields.',
        'not-found': 'The requested data was not found.',
        'invalid-transition': 'That fact cannot make the requested transition.',
        'record-already-exists': 'A Routine record already exists for that date.',
        'delete-preview-stale': 'The delete impact changed. Preview it again.',
        'invariant-violation': 'The requested data relationship is not available.'
      }
      return fail(error.code, messages[error.code])
    }
    return fail('persistence-failed', 'MyTracer could not complete the data operation.')
  }
}

function objectWithKeys(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DataControlIpcValidationError()
  }
  const input = value as Record<string, unknown>
  if (Object.keys(input).some((key) => !allowed.includes(key))) {
    throw new DataControlIpcValidationError()
  }
  return input
}

function oneObject(args: readonly unknown[], allowed: readonly string[]) {
  if (args.length !== 1) throw new DataControlIpcValidationError()
  return objectWithKeys(args[0], allowed)
}

function id(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new DataControlIpcValidationError()
  }
  return value
}

function localDate(value: unknown): string {
  if (typeof value !== 'string') throw new DataControlIpcValidationError()
  try {
    return String(createLocalDate(value))
  } catch {
    throw new DataControlIpcValidationError()
  }
}

function nonNegativeInteger(value: unknown): number {
  if (!Number.isInteger(value) || Number(value) < 0) throw new DataControlIpcValidationError()
  return Number(value)
}

function optionalMinutes(value: unknown): number | null | undefined {
  if (value === undefined || value === null) return value
  return nonNegativeInteger(value)
}

function optionalText(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return value
  if (typeof value !== 'string' || !value.trim()) throw new DataControlIpcValidationError()
  return value
}

function requiredText(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new DataControlIpcValidationError()
  return value
}

function actionOutcome(value: unknown): BackfillActionRecordInputDto['outcome'] {
  if (value !== 'completed' && value !== 'partial' && value !== 'stopped') {
    throw new DataControlIpcValidationError()
  }
  return value
}

function routineOutcome(value: unknown): BackfillRoutineRecordInputDto['outcome'] {
  if (
    value !== 'target_met' &&
    value !== 'acted' &&
    value !== 'intentional_rest' &&
    value !== 'not_done'
  ) {
    throw new DataControlIpcValidationError()
  }
  return value
}

function target(value: unknown): DeleteTarget {
  const input = objectWithKeys(value, ['type', 'id'])
  if (
    input.type !== 'action-record' &&
    input.type !== 'routine-record' &&
    input.type !== 'action' &&
    input.type !== 'routine' &&
    input.type !== 'goal'
  ) {
    throw new DataControlIpcValidationError()
  }
  return { type: input.type, id: id(input.id) }
}

const actionFields = [
  'occurredOn',
  'durationMinutes',
  'outcome',
  'nextStep',
  'summary',
  'note'
] as const

function parseBackfillAction(args: readonly unknown[]): BackfillActionRecordInputDto {
  const input = oneObject(args, ['actionId', ...actionFields, 'understanding', 'confusion'])
  return {
    actionId: id(input.actionId),
    occurredOn: localDate(input.occurredOn),
    durationMinutes:
      input.durationMinutes === null ? null : nonNegativeInteger(input.durationMinutes),
    outcome: actionOutcome(input.outcome),
    nextStep: optionalText(input.nextStep),
    summary: optionalSummary(input.summary),
    note: optionalNote(input.note),
    understanding: optionalText(input.understanding),
    confusion: optionalText(input.confusion)
  }
}

function parseUpdateAction(args: readonly unknown[]): UpdateActionRecordInputDto {
  const input = oneObject(args, ['recordId', ...actionFields])
  return {
    recordId: id(input.recordId),
    occurredOn: localDate(input.occurredOn),
    durationMinutes:
      input.durationMinutes === null ? null : nonNegativeInteger(input.durationMinutes),
    outcome: actionOutcome(input.outcome),
    nextStep: optionalText(input.nextStep),
    summary: optionalSummary(input.summary),
    note: optionalNote(input.note)
  }
}

const routineFields = [
  'occurredOn',
  'outcome',
  'plannedForDate',
  'durationMinutes',
  'summary',
  'note'
] as const

function parseBackfillRoutine(args: readonly unknown[]): BackfillRoutineRecordInputDto {
  const input = oneObject(args, ['routineId', ...routineFields])
  if (typeof input.plannedForDate !== 'boolean') throw new DataControlIpcValidationError()
  return {
    routineId: id(input.routineId),
    occurredOn: localDate(input.occurredOn),
    outcome: routineOutcome(input.outcome),
    plannedForDate: input.plannedForDate,
    durationMinutes: optionalMinutes(input.durationMinutes),
    summary: optionalSummary(input.summary),
    note: optionalNote(input.note)
  }
}

function parseUpdateRoutine(args: readonly unknown[]): UpdateRoutineRecordInputDto {
  const input = oneObject(args, ['recordId', ...routineFields])
  if (input.plannedForDate !== undefined && typeof input.plannedForDate !== 'boolean') {
    throw new DataControlIpcValidationError()
  }
  return {
    recordId: id(input.recordId),
    occurredOn: localDate(input.occurredOn),
    outcome: routineOutcome(input.outcome),
    plannedForDate: input.plannedForDate as boolean | undefined,
    durationMinutes: optionalMinutes(input.durationMinutes),
    summary: optionalSummary(input.summary),
    note: optionalNote(input.note)
  }
}

function parseFactId(args: readonly unknown[]): FactIdInputDto {
  const input = oneObject(args, ['id'])
  return { id: id(input.id) }
}

function parseTextFact(args: readonly unknown[]): TextFactInputDto {
  const input = oneObject(args, ['id', 'text'])
  return { id: id(input.id), text: requiredText(input.text) }
}

function parseResolve(args: readonly unknown[]): ResolveConfusionInputDto {
  const input = oneObject(args, ['id', 'resolution'])
  return { id: id(input.id), resolution: optionalText(input.resolution) }
}

export function registerDataControlIpc(options: RegisterDataControlIpcOptions): void {
  const register = (
    channel: string,
    parse: (args: readonly unknown[]) => unknown,
    run: (event: IpcMainInvokeEvent, input: never) => unknown
  ) => {
    options.ipc.removeHandler(channel)
    options.ipc.handle(channel, (event, ...args) => {
      options.assertSender(event)
      return execute(() => run(event, parse(args) as never))
    })
  }
  register(
    DATA_CONTROL_CHANNELS.list,
    (args) => {
      if (args.length) throw new DataControlIpcValidationError()
    },
    () => options.service.listData()
  )
  register(
    DATA_CONTROL_CHANNELS.backfillActionRecord,
    parseBackfillAction,
    (_event, input: BackfillActionRecordInputDto) => options.service.backfillActionRecord(input)
  )
  register(
    DATA_CONTROL_CHANNELS.updateActionRecord,
    parseUpdateAction,
    (_event, input: UpdateActionRecordInputDto) => options.service.updateActionRecord(input)
  )
  register(
    DATA_CONTROL_CHANNELS.backfillRoutineRecord,
    parseBackfillRoutine,
    (_event, input: BackfillRoutineRecordInputDto) => options.service.backfillRoutineRecord(input)
  )
  register(
    DATA_CONTROL_CHANNELS.updateRoutineRecord,
    parseUpdateRoutine,
    (_event, input: UpdateRoutineRecordInputDto) => options.service.updateRoutineRecord(input)
  )
  register(
    DATA_CONTROL_CHANNELS.updateUnderstanding,
    parseTextFact,
    (_event, input: TextFactInputDto) =>
      options.service.updateUnderstandingText(input.id, input.text)
  )
  register(
    DATA_CONTROL_CHANNELS.revokeUnderstanding,
    parseFactId,
    (_event, input: FactIdInputDto) => options.service.revokeUnderstanding(input.id)
  )
  register(
    DATA_CONTROL_CHANNELS.updateConfusion,
    parseTextFact,
    (_event, input: TextFactInputDto) => options.service.updateConfusionText(input.id, input.text)
  )
  register(
    DATA_CONTROL_CHANNELS.resolveConfusion,
    parseResolve,
    (_event, input: ResolveConfusionInputDto) =>
      options.service.resolveConfusion(input.id, input.resolution)
  )
  register(DATA_CONTROL_CHANNELS.reopenConfusion, parseFactId, (_event, input: FactIdInputDto) =>
    options.service.reopenConfusion(input.id)
  )
  register(
    DATA_CONTROL_CHANNELS.previewDelete,
    (args) => {
      const input = oneObject(args, ['target'])
      return { target: target(input.target) }
    },
    (event, input: { readonly target: DeleteTarget }) => {
      const preview = options.service.previewDelete(input.target)
      const generatedAt = options.now()
      const context = options.contexts.begin(
        event.sender.id,
        preview.target,
        preview.fingerprint,
        generatedAt
      )
      return Object.freeze({
        previewId: context.id,
        target: preview.target,
        counts: preview.counts,
        generatedAt
      })
    }
  )
  register(
    DATA_CONTROL_CHANNELS.cancelDelete,
    (args) => {
      const input = oneObject(args, ['previewId'])
      return { previewId: id(input.previewId) }
    },
    (event, input: { readonly previewId: string }) => {
      options.contexts.cancel(event.sender.id, input.previewId)
      return Object.freeze({ cancelled: true as const })
    }
  )
  register(
    DATA_CONTROL_CHANNELS.confirmDelete,
    (args) => {
      const input = oneObject(args, ['previewId', 'target', 'confirmation'])
      if (input.confirmation !== 'permanently-delete') throw new DataControlIpcValidationError()
      return {
        previewId: id(input.previewId),
        target: target(input.target),
        confirmation: input.confirmation
      }
    },
    (event, input: { readonly previewId: string; readonly target: DeleteTarget }) => {
      const context = options.contexts.consume(event.sender.id, input.previewId, input.target)
      return Object.freeze({
        counts: options.service.confirmDelete(input.target, context.fingerprint)
      })
    }
  )
}

function optionalNote(value: unknown): string | null | undefined {
  if (value == null) return value
  if (typeof value !== 'string') throw new DataControlIpcValidationError('Expected note text.')
  return value
}

function optionalSummary(value: unknown): string | null | undefined {
  const text = optionalText(value)
  if (text && Array.from(text).length > 500)
    throw new DataControlIpcValidationError('简述请保持在 500 字以内。')
  return text
}
