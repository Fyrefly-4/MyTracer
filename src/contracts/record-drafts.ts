import type {
  BeginActionRecordingDto,
  ActionRecordOutcomeDto,
  FirstActionRecordInputDto
} from './records'
import type { BeginRoutineRecordingDto, RoutineRecordOutcomeDto } from './routine-records'

export type PostRecordActionChoice = 'keep-pending' | 'complete' | 'cancel' | 'reschedule'
export type RecordedNextMode = 'clear' | 'use-existing' | 'recorded-next'

export interface ActionRecordingDraft {
  readonly context: BeginActionRecordingDto
  readonly durationMinutes: string
  readonly outcome: ActionRecordOutcomeDto
  readonly deepExpanded: boolean
  readonly understanding: string
  readonly confusion: string
  readonly nextStep: string
  readonly summary: string
  readonly note: string
  readonly postExpanded: boolean
  readonly postAction: PostRecordActionChoice
  readonly nextMode: RecordedNextMode
  readonly replacementActionId: string
  readonly applyRecordedNextStep: boolean
}

export interface FirstActionRecordingDraft {
  readonly context: BeginActionRecordingDto
  readonly title: string
  readonly goalId: string
  readonly durationMinutes: string
  readonly unknownDuration: boolean
  readonly outcome: ActionRecordOutcomeDto | ''
  readonly lifecycle: 'keep-pending' | 'complete' | ''
  readonly summary: string
  readonly note: string
  // A transport failure must retry exactly the same request before editing/abandoning.
  readonly uncertainInput?: FirstActionRecordInputDto
}

export interface RoutineRecordingDraft {
  readonly context: BeginRoutineRecordingDto
  readonly outcome: RoutineRecordOutcomeDto
  readonly durationMinutes: string
  readonly summary: string
  readonly note: string
}

export type RecordDraft =
  | { kind: 'first'; draft: FirstActionRecordingDraft }
  | { kind: 'action'; draft: ActionRecordingDraft }
  | { kind: 'routine'; draft: RoutineRecordingDraft }
export const DRAFT_CHANNELS = {
  load: 'record-drafts:load',
  retain: 'record-drafts:retain',
  review: 'record-drafts:review',
  reconcile: 'record-drafts:reconcile',
  closeRequest: 'record-drafts:close-request',
  closeReply: 'record-drafts:close-reply'
} as const
export interface RecordDraftApi {
  load(): Promise<readonly RecordDraft[]>
  retain(input: RecordDraft & { revision: number }): Promise<void>
  review(input: { kind: RecordDraft['kind']; contextId: string }): Promise<void>
  reconcile(input: {
    kind: RecordDraft['kind']
    contextId: string
  }): Promise<'open' | 'saved' | 'discarded'>
  subscribeClose(listener: (requestId: string) => void): () => void
  replyClose(input: { requestId: string; retained: boolean }): Promise<void>
}

// Compare values, not whether a form was opened or touched. Expansion is reading state.
export function hasRecordInput(value: RecordDraft): boolean {
  const d = value.draft
  if (value.kind === 'first') {
    const f = value.draft
    return Boolean(
      f.title ||
      f.goalId ||
      f.durationMinutes ||
      f.unknownDuration ||
      f.outcome ||
      f.lifecycle ||
      f.summary ||
      f.note ||
      f.uncertainInput
    )
  }
  if (value.kind === 'routine')
    return Boolean(d.durationMinutes || d.summary || d.note || value.draft.outcome !== 'acted')
  const a = value.draft
  return Boolean(
    a.durationMinutes ||
    a.summary ||
    a.note ||
    a.outcome !== 'partial' ||
    a.understanding ||
    a.confusion ||
    a.nextStep ||
    a.postAction !== 'keep-pending' ||
    a.nextMode !== 'clear' ||
    a.replacementActionId ||
    a.applyRecordedNextStep
  )
}
