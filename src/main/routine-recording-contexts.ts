export interface RoutineRecordingContext {
  readonly id: string
  readonly senderId: number
  readonly routineId: string
  readonly capturedOn: string
}

export class InvalidRoutineRecordingContextError extends Error {
  public constructor() {
    super('The Routine recording context is invalid or no longer available.')
    this.name = 'InvalidRoutineRecordingContextError'
  }
}

export class RoutineRecordingContextStore {
  private readonly contexts = new Map<string, RoutineRecordingContext>()

  public constructor(private readonly generateId: () => string) {}

  public begin(senderId: number, routineId: string, capturedOn: string): RoutineRecordingContext {
    for (const [id, context] of this.contexts) {
      if (context.senderId === senderId && context.routineId === routineId) {
        this.contexts.delete(id)
      }
    }
    const context = Object.freeze({ id: this.generateId(), senderId, routineId, capturedOn })
    this.contexts.set(context.id, context)
    return context
  }

  public require(senderId: number, routineId: string, contextId: string): RoutineRecordingContext {
    const context = this.contexts.get(contextId)
    if (!context || context.senderId !== senderId || context.routineId !== routineId) {
      throw new InvalidRoutineRecordingContextError()
    }
    return context
  }

  public cancel(senderId: number, contextId: string): void {
    const context = this.contexts.get(contextId)
    if (!context || context.senderId !== senderId) {
      throw new InvalidRoutineRecordingContextError()
    }
    this.contexts.delete(contextId)
  }

  public consume(senderId: number, routineId: string, contextId: string): void {
    this.require(senderId, routineId, contextId)
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
