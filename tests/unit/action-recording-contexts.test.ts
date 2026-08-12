import { describe, expect, it } from 'vitest'

const contextModulePath = '../../src/main/action-recording-contexts'
const { ActionRecordingContextStore } = (await import(contextModulePath)) as {
  readonly ActionRecordingContextStore: new (generateId: () => string) => {
    begin(
      senderId: number,
      actionId: string,
      capturedOn: string
    ): {
      readonly id: string
      readonly senderId: number
      readonly actionId: string
      readonly capturedOn: string
    }
    require(
      senderId: number,
      actionId: string,
      contextId: string
    ): {
      readonly id: string
      readonly senderId: number
      readonly actionId: string
      readonly capturedOn: string
    }
    cancel(senderId: number, contextId: string): void
    consume(senderId: number, actionId: string, contextId: string): void
    clearSender(senderId: number): void
    clearAll(): void
  }
}

describe('Action recording contexts', () => {
  it('binds opaque contexts to sender and Action and replaces only the same pair', () => {
    const ids = ['context-1', 'context-2', 'context-3']
    const store = new ActionRecordingContextStore(() => ids.shift()!)
    const first = store.begin(1, 'action-1', '2026-08-12')
    const other = store.begin(1, 'action-2', '2026-08-12')
    const replacement = store.begin(1, 'action-1', '2026-08-13')

    expect(() => store.require(1, 'action-1', first.id)).toThrow()
    expect(store.require(1, 'action-2', other.id)).toEqual(other)
    expect(store.require(1, 'action-1', replacement.id)).toEqual(replacement)
    expect(() => store.require(2, 'action-1', replacement.id)).toThrow()
    expect(() => store.require(1, 'action-2', replacement.id)).toThrow()
  })

  it('invalidates on cancel, consume, sender cleanup, and application cleanup', () => {
    const ids = ['context-1', 'context-2', 'context-3', 'context-4']
    const store = new ActionRecordingContextStore(() => ids.shift()!)
    const cancelled = store.begin(1, 'action-1', '2026-08-12')
    store.cancel(1, cancelled.id)
    expect(() => store.require(1, 'action-1', cancelled.id)).toThrow()

    const consumed = store.begin(1, 'action-1', '2026-08-12')
    store.consume(1, 'action-1', consumed.id)
    expect(() => store.consume(1, 'action-1', consumed.id)).toThrow()

    const senderContext = store.begin(1, 'action-1', '2026-08-12')
    const otherSender = store.begin(2, 'action-1', '2026-08-12')
    store.clearSender(1)
    expect(() => store.require(1, 'action-1', senderContext.id)).toThrow()
    expect(store.require(2, 'action-1', otherSender.id)).toEqual(otherSender)
    store.clearAll()
    expect(() => store.require(2, 'action-1', otherSender.id)).toThrow()
  })
})
