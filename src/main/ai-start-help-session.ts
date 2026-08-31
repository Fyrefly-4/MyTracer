import type { AiConfigurationState } from '../application/ports/configuration'
import type { StartHelpRequestDto } from '../application/ports/ai-start-help'
import type { AiStartHelpExecutionResult } from '../application/ai-start-help'
import { AiStartHelpContextError } from '../application/ai-start-help-context'
import type {
  AiStartHelpErrorCode,
  AiStartHelpSessionDto,
  StartAiStartHelpInputDto
} from '../contracts/ai-start-help'

interface SessionEntry {
  generation: number
  controller: AbortController | null
  input: StartAiStartHelpInputDto | null
  state: AiStartHelpSessionDto
}

export interface AiStartHelpSessionStoreOptions {
  readonly selectRequest: (input: StartAiStartHelpInputDto) => StartHelpRequestDto
  readonly execute: (
    request: StartHelpRequestDto,
    signal: AbortSignal
  ) => Promise<AiStartHelpExecutionResult>
  readonly readConfiguration: () => AiConfigurationState
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

function failureState(
  generation: number,
  code: AiStartHelpErrorCode,
  requestId?: string
): AiStartHelpSessionDto {
  return Object.freeze({
    state: code === 'cancelled' ? 'cancelled' : 'failed',
    generation,
    ...(requestId ? { requestId } : {}),
    error: Object.freeze({
      code,
      retryable:
        retryableContextCodes.has(code) ||
        ['timeout', 'network', 'rate-limited', 'provider-unavailable', 'internal'].includes(code)
    })
  })
}

function closedState(generation: number): AiStartHelpSessionDto {
  return Object.freeze({ state: 'closed', generation })
}

export class AiStartHelpSessionStore {
  private readonly entries = new Map<number, SessionEntry>()

  public constructor(private readonly options: AiStartHelpSessionStoreOptions) {}

  public status(senderId: number): AiStartHelpSessionDto {
    return this.entry(senderId).state
  }

  public start(senderId: number, input: StartAiStartHelpInputDto): Promise<AiStartHelpSessionDto> {
    const entry = this.entry(senderId)
    entry.controller?.abort()
    entry.generation += 1
    entry.input = Object.freeze({ ...input })
    return this.run(senderId, entry, entry.generation, entry.input)
  }

  public retry(senderId: number): Promise<AiStartHelpSessionDto> {
    const entry = this.entry(senderId)
    if (!entry.input) return Promise.resolve(entry.state)
    entry.controller?.abort()
    entry.generation += 1
    return this.run(senderId, entry, entry.generation, entry.input)
  }

  public cancel(senderId: number): AiStartHelpSessionDto {
    const entry = this.entry(senderId)
    entry.controller?.abort()
    entry.controller = null
    entry.state = failureState(entry.generation, 'cancelled', entry.state.requestId)
    return entry.state
  }

  public close(senderId: number): AiStartHelpSessionDto {
    const entry = this.entry(senderId)
    entry.controller?.abort()
    entry.controller = null
    entry.input = null
    entry.state = closedState(entry.generation)
    return entry.state
  }

  public configurationChanged(senderId?: number): void {
    if (senderId === undefined) {
      for (const id of this.entries.keys()) this.close(id)
      return
    }
    this.close(senderId)
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

  private entry(senderId: number): SessionEntry {
    let entry = this.entries.get(senderId)
    if (!entry) {
      entry = { generation: 0, controller: null, input: null, state: closedState(0) }
      this.entries.set(senderId, entry)
    }
    return entry
  }

  private async run(
    senderId: number,
    entry: SessionEntry,
    generation: number,
    input: StartAiStartHelpInputDto
  ): Promise<AiStartHelpSessionDto> {
    const configuration = this.options.readConfiguration()
    if (configuration.availability === 'disabled') {
      entry.state = failureState(generation, 'disabled')
      return entry.state
    }
    if (configuration.availability === 'not-configured') {
      entry.state = failureState(generation, 'not-configured')
      return entry.state
    }
    if (configuration.availability === 'configured-unavailable') {
      entry.state = failureState(generation, 'credential-unavailable')
      return entry.state
    }

    let request: StartHelpRequestDto
    try {
      request = this.options.selectRequest(input)
    } catch (error) {
      const code = contextFailure(error)
      entry.state = failureState(generation, code)
      return entry.state
    }

    const controller = new AbortController()
    entry.controller = controller
    entry.state = Object.freeze({
      state: 'requesting',
      generation,
      requestId: request.requestId
    })
    const result = await this.options.execute(request, controller.signal)
    const current = this.entries.get(senderId)
    if (
      !current ||
      current !== entry ||
      current.generation !== generation ||
      current.controller !== controller
    ) {
      return current?.state ?? closedState(generation)
    }
    entry.controller = null
    entry.state = result.ok
      ? Object.freeze({
          state: 'draft-ready',
          generation,
          requestId: request.requestId,
          draft: result.draft
        })
      : failureState(generation, result.error?.code ?? 'internal', request.requestId)
    return entry.state
  }
}
