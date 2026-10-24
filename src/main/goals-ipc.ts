import type { IpcMainInvokeEvent } from 'electron'
import { GoalApplicationError, type GoalService } from '../application/goals'
import {
  GOAL_CHANNELS,
  type CreateAndSetGoalCurrentNextActionInputDto,
  type CreateGoalInputDto,
  type CreateGoalStageInputDto,
  type GoalErrorCode,
  type GoalIdInputDto,
  type GoalResult,
  type GoalStatusDto,
  type ListGoalsInputDto,
  type SetGoalCurrentNextActionInputDto,
  type UpdateGoalDetailsInputDto
} from '../contracts/goals'

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown

export interface GoalIpcMain {
  removeHandler(channel: string): void
  handle(channel: string, listener: Handler): void
}

export interface RegisterGoalIpcOptions {
  readonly ipc: GoalIpcMain
  readonly service: GoalService
  readonly assertSender: (event: IpcMainInvokeEvent) => void
}

class GoalIpcValidationError extends Error {}

function fail<T>(code: GoalErrorCode, message: string): GoalResult<T> {
  return Object.freeze({ ok: false, error: Object.freeze({ code, message }) })
}

function execute<T>(work: () => T): GoalResult<T> {
  try {
    return Object.freeze({ ok: true, value: work() })
  } catch (error) {
    if (error instanceof GoalIpcValidationError) {
      return fail('validation', 'The Goal request was invalid.')
    }
    if (error instanceof GoalApplicationError) {
      const messages: Record<GoalApplicationError['code'], string> = {
        validation: 'Please provide the required Goal information.',
        'not-found': 'The requested Goal or Action was not found.',
        'invalid-transition': 'That Goal change is not available in its current state.',
        'invariant-violation': 'The selected next action is not available for this Goal.'
      }
      return fail(error.code, messages[error.code])
    }
    return fail('persistence-failed', 'MyTracer could not save or load the Goal.')
  }
}

function oneArgument(args: readonly unknown[]): unknown {
  if (args.length !== 1) {
    throw new GoalIpcValidationError('Expected one input object.')
  }
  return args[0]
}

function objectWithKeys(value: unknown, allowedKeys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new GoalIpcValidationError('Expected an object.')
  }
  const record = value as Record<string, unknown>
  if (Object.keys(record).some((key) => !allowedKeys.includes(key))) {
    throw new GoalIpcValidationError('Unexpected input field.')
  }
  return record
}

function requiredString(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new GoalIpcValidationError('Expected non-blank text.')
  }
  return value
}

function requiredId(value: unknown): string {
  const id = requiredString(value)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new GoalIpcValidationError('Expected a UUID v4 identifier.')
  }
  return id
}

function optionalString(value: unknown): string | null | undefined {
  if (value === undefined || value === null) {
    return value
  }
  if (typeof value !== 'string') {
    throw new GoalIpcValidationError('Expected optional text.')
  }
  return value
}

function parseCreate(args: readonly unknown[]): CreateGoalInputDto {
  const record = objectWithKeys(oneArgument(args), ['name', 'description', 'initialNextAction'])
  const initial = record.initialNextAction
  let initialNextAction: CreateGoalInputDto['initialNextAction']
  if (initial === undefined || initial === null) {
    initialNextAction = initial
  } else {
    const action = objectWithKeys(initial, ['title', 'description'])
    initialNextAction = {
      title: requiredString(action.title),
      description: optionalString(action.description)
    }
  }
  return {
    name: requiredString(record.name),
    description: optionalString(record.description),
    initialNextAction
  }
}

function parseCreateStage(args: readonly unknown[]): CreateGoalStageInputDto {
  const record = objectWithKeys(oneArgument(args), [
    'goalId',
    'predecessorGoalId',
    'name',
    'description'
  ])
  return {
    goalId: requiredId(record.goalId),
    predecessorGoalId: requiredId(record.predecessorGoalId),
    name: requiredString(record.name),
    description: optionalString(record.description)
  }
}

function parseUpdate(args: readonly unknown[]): UpdateGoalDetailsInputDto {
  const record = objectWithKeys(oneArgument(args), ['goalId', 'name', 'description'])
  return {
    goalId: requiredId(record.goalId),
    name: requiredString(record.name),
    description: optionalString(record.description)
  }
}

function parseGoalId(args: readonly unknown[]): GoalIdInputDto {
  const record = objectWithKeys(oneArgument(args), ['goalId'])
  return { goalId: requiredId(record.goalId) }
}

function parseSetCurrent(args: readonly unknown[]): SetGoalCurrentNextActionInputDto {
  const record = objectWithKeys(oneArgument(args), ['goalId', 'actionId'])
  return {
    goalId: requiredId(record.goalId),
    actionId: record.actionId === null ? null : requiredId(record.actionId)
  }
}

function parseCreateAndSetCurrent(
  args: readonly unknown[]
): CreateAndSetGoalCurrentNextActionInputDto {
  const record = objectWithKeys(oneArgument(args), ['goalId', 'title', 'description'])
  return {
    goalId: requiredId(record.goalId),
    title: requiredString(record.title),
    description: optionalString(record.description)
  }
}

function parseList(args: readonly unknown[]): ListGoalsInputDto {
  const record = objectWithKeys(oneArgument(args), ['status'])
  const status = record.status
  if (
    status !== undefined &&
    status !== null &&
    status !== 'active' &&
    status !== 'paused' &&
    status !== 'ended'
  ) {
    throw new GoalIpcValidationError('Invalid Goal status.')
  }
  return { status: status as GoalStatusDto | null | undefined }
}

export function registerGoalIpc(options: RegisterGoalIpcOptions): void {
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

  register(GOAL_CHANNELS.createStage, parseCreateStage, (input: CreateGoalStageInputDto) =>
    options.service.createStage(input)
  )
  register(GOAL_CHANNELS.create, parseCreate, (input: CreateGoalInputDto) =>
    options.service.createGoal(input)
  )
  register(GOAL_CHANNELS.updateDetails, parseUpdate, (input: UpdateGoalDetailsInputDto) =>
    options.service.updateGoalDetails(input)
  )
  register(GOAL_CHANNELS.pause, parseGoalId, (input: GoalIdInputDto) =>
    options.service.pauseGoal(input.goalId)
  )
  register(GOAL_CHANNELS.resume, parseGoalId, (input: GoalIdInputDto) =>
    options.service.resumeGoal(input.goalId)
  )
  register(GOAL_CHANNELS.end, parseGoalId, (input: GoalIdInputDto) =>
    options.service.endGoal(input.goalId)
  )
  register(
    GOAL_CHANNELS.setCurrentNextAction,
    parseSetCurrent,
    (input: SetGoalCurrentNextActionInputDto) => options.service.setGoalCurrentNextAction(input)
  )
  register(
    GOAL_CHANNELS.createAndSetCurrentNextAction,
    parseCreateAndSetCurrent,
    (input: CreateAndSetGoalCurrentNextActionInputDto) =>
      options.service.createAndSetGoalCurrentNextAction(input)
  )
  register(GOAL_CHANNELS.list, parseList, (input: ListGoalsInputDto) =>
    options.service.listGoals(input.status ?? undefined)
  )
  register(GOAL_CHANNELS.getDetail, parseGoalId, (input: GoalIdInputDto) =>
    options.service.getGoalDetail(input.goalId)
  )
}
