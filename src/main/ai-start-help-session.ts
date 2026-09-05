import type { AiStartHelpExecutionResult } from '../application/ai-start-help'
import { AiStartHelpContextError } from '../application/ai-start-help-context'
import type { AiContextManifest } from '../application/ai-start-help-context'
import type { StartHelpRequestDto } from '../application/ports/ai-start-help'
import type { AiConfigurationState } from '../application/ports/configuration'
import type {
  AiStartHelpCandidateState,
  AiStartHelpErrorCode,
  AiStartHelpSessionDto,
  AiStartHelpSessionState,
  ConfirmAiStartHelpSuggestionInputDto,
  ConfirmAiStartHelpUnderstandingInputDto,
  StartAiStartHelpInputDto,
  StartHelpDraftDto
} from '../contracts/ai-start-help'

interface SelectedSessionContext {
  readonly requestDto: StartHelpRequestDto
  readonly manifest: AiContextManifest
  readonly expectedGoalUpdatedAt: string
  readonly expectedActionUpdatedAt: string
  readonly expectedCurrentNextActionId: string | null
  readonly understandingTargets: readonly TargetEntry[]
}

interface TargetEntry {
  readonly recordId: string
  readonly actionTitle: string
  readonly occurredOn: string
}

interface SessionEntry {
  readonly sessionId: string
  generation: number
  controller: AbortController | null
  input: StartAiStartHelpInputDto | null
  state: AiStartHelpSessionState
  requestId?: string
  error?: { readonly code: AiStartHelpErrorCode; readonly retryable: boolean }
  context: SelectedSessionContext | null
  draft: StartHelpDraftDto | null
  readonly candidateStates: Map<string, AiStartHelpCandidateState>
  readonly targetRefs: Map<string, TargetEntry>
}

export interface ConfirmStartHelpSuggestionCommand {
  readonly goalId: string
  readonly contextActionId: string
  readonly expectedActionUpdatedAt: string
  readonly expectedGoalUpdatedAt: string
  readonly expectedCurrentNextActionId: string | null
  readonly finalText: string
}

export interface ConfirmStartHelpUnderstandingCommand {
  readonly actionRecordId: string
  readonly expectedGoalId: string
  readonly finalText: string
}

export interface AiStartHelpSessionStoreOptions {
  readonly selectContext: (input: StartAiStartHelpInputDto) => SelectedSessionContext
  readonly execute: (
    request: StartHelpRequestDto,
    signal: AbortSignal
  ) => Promise<AiStartHelpExecutionResult>
  readonly readConfiguration: () => AiConfigurationState
  readonly confirmSuggestion: (command: ConfirmStartHelpSuggestionCommand) => void
  readonly confirmUnderstanding: (command: ConfirmStartHelpUnderstandingCommand) => void
  readonly generateSessionId: () => string
  readonly generateTargetRef: () => string
}

const retryableContextCodes = new Set<AiStartHelpErrorCode>(['stale-context', 'context-not-found'])

function contextFailure(error: unknown): AiStartHelpErrorCode {
  if (!(error instanceof AiStartHelpContextError)) return 'internal'
  const mapping: Record<AiStartHelpContextError['code'], AiStartHelpErrorCode> = {
    validation: 'internal',
    'not-found': 'context-not-found',
    stale: 'stale-context',
    'invalid-context': 'context-not-found',
    'context-too-large': 'context-too-large'
  }
  return mapping[error.code]
}

function commandFailure(error: unknown): AiStartHelpErrorCode {
  if (!error || typeof error !== 'object' || !('code' in error)) return 'internal'
  const code = (error as { readonly code?: unknown }).code
  if (code === 'not-found') return 'context-not-found'
  if (code === 'invalid-transition' || code === 'invariant-violation') return 'stale-context'
  if (code === 'validation') return 'invalid-response'
  return 'internal'
}

function errorValue(code: AiStartHelpErrorCode): SessionEntry['error'] {
  return Object.freeze({
    code,
    retryable:
      retryableContextCodes.has(code) ||
      ['timeout', 'network', 'rate-limited', 'provider-unavailable', 'internal'].includes(code)
  })
}

function terminalView(state: 'idle' | 'closed', generation = 0): AiStartHelpSessionDto {
  return Object.freeze({ state, generation })
}

function candidateText(value: string): string {
  const normalized = value.replace(/\r\n?/g, '\n').trim()
  if (!normalized || Array.from(normalized).length > 500) {
    throw new TypeError('The confirmed candidate text was invalid.')
  }
  return normalized
}

export class AiStartHelpSessionStore {
  private readonly entries = new Map<number, SessionEntry>()

  public constructor(private readonly options: AiStartHelpSessionStoreOptions) {}

  public status(senderId: number): AiStartHelpSessionDto {
    const entry = this.entries.get(senderId)
    return entry ? this.view(entry) : terminalView('idle')
  }

