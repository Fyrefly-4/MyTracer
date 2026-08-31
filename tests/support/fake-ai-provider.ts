import type {
  ProviderCapabilities,
  ProviderRequestOptions
} from '../../src/application/ports/ai-start-help'
import {
  AiProviderError,
  type AiProviderFailureCode
} from '../../src/application/ports/ai-start-help'

export type FakeAiFailureCode = AiProviderFailureCode | 'parse'

export class FakeAiProviderError extends Error {
  public constructor(
    public readonly code: FakeAiFailureCode,
    message: string
  ) {
    super(message)
    this.name = 'FakeAiProviderError'
  }
}

export type FakeAiScript<TDraft> =
  | { readonly kind: 'success'; readonly draft: TDraft }
  | { readonly kind: 'timeout' }
  | { readonly kind: 'cancellation' }
  | { readonly kind: 'authentication-failure'; readonly message?: string }
  | { readonly kind: 'quota-failure'; readonly message?: string }
  | { readonly kind: 'rate-limit-failure'; readonly message?: string }
  | { readonly kind: 'network-failure'; readonly message?: string }
  | { readonly kind: 'provider-unavailable'; readonly message?: string }
  | { readonly kind: 'internal-failure'; readonly message?: string }
  | { readonly kind: 'parse-failure'; readonly message?: string }
  | { readonly kind: 'late-response'; readonly draft: TDraft }
  | { readonly kind: 'fabricated-fact'; readonly draft: TDraft }
  | { readonly kind: 'rest-suggestion'; readonly draft: TDraft }

export interface FakeAiCall<TRequest> {
  readonly request: TRequest
  readonly scriptKind: FakeAiScript<unknown>['kind']
  readonly aborted: boolean
}

export class FakeStartHelpRequestCapture<TRequest> {
  private readonly recordedCalls: TRequest[] = []

  public get calls(): readonly TRequest[] {
    return this.recordedCalls.map((request) => clone(request))
  }

  public captureStartHelpRequest(request: TRequest): void {
    this.recordedCalls.push(clone(request))
  }
}

interface MutableFakeAiCall<TRequest> {
  readonly request: TRequest
  readonly scriptKind: FakeAiScript<unknown>['kind']
  aborted: boolean
}

interface Deferred<T> {
  readonly promise: Promise<T>
  readonly resolve: (value: T) => void
  readonly reject: (reason: unknown) => void
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, resolve, reject }
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function abortError(): DOMException {
  return new DOMException('The fake AI request was cancelled.', 'AbortError')
}

export class FakeAiProvider<TRequest, TDraft> {
  private readonly scripts: Array<FakeAiScript<TDraft>>
  private readonly recordedCalls: Array<MutableFakeAiCall<TRequest>> = []
  private readonly lateResponses = new Map<
    number,
    { readonly deferred: Deferred<TDraft>; readonly draft: TDraft }
  >()

  public constructor(scripts: ReadonlyArray<FakeAiScript<TDraft>>) {
    this.scripts = scripts.map((script) => clone(script))
  }

  public get calls(): ReadonlyArray<FakeAiCall<TRequest>> {
    return this.recordedCalls.map((call) => clone(call))
  }

  public capabilities(): ProviderCapabilities {
    return Object.freeze({
      configured: true,
      available: true,
      providerLabel: 'Fake AI Provider',
      modelLabel: 'Deterministic fake'
    })
  }

  public async requestStartHelp(
    request: TRequest,
    options?: AbortSignal | ProviderRequestOptions
  ): Promise<TDraft> {
    const signal = options instanceof AbortSignal ? options : options?.signal
    const script = this.scripts.shift()

    if (!script) {
      throw new Error('FakeAiProvider has no scripted response for this call.')
    }

    const callIndex = this.recordedCalls.length
    const call: MutableFakeAiCall<TRequest> = {
      request: clone(request),
      scriptKind: script.kind,
      aborted: signal?.aborted ?? false
    }
    this.recordedCalls.push(call)

    if (signal?.aborted && script.kind !== 'late-response') {
      throw abortError()
    }

    if (
      script.kind === 'success' ||
      script.kind === 'fabricated-fact' ||
      script.kind === 'rest-suggestion'
    ) {
      return clone(script.draft)
    }

    if (script.kind === 'authentication-failure') {
      throw new AiProviderError('authentication')
    }

    if (script.kind === 'quota-failure') throw new AiProviderError('quota')
    if (script.kind === 'rate-limit-failure') throw new AiProviderError('rate-limited')
    if (script.kind === 'network-failure') throw new AiProviderError('network')
    if (script.kind === 'provider-unavailable') throw new AiProviderError('provider-unavailable')
    if (script.kind === 'internal-failure') throw new AiProviderError('internal')

    if (script.kind === 'parse-failure') {
      throw new FakeAiProviderError('parse', script.message ?? 'The fake AI response was invalid.')
    }

    const deferred = createDeferred<TDraft>()

    if (script.kind === 'late-response') {
      this.lateResponses.set(callIndex, { deferred, draft: clone(script.draft) })
      signal?.addEventListener(
        'abort',
        () => {
          call.aborted = true
        },
        { once: true }
      )
      return deferred.promise
    }

    const rejectOnAbort = (): void => {
      call.aborted = true
      deferred.reject(abortError())
    }

    signal?.addEventListener('abort', rejectOnAbort, { once: true })
    return deferred.promise.finally(() => signal?.removeEventListener('abort', rejectOnAbort))
  }

  public releaseLateResponse(callIndex: number): void {
    const pending = this.lateResponses.get(callIndex)
    const scriptKind = this.recordedCalls[callIndex]?.scriptKind

    if (!pending || scriptKind !== 'late-response') {
      throw new Error(`Call ${callIndex} is not waiting for a late response.`)
    }

    this.lateResponses.delete(callIndex)
    pending.deferred.resolve(clone(pending.draft))
  }
}
