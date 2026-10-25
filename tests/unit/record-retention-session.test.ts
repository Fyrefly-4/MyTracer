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
    const reconcile = vi.fn().mockResolvedValue('saved')
    vi.stubGlobal('window', {
      myTracer: { recordDrafts: { load: async () => [], retain: async () => undefined, reconcile } }
    })
    const session = new UiSession(() => undefined)
    await session.restoreRecordInputs()
    session.setFirstActionDraft({ ...empty, title: 'Synthetic pending submission' })
    await expect(
      session.trackRecordSave('c', async () => {
        throw Error('Synthetic lost reply')
      })
    ).rejects.toThrow()
    expect(session.isRecordPending('c')).toBe(false)
    expect(session.isRecordUncertain('c')).toBe(true)
    expect(session.getFirstActionDraft()).not.toBeNull()
    expect(await session.reconcileRecord('first', 'c')).toBe('saved')
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
})
