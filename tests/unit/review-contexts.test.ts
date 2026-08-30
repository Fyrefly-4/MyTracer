import { describe, expect, it } from 'vitest'

const contextModulePath = '../../src/main/review-contexts'
const { ReviewContextStore } = await import(contextModulePath)

const period = { periodStartedOn: '2026-08-24', periodEndedOn: '2026-08-30' }

describe('ReviewContextStore', () => {
  it('binds a captured period to one sender and makes superseded contexts stale', () => {
    let sequence = 1
    const store = new ReviewContextStore(() => `context-${sequence++}`)
    const first = store.begin(7, period)
    expect(store.get(7, first.id)).toMatchObject(period)
    expect(() => store.get(8, first.id)).toThrowError(
      expect.objectContaining({ name: 'InvalidReviewContextError' })
    )
    const second = store.begin(7, {
      periodStartedOn: '2026-08-31',
      periodEndedOn: '2026-09-06'
    })
    expect(() => store.get(7, first.id)).toThrowError(
      expect.objectContaining({ name: 'StaleReviewContextError' })
    )
    expect(store.get(7, second.id).periodStartedOn).toBe('2026-08-31')
  })

  it('invalidates cancel, navigation/window sender cleanup, and application cleanup', () => {
    let sequence = 1
    const store = new ReviewContextStore(() => `context-${sequence++}`)
    const cancelled = store.begin(7, period)
    store.cancel(7, cancelled.id)
    expect(() => store.get(7, cancelled.id)).toThrowError(
      expect.objectContaining({ name: 'StaleReviewContextError' })
    )
    expect(() => store.cancel(7, 'forged')).toThrowError(
      expect.objectContaining({ name: 'InvalidReviewContextError' })
    )

    const senderSeven = store.begin(7, period)
    const senderEight = store.begin(8, period)
    store.clearSender(7)
    expect(() => store.get(7, senderSeven.id)).toThrowError(
      expect.objectContaining({ name: 'StaleReviewContextError' })
    )
    expect(store.get(8, senderEight.id)).toMatchObject(period)
    store.clearAll()
    expect(() => store.get(8, senderEight.id)).toThrowError(
      expect.objectContaining({ name: 'InvalidReviewContextError' })
    )
  })
})
