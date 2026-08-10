import type { IpcMainInvokeEvent } from 'electron'
import { ActionApplicationError } from '../application/actions'
import type { TodayService } from '../application/today'
import {
  type ActionErrorCode,
  type ActionIdInputDto,
  type ActionResult
} from '../contracts/actions'
import { TODAY_CHANNELS, type GetTodayInputDto } from '../contracts/today'

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown

export interface TodayIpcMain {
  removeHandler(channel: string): void
  handle(channel: string, listener: Handler): void
}

export interface RegisterTodayIpcOptions {
  readonly ipc: TodayIpcMain
  readonly service: TodayService
  readonly assertSender: (event: IpcMainInvokeEvent) => void
}

class TodayIpcValidationError extends Error {}

function fail<T>(code: ActionErrorCode, message: string): ActionResult<T> {
  return Object.freeze({ ok: false, error: Object.freeze({ code, message }) })
}

function execute<T>(work: () => T): ActionResult<T> {
  try {
    return Object.freeze({ ok: true, value: work() })
  } catch (error) {
    if (error instanceof TodayIpcValidationError) {
      return fail('validation', 'The Today request was invalid.')
    }
    if (error instanceof ActionApplicationError) {
      const messages: Record<ActionApplicationError['code'], string> = {
        validation: 'Please provide the required Today information.',
        'not-found': 'The requested Action was not found.',
        'invalid-transition': 'That Action cannot be selected for Today in its current state.',
        'invariant-violation': 'The requested Today relationship is not available.'
      }
      return fail(error.code, messages[error.code])
    }
    return fail('persistence-failed', 'MyTracer could not save or load Today.')
  }
}

function oneObject(
  args: readonly unknown[],
  allowedKeys: readonly string[]
): Record<string, unknown> {
  if (args.length !== 1 || !args[0] || typeof args[0] !== 'object' || Array.isArray(args[0])) {
    throw new TodayIpcValidationError('Expected one input object.')
  }
  const record = args[0] as Record<string, unknown>
  if (Object.keys(record).some((key) => !allowedKeys.includes(key))) {
    throw new TodayIpcValidationError('Unexpected input field.')
  }
  return record
}

function requiredId(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new TodayIpcValidationError('Expected a UUID v4 identifier.')
  }
  return value
}

function parseActionId(args: readonly unknown[]): ActionIdInputDto {
  const record = oneObject(args, ['actionId'])
  return { actionId: requiredId(record.actionId) }
}

function parseGet(args: readonly unknown[]): GetTodayInputDto {
  oneObject(args, [])
  return {}
}

export function registerTodayIpc(options: RegisterTodayIpcOptions): void {
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

  register(TODAY_CHANNELS.selectAction, parseActionId, (input: ActionIdInputDto) =>
    options.service.selectActionForToday(input.actionId)
  )
  register(TODAY_CHANNELS.removeAction, parseActionId, (input: ActionIdInputDto) =>
    options.service.removeActionFromToday(input.actionId)
  )
  register(TODAY_CHANNELS.get, parseGet, () => options.service.getToday())
}
