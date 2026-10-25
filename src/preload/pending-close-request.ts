/** Keep Main's latest close/cancel request until the renderer subscribes. */
export class PendingCloseRequest {
  private latest: string | undefined
  private readonly listeners = new Set<(requestId: string) => void>()
  receive(requestId: string): void {
    this.latest = requestId
    for (const listener of this.listeners) listener(requestId)
  }
  subscribe(listener: (requestId: string) => void): () => void {
    this.listeners.add(listener)
    if (this.latest !== undefined) listener(this.latest)
    return () => {
      this.listeners.delete(listener)
    }
  }
}