  public start(senderId: number, input: StartAiStartHelpInputDto): AiStartHelpSessionDto {
    const previous = this.entries.get(senderId)
    previous?.controller?.abort()
    const entry: SessionEntry = {
      sessionId: this.options.generateSessionId(),
      generation: 1,
      controller: null,
      input: Object.freeze({ ...input }),
      state: 'building-context',
      context: null,
      draft: null,
      candidateStates: new Map(),
      targetRefs: new Map()
    }
    this.entries.set(senderId, entry)
    void this.run(senderId, entry, entry.generation)
    return this.view(entry)
  }

  public retry(senderId: number, sessionId: string): AiStartHelpSessionDto {
    const entry = this.ownedEntry(senderId, sessionId)
    if (!entry || !entry.input || !['failed', 'draft-ready'].includes(entry.state)) {
      return entry ? this.view(entry) : terminalView('idle')
    }
    entry.controller?.abort()
    entry.generation += 1
    this.resetForRequest(entry)
    void this.run(senderId, entry, entry.generation)
    return this.view(entry)
  }

  public cancel(senderId: number, sessionId: string): AiStartHelpSessionDto {
    const entry = this.ownedEntry(senderId, sessionId)
    if (!entry) return terminalView('idle')
    entry.controller?.abort()
    entry.controller = null
    entry.state = 'cancelled'
    entry.error = errorValue('cancelled')
    this.clearTemporaryResult(entry, true)
    return this.view(entry)
  }

  public reject(senderId: number, sessionId: string): AiStartHelpSessionDto {
    const entry = this.ownedEntry(senderId, sessionId)
    if (!entry) return terminalView('idle')
    if (entry.state !== 'draft-ready') return this.view(entry)
    entry.state = 'rejected'
    delete entry.error
    this.clearTemporaryResult(entry, true)
    return this.view(entry)
  }

  public close(senderId: number, sessionId: string): AiStartHelpSessionDto {
    const entry = this.ownedEntry(senderId, sessionId)
    if (!entry) return terminalView('closed')
    entry.controller?.abort()
    entry.controller = null
    entry.state = 'closed'
    delete entry.error
    this.clearTemporaryResult(entry, true)
    return this.view(entry)
  }

  public confirmSuggestion(
    senderId: number,
    input: ConfirmAiStartHelpSuggestionInputDto
  ): AiStartHelpSessionDto {
    const entry = this.ownedEntry(senderId, input.sessionId)
    if (!entry || entry.state !== 'draft-ready' || !entry.context || !entry.draft) {
      return entry ? this.view(entry) : terminalView('idle')
    }
    const suggestion = entry.draft.suggestions.find(
      (candidate) => candidate.candidateId === input.candidateId
    )
    const state = entry.candidateStates.get(input.candidateId)
    if (!suggestion || !state || state === 'confirming' || state === 'confirmed') {
      return this.view(entry)
    }

    entry.candidateStates.set(input.candidateId, 'confirming')
    delete entry.error
    try {
      this.options.confirmSuggestion({
        goalId: entry.context.manifest.goalId,
        contextActionId: entry.context.manifest.actionId,
        expectedActionUpdatedAt: entry.context.expectedActionUpdatedAt,
        expectedGoalUpdatedAt: entry.context.expectedGoalUpdatedAt,
        expectedCurrentNextActionId: entry.context.expectedCurrentNextActionId,
        finalText: candidateText(input.finalText)
      })
      entry.candidateStates.set(input.candidateId, 'confirmed')
      entry.state = 'confirmed'
      this.clearTemporaryResult(entry, true)
    } catch (error) {
      entry.candidateStates.set(input.candidateId, 'failed')
      entry.error = errorValue(commandFailure(error))
    }
    return this.view(entry)
  }

  public confirmUnderstanding(
    senderId: number,
    input: ConfirmAiStartHelpUnderstandingInputDto
  ): AiStartHelpSessionDto {
    const entry = this.ownedEntry(senderId, input.sessionId)
    if (!entry || entry.state !== 'draft-ready' || !entry.context || !entry.draft) {
      return entry ? this.view(entry) : terminalView('idle')
    }
    const candidate = entry.draft.understandingCandidates?.find(
      (item) => item.candidateId === input.candidateId
    )
    const state = entry.candidateStates.get(input.candidateId)
    const target = entry.targetRefs.get(input.targetRef)
    if (!candidate || !state || !target || state === 'confirming' || state === 'confirmed') {
      if (candidate && state && state !== 'confirmed') {
        entry.candidateStates.set(input.candidateId, 'failed')
        entry.error = errorValue('context-not-found')
      }
      return this.view(entry)
    }

    entry.candidateStates.set(input.candidateId, 'confirming')
    delete entry.error
    try {
      this.options.confirmUnderstanding({
        actionRecordId: target.recordId,
        expectedGoalId: entry.context.manifest.goalId,
        finalText: candidateText(input.finalText)
      })
      entry.candidateStates.set(input.candidateId, 'confirmed')
    } catch (error) {
      entry.candidateStates.set(input.candidateId, 'failed')
      entry.error = errorValue(commandFailure(error))
    }
    return this.view(entry)
  }

