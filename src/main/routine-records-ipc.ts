import { ContinuityError, type RecordContinuity } from './record-continuity'
import type { IpcMainInvokeEvent } from 'electron'
import {
  RoutineRecordApplicationError,
  type RoutineRecordService
} from '../application/routine-records'
import {
  ROUTINE_RECORD_CHANNELS,
  type BeginRoutineRecordingInputDto,
  type CancelRoutineRecordingInputDto,
  type GetRoutineDayStateInputDto,
  type RecordRoutineInputDto,
  type RoutineRecordErrorCode,
  type RoutineRecordOutcomeDto,
  type RoutineRecordResult
} from '../contracts/routine-records'
import { createLocalDate } from '../domain/local-date'
import {
  InvalidRoutineRecordingContextError,
  RoutineRecordingContextStore
} from './routine-recording-contexts'

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown

export interface RoutineRecordIpcMain {
  removeHandler(channel: string): void
  handle(channel: string, listener: Handler): void
}

export interface RegisterRoutineRecordIpcOptions {
  readonly ipc: RoutineRecordIpcMain
  readonly service: RoutineRecordService
  readonly contexts: RoutineRecordingContextStore
  readonly continuity?: RecordContinuity
  readonly assertSender: (event: IpcMainInvokeEvent) => void
}

class RoutineRecordIpcValidationError extends Error {}

function fail<T>(code: RoutineRecordErrorCode, message: string): RoutineRecordResult<T> {
  return Object.freeze({ ok: false, error: Object.freeze({ code, message }) })
}

function execute<T>(work: () => T): RoutineRecordResult<T> {
  try {
    return Object.freeze({ ok: true, value: work() })
  } catch (error) {
    if (error instanceof ContinuityError)
      return fail(error.code, 'Please check this recording before continuing.')
    if (error instanceof RoutineRecordIpcValidationError) {
      return fail('validation', 'The Routine record request was invalid.')
    }
    if (error instanceof InvalidRoutineRecordingContextError) {
      return fail(
        'invalid-recording-context',
        'This Routine recording form is no longer active. Start a new recording.'
      )
    }
    if (error instanceof RoutineRecordApplicationError) {
      const messages: Record<RoutineRecordApplicationError['code'], string> = {
        validation: 'Please check the Routine record fields.',
        'not-found': 'The requested Routine or record was not found.',
        'invalid-transition': 'That Routine cannot be recorded in its current state.',
        'invariant-violation': 'The requested Routine record relationship is not available.',
        'record-already-exists': 'This Routine already has a record for that date.'
      }
      return fail(error.code, messages[error.code])
    }
    return fail('persistence-failed', 'MyTracer could not save or load the Routine record.')
  }
}

function objectWithKeys(value: unknown, allowedKeys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RoutineRecordIpcValidationError('Expected one input object.')
  }
  const record = value as Record<string, unknown>
  if (Object.keys(record).some((key) => !allowedKeys.includes(key))) {
    throw new RoutineRecordIpcValidationError('Unexpected input field.')
  }
  return record
}

function oneObject(args: readonly unknown[], allowedKeys: readonly string[]) {
  if (args.length !== 1) throw new RoutineRecordIpcValidationError('Expected one input object.')
  return objectWithKeys(args[0], allowedKeys)
}

function requiredId(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new RoutineRecordIpcValidationError('Expected a UUID v4 identifier.')
  }
  return value
}

function optionalText(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return value
  if (typeof value !== 'string' || !value.trim()) {
    throw new RoutineRecordIpcValidationError('Expected optional non-blank text.')
  }
  return value
}

function parseOutcome(value: unknown): RoutineRecordOutcomeDto {
  if (
    value !== 'target_met' &&
    value !== 'acted' &&
    value !== 'intentional_rest' &&
    value !== 'not_done'
  ) {
    throw new RoutineRecordIpcValidationError('Invalid Routine record outcome.')
  }
  return value
}

function parseBegin(args: readonly unknown[]): BeginRoutineRecordingInputDto {
  const input = oneObject(args, ['routineId'])
  return { routineId: requiredId(input.routineId) }
}

function parseCancel(args: readonly unknown[]): CancelRoutineRecordingInputDto {
  const input = oneObject(args, ['recordingContextId'])
  return { recordingContextId: requiredId(input.recordingContextId) }
}

