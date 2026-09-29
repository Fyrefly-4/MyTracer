import type { UpdateFailureCode, UpdateStatusDto } from '../contracts/updates'
import { UpdatePortError, type CheckedUpdate, type UpdatePort } from './ports/update'

function parseStableVersion(value: string): readonly bigint[] | null {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value)
  return match ? [BigInt(match[1]), BigInt(match[2]), BigInt(match[3])] : null
}

function compareStableVersions(left: string, right: string): number | null {
  const a = parseStableVersion(left)
  const b = parseStableVersion(right)
  if (!a || !b) return null
  for (let i = 0; i < 3; i += 1) {
    if (a[i] > b[i]) return 1
    if (a[i] < b[i]) return -1
  }
  return 0
}

function failureCode(error: unknown, signal: AbortSignal): UpdateFailureCode {
  if (signal.aborted) return signal.reason === 'timeout' ? 'timeout' : 'cancelled'
  return error instanceof UpdatePortError ? error.code : 'internal'
}

function withDeadline<T>(
  action: (signal: AbortSignal) => Promise<T>,
  controller: AbortController,
  deadlineMs: number
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  let rejectOnAbort: ((reason: UpdatePortError) => void) | undefined
  const onAbort = (): void => rejectOnAbort?.(new UpdatePortError('cancelled'))
  const cancelled = new Promise<never>((_resolve, reject) => {
    rejectOnAbort = reject
    controller.signal.addEventListener('abort', onAbort, { once: true })
  })
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort('timeout')
      reject(new UpdatePortError('timeout'))
    }, deadlineMs)
  })
  const work = action(controller.signal)
  return Promise.race([work, timeout, cancelled]).finally(() => {
    clearTimeout(timer)
    controller.signal.removeEventListener('abort', onAbort)
  })
}

export class UpdateService {
  private status: UpdateStatusDto
  private candidate: CheckedUpdate | null = null
  private controller: AbortController | null = null
  private generation = 0
  private readonly listeners = new Set<(status: UpdateStatusDto) => void>()

  constructor(
    private readonly options: {
      readonly port: UpdatePort
      readonly currentVersion: string
      readonly generateId: () => string
      readonly checkDeadlineMs?: number
      readonly downloadDeadlineMs?: number
    }
  ) {
    this.status = Object.freeze({ state: 'idle', currentVersion: options.currentVersion })
  }

  getStatus(): UpdateStatusDto {
    return this.status
  }

  subscribe(listener: (status: UpdateStatusDto) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async check(): Promise<UpdateStatusDto> {
    if (this.isBusy()) return this.status
    this.controller?.abort('superseded')
    this.candidate = null
    const generation = ++this.generation
    const controller = new AbortController()
    this.controller = controller
    const operationId = this.options.generateId()
    this.publish({ state: 'checking', currentVersion: this.options.currentVersion, operationId })
    try {
      const candidate = await withDeadline(
        (signal) => this.options.port.check(signal),
        controller,
        this.options.checkDeadlineMs ?? 120_000
      )
      if (generation !== this.generation) return this.status
      const comparison = compareStableVersions(candidate.version, this.options.currentVersion)
      if (comparison === null || comparison < 0) {
        throw new UpdatePortError('unsupported-version')
      }
      if (comparison === 0) {
        this.publish({
          state: 'upToDate',
          currentVersion: this.options.currentVersion,
          operationId
        })
      } else {
        this.candidate = candidate
        this.publish({
          state: 'available',
          currentVersion: this.options.currentVersion,
          operationId,
          candidate: { version: candidate.version, releaseNotes: candidate.releaseNotes }
        })
      }
    } catch (error) {
      if (generation !== this.generation) return this.status
      const code = failureCode(error, controller.signal)
      this.publish({
        state: 'error',
        currentVersion: this.options.currentVersion,
        operationId,
        error: { code, retryable: code !== 'unsupported-version', retryAction: 'check' }
      })
    } finally {
      if (generation === this.generation) this.controller = null
    }
    return this.status
  }

  async download(input: {
    readonly operationId: string
    readonly version: string
  }): Promise<UpdateStatusDto> {
    if (this.isBusy()) return this.status
    if (
      !this.candidate ||
      this.status.operationId !== input.operationId ||
      this.candidate.version !== input.version ||
      (this.status.state !== 'available' &&
        !(this.status.state === 'error' && this.status.error?.retryAction === 'download'))
    ) {
      return this.status
    }
    const candidate = this.candidate
    const generation = ++this.generation
    const controller = new AbortController()
    this.controller = controller
    this.publish({
      state: 'downloading',
      currentVersion: this.options.currentVersion,
      operationId: input.operationId,
      candidate: { version: candidate.version, releaseNotes: candidate.releaseNotes },
      progressPercent: 0
    })
    try {
      await withDeadline(
        (signal) =>
          candidate.download(signal, (percent) => {
            if (generation !== this.generation || signal.aborted) return
            if (!Number.isFinite(percent)) return
            this.publish({ ...this.status, progressPercent: Math.max(0, Math.min(100, percent)) })
          }),
        controller,
        this.options.downloadDeadlineMs ?? 30 * 60_000
      )
      if (generation !== this.generation) return this.status
      this.publish({
        state: 'downloaded',
        currentVersion: this.options.currentVersion,
        operationId: input.operationId,
        candidate: { version: candidate.version, releaseNotes: candidate.releaseNotes },
        progressPercent: 100
      })
    } catch (error) {
      if (generation !== this.generation) return this.status
      const code = failureCode(error, controller.signal)
      this.publish({
        state: 'error',
        currentVersion: this.options.currentVersion,
        operationId: input.operationId,
        candidate: { version: candidate.version, releaseNotes: candidate.releaseNotes },
        error: { code, retryable: true, retryAction: 'download' }
      })
    } finally {
      if (generation === this.generation) this.controller = null
    }
    return this.status
  }

  cancel(input: { readonly operationId: string }): UpdateStatusDto {
    if (input.operationId !== this.status.operationId || !this.isBusy()) return this.status
    const wasDownloading = this.status.state === 'downloading'
    ++this.generation
    this.controller?.abort('cancelled')
    this.controller = null
    this.publish({
      state: 'error',
      currentVersion: this.options.currentVersion,
      operationId: input.operationId,
      ...(wasDownloading && this.status.candidate ? { candidate: this.status.candidate } : {}),
      error: {
        code: 'cancelled',
        retryable: true,
        retryAction: wasDownloading ? 'download' : 'check'
      }
    })
    return this.status
  }

  private isBusy(): boolean {
    return this.status.state === 'checking' || this.status.state === 'downloading'
  }

  private publish(status: UpdateStatusDto): void {
    this.status = Object.freeze(status)
    for (const listener of this.listeners) listener(this.status)
  }
}
