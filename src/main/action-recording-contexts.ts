import type { RecordActionValueDto } from '../contracts/records'

type SavedFirstResult = Extract<RecordActionValueDto, { readonly kind: 'saved' }>

export interface ActionRecordingContext {
  readonly savedFirstResult?: SavedFirstResult
  readonly firstRecord?: boolean
  readonly operationId: string
  readonly id: string
  readonly senderId: number
  readonly actionId: string
  readonly capturedOn: string
}

export class InvalidActionRecordingContextError extends Error {
  public constructor() {
    super('The recording context is invalid or no longer available.')
    this.name = 'InvalidActionRecordingContextError'
  }
}

export class ActionRecordingContextStore {
  private readonly contexts = new Map<string, ActionRecordingContext>()

  public constructor(private readonly generateId: () => string) {}

  public begin(
    senderId: number,
    actionId: string,
    capturedOn: string,
    firstRecord = false,
    operationId?: string
  ): ActionRecordingContext {
    for (const [id, context] of this.contexts) {
      if (
        context.senderId === senderId &&
        context.actionId === actionId &&
        Boolean(context.firstRecord) === firstRecord
      ) {
        this.contexts.delete(id)
      }
    }
    const id = this.generateId()
    const context = Object.freeze({
      id,
      operationId: operationId ?? id,
      senderId,
      actionId,
      capturedOn,
      firstRecord
    })
    this.contexts.set(context.id, context)
    return context
  }

  public require(senderId: number, actionId: string, contextId: string): ActionRecordingContext {
    const context = this.contexts.get(contextId)
    if (!context || context.senderId !== senderId || context.actionId !== actionId) {
      throw new InvalidActionRecordingContextError()
    }
    return context
  }

  public rememberFirstResult(
    senderId: number,
    actionId: string,
    contextId: string,
    result: SavedFirstResult
  ): void {
    const context = this.require(senderId, actionId, contextId)
    if (!context.firstRecord) throw new InvalidActionRecordingContextError()
    this.contexts.set(contextId, Object.freeze({ ...context, savedFirstResult: result }))
  }

  public requireSender(senderId: number, contextId: string): ActionRecordingContext {
    const context = this.contexts.get(contextId)
    if (!context || context.senderId !== senderId) throw new InvalidActionRecordingContextError()
    return context
  }

  public cancel(senderId: number, contextId: string): void {
    const context = this.contexts.get(contextId)
    if (!context || context.senderId !== senderId) {
      throw new InvalidActionRecordingContextError()
    }
    this.contexts.delete(contextId)
  }

  public consume(senderId: number, actionId: string, contextId: string): void {
    this.require(senderId, actionId, contextId)
    this.contexts.delete(contextId)
  }

  public clearSender(senderId: number): void {
    for (const [id, context] of this.contexts) {
      if (context.senderId === senderId) this.contexts.delete(id)
    }
  }

  public clearAll(): void {
    this.contexts.clear()
  }
}
