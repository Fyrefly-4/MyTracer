import { ContinuityError, type RecordContinuity } from './record-continuity'
import type { IpcMainInvokeEvent } from 'electron'
import {
  ActionRecordApplicationError,
  type ActionRecordService
} from '../application/action-records'
import {
  RECORD_CHANNELS,
  type FirstActionRecordInputDto,
  type ActionRecordIdInputDto,
  type BeginActionRecordingInputDto,
  type CancelActionRecordingInputDto,
  type ListActionRecordsInputDto,
  type PostRecordChoiceDto,
  type RecordActionInputDto,
  type RecordedCurrentNextResolutionDto,
  type RecordErrorCode,
  type RecordResult
} from '../contracts/records'
import {
  ActionRecordingContextStore,
  InvalidActionRecordingContextError
} from './action-recording-contexts'

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown

export interface RecordIpcMain {
  removeHandler(channel: string): void
  handle(channel: string, listener: Handler): void
}

export interface RegisterRecordIpcOptions {
  readonly ipc: RecordIpcMain
  readonly service: ActionRecordService
  readonly contexts: ActionRecordingContextStore
  readonly continuity?: RecordContinuity
  readonly assertSender: (event: IpcMainInvokeEvent) => void
}

class RecordIpcValidationError extends Error {}

function fail<T>(code: RecordErrorCode, message: string): RecordResult<T> {
  return Object.freeze({ ok: false, error: Object.freeze({ code, message }) })
}

function execute<T>(work: () => T): RecordResult<T> {
  try {
    return Object.freeze({ ok: true, value: work() })
  } catch (error) {
    if (error instanceof ContinuityError)
      return fail(error.code, 'Please check this recording before continuing.')
    if (error instanceof RecordIpcValidationError) {
      return fail('validation', 'The Action record request was invalid.')
    }
    if (error instanceof InvalidActionRecordingContextError) {
      return fail(
        'invalid-recording-context',
        'This recording form is no longer active. Start a new recording.'
      )
    }
    if (error instanceof ActionRecordApplicationError) {
      const messages: Record<ActionRecordApplicationError['code'], string> = {
        validation: 'Please check the Action record fields.',
        'not-found': 'The requested Action or record was not found.',
        'invalid-transition': 'That Action cannot be recorded in its current state.',
        'invariant-violation': 'The requested record relationship is not available.'
      }
      return fail(error.code, messages[error.code])
    }
    return fail('persistence-failed', 'MyTracer could not save or load the Action record.')
  }
}

function oneArgument(args: readonly unknown[]): unknown {
  if (args.length !== 1) throw new RecordIpcValidationError('Expected one input object.')
  return args[0]
}

function objectWithKeys(value: unknown, allowedKeys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RecordIpcValidationError('Expected an object.')
  }
  const record = value as Record<string, unknown>
  if (Object.keys(record).some((key) => !allowedKeys.includes(key))) {
    throw new RecordIpcValidationError('Unexpected input field.')
  }
  return record
}

function requiredString(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new RecordIpcValidationError('Expected non-blank text.')
  }
  return value
}

function optionalText(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return value
  if (typeof value !== 'string' || !value.trim()) {
    throw new RecordIpcValidationError('Expected optional non-blank text.')
  }
  return value
}

function requiredId(value: unknown): string {
  const id = requiredString(value)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new RecordIpcValidationError('Expected a UUID v4 identifier.')
  }
  return id
}

function parseBegin(args: readonly unknown[]): BeginActionRecordingInputDto {
  const input = objectWithKeys(oneArgument(args), ['actionId'])
  return { actionId: requiredId(input.actionId) }
}

function parseCancel(args: readonly unknown[]): CancelActionRecordingInputDto {
  const input = objectWithKeys(oneArgument(args), ['recordingContextId'])
  return { recordingContextId: requiredId(input.recordingContextId) }
}