  public configurationChanged(senderId?: number): void {
    if (senderId === undefined) this.clearAll()
    else this.clearSender(senderId)
  }

  public clearSender(senderId: number): void {
    const entry = this.entries.get(senderId)
    entry?.controller?.abort()
    this.entries.delete(senderId)
  }

  public clearAll(): void {
    for (const entry of this.entries.values()) entry.controller?.abort()
    this.entries.clear()
  }

  private ownedEntry(senderId: number, sessionId: string): SessionEntry | null {
    const entry = this.entries.get(senderId)
    return entry?.sessionId === sessionId ? entry : null
  }

  private resetForRequest(entry: SessionEntry): void {
    entry.state = 'building-context'
    entry.controller = null
    entry.context = null
    entry.draft = null
    entry.candidateStates.clear()
    entry.targetRefs.clear()
    delete entry.requestId
    delete entry.error
  }

  private clearTemporaryResult(entry: SessionEntry, clearInput: boolean): void {
    entry.context = null
    entry.draft = null
    entry.candidateStates.clear()
    entry.targetRefs.clear()
    delete entry.requestId
    if (clearInput) entry.input = null
  }

  private async run(senderId: number, entry: SessionEntry, generation: number): Promise<void> {
    const configuration = this.options.readConfiguration()
    if (configuration.availability !== 'configured-available') {
      const code: AiStartHelpErrorCode =
        configuration.availability === 'disabled'
          ? 'disabled'
          : configuration.availability === 'not-configured'
            ? 'not-configured'
            : 'credential-unavailable'
      entry.state = 'failed'
      entry.error = errorValue(code)
      return
    }

    try {
      entry.context = this.options.selectContext(entry.input!)
    } catch (error) {
      entry.state = 'failed'
      entry.error = errorValue(contextFailure(error))
      return
    }

    entry.requestId = entry.context.requestDto.requestId
    entry.targetRefs.clear()
    for (const target of entry.context.understandingTargets) {
      entry.targetRefs.set(this.options.generateTargetRef(), Object.freeze({ ...target }))
    }
    const controller = new AbortController()
    entry.controller = controller
    entry.state = 'requesting'
    let result: AiStartHelpExecutionResult
    try {
      result = await this.options.execute(entry.context.requestDto, controller.signal)
    } catch {
      const current = this.entries.get(senderId)
      if (
        !current ||
        current !== entry ||
        current.generation !== generation ||
        current.controller !== controller
      ) {
        return
      }
      entry.controller = null
      entry.state = 'failed'
      entry.error = errorValue('internal')
      entry.draft = null
      return
    }
    const current = this.entries.get(senderId)
    if (
      !current ||
      current !== entry ||
      current.generation !== generation ||
      current.controller !== controller
    ) {
      return
    }
    entry.controller = null
    if (!result.ok || !result.draft) {
      entry.state = result.error?.code === 'cancelled' ? 'cancelled' : 'failed'
      entry.error = errorValue(result.error?.code ?? 'internal')
      entry.draft = null
      return
    }

    entry.state = 'draft-ready'
    entry.draft = result.draft
    entry.candidateStates.clear()
    for (const candidate of [
      ...result.draft.suggestions,
      ...(result.draft.understandingCandidates ?? [])
    ]) {
      entry.candidateStates.set(candidate.candidateId, 'unconfirmed')
    }
    delete entry.error
  }

  private view(entry: SessionEntry): AiStartHelpSessionDto {
    const draft = entry.draft
      ? Object.freeze({
          requestId: entry.draft.requestId,
          acknowledgement: entry.draft.acknowledgement,
          ...(entry.draft.clarifyingQuestion
            ? { clarifyingQuestion: entry.draft.clarifyingQuestion }
            : {}),
          suggestions: Object.freeze(
            entry.draft.suggestions.map((candidate) =>
              Object.freeze({
                candidateId: candidate.candidateId,
                text: candidate.text,
                status: entry.candidateStates.get(candidate.candidateId) ?? 'unconfirmed'
              })
            )
          ),
          ...(entry.draft.understandingCandidates
            ? {
                understandingCandidates: Object.freeze(
                  entry.draft.understandingCandidates.map((candidate) =>
                    Object.freeze({
                      candidateId: candidate.candidateId,
                      text: candidate.text,
                      status: entry.candidateStates.get(candidate.candidateId) ?? 'unconfirmed'
                    })
                  )
                )
              }
            : {}),
          understandingTargets: Object.freeze(
            [...entry.targetRefs.entries()].map(([targetRef, target]) =>
              Object.freeze({
                targetRef,
                actionTitle: target.actionTitle,
                occurredOn: target.occurredOn
              })
            )
          ),
          ...(entry.draft.safetyNotes ? { safetyNotes: entry.draft.safetyNotes } : {})
        })
      : undefined
    return Object.freeze({
      state: entry.state,
      sessionId: entry.sessionId,
      generation: entry.generation,
      ...(entry.requestId ? { requestId: entry.requestId } : {}),
      ...(draft ? { draft } : {}),
      ...(entry.error ? { error: entry.error } : {})
    })
  }
}
