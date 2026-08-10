import type { IpcMainInvokeEvent } from 'electron'
import { ActionApplicationError, type ActionService } from '../application/actions'
import {
  ACTION_CHANNELS,
  type ActionErrorCode,
  type ActionIdInputDto,
  type ActionResult,
  type CreateActionInputDto,
  type CurrentNextResolutionDto,
  type TransitionActionInputDto,
  type UpdateActionDetailsInputDto
} from '../contracts/actions'

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown

export interface ActionIpcMain {
  removeHandler(channel: string): void
  handle(channel: string, listener: Handler): void
}

export interface RegisterActionIpcOptions {
  readonly ipc: ActionIpcMain
  readonly service: ActionService
  readonly assertSender: (event: IpcMainInvokeEvent) => void
}

class ActionIpcValidationError extends Error {}

function fail<T>(code: ActionErrorCode, message: string): ActionResult<T> {
  return Object.freeze({ ok: false, error: Object.freeze({ code, message }) })
}

function execute<T>(work: () => T): ActionResult<T> {
  try {
    return Object.freeze({ ok: true, value: work() })
  } catch (error) {
    if (error instanceof ActionIpcValidationError) {
      return fail('validation', 'The Action request was invalid.')
    }
    if (error instanceof ActionApplicationError) {
      const messages: Record<ActionApplicationError['code'], string> = {
        validation: 'Please provide the required Action information.',
        'not-found': 'The requested Action or Goal was not found.',
        'invalid-transition': 'That Action change is not available in its current state.',
        'invariant-violation': 'The requested Action relationship is not available.'
      }
      return fail(error.code, messages[error.code])
    }
    return fail('persistence-failed', 'MyTracer could not save or load the Action.')
  }
}

function oneArgument(args: readonly unknown[]): unknown {
  if (args.length !== 1) throw new ActionIpcValidationError('Expected one input object.')
  return args[0]
}

function objectWithKeys(value: unknown, allowedKeys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ActionIpcValidationError('Expected an object.')
  }
  const record = value as Record<string, unknown>
  if (Object.keys(record).some((key) => !allowedKeys.includes(key))) {
    throw new ActionIpcValidationError('Unexpected input field.')
  }
  return record
}

function requiredString(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ActionIpcValidationError('Expected non-blank text.')
  }
  return value
}

function optionalString(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return value
  if (typeof value !== 'string') throw new ActionIpcValidationError('Expected optional text.')
  return value
}

function requiredId(value: unknown): string {
  const id = requiredString(value)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new ActionIpcValidationError('Expected a UUID v4 identifier.')
  }
  return id
}

function optionalId(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return value
  return requiredId(value)
}

function parseCreate(args: readonly unknown[]): CreateActionInputDto {
  const record = objectWithKeys(oneArgument(args), ['goalId', 'title', 'description'])
  return {
    goalId: optionalId(record.goalId),
    title: requiredString(record.title),
    description: optionalString(record.description)
  }
}

function parseUpdate(args: readonly unknown[]): UpdateActionDetailsInputDto {
  const record = objectWithKeys(oneArgument(args), ['actionId', 'title', 'description'])
  return {
    actionId: requiredId(record.actionId),
    title: requiredString(record.title),
    description: optionalString(record.description)
  }
}

function parseActionId(args: readonly unknown[]): ActionIdInputDto {
  const record = objectWithKeys(oneArgument(args), ['actionId'])
  return { actionId: requiredId(record.actionId) }
}

function parseResolution(value: unknown): CurrentNextResolutionDto | undefined {
  if (value === undefined) return undefined
  const base = objectWithKeys(value, ['kind', 'actionId', 'title', 'description'])
  if (base.kind === 'clear') {
    objectWithKeys(value, ['kind'])
    return { kind: 'clear' }
  }
  if (base.kind === 'use-existing') {
    objectWithKeys(value, ['kind', 'actionId'])
    return { kind: 'use-existing', actionId: requiredId(base.actionId) }
  }
  if (base.kind === 'create-and-use') {
    objectWithKeys(value, ['kind', 'title', 'description'])
    return {
      kind: 'create-and-use',
      title: requiredString(base.title),
      description: optionalString(base.description)
    }
  }
  throw new ActionIpcValidationError('Invalid current next resolution.')
}

function parseTransition(args: readonly unknown[]): TransitionActionInputDto {
  const record = objectWithKeys(oneArgument(args), ['actionId', 'currentNextResolution'])
  return {
    actionId: requiredId(record.actionId),
    currentNextResolution: parseResolution(record.currentNextResolution)
  }
}

export function registerActionIpc(options: RegisterActionIpcOptions): void {
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

  register(ACTION_CHANNELS.create, parseCreate, (input: CreateActionInputDto) =>
    options.service.createAction(input)
  )
  register(ACTION_CHANNELS.updateDetails, parseUpdate, (input: UpdateActionDetailsInputDto) =>
    options.service.updateActionDetails(input)
  )
  register(ACTION_CHANNELS.complete, parseTransition, (input: TransitionActionInputDto) =>
    options.service.completeAction(input)
  )
  register(ACTION_CHANNELS.cancel, parseTransition, (input: TransitionActionInputDto) =>
    options.service.cancelAction(input)
  )
  register(ACTION_CHANNELS.reschedule, parseTransition, (input: TransitionActionInputDto) =>
    options.service.rescheduleAction(input)
  )
  register(ACTION_CHANNELS.getDetail, parseActionId, (input: ActionIdInputDto) =>
    options.service.getActionDetail(input.actionId)
  )
}