function parseResolution(value: unknown): RecordedCurrentNextResolutionDto | undefined {
  if (value === undefined) return undefined
  const base = objectWithKeys(value, ['kind', 'actionId'])
  if (base.kind === 'clear') {
    objectWithKeys(value, ['kind'])
    return { kind: 'clear' }
  }
  if (base.kind === 'use-existing') {
    objectWithKeys(value, ['kind', 'actionId'])
    return { kind: 'use-existing', actionId: requiredId(base.actionId) }
  }
  if (base.kind === 'create-from-recorded-next-step') {
    objectWithKeys(value, ['kind'])
    return { kind: 'create-from-recorded-next-step' }
  }
  throw new RecordIpcValidationError('Invalid current-next resolution.')
}

function parsePostRecord(value: unknown): PostRecordChoiceDto | undefined {
  if (value === undefined) return undefined
  const input = objectWithKeys(value, ['action', 'currentNextResolution', 'applyRecordedNextStep'])
  const action = input.action
  if (
    action !== undefined &&
    action !== 'keep-pending' &&
    action !== 'complete' &&
    action !== 'cancel' &&
    action !== 'reschedule'
  ) {
    throw new RecordIpcValidationError('Invalid post-record Action choice.')
  }
  if (
    input.applyRecordedNextStep !== undefined &&
    typeof input.applyRecordedNextStep !== 'boolean'
  ) {
    throw new RecordIpcValidationError('Invalid next-step application choice.')
  }
  return {
    action: action as PostRecordChoiceDto['action'],
    currentNextResolution: parseResolution(input.currentNextResolution),
    applyRecordedNextStep: input.applyRecordedNextStep as boolean | undefined
  }
}

function parseRecord(args: readonly unknown[]): RecordActionInputDto {
  const input = objectWithKeys(oneArgument(args), [
    'actionId',
    'recordingContextId',
    'dateChoice',
    'durationMinutes',
    'outcome',
    'understanding',
    'confusion',
    'nextStep',
    'summary',
    'note',
    'postRecord'
  ])
  if (
    input.durationMinutes !== null &&
    (!Number.isInteger(input.durationMinutes) || Number(input.durationMinutes) < 0)
  ) {
    throw new RecordIpcValidationError('Expected non-negative integer minutes.')
  }
  if (input.outcome !== 'completed' && input.outcome !== 'partial' && input.outcome !== 'stopped') {
    throw new RecordIpcValidationError('Invalid Action record outcome.')
  }
  if (
    input.dateChoice !== undefined &&
    input.dateChoice !== 'keep-captured-on' &&
    input.dateChoice !== 'use-current-on'
  ) {
    throw new RecordIpcValidationError('Invalid recording date choice.')
  }
  return {
    actionId: requiredId(input.actionId),
    recordingContextId: requiredId(input.recordingContextId),
    dateChoice: input.dateChoice as RecordActionInputDto['dateChoice'],
    durationMinutes: input.durationMinutes === null ? null : Number(input.durationMinutes),
    outcome: input.outcome,
    understanding: optionalText(input.understanding),
    confusion: optionalText(input.confusion),
    nextStep: optionalText(input.nextStep),
    summary: optionalSummary(input.summary),
    note: optionalNote(input.note),
    postRecord: parsePostRecord(input.postRecord)
  }
}

function parseFirst(args: readonly unknown[]): FirstActionRecordInputDto {
  const input = objectWithKeys(oneArgument(args), [
    'actionId',
    'recordingContextId',
    'title',
    'goalId',
    'durationMinutes',
    'outcome',
    'lifecycle',
    'summary',
    'note',
    'dateChoice'
  ])
  if (input.lifecycle !== 'keep-pending' && input.lifecycle !== 'complete') {
    throw new RecordIpcValidationError('Choose the Action lifecycle explicitly.')
  }
  const record = parseRecord([
    {
      actionId: input.actionId,
      recordingContextId: input.recordingContextId,
      durationMinutes: input.durationMinutes,
      outcome: input.outcome,
      summary: input.summary,
      note: input.note,
      dateChoice: input.dateChoice
    }
  ])
  return {
    ...record,
    title: requiredString(input.title),
    goalId: input.goalId === null ? null : requiredId(input.goalId),
    lifecycle: input.lifecycle
  }
}

