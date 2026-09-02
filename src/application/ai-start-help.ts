import type {
  AiStartHelpProvider,
  AiProviderFailureCode,
  ProviderCapabilities,
  StartHelpRequestDto
} from './ports/ai-start-help'
import { AiProviderError } from './ports/ai-start-help'
import type {
  AiStartHelpErrorCode,
  StartHelpDraftDto,
  StartHelpSuggestionDto
} from '../contracts/ai-start-help'

const LIMITS = Object.freeze({
  acknowledgement: 300,
  clarifyingQuestion: 300,
  suggestion: 500,
  suggestionsTotal: 1_200,
  understandingCandidate: 500,
  understandingCandidatesTotal: 1_200,
  safetyNote: 300,
  safetyNotesTotal: 500,
  providerRequestId: 128,
  total: 3_500
})

const ROOT_FIELDS = new Set([
  'acknowledgement',
  'clarifyingQuestion',
  'suggestions',
  'understandingCandidates',
  'safetyNotes',
  'providerRequestId'
])
const TEXT_ITEM_FIELDS = new Set(['text'])
const HTML_PATTERN = /<\/?[a-z][^>]*>/i

export class InvalidStartHelpResponseError extends Error {
  public constructor() {
    super('The AI provider response was invalid.')
    this.name = 'InvalidStartHelpResponseError'
  }
}

function failInvalid(): never {
  throw new InvalidStartHelpResponseError()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function codePoints(value: string): number {
  return Array.from(value).length
}

function strictText(value: unknown, maximum: number): string {
  if (typeof value !== 'string') failInvalid()
  const normalized = value.replace(/\r\n?/g, '\n').trim()
  if (!normalized || codePoints(normalized) > maximum || HTML_PATTERN.test(normalized))
    failInvalid()
  return normalized
}

function optionalText(value: unknown, maximum: number): string | undefined {
  return value === undefined ? undefined : strictText(value, maximum)
}

function textItems(
  value: unknown,
  countMinimum: number,
  countMaximum: number,
  itemMaximum: number,
  totalMaximum: number,
  generateCandidateId: () => string
): readonly StartHelpSuggestionDto[] {
  if (!Array.isArray(value) || value.length < countMinimum || value.length > countMaximum) {
    failInvalid()
  }
  let total = 0
  const items = value.map((candidate) => {
    if (!isRecord(candidate) || Object.keys(candidate).some((key) => !TEXT_ITEM_FIELDS.has(key))) {
      failInvalid()
    }
    const text = strictText(candidate.text, itemMaximum)
    total += codePoints(text)
    return Object.freeze({ candidateId: generateCandidateId(), text })
  })
  if (total > totalMaximum) failInvalid()
  return Object.freeze(items)
}

function stringItems(
  value: unknown,
  countMaximum: number,
  itemMaximum: number,
  totalMaximum: number
): readonly string[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.length > countMaximum) failInvalid()
  let total = 0
  const items = value.map((item) => {
    const text = strictText(item, itemMaximum)
    total += codePoints(text)
    return text
  })
  if (total > totalMaximum) failInvalid()
  return Object.freeze(items)
}

export function validateStartHelpResponse(
  value: unknown,
  requestId: string,
  generateCandidateId: () => string
): StartHelpDraftDto {
  if (!isRecord(value) || Object.keys(value).some((key) => !ROOT_FIELDS.has(key))) failInvalid()

  const acknowledgement = strictText(value.acknowledgement, LIMITS.acknowledgement)
  const clarifyingQuestion = optionalText(value.clarifyingQuestion, LIMITS.clarifyingQuestion)
  const suggestions = textItems(
    value.suggestions,
    1,
    3,
    LIMITS.suggestion,
    LIMITS.suggestionsTotal,
    generateCandidateId
  )
  const understandingCandidates =
    value.understandingCandidates === undefined
      ? undefined
      : textItems(
          value.understandingCandidates,
          0,
          3,
          LIMITS.understandingCandidate,
          LIMITS.understandingCandidatesTotal,
          generateCandidateId
        )
  const safetyNotes = stringItems(value.safetyNotes, 2, LIMITS.safetyNote, LIMITS.safetyNotesTotal)
  const providerRequestId = optionalText(value.providerRequestId, LIMITS.providerRequestId)

  const totalText = [
    acknowledgement,
    clarifyingQuestion,
    ...suggestions.map((item) => item.text),
    ...(understandingCandidates ?? []).map((item) => item.text),
    ...(safetyNotes ?? []),
    providerRequestId
  ].reduce((total, text) => total + (text ? codePoints(text) : 0), 0)
  if (totalText > LIMITS.total) failInvalid()

  return Object.freeze({
    requestId,
    acknowledgement,
    ...(clarifyingQuestion ? { clarifyingQuestion } : {}),
    suggestions,
    ...(understandingCandidates ? { understandingCandidates } : {}),
    ...(safetyNotes ? { safetyNotes } : {}),
    ...(providerRequestId ? { providerRequestId } : {})
  })
}

