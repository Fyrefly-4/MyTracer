import { describe, expect, it } from 'vitest'
const contextModulePath = '../../src/main/routine-recording-contexts'
const { RoutineRecordingContextStore } = (await import(contextModulePath)) as {
  readonly RoutineRecordingContextStore: new (generateId: () => string) => {
    begin(
      senderId: number,
      routineId: string,
      capturedOn: string
    ): {
      readonly id: string
      readonly senderId: number
      readonly routineId: string
      readonly capturedOn: string
    }
    require(
      senderId: number,
      routineId: string,
      contextId: string
    ): {
      readonly id: string
      readonly senderId: number
      readonly routineId: string
      readonly capturedOn: string
    }
    cancel(senderId: number, contextId: string): void
    consume(senderId: number, routineId: string, contextId: string): void
    clearSender(senderId: number): void
    clearAll(): void
  }
}

describe('Routine recording contexts', () => {
  it('binds an opaque context to one sender and Routine', () => {
    const ids = ['context-1', 'context-2']
    const store = new RoutineRecordingContextStore(() => ids.shift()!)
    const first = store.begin(1, 'routine-1', '2026-08-10')
    const replacement = store.begin(1, 'routine-1', '2026-08-11')

    expect(() => store.require(1, 'routine-1', first.id)).toThrow()
    expect(store.require(1, 'routine-1', replacement.id)).toEqual(replacement)
    expect(() => store.require(2, 'routine-1', replacement.id)).toThrow()
    expect(() => store.require(1, 'routine-2', replacement.id)).toThrow()
  })

  it('invalidates on cancel, consume, sender cleanup, and application cleanup', () => {
    const ids = ['context-1', 'context-2', 'context-3', 'context-4']
    const store = new RoutineRecordingContextStore(() => ids.shift()!)
    const cancelled = store.begin(1, 'routine-1', '2026-08-10')
    store.cancel(1, cancelled.id)
    expect(() => store.require(1, 'routine-1', cancelled.id)).toThrow()

    const consumed = store.begin(1, 'routine-1', '2026-08-10')
    store.consume(1, 'routine-1', consumed.id)
    expect(() => store.require(1, 'routine-1', consumed.id)).toThrow()

    const senderContext = store.begin(1, 'routine-1', '2026-08-10')
    const otherSender = store.begin(2, 'routine-1', '2026-08-10')
    store.clearSender(1)
    expect(() => store.require(1, 'routine-1', senderContext.id)).toThrow()
    expect(store.require(2, 'routine-1', otherSender.id)).toEqual(otherSender)
    store.clearAll()
    expect(() => store.require(2, 'routine-1', otherSender.id)).toThrow()
  })
})