function parseActionList(args: readonly unknown[]): ListActionRecordsInputDto {
  const input = objectWithKeys(oneArgument(args), ['actionId'])
  return { actionId: requiredId(input.actionId) }
}

function parseRecordId(args: readonly unknown[]): ActionRecordIdInputDto {
  const input = objectWithKeys(oneArgument(args), ['recordId'])
  return { recordId: requiredId(input.recordId) }
}

export function registerRecordIpc(options: RegisterRecordIpcOptions): void {
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
    RECORD_CHANNELS.beginFirst,
    (args) => {
      if (args.length) throw new RecordIpcValidationError('Expected no input.')
      return undefined
    },
    (event) => {
      const prepared = options.service.beginFirstActionRecording()
      const context = options.contexts.begin(
        event.sender.id,
        prepared.actionId,
        prepared.capturedOn,
        true
      )
      options.continuity?.bind('first', prepared.actionId, context)
      return Object.freeze({ ...prepared, recordingContextId: context.id })
    }
  )
  register(RECORD_CHANNELS.saveFirst, parseFirst, (event, input: FirstActionRecordInputDto) => {
    const context = options.contexts.require(
      event.sender.id,
      input.actionId,
      input.recordingContextId
    )
    if (!context.firstRecord) throw new InvalidActionRecordingContextError()
    // Keep this session capability for a retry after a lost IPC response. The persisted
    // record ID is the idempotency key; no separate receipt or schema is needed.
    if (context.savedFirstResult) return context.savedFirstResult
    const save = () =>
      options.service.recordFirstAction({
        ...input,
        recordId: context.operationId ?? context.id,
        capturedOn: context.capturedOn
      })
    const result = options.continuity ? options.continuity.commit(context.id, save) : save()
    if (result.kind === 'saved')
      options.contexts.rememberFirstResult(event.sender.id, input.actionId, context.id, result)
    return result
  })
  register(RECORD_CHANNELS.begin, parseBegin, (event, input: BeginActionRecordingInputDto) => {
    const prepared = options.service.beginActionRecording(input.actionId)
    const context = options.contexts.begin(event.sender.id, input.actionId, prepared.capturedOn)
    options.continuity?.bind('action', input.actionId, context)
    return Object.freeze({ ...prepared, recordingContextId: context.id })
  })
  register(RECORD_CHANNELS.cancel, parseCancel, (event, input: CancelActionRecordingInputDto) => {
    if (options.continuity)
      options.contexts.requireSender(event.sender.id, input.recordingContextId)
    options.continuity?.discard(input.recordingContextId)
    if (!options.continuity) options.contexts.cancel(event.sender.id, input.recordingContextId)
    return Object.freeze({ cancelled: true as const })
  })
  register(RECORD_CHANNELS.record, parseRecord, (event, input: RecordActionInputDto) => {
    const context = options.contexts.require(
      event.sender.id,
      input.actionId,
      input.recordingContextId
    )
    if (context.firstRecord) throw new InvalidActionRecordingContextError()
    const save = () =>
      options.service.recordAction({
        ...input,
        capturedOn: context.capturedOn
      })
    const result = options.continuity ? options.continuity.commit(context.id, save) : save()
    if (result.kind === 'saved' && !options.continuity) {
      options.contexts.consume(event.sender.id, input.actionId, input.recordingContextId)
    }
    return result
  })
  register(
    RECORD_CHANNELS.listForAction,
    parseActionList,
    (_event, input: ListActionRecordsInputDto) =>
      options.service.listActionRecordsForAction(input.actionId)
  )
  register(RECORD_CHANNELS.getDetail, parseRecordId, (_event, input: ActionRecordIdInputDto) =>
    options.service.getActionRecordDetail(input.recordId)
  )
}

function optionalNote(value: unknown): string | null | undefined {
  if (value == null) return value
  if (typeof value !== 'string') throw new RecordIpcValidationError('Expected note text.')
  return value
}

function optionalSummary(value: unknown): string | null | undefined {
  const text = optionalText(value)
  if (text && Array.from(text).length > 500)
    throw new RecordIpcValidationError('简述请保持在 500 字以内。')
  return text
}