function parseRecord(args: readonly unknown[]): RecordRoutineInputDto {
  const input = oneObject(args, [
    'routineId',
    'recordingContextId',
    'dateChoice',
    'outcome',
    'durationMinutes',
    'summary',
    'note'
  ])
  if (
    input.dateChoice !== undefined &&
    input.dateChoice !== 'keep-captured-on' &&
    input.dateChoice !== 'use-current-on'
  ) {
    throw new RoutineRecordIpcValidationError('Invalid recording date choice.')
  }
  if (
    input.durationMinutes !== undefined &&
    input.durationMinutes !== null &&
    (!Number.isInteger(input.durationMinutes) || Number(input.durationMinutes) < 0)
  ) {
    throw new RoutineRecordIpcValidationError('Expected optional non-negative integer minutes.')
  }
  const outcome = parseOutcome(input.outcome)
  if (
    (outcome === 'intentional_rest' || outcome === 'not_done') &&
    input.durationMinutes !== undefined &&
    input.durationMinutes !== null
  ) {
    throw new RoutineRecordIpcValidationError('This outcome cannot include duration.')
  }
  return {
    routineId: requiredId(input.routineId),
    recordingContextId: requiredId(input.recordingContextId),
    dateChoice: input.dateChoice as RecordRoutineInputDto['dateChoice'],
    outcome,
    durationMinutes:
      input.durationMinutes === undefined || input.durationMinutes === null
        ? input.durationMinutes
        : Number(input.durationMinutes),
    summary: optionalSummary(input.summary),
    note: optionalNote(input.note)
  }
}

function parseDayState(args: readonly unknown[]): GetRoutineDayStateInputDto {
  const input = oneObject(args, ['routineId', 'localDate'])
  if (typeof input.localDate !== 'string') {
    throw new RoutineRecordIpcValidationError('Expected a LocalDate.')
  }
  try {
    createLocalDate(input.localDate)
  } catch {
    throw new RoutineRecordIpcValidationError('Expected a valid LocalDate.')
  }
  return { routineId: requiredId(input.routineId), localDate: input.localDate }
}

export function registerRoutineRecordIpc(options: RegisterRoutineRecordIpcOptions): void {
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
    ROUTINE_RECORD_CHANNELS.begin,
    parseBegin,
    (event, input: BeginRoutineRecordingInputDto) => {
      const prepared = options.service.beginRoutineRecording(input.routineId)
      const context = options.contexts.begin(event.sender.id, input.routineId, prepared.capturedOn)
      options.continuity?.bind('routine', input.routineId, context)
      return Object.freeze({ ...prepared, recordingContextId: context.id })
    }
  )
  register(
    ROUTINE_RECORD_CHANNELS.cancel,
    parseCancel,
    (event, input: CancelRoutineRecordingInputDto) => {
      if (options.continuity)
        options.contexts.requireSender(event.sender.id, input.recordingContextId)
      options.continuity?.discard(input.recordingContextId)
      if (!options.continuity) options.contexts.cancel(event.sender.id, input.recordingContextId)
      return Object.freeze({ cancelled: true as const })
    }
  )
  register(ROUTINE_RECORD_CHANNELS.record, parseRecord, (event, input: RecordRoutineInputDto) => {
    const context = options.contexts.require(
      event.sender.id,
      input.routineId,
      input.recordingContextId
    )
    const save = () => options.service.recordRoutine({ ...input, capturedOn: context.capturedOn })
    const result = options.continuity ? options.continuity.commit(context.id, save) : save()
    if (result.kind === 'saved' && !options.continuity) {
      options.contexts.consume(event.sender.id, input.routineId, input.recordingContextId)
    }
    return result
  })
  register(
    ROUTINE_RECORD_CHANNELS.getDayState,
    parseDayState,
    (_event, input: GetRoutineDayStateInputDto) =>
      options.service.getRoutineDayState(input.routineId, input.localDate)
  )
}

function optionalNote(value: unknown): string | null | undefined {
  if (value == null) return value
  if (typeof value !== 'string') throw new RoutineRecordIpcValidationError('Expected note text.')
  return value
}

function optionalSummary(value: unknown): string | null | undefined {
  const text = optionalText(value)
  if (text && Array.from(text).length > 500)
    throw new RoutineRecordIpcValidationError('简述请保持在 500 字以内。')
  return text
}
