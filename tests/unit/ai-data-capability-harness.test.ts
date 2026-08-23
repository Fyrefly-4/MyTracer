import { describe, expect, it } from 'vitest'
import {
  observeAiDataCapabilityState,
  type AiDataCapabilityState,
  type AiFailureScenario
} from '../support/ai-data-capability-harness'

describe('T033 AI data-capability state harness', () => {
  it.each<AiDataCapabilityState>(['disabled', 'not-configured'])(
    'constructs %s without invoking a provider',
    async (state) => {
      const observation = await observeAiDataCapabilityState({
        state,
        readCoreSnapshot: () => ({ goals: ['untouched'] })
      })

      expect(observation.providerCalls).toBe(0)
      expect(observation.failureCode).toBeNull()
      expect(observation.after).toEqual(observation.before)
      expect(observation.configuration).toEqual(
        state === 'not-configured'
          ? {
              configured: false,
              availability: 'not-configured',
              credentialProtection: 'available'
            }
          : null
      )
    }
  )

  it.each<[AiFailureScenario, 'authentication' | 'parse' | 'aborted']>([
    ['authentication-failure', 'authentication'],
    ['parse-failure', 'parse'],
    ['timeout', 'aborted']
  ])('constructs deterministic %s failure without changing core state', async (scenario, code) => {
    const state = { records: [{ id: 'record-1', outcome: 'partial' }] }
    const observation = await observeAiDataCapabilityState({
      state: 'failure',
      failureScenario: scenario,
      readCoreSnapshot: () => state
    })

    expect(observation.providerCalls).toBe(1)
    expect(observation.failureCode).toBe(code)
    expect(observation.after).toEqual(observation.before)
  })
})
