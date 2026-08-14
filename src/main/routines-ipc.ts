import type { IpcMainInvokeEvent } from 'electron'
import { RoutineApplicationError, type RoutineService } from '../application/routines'
import {
  ROUTINE_CHANNELS,
  type CreateRoutineInputDto,
  type ListRoutinesInputDto,
  type ReplaceRoutineScheduleInputDto,
  type RoutineErrorCode,
  type RoutineIdInputDto,
  type RoutineResult,
  type RoutineStatusDto,
  type UpdateRoutineDetailsInputDto
} from '../contracts/routines'

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown

export interface RoutineIpcMain {
  removeHandler(channel: string): void
  handle(channel: string, listener: Handler): void
}

export interface RegisterRoutineIpcOptions {
  readonly ipc: RoutineIpcMain
  readonly service: RoutineService
  readonly assertSender: (event: IpcMainInvokeEvent) => void
}

class RoutineIpcValidationError extends Error {}

function fail<T>(code: RoutineErrorCode, message: string): RoutineResult<T> {
  return Object.freeze({ ok: false, error: Object.freeze({ code, message }) })
}

function execute<T>(work: () => T): RoutineResult<T> {
  try {
    return Object.freeze({ ok: true, value: work() })
  } catch (error) {
    if (error instanceof RoutineIpcValidationError) {
      return fail('validation', 'The Routine request was invalid.')
    }
    if (error instanceof RoutineApplicationError) {
      const messages: Record<RoutineApplicationError['code'], string> = {
        validation: 'Please provide the required Routine information.',
        'not-found': 'The requested Routine or Goal was not found.',
        'invalid-transition': 'That Routine change is not available in its current state.',
        'invariant-violation': 'The requested Routine relationship is not available.'
      }
      return fail(error.code, messages[error.code])
    }
    return fail('persistence-failed', 'MyTracer could not save or load the Routine.')
  }
}

function oneObject(
  args: readonly unknown[],
  allowedKeys: readonly string[]
): Record<string, unknown> {
  if (args.length !== 1 || !args[0] || typeof args[0] !== 'object' || Array.isArray(args[0])) {
    throw new RoutineIpcValidationError('Expected one input object.')
  }
  const record = args[0] as Record<string, unknown>
  if (Object.keys(record).some((key) => !allowedKeys.includes(key))) {
    throw new RoutineIpcValidationError('Unexpected input field.')
  }
  return record
}

function requiredText(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new RoutineIpcValidationError('Expected non-blank text.')
  }
  return value
}

function optionalText(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return value
  if (typeof value !== 'string') throw new RoutineIpcValidationError('Expected optional text.')
  return value
}

function requiredId(value: unknown): string {
  const id = requiredText(value)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new RoutineIpcValidationError('Expected a UUID v4 identifier.')
  }
  return id
}

function optionalId(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return value
  return requiredId(value)
}

function weekdays(value: unknown): readonly number[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new RoutineIpcValidationError('Expected a non-empty weekday array.')
  }
  const seen = new Set<number>()
  for (const weekday of value) {
    if (
      typeof weekday !== 'number' ||
      !Number.isInteger(weekday) ||
      weekday < 1 ||
      weekday > 7 ||
      seen.has(weekday)
    ) {
      throw new RoutineIpcValidationError('Expected unique ISO weekday values.')
    }
    seen.add(weekday)
  }
  return Object.freeze([...seen])
}

function parseCreate(args: readonly unknown[]): CreateRoutineInputDto {
  const record = oneObject(args, ['goalId', 'name', 'description', 'minimumAction', 'weekdays'])
  return {
    goalId: optionalId(record.goalId),
    name: requiredText(record.name),
    description: optionalText(record.description),
    minimumAction: requiredText(record.minimumAction),
    weekdays: weekdays(record.weekdays)
  }
}

function parseUpdate(args: readonly unknown[]): UpdateRoutineDetailsInputDto {
  const record = oneObject(args, ['routineId', 'name', 'description', 'minimumAction'])
  return {
    routineId: requiredId(record.routineId),
    name: requiredText(record.name),
    description: optionalText(record.description),
    minimumAction: requiredText(record.minimumAction)
  }
}

function parseReplace(args: readonly unknown[]): ReplaceRoutineScheduleInputDto {
  const record = oneObject(args, ['routineId', 'weekdays'])
  return { routineId: requiredId(record.routineId), weekdays: weekdays(record.weekdays) }
}

function parseId(args: readonly unknown[]): RoutineIdInputDto {
  const record = oneObject(args, ['routineId'])
  return { routineId: requiredId(record.routineId) }
}

function parseList(args: readonly unknown[]): ListRoutinesInputDto {
  const record = oneObject(args, ['status'])
  const status = record.status
  if (
    status !== undefined &&
    status !== null &&
    status !== 'active' &&
    status !== 'paused' &&
    status !== 'ended'
  ) {
    throw new RoutineIpcValidationError('Invalid Routine status.')
  }
  return { status: status as RoutineStatusDto | null | undefined }
}

export function registerRoutineIpc(options: RegisterRoutineIpcOptions): void {
  const register = (
    channel: string,
    parse: (args: readonly unknown[]) => unknown,
    run: (input: never) => unknown
  ) => {
    options.ipc.removeHandler(channel)
    options.ipc.handle(channel, (event, ...args) => {
      options.assertSender(event)
      return execute(() => run(parse(args) as never))
    })
  }

  register(ROUTINE_CHANNELS.create, parseCreate, (input: CreateRoutineInputDto) =>
    options.service.createRoutine(input)
  )
  register(ROUTINE_CHANNELS.updateDetails, parseUpdate, (input: UpdateRoutineDetailsInputDto) =>
    options.service.updateRoutineDetails(input)
  )
  register(
    ROUTINE_CHANNELS.replaceSchedule,
    parseReplace,
    (input: ReplaceRoutineScheduleInputDto) => options.service.replaceRoutineSchedule(input)
  )
  register(ROUTINE_CHANNELS.pause, parseId, (input: RoutineIdInputDto) =>
    options.service.pauseRoutine(input.routineId)
  )
  register(ROUTINE_CHANNELS.resume, parseId, (input: RoutineIdInputDto) =>
    options.service.resumeRoutine(input.routineId)
  )
  register(ROUTINE_CHANNELS.end, parseId, (input: RoutineIdInputDto) =>
    options.service.endRoutine(input.routineId)
  )
  register(ROUTINE_CHANNELS.list, parseList, (input: ListRoutinesInputDto) =>
    options.service.listRoutines(input.status ?? undefined)
  )
  register(ROUTINE_CHANNELS.getDetail, parseId, (input: RoutineIdInputDto) =>
    options.service.getRoutineDetail(input.routineId)
  )
}
