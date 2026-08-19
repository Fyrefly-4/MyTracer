import { describe, expect, it } from 'vitest'

const contextModulePath = '../../src/main/delete-preview-contexts'
const { DeletePreviewContextStore } = await import(contextModulePath)

const target = { type: 'action' as const, id: 'action-1' }

describe('DeletePreviewContextStore', () => {
  it('binds one-time previews to sender and target and supersedes the same target', () => {
    let sequence = 1
    const store = new DeletePreviewContextStore(() => `preview-${sequence++}`)
    const first = store.begin(7, target, 'fingerprint-1', 'instant-1')
    const second = store.begin(7, target, 'fingerprint-2', 'instant-2')
    expect(() => store.consume(7, first.id, target)).toThrow()
    expect(() => store.consume(8, second.id, target)).toThrow()
    expect(store.consume(7, second.id, target)).toMatchObject({ fingerprint: 'fingerprint-2' })
    expect(() => store.consume(7, second.id, target)).toThrow()
  })

  it('clears only the requested sender or all contexts', () => {
    let sequence = 1
    const store = new DeletePreviewContextStore(() => `preview-${sequence++}`)
    const first = store.begin(7, target, 'first', 'instant')
    const second = store.begin(8, target, 'second', 'instant')
    store.clearSender(7)
    expect(() => store.cancel(7, first.id)).toThrow()
    expect(() => store.cancel(8, second.id)).not.toThrow()
    const third = store.begin(8, target, 'third', 'instant')
    store.clearAll()
    expect(() => store.cancel(8, third.id)).toThrow()
  })
})