export interface AiStartHelpExecutionResult {
  readonly ok: boolean
  readonly draft?: StartHelpDraftDto
  readonly error?: {
    readonly code: AiStartHelpErrorCode
    readonly retryable: boolean
  }
}

const RETRYABLE = new Set<AiStartHelpErrorCode>([
  'timeout',
  'network',
  'rate-limited',
  'provider-unavailable',
  'internal'
])

function failure(code: AiStartHelpErrorCode): AiStartHelpExecutionResult {
  return Object.freeze({
    ok: false,
    error: Object.freeze({ code, retryable: RETRYABLE.has(code) })
  })
}

function mapProviderFailure(code: AiProviderFailureCode): AiStartHelpErrorCode {
  return code
}

export interface AiStartHelpServiceOptions {
  readonly provider: AiStartHelpProvider
  readonly generateCandidateId: () => string
  readonly deadlineMs?: number
}

export class AiStartHelpService {
  private readonly deadlineMs: number

  public constructor(private readonly options: AiStartHelpServiceOptions) {
    this.deadlineMs = options.deadlineMs ?? 20_000
  }

  public async execute(
    request: StartHelpRequestDto,
    lifecycleSignal: AbortSignal
  ): Promise<AiStartHelpExecutionResult> {
    if (lifecycleSignal.aborted) return failure('cancelled')
    let capabilities: ProviderCapabilities
    try {
      capabilities = this.options.provider.capabilities()
    } catch {
      return failure('internal')
    }
    if (!capabilities.configured) return failure('not-configured')
    if (!capabilities.available) return failure('credential-unavailable')

    const controller = new AbortController()
    let timedOut = false
    const cancel = (): void => controller.abort()
    lifecycleSignal.addEventListener('abort', cancel, { once: true })
    type ProviderOutcome =
      | { readonly kind: 'response'; readonly value: unknown }
      | { readonly kind: 'error'; readonly error: unknown }
      | { readonly kind: 'aborted' }
    let resolveAbort: ((outcome: ProviderOutcome) => void) | undefined
    const aborted = new Promise<ProviderOutcome>((resolve) => {
      resolveAbort = resolve
    })
    const onAbort = (): void => resolveAbort?.({ kind: 'aborted' })
    controller.signal.addEventListener('abort', onAbort, { once: true })
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, this.deadlineMs)

    try {
      const providerOutcome = Promise.resolve()
        .then(() =>
          this.options.provider.requestStartHelp(request, {
            signal: controller.signal,
            requestId: request.requestId
          })
        )
        .then(
          (value): ProviderOutcome => ({ kind: 'response', value }),
          (error: unknown): ProviderOutcome => ({ kind: 'error', error })
        )
      const outcome = await Promise.race([providerOutcome, aborted])
      if (outcome.kind === 'aborted') {
        return failure(timedOut ? 'timeout' : 'cancelled')
      }
      if (outcome.kind === 'error') throw outcome.error
      return Object.freeze({
        ok: true,
        draft: validateStartHelpResponse(
          outcome.value,
          request.requestId,
          this.options.generateCandidateId
        )
      })
    } catch (error) {
      if (timedOut) return failure('timeout')
      if (
        lifecycleSignal.aborted ||
        (error instanceof DOMException && error.name === 'AbortError')
      ) {
        return failure('cancelled')
      }
      if (error instanceof InvalidStartHelpResponseError) return failure('invalid-response')
      if (error instanceof AiProviderError) return failure(mapProviderFailure(error.code))
      return failure('internal')
    } finally {
      clearTimeout(timer)
      controller.signal.removeEventListener('abort', onAbort)
      lifecycleSignal.removeEventListener('abort', cancel)
    }
  }
}
