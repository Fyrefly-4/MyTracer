import type { DeleteTarget } from '../domain/data-control'

export class InvalidDeletePreviewContextError extends Error {
  public constructor() {
    super('Delete preview context is invalid or no longer active.')
    this.name = 'InvalidDeletePreviewContextError'
  }
}

interface DeletePreviewContext {
  readonly id: string
  readonly senderId: number
  readonly target: DeleteTarget
  readonly fingerprint: string
  readonly generatedAt: string
}

const targetKey = (senderId: number, target: DeleteTarget) =>
  `${senderId}:${target.type}:${target.id}`

export class DeletePreviewContextStore {
  private readonly contexts = new Map<string, DeletePreviewContext>()
  private readonly activeByTarget = new Map<string, string>()

  public constructor(private readonly generateId: () => string) {}

  public begin(
    senderId: number,
    target: DeleteTarget,
    fingerprint: string,
    generatedAt: string
  ): DeletePreviewContext {
    const key = targetKey(senderId, target)
    const previousId = this.activeByTarget.get(key)
    if (previousId) this.contexts.delete(previousId)
    const context = Object.freeze({
      id: this.generateId(),
      senderId,
      target: Object.freeze({ ...target }),
      fingerprint,
      generatedAt
    })
    this.contexts.set(context.id, context)
    this.activeByTarget.set(key, context.id)
    return context
  }

  public consume(senderId: number, previewId: string, target: DeleteTarget): DeletePreviewContext {
    const context = this.contexts.get(previewId)
    if (
      !context ||
      context.senderId !== senderId ||
      context.target.type !== target.type ||
      context.target.id !== target.id
    ) {
      throw new InvalidDeletePreviewContextError()
    }
    this.remove(context)
    return context
  }

  public cancel(senderId: number, previewId: string): void {
    const context = this.contexts.get(previewId)
    if (!context || context.senderId !== senderId) {
      throw new InvalidDeletePreviewContextError()
    }
    this.remove(context)
  }

  public clearSender(senderId: number): void {
    for (const context of this.contexts.values()) {
      if (context.senderId === senderId) this.remove(context)
    }
  }

  public clearAll(): void {
    this.contexts.clear()
    this.activeByTarget.clear()
  }

  private remove(context: DeletePreviewContext): void {
    this.contexts.delete(context.id)
    const key = targetKey(context.senderId, context.target)
    if (this.activeByTarget.get(key) === context.id) this.activeByTarget.delete(key)
  }
}
