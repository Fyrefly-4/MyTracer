import { describe, expect, it } from 'vitest'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore Main is compiled by the node project; Vitest exercises this exact session unit at runtime.
import { AiStartHelpSessionStore } from '../../src/main/ai-start-help-session'
import type { StartHelpRequestDto } from '../../src/application/ports/ai-start-help'

const request = (id: string): StartHelpRequestDto => ({
  requestId: id,
  locale: 'zh-CN',
  userInput: '卡住了',
  goal: { name: '目标' },
  action: { title: '行动' },
  recentRelevantRecords: []
})
const input = {
  actionId: '00000000-0000-4000-8000-000000000001',
  locale: 'zh-CN',
  userInput: '卡住了'
}

describe('AiStartHelpSessionStore', () => {
  it('cancels an old generation and ignores its late response', async () => {
    let call = 0
    const resolvers: Array<(value: never) => void> = []
    const store = new AiStartHelpSessionStore({
      readConfiguration: () => ({
        configured: true,
        availability: 'configured-available',
        credentialProtection: 'available'
      }),
      selectRequest: () => request(`request-${++call}`),
      execute: (_request, signal) =>
        new Promise((resolve) => {
          resolvers.push(resolve as (value: never) => void)
          signal.addEventListener('abort', () => undefined, { once: true })
        })
    })
    const first = store.start(7, input)
    const second = store.start(7, input)
    resolvers[0]?.({
      ok: true,
      draft: { requestId: 'request-1', acknowledgement: 'old', suggestions: [] }
    } as never)
    expect((await first).generation).toBe(2)
    resolvers[1]?.({ ok: false, error: { code: 'network', retryable: true } } as never)
    expect(await second).toMatchObject({ generation: 2, error: { code: 'network' } })
  })

  it('aborts and removes sender-owned state during cleanup', async () => {
    let aborted = false
    const store = new AiStartHelpSessionStore({
      readConfiguration: () => ({
        configured: true,
        availability: 'configured-available',
        credentialProtection: 'available'
      }),
      selectRequest: () => request('request-1'),
      execute: (_request, signal) =>
        new Promise(() =>
          signal.addEventListener(
            'abort',
            () => {
              aborted = true
            },
            { once: true }
          )
        )
    })
    void store.start(8, input)
    store.clearSender(8)
    expect(aborted).toBe(true)
    expect(store.status(8)).toEqual({ state: 'closed', generation: 0 })
  })

  it('keeps a closed session closed when an abort-ignoring execution resolves late', async () => {
    let resolveExecution: ((value: never) => void) | undefined
    const store = new AiStartHelpSessionStore({
      readConfiguration: () => ({
        configured: true,
        availability: 'configured-available',
        credentialProtection: 'available'
      }),
      selectRequest: () => request('request-1'),
      execute: () =>
        new Promise((resolve) => {
          resolveExecution = resolve as (value: never) => void
        })
    })
    const pending = store.start(11, input)
    expect(store.close(11)).toEqual({ state: 'closed', generation: 1 })
    resolveExecution?.({
      ok: true,
      draft: {
        requestId: 'request-1',
        acknowledgement: 'late',
        suggestions: [{ candidateId: 'late', text: 'late' }]
      }
    } as never)
    expect(await pending).toEqual({ state: 'closed', generation: 1 })
    expect(store.status(11)).toEqual({ state: 'closed', generation: 1 })
  })

  it('manual retry preserves input but creates a new context request and generation', async () => {
    const requestIds: string[] = []
    const store = new AiStartHelpSessionStore({
      readConfiguration: () => ({
        configured: true,
        availability: 'configured-available',
        credentialProtection: 'available'
      }),
      selectRequest: (value) => {
        expect(value.userInput).toBe('卡住了')
        const id = `request-${requestIds.length + 1}`
        requestIds.push(id)
        return request(id)
      },
      execute: async (selected) => ({
        ok: false,
        error: { code: selected.requestId === 'request-1' ? 'network' : 'quota', retryable: true }
      })
    })
    expect(await store.start(10, input)).toMatchObject({ generation: 1, requestId: 'request-1' })
    expect(await store.retry(10)).toMatchObject({ generation: 2, requestId: 'request-2' })
    expect(requestIds).toEqual(['request-1', 'request-2'])
  })

  it.each([
    ['disabled', 'disabled'],
    ['not-configured', 'not-configured'],
    ['configured-unavailable', 'credential-unavailable']
  ] as const)('degrades %s without selecting context', async (availability, code) => {
    let selections = 0
    const store = new AiStartHelpSessionStore({
      readConfiguration: () => ({
        configured: availability.startsWith('configured'),
        availability,
        credentialProtection: 'unavailable'
      }),
      selectRequest: () => {
        selections += 1
        return request('never')
      },
      execute: async () => ({ ok: false })
    })
    expect(await store.start(9, input)).toMatchObject({ error: { code } })
    expect(selections).toBe(0)
  })
})
