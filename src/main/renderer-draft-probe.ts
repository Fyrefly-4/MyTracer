export type DraftProbeResult = 'clear' | 'unsaved' | 'unavailable'

export class RendererDraftProbe {
  private readonly pending = new Map<string, (result: DraftProbeResult) => void>()

  constructor(
    private readonly options: {
      readonly sendRequest: (requestId: string) => boolean
      readonly generateId: () => string
      readonly deadlineMs?: number
    }
  ) {}

  request(): Promise<DraftProbeResult> {
    const requestId = this.options.generateId()
    return new Promise<DraftProbeResult>((resolve) => {
      const timer = setTimeout(
        () => this.reply({ requestId, hasUnsavedContent: null }),
        this.options.deadlineMs ?? 3_000
      )
      this.pending.set(requestId, (result) => {
        clearTimeout(timer)
        this.pending.delete(requestId)
        resolve(result)
      })
      try {
        if (!this.options.sendRequest(requestId)) {
          this.reply({ requestId, hasUnsavedContent: null })
        }
      } catch {
        this.reply({ requestId, hasUnsavedContent: null })
      }
    })
  }

  reply(input: { readonly requestId: string; readonly hasUnsavedContent: boolean | null }): void {
    this.pending.get(input.requestId)?.(
      input.hasUnsavedContent === null
        ? 'unavailable'
        : input.hasUnsavedContent
          ? 'unsaved'
          : 'clear'
    )
  }

  clear(): void {
    for (const resolve of this.pending.values()) resolve('unavailable')
  }
}
