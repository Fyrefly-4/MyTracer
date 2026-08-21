import type { AiConfigurationState } from '../../src/application/ports/configuration'
import { EmptyAiConfiguration } from '../../src/infrastructure/configuration/empty-ai-configuration'
import { FakeAiProvider, type FakeAiFailureCode, type FakeAiScript } from './fake-ai-provider'

export type AiDataCapabilityState = 'disabled' | 'not-configured' | 'failure'
export type AiFailureScenario = 'authentication-failure' | 'parse-failure' | 'timeout'

export interface AiStateObservation<TSnapshot> {
  readonly state: AiDataCapabilityState
  readonly configuration: AiConfigurationState | null
  readonly providerCalls: number
  readonly failureCode: FakeAiFailureCode | 'aborted' | null
  readonly before: TSnapshot
  readonly after: TSnapshot
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function failureCode(error: unknown): FakeAiFailureCode | 'aborted' {
  if (error instanceof DOMException && error.name === 'AbortError') return 'aborted'
  if (
    error instanceof Error &&
    'code' in error &&
    (error.code === 'authentication' || error.code === 'parse')
  ) {
    return error.code
  }
  throw error
}

export async function observeAiDataCapabilityState<TSnapshot>(input: {
  readonly state: AiDataCapabilityState
  readonly readCoreSnapshot: () => TSnapshot | Promise<TSnapshot>
  readonly failureScenario?: AiFailureScenario
}): Promise<AiStateObservation<TSnapshot>> {
  const before = clone(await input.readCoreSnapshot())
  const scenario = input.failureScenario ?? 'authentication-failure'
  const scripts: ReadonlyArray<FakeAiScript<never>> = [{ kind: scenario }]
  const provider = new FakeAiProvider<{ readonly marker: '__fake_ai_request_marker__' }, never>(
    scripts
  )
  let configuration: AiConfigurationState | null = null
  let observedFailure: FakeAiFailureCode | 'aborted' | null = null

  if (input.state === 'not-configured') {
    configuration = new EmptyAiConfiguration({
      protectionAvailability: () => 'available',
      readCredential: () => null
    }).readState()
  }

  if (input.state === 'failure') {
    const controller = new AbortController()
    const request = provider.requestStartHelp(
      { marker: '__fake_ai_request_marker__' },
      controller.signal
    )
    if (scenario === 'timeout') controller.abort()
    try {
      await request
    } catch (error) {
      observedFailure = failureCode(error)
    }
  }

  const after = clone(await input.readCoreSnapshot())
  return Object.freeze({
    state: input.state,
    configuration,
    providerCalls: provider.calls.length,
    failureCode: observedFailure,
    before,
    after
  })
}
