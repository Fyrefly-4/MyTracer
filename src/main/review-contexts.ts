import type { ReviewPeriod } from '../application/review'

export class InvalidReviewContextError extends Error {
  public constructor() {
    super('Review context is invalid.')
    this.name = 'InvalidReviewContextError'
  }
}

export class StaleReviewContextError extends Error {
  public constructor() {
    super('Review context is stale.')
    this.name = 'StaleReviewContextError'
  }
}

export interface ReviewContext extends ReviewPeriod {
  readonly id: string
  readonly senderId: number
}

export class ReviewContextStore {
  private readonly contexts = new Map<string, ReviewContext>()
  private readonly activeBySender = new Map<number, string>()
  private readonly staleIds = new Set<string>()

  public constructor(private readonly generateId: () => string) {}

  public begin(senderId: number, period: ReviewPeriod): ReviewContext {
    const previousId = this.activeBySender.get(senderId)
    if (previousId) this.invalidate(previousId)
    const context = Object.freeze({ id: this.generateId(), senderId, ...period })
    this.contexts.set(context.id, context)
    this.activeBySender.set(senderId, context.id)
    return context
  }

  public get(senderId: number, contextId: string): ReviewContext {
    if (this.staleIds.has(contextId)) throw new StaleReviewContextError()
    const context = this.contexts.get(contextId)
    if (!context || context.senderId !== senderId) throw new InvalidReviewContextError()
    return context
  }

  public cancel(senderId: number, contextId: string): void {
    this.get(senderId, contextId)
    this.invalidate(contextId)
  }

  public consume(senderId: number, contextId: string): void {
    this.get(senderId, contextId)
    this.invalidate(contextId)
  }

  public clearSender(senderId: number): void {
    for (const context of this.contexts.values()) {
      if (context.senderId === senderId) this.invalidate(context.id)
    }
  }

  public clearAll(): void {
    this.contexts.clear()
    this.activeBySender.clear()
    this.staleIds.clear()
  }

  private invalidate(contextId: string): void {
    const context = this.contexts.get(contextId)
    if (!context) return
    this.contexts.delete(contextId)
    if (this.activeBySender.get(context.senderId) === contextId) {
      this.activeBySender.delete(context.senderId)
    }
    this.staleIds.add(contextId)
  }
}
