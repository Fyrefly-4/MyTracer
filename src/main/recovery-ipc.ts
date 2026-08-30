import type { IpcMainInvokeEvent } from 'electron'
import { RecoveryApplicationError, type RecoveryService } from '../application/recovery'
import {
  RECOVERY_CHANNELS,
  type GetRecoveryContextInputDto,
  type RecoveryErrorCode,
  type RecoveryResult
} from '../contracts/recovery'

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown
export interface RecoveryIpcMain {
  removeHandler(channel: string): void
  handle(channel: string, listener: Handler): void
}
export interface RegisterRecoveryIpcOptions {
  readonly ipc: RecoveryIpcMain
  readonly service: RecoveryService
  readonly assertSender: (event: IpcMainInvokeEvent) => void
}
class RecoveryIpcValidationError extends Error {}

function fail<T>(code: RecoveryErrorCode, message: string): RecoveryResult<T> {
  return Object.freeze({ ok: false, error: Object.freeze({ code, message }) })
}
function requiredUuid(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new RecoveryIpcValidationError('Expected a UUID v4 identifier.')
  }
  return value
}
function parseGet(args: readonly unknown[]): GetRecoveryContextInputDto {
  if (args.length !== 1 || !args[0] || typeof args[0] !== 'object' || Array.isArray(args[0])) {
    throw new RecoveryIpcValidationError('Expected one input object.')
  }
  const record = args[0] as Record<string, unknown>
  if (Object.keys(record).some((key) => key !== 'goalId')) {
    throw new RecoveryIpcValidationError('Unexpected input field.')
  }
  return { goalId: requiredUuid(record.goalId) }
}
function execute<T>(work: () => T): RecoveryResult<T> {
  try {
    return Object.freeze({ ok: true, value: work() })
  } catch (error) {
    if (error instanceof RecoveryIpcValidationError)
      return fail('validation', 'The Recovery request was invalid.')
    if (error instanceof RecoveryApplicationError) {
      return fail(
        error.code,
        error.code === 'not-found'
          ? 'The requested Goal was not found.'
          : 'The Recovery request was invalid.'
      )
    }
    return fail('persistence-failed', 'MyTracer could not load Recovery facts.')
  }
}

export function registerRecoveryIpc(options: RegisterRecoveryIpcOptions): void {
  options.ipc.removeHandler(RECOVERY_CHANNELS.getContext)
  options.ipc.handle(RECOVERY_CHANNELS.getContext, (event, ...args) => {
    options.assertSender(event)
    return execute(() => options.service.getContext(parseGet(args)))
  })
}
