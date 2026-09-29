export class InstallOperationGate {
  private phase: 'open' | 'preparing' | 'closed' = 'open'
  private readonly pending = new Set<Promise<unknown>>()

  get state(): 'open' | 'preparing' | 'closed' {
    return this.phase
  }

  run<T>(operation: () => T): T {
    if (this.phase !== 'open') {
      throw new Error('Application commands are unavailable while installation is preparing.')
    }
    const result = operation()
    if (result && typeof result === 'object' && 'then' in result) {
      const pending = Promise.resolve(result)
      this.pending.add(pending)
      void pending.then(
        () => this.pending.delete(pending),
        () => this.pending.delete(pending)
      )
    }
    return result
  }

  beginPreparation(): boolean {
    if (this.phase !== 'open') return false
    this.phase = 'preparing'
    return true
  }

  async drain(signal: AbortSignal): Promise<boolean> {
    if (this.phase !== 'preparing' || signal.aborted) return false
    const pending = Promise.allSettled([...this.pending])
    return Promise.race([
      pending.then(() => !signal.aborted && this.phase === 'preparing'),
      new Promise<boolean>((resolve) => {
        signal.addEventListener('abort', () => resolve(false), { once: true })
      })
    ])
  }

  cancelPreparation(): boolean {
    if (this.phase !== 'preparing') return false
    this.phase = 'open'
    return true
  }

  seal(): boolean {
    if (this.phase !== 'preparing' || this.pending.size > 0) return false
    this.phase = 'closed'
    return true
  }
}
