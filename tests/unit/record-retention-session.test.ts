import { afterEach, describe, expect, it, vi } from 'vitest'
import { UiSession, type FirstActionRecordingDraft } from '../../src/renderer/src/app/ui-session'
import { hasRecordInput } from '../../src/contracts/record-drafts'
const empty: FirstActionRecordingDraft = {
  context: { actionId: 'a', recordingContextId: 'c', capturedOn: '2026-10-24' },
  title: '',
  goalId: '',
  durationMinutes: '',
  unknownDuration: false,
  outcome: '',
  lifecycle: '',
  summary: '',
  note: ''
}
afterEach(() => vi.unstubAllGlobals())
describe('record input retention lifetime', () => {
  it('drains initial restore before answering a close request', async () => {
    let loaded!: (value: []) => void
    vi.stubGlobal('window', {
      myTracer: {
        recordDrafts: {
          load: () =>
            new Promise<[]>((resolve) => {
              loaded = resolve
            })
        }
      }
    })
    const session = new UiSession(() => undefined)
    let answered = false
    const close = session.flushRecordInputs().then((value) => {
      answered = true
      return value
    })
    await Promise.resolve()
    expect(answered).toBe(false)
    loaded([])
    expect(await close).toBe(true)
  })
  it('does not treat opening or reverting the first form as unsaved content', () => {
    const session = new UiSession(() => undefined)
    session.setFirstActionDraft(empty)
    expect(session.hasUnsavedContent()).toBe(false)
    session.setFirstActionDraft({ ...empty, unknownDuration: true })
    expect(session.hasUnsavedContent()).toBe(true)
    session.setFirstActionDraft(empty)
    expect(session.hasUnsavedContent()).toBe(false)
  })
  it('waits for the pending revision, reports failure honestly, and can retry without losing inputs', async () => {
    let finish!: () => void
    const retain = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve
          })
      )
      .mockRejectedValueOnce(Error('synthetic storage failure'))
      .mockResolvedValue(undefined)
    vi.stubGlobal('window', { myTracer: { recordDrafts: { load: async () => [], retain } } })
    const session = new UiSession(() => undefined)
    await session.restoreRecordInputs()
    session.setFirstActionDraft({ ...empty, title: 'Synthetic unfinished title' })
    let flushed = false
    const flush = session.flushRecordInputs().then((result) => {
      flushed = result
    })
    await Promise.resolve()
    expect(flushed).toBe(false)
    finish()
    await flush
    expect(flushed).toBe(true)
    session.setFirstActionDraft({ ...empty, title: 'Synthetic revised title' })
    expect(await session.flushRecordInputs()).toBe(false)
    expect(session.hasRetentionError()).toBe(true)
    expect(session.getFirstActionDraft()?.title).toBe('Synthetic revised title')
    await session.retryRecordRetention()
    expect(session.hasRetentionError()).toBe(false)
    expect(retain.mock.calls.map((call) => call[0].revision)).toEqual([1, 2, 3])
  })
  it('restores all matching inputs before entrypoints mount without submitting anything', async () => {
    const draft = { ...empty, title: 'Synthetic restored' }
    const retain = vi.fn()
    vi.stubGlobal('window', {
      myTracer: { recordDrafts: { load: async () => [{ kind: 'first', draft }], retain } }
    })
    const session = new UiSession(() => undefined)
    await session.restoreRecordInputs()
    expect(session.getFirstActionDraft()).toEqual(draft)
    expect(retain).not.toHaveBeenCalled()
    expect(session.hasUnsavedContent()).toBe(true)
  })
  it('only compares actual action fields, not expanded reading sections', () => {
    const draft = {
      context: empty.context,
      durationMinutes: '',
      summary: '',
      note: '',
      outcome: 'partial' as const,
      understanding: '',
      confusion: '',
      nextStep: '',
      deepExpanded: true,
      postExpanded: true,
      postAction: 'keep-pending' as const,
      nextMode: 'clear' as const,
      replacementActionId: '',
      applyRecordedNextStep: false
    }
    expect(hasRecordInput({ kind: 'action', draft })).toBe(false)
    expect(hasRecordInput({ kind: 'action', draft: { ...draft, outcome: 'stopped' } })).toBe(true)
  })
  it('shares uncertain submission state across entrypoints and reconciles without replay', async () => {
    const reconcile = vi
      .fn()
      .mockResolvedValue({ state: 'saved', objectId: 'a', occurredOn: '2026-10-24' })
    vi.stubGlobal('window', {
      myTracer: { recordDrafts: { load: async () => [], retain: async () => undefined, reconcile } }
    })
    const session = new UiSession(() => undefined)
    await session.restoreRecordInputs()
    session.setFirstActionDraft({ ...empty, title: 'Synthetic pending submission' })
    await expect(
      session.trackRecordOperation('c', async () => {
        throw Error('Synthetic lost reply')
      })
    ).rejects.toThrow()
    expect(session.isRecordPending('c')).toBe(false)
    expect(session.isRecordUncertain('c')).toBe(true)
    expect(session.getFirstActionDraft()).not.toBeNull()
    expect(await session.reconcileRecord('first', 'c')).toEqual({
      state: 'saved',
      objectId: 'a',
      occurredOn: '2026-10-24'
    })
    expect(session.isRecordUncertain('c')).toBe(false)
    expect(session.isRecordConsumed('c')).toBe(true)
    expect(session.getFirstActionDraft()).toBeNull()
    expect(reconcile).toHaveBeenCalledExactlyOnceWith({ kind: 'first', contextId: 'c' })
  })
  it('coalesces StrictMode hydration so entrypoints never capture superseded capabilities', async () => {
    let finish!: (value: unknown[]) => void
    const load = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    vi.stubGlobal('window', { myTracer: { recordDrafts: { load } } })
    const session = new UiSession(() => undefined)
    const first = session.restoreRecordInputs()
    const second = session.restoreRecordInputs()
    expect(first).toBe(second)
    finish([{ kind: 'first', draft: { ...empty, title: 'Synthetic restored' } }])
    await first
    await session.restoreRecordInputs()
    expect(load).toHaveBeenCalledTimes(1)
  })
  it('blocks update installation when reverting to empty has not been persisted', async () => {
    let completeClear!: () => void
    const retain = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(Error('Synthetic failed clearing write'))
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            completeClear = resolve
          })
      )
    vi.stubGlobal('window', { myTracer: { recordDrafts: { load: async () => [], retain } } })
    const session = new UiSession(() => undefined)
    await session.restoreRecordInputs()
    session.setFirstActionDraft({ ...empty, title: 'Synthetic original retained text' })
    expect(await session.flushRecordInputs()).toBe(true)
    session.setFirstActionDraft(empty)
    expect(await session.flushRecordInputs()).toBe(false)
    expect(hasRecordInput({ kind: 'first', draft: session.getFirstActionDraft()! })).toBe(false)
    expect(session.hasUnsavedContent()).toBe(true)
    const retry = session.retryRecordRetention()
    expect(session.hasUnsavedContent()).toBe(true)
    completeClear()
    await retry
    expect(session.hasUnsavedContent()).toBe(false)
  })
  it('clears discarded input after the original panel unmounts and protects pending/uncertain operations', async () => {
    vi.stubGlobal('window', {
      myTracer: { recordDrafts: { load: async () => [], retain: async () => undefined } }
    })
    const session = new UiSession(() => undefined)
    await session.restoreRecordInputs()
    session.setFirstActionDraft({ ...empty, title: 'Synthetic discarded elsewhere' })
    let complete!: (value: { ok: true; value: { cancelled: true } }) => void
    const discard = session.trackRecordOperation(
      'c',
      () =>
        new Promise<{ ok: true; value: { cancelled: true } }>((resolve) => {
          complete = resolve
        })
    )
    expect(session.isRecordPending('c')).toBe(true)
    expect(session.hasUnsavedContent()).toBe(true)
    complete({ ok: true, value: { cancelled: true } })
    await discard
    expect(session.getFirstActionDraft()).toBeNull()
    expect(session.isRecordConsumed('c')).toBe(true)
    await session.flushRecordInputs()
    expect(session.hasUnsavedContent()).toBe(false)
    session.setFirstActionDraft(empty)
    await session.flushRecordInputs()
    await expect(
      session.trackRecordOperation('c', async () => {
        throw Error('Synthetic lost reply')
      })
    ).rejects.toThrow()
    expect(session.hasUnsavedContent()).toBe(true)
  })
})
