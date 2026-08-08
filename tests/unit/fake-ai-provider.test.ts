import { describe, expect, it } from 'vitest'
import { FakeAiProvider, FakeAiProviderError, type FakeAiScript } from '../support/fake-ai-provider'

interface Request {
  readonly marker: string
}

interface Draft {
  readonly suggestion: string
}

function provider(scripts: ReadonlyArray<FakeAiScript<Draft>>): FakeAiProvider<Request, Draft> {
  return new FakeAiProvider(scripts)
}

describe('FakeAiProvider', () => {
  it('returns scripted success and records a cloned request', async () => {
    const fake = provider([{ kind: 'success', draft: { suggestion: 'Open the file.' } }])
    const request = { marker: 'goal-a' }

    await expect(fake.requestStartHelp(request)).resolves.toEqual({ suggestion: 'Open the file.' })
    expect(fake.calls).toEqual([
      { request: { marker: 'goal-a' }, scriptKind: 'success', aborted: false }
    ])
  })

  it.each([
    ['authentication-failure', 'authentication'],
    ['parse-failure', 'parse']
  ] as const)('rejects the %s script without producing a draft', async (kind, code) => {
    const fake = provider([{ kind }])

    await expect(fake.requestStartHelp({ marker: 'goal-a' })).rejects.toEqual(
      expect.objectContaining<Partial<FakeAiProviderError>>({ code })
    )
  })

  it.each(['timeout', 'cancellation'] as const)(
    'keeps %s deterministic until the caller cancels',
    async (kind) => {
      const fake = provider([{ kind }])
      const controller = new AbortController()
      const result = fake.requestStartHelp({ marker: 'goal-a' }, controller.signal)
      let settled = false
      void result.then(
        () => {
          settled = true
        },
        () => {
          settled = true
        }
      )

      await Promise.resolve()
      expect(settled).toBe(false)

      controller.abort()
      await expect(result).rejects.toMatchObject({ name: 'AbortError' })
      expect(fake.calls[0]?.aborted).toBe(true)
    }
  )

  it('can release a late response after cancellation without writing state', async () => {
    const fake = provider([
      { kind: 'late-response', draft: { suggestion: 'Late and still temporary.' } }
    ])
    const controller = new AbortController()
    const result = fake.requestStartHelp({ marker: 'goal-a' }, controller.signal)

    controller.abort()
    fake.releaseLateResponse(0)

    await expect(result).resolves.toEqual({ suggestion: 'Late and still temporary.' })
    expect(fake.calls[0]?.aborted).toBe(true)
  })

  it('returns fabricated payloads only as explicit temporary test data', async () => {
    const fake = provider([
      { kind: 'fabricated-fact', draft: { suggestion: 'You already finished everything.' } }
    ])

    await expect(fake.requestStartHelp({ marker: 'goal-a' })).resolves.toEqual({
      suggestion: 'You already finished everything.'
    })
    expect(fake.calls).toHaveLength(1)
  })

  it('keeps provider instances and scripts isolated', async () => {
    const first = provider([{ kind: 'success', draft: { suggestion: 'First.' } }])
    const second = provider([{ kind: 'success', draft: { suggestion: 'Second.' } }])

    await expect(first.requestStartHelp({ marker: 'a' })).resolves.toEqual({ suggestion: 'First.' })
    await expect(second.requestStartHelp({ marker: 'b' })).resolves.toEqual({
      suggestion: 'Second.'
    })
    expect(first.calls[0]?.request.marker).toBe('a')
    expect(second.calls[0]?.request.marker).toBe('b')
  })
})
