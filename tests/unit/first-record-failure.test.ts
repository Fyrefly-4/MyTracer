import { describe, expect, it } from 'vitest'
import { firstRecordDraftAfterFailure } from '../../src/renderer/src/app/ui-session'
import type { FirstActionRecordingDraft } from '../../src/renderer/src/app/ui-session'
import type { RecordErrorCode } from '../../src/contracts/records'

const draft: FirstActionRecordingDraft = {
  context: { actionId: 'action', recordingContextId: 'context', capturedOn: '2026-10-24' },
  title: '合成事实',
  goalId: 'goal',
  durationMinutes: '4',
  unknownDuration: false,
  outcome: 'partial',
  lifecycle: 'keep-pending',
  note: '保留输入',
  uncertainInput: {
    actionId: 'action',
    recordingContextId: 'context',
    title: '合成事实',
    goalId: 'goal',
    durationMinutes: 4,
    outcome: 'partial',
    lifecycle: 'keep-pending'
  }
}
describe('first record transport uncertainty', () => {
  it.each(['not-found', 'invalid-transition'] as const)(
    'unlocks editing and abandonment after authoritative %s',
    (code) => {
      expect(firstRecordDraftAfterFailure(draft, code)).toEqual({
        ...draft,
        uncertainInput: undefined
      })
    }
  )
  it.each([
    'validation',
    'invalid-recording-context',
    'persistence-failed',
    'invariant-violation'
  ] satisfies RecordErrorCode[])('keeps a lost-reply lock after ambiguous %s', (code) => {
    expect(firstRecordDraftAfterFailure(draft, code)).toBe(draft)
  })
})
