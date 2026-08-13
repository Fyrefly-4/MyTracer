import type { IpcMainInvokeEvent } from 'electron'
import { ProgressApplicationError, type ProgressService } from '../application/progress'
import {
  PROGRESS_CHANNELS,
  type GetProgressInputDto,
  type ProgressErrorCode,
  type ProgressResult
} from '../contracts/progress'
import { createLocalDate } from '../domain/local-date'

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown

export interface ProgressIpcMain {
  removeHandler(channel: string): void
  handle(channel: string, listener: Handler): void
}

export interface RegisterProgressIpcOptions {
  readonly ipc: ProgressIpcMain
  readonly service: ProgressService
  readonly assertSender: (event: IpcMainInvokeEvent) => void
}

class ProgressIpcValidationError extends Error {}

function fail<T>(code: ProgressErrorCode, message: string): ProgressResult<T> {
  return Object.freeze({ ok: false, error: Object.freeze({ code, message }) })
}

function execute<T>(work: () => T): ProgressResult<T> {
  try {
    return Object.freeze({ ok: true, value: work() })
  } catch (error) {
    if (error instanceof ProgressIpcValidationError) {
      return fail('validation', 'The Progress filter was invalid.')
    }
    if (error instanceof ProgressApplicationError) {
      return fail(
        error.code,
        error.code === 'not-found'
          ? 'The requested Goal was not found.'
          : 'Please check the Progress date range.'
      )
    }
    return fail('persistence-failed', 'MyTracer could not load Progress facts.')
  }
}

function requiredUuid(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new ProgressIpcValidationError('Expected a UUID v4 identifier.')
  }
  return value
}

function optionalDate(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return value
  if (typeof value !== 'string') throw new ProgressIpcValidationError('Expected a LocalDate.')
  try {
    createLocalDate(value)
  } catch {
    throw new ProgressIpcValidationError('Expected a valid LocalDate.')
  }
  return value
}

function parseGet(args: readonly unknown[]): GetProgressInputDto {
  if (args.length !== 1 || !args[0] || typeof args[0] !== 'object' || Array.isArray(args[0])) {
    throw new ProgressIpcValidationError('Expected one input object.')
  }
  const record = args[0] as Record<string, unknown>
  if (Object.keys(record).some((key) => !['goalId', 'from', 'through'].includes(key))) {
    throw new ProgressIpcValidationError('Unexpected input field.')
  }
  if (record.goalId !== undefined && record.goalId !== null && typeof record.goalId !== 'string') {
    throw new ProgressIpcValidationError('Expected an optional Goal ID.')
  }
  return {
    goalId:
      record.goalId === undefined || record.goalId === null
        ? record.goalId
        : requiredUuid(record.goalId),
    from: optionalDate(record.from),
    through: optionalDate(record.through)
  }
}

export function registerProgressIpc(options: RegisterProgressIpcOptions): void {
  options.ipc.removeHandler(PROGRESS_CHANNELS.get)
  options.ipc.handle(PROGRESS_CHANNELS.get, (event, ...args) => {
    options.assertSender(event)
    return execute(() => options.service.getProgress(parseGet(args)))
  })
}
