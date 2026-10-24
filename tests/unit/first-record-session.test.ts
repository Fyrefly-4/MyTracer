import { describe, expect, it } from 'vitest'
import { UiSession, type FirstActionRecordingDraft } from '../../src/renderer/src/app/ui-session'

describe('first record session draft', () => {
  it('survives page navigation, protects quit, and clears only explicitly or after save', () => {
    const session = new UiSession(() => undefined)
    const draft: FirstActionRecordingDraft = {
      context: { actionId: 'a', recordingContextId: 'r', capturedOn: '2026-08-12' },
      title: '做了一点',
      goalId: '',
      durationMinutes: '',
      unknownDuration: true,
      outcome: 'completed',
      lifecycle: 'keep-pending',
      note: '还要继续'
    }
    session.setFirstActionDraft(draft)
    session.selectAction('existing-action')
    session.setPanePosition('today', 'master', 200)
    expect(session.getFirstActionDraft()).toEqual(draft)
    expect(session.hasUnsavedContent()).toBe(true)
    expect(new UiSession(() => undefined).getFirstActionDraft()).toBeNull()
    session.setFirstActionDraft(null)
    expect(session.hasUnsavedContent()).toBe(false)
    expect(session.getPanePosition('today', 'master')).toBe(200)
  })
})

describe('first record request ownership', () => {
  it('invalidates old begin responses on a newer request or draft change', () => {
    const session = new UiSession(() => undefined)
    const first = session.beginFirstActionDraftRequest()
    const second = session.beginFirstActionDraftRequest()
    expect(session.ownsFirstActionDraftRequest(first)).toBe(false)
    expect(session.ownsFirstActionDraftRequest(second)).toBe(true)
    session.setFirstActionDraft(null)
    expect(session.ownsFirstActionDraftRequest(second)).toBe(false)
  })
})
