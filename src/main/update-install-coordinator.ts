import type { UpdateService } from '../application/update-service'
import type {
  DownloadUpdateInputDto,
  InstallPreparationResultDto,
  UpdateStatusDto
} from '../contracts/updates'

type DraftProbeResult = 'clear' | 'unsaved' | 'unavailable'

interface InstallGate {
  beginPreparation(): boolean
  drain(signal: AbortSignal): Promise<boolean>
  cancelPreparation(): boolean
  seal(): boolean
}

export class UpdateInstallCoordinator {
  private controller: AbortController | null = null
  private operationId: string | null = null
  private databaseClosed = false

  constructor(
    private readonly options: {
      readonly service: UpdateService
      readonly gate: InstallGate
      readonly probeDrafts: () => Promise<DraftProbeResult>
      readonly hasPendingAiDraft: () => boolean
      readonly cancelAiRequests: () => void
      readonly closeDatabase: () => void
      readonly quitApplication: () => void
      readonly drainDeadlineMs?: number
    }
  ) {}

  async install(input: DownloadUpdateInputDto): Promise<InstallPreparationResultDto> {
    if (this.controller || this.databaseClosed) {
      return this.result(this.databaseClosed ? 'restart-required' : 'busy')
    }
    if (
      this.options.service.getStatus().state !== 'downloaded' ||
      this.options.service.getStatus().operationId !== input.operationId ||
      this.options.service.getStatus().candidate?.version !== input.version
    ) {
      return this.result()
    }
    const controller = new AbortController()
    this.controller = controller
    this.operationId = input.operationId
    const timer = setTimeout(
      () => controller.abort('timeout'),
      this.options.drainDeadlineMs ?? 15_000
    )
    try {
      const initialDrafts = await this.awaitStep(this.probe(), controller.signal)
      if (initialDrafts === null) return this.cancelAndResult(input, this.abortBlocker(controller))
      if (initialDrafts !== 'clear') return this.result(initialDrafts)
      if (controller.signal.aborted)
        return this.cancelAndResult(input, this.abortBlocker(controller))

      const prepared = await this.awaitStep(
        this.options.service.prepareInstall(input),
        controller.signal
      )
      if (prepared === null) return this.cancelAndResult(input, this.abortBlocker(controller))
      if (prepared.state !== 'preparing') return this.result()
      if (controller.signal.aborted)
        return this.cancelAndResult(input, this.abortBlocker(controller))
      if (!this.options.gate.beginPreparation()) return this.cancelAndResult(input, 'busy')

      // The preparing state is broadcast before the second probe so the Renderer can lock editing.
      const finalDrafts = await this.awaitStep(this.probe(), controller.signal)
      if (finalDrafts === null) return this.cancelAndResult(input, this.abortBlocker(controller))
      if (finalDrafts !== 'clear') return this.cancelAndResult(input, finalDrafts)
      if (controller.signal.aborted)
        return this.cancelAndResult(input, this.abortBlocker(controller))

      this.options.cancelAiRequests()
      const drained = await this.options.gate.drain(controller.signal)
      if (!drained || !this.options.gate.seal()) {
        return this.cancelAndResult(
          input,
          controller.signal.aborted ? this.abortBlocker(controller) : 'busy'
        )
      }

      this.databaseClosed = true
      this.options.closeDatabase()
      const installed = await this.awaitStep(
        this.options.service.confirmInstall(input),
        controller.signal
      )
      if (installed === null) return this.restartRequiredResult()
      if (installed.state !== 'installing') return this.restartRequiredResult()
      setImmediate(() => this.options.quitApplication())
      return this.result()
    } catch {
      if (this.databaseClosed) return this.restartRequiredResult()
      return this.cancelAndResult(input, 'busy')
    } finally {
      clearTimeout(timer)
      if (this.controller === controller) {
        this.controller = null
        this.operationId = null
      }
    }
  }

  private abortBlocker(controller: AbortController): 'timeout' | 'cancelled' {
    return controller.signal.reason === 'timeout' ? 'timeout' : 'cancelled'
  }

  private restartRequiredResult(): InstallPreparationResultDto {
    this.options.service.requireRestart()
    return this.result('restart-required')
  }

  private async awaitStep<T>(work: Promise<T>, signal: AbortSignal): Promise<T | null> {
    if (signal.aborted) return null
    return new Promise<T | null>((resolve, reject) => {
      const abort = (): void => resolve(null)
      signal.addEventListener('abort', abort, { once: true })
      void work.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
    })
  }

  cancelPreparation(input: { readonly operationId: string }): UpdateStatusDto {
    if (this.operationId !== input.operationId || this.databaseClosed) {
      return this.options.service.getStatus()
    }
    this.controller?.abort('cancelled')
    this.options.gate.cancelPreparation()
    return this.options.service.cancelPreparation(input)
  }

  private async probe(): Promise<
    Exclude<InstallPreparationResultDto['blocker'], undefined> | 'clear'
  > {
    if (this.options.hasPendingAiDraft()) return 'unsaved-content'
    const result = await this.options.probeDrafts()
    return result === 'unsaved'
      ? 'unsaved-content'
      : result === 'unavailable'
        ? 'renderer-unavailable'
        : 'clear'
  }

  private cancelAndResult(
    input: DownloadUpdateInputDto,
    blocker: Exclude<InstallPreparationResultDto['blocker'], undefined>
  ): InstallPreparationResultDto {
    this.options.gate.cancelPreparation()
    this.options.service.cancelPreparation(input)
    return this.result(blocker)
  }

  private result(blocker?: InstallPreparationResultDto['blocker']): InstallPreparationResultDto {
    return {
      status: this.options.service.getStatus(),
      ...(blocker ? { blocker } : {})
    }
  }
}
