/** Shared, data-only Assistant contract. No provider, storage or renderer authority. */
export interface AssistantObjectRef {
  readonly kind:
    | 'goal'
    | 'action'
    | 'action-record'
    | 'routine-record'
    | 'review'
    | 'conversation'
    | 'record-draft'
  readonly id: string
}
export interface AssistantEntry {
  readonly object: AssistantObjectRef
  readonly intent: 'organize' | 'clarify' | 'resume' | 'review' | 'chat'
  readonly editorText?: string
  readonly editorRevision?: string
}
export interface AssistantScope {
  readonly current: AssistantObjectRef
  readonly selectedObjects: readonly AssistantObjectRef[]
  readonly goalId?: string
  readonly dateRange?: { readonly from: string; readonly to: string }
}
export interface AssistantSource {
  readonly ref: AssistantObjectRef
  readonly sourceRevision: string
  readonly label: string
  readonly excerpt: string
  readonly fields: readonly string[]
  readonly origin: 'saved' | 'editor-draft'
  readonly truncated: boolean
}
export interface AssistantContextManifest {
  readonly revision: string
  readonly scopeRevision: number
  readonly sources: readonly AssistantSource[]
  readonly truncated: boolean
  readonly omittedCount: number
  readonly historyOmittedCount: number
}
export interface AssistantMessage {
  readonly id: string
  readonly role: 'user' | 'assistant'
  readonly text: string
  readonly sourceRefs: readonly AssistantObjectRef[]
  readonly createdAt: string
}
export interface AssistantSession {
  /** Earlier messages remain visible locally but are excluded after a scope change. */
  readonly historyStartIndex?: number
  readonly id: string
  readonly mode: 'persistent' | 'temporary'
  readonly entry: AssistantEntry
  readonly scope: AssistantScope
  readonly revision: number
  readonly messages: readonly AssistantMessage[]
  readonly createdAt: string
  readonly updatedAt: string
}
export type AssistantSessionSummary = Omit<AssistantSession, 'messages' | 'scope'> & {
  readonly title?: string
}
export interface AssistantTurnInput {
  readonly sessionId: string
  readonly expectedRevision: number
  readonly requestId: string
  readonly text: string
}
export type AssistantToolCall =
  | {
      readonly name: 'findRecords'
      readonly keyword?: string
      readonly from?: string
      readonly to?: string
    }
  | { readonly name: 'readGoal'; readonly goalId: string }
  | { readonly name: 'getStatistics' }
export interface AssistantStatistics {
  readonly recordCount: number
  readonly totalDurationMinutes: number
  readonly unknownDurationCount: number
  readonly outcomes: Readonly<Record<string, number>>
  readonly unknownPolicy: 'absence-is-unknown-not-counted-as-not-done'
}
export interface AssistantToolResult {
  readonly call: AssistantToolCall
  readonly sources: readonly AssistantSource[]
  readonly statistics?: AssistantStatistics
  readonly truncated: boolean
  readonly omittedCount: number
}
export type AssistantCandidatePayload =
  | { readonly kind: 'record-summary'; readonly text: string }
  | { readonly kind: 'note-append'; readonly text: string }
  | { readonly kind: 'action-create'; readonly title: string; readonly description?: string }
  | {
      readonly kind: 'review-draft'
      readonly confirmedProgress: string
      readonly mainObstacle: string
      readonly nextAdjustment: string
    }
export interface AssistantCandidate {
  readonly id: string
  readonly requestId: string
  readonly sourceRefs: readonly AssistantObjectRef[]
  readonly target: AssistantObjectRef
  readonly expectedTargetRevision: string
  readonly payload: AssistantCandidatePayload
  readonly state: 'proposed' | 'stale' | 'committing' | 'committed' | 'uncertain'
}
export interface AssistantBudget {
  readonly maxToolCalls: number
  readonly usedToolCalls: number
  readonly maxOutputCharacters: number
  readonly usedOutputCharacters: number
  readonly maxHistoryMessages: number
}
export interface AssistantRun {
  readonly requestId: string
  readonly state: 'running' | 'completed' | 'cancelled' | 'failed'
  readonly manifest: AssistantContextManifest
  readonly steps: readonly AssistantToolResult[]
  readonly messages: readonly AssistantMessage[]
  readonly candidates: readonly AssistantCandidate[]
  readonly budget: AssistantBudget
  readonly error?: { readonly code: AssistantErrorCode }
}
export interface AssistantWritePreview {
  /** Local editor token only; never permission to save a review. */
  readonly editorRevision?: string
  readonly destination?: 'editor-draft' | 'application-command'
  readonly previewId: string
  readonly candidateId: string
  readonly sessionRevision: number
  readonly sources: readonly AssistantSource[]
  readonly targetRevision: string
  readonly payload: AssistantCandidatePayload
  readonly changes: readonly {
    readonly target: AssistantObjectRef
    readonly label: string
    readonly before: string
    readonly after: string
  }[]
}
export interface AssistantWriteReceipt {
  readonly operationId: string
  readonly previewId: string
  readonly target: AssistantObjectRef
  readonly status: 'committed'
}
export type AssistantErrorCode =
  | 'validation'
  | 'not-found'
  | 'stale-context'
  | 'out-of-scope'
  | 'busy'
  | 'cancelled'
  | 'budget-exceeded'
  | 'invalid-response'
  | 'provider-unavailable'
  | 'persistence-failed'
  | 'unsupported'
  | 'operation-uncertain'
export type AssistantResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: AssistantErrorCode } }
export interface AssistantSessionInput {
  readonly sessionId: string
}
export interface AssistantRunInput extends AssistantSessionInput {
  readonly requestId: string
}
export interface AssistantPreviewInput extends AssistantSessionInput {
  readonly candidateId: string
  readonly payload: AssistantCandidatePayload
  readonly expectedTargetRevision: string
}
export interface AssistantConfirmInput extends AssistantSessionInput {
  readonly previewId: string
  readonly operationId: string
}
export const ASSISTANT_CHANNELS = Object.freeze({
  createSession: 'assistant:create-session',
  listSessions: 'assistant:list-sessions',
  getSession: 'assistant:get-session',
  deleteSession: 'assistant:delete-session',
  setScope: 'assistant:set-scope',
  sendTurn: 'assistant:send-turn',
  getRun: 'assistant:get-run',
  cancelTurn: 'assistant:cancel-turn',
  previewWrite: 'assistant:preview-write',
  confirmWrite: 'assistant:confirm-write'
} as const)
export interface AssistantApi {
  readonly createSession: (input: {
    readonly entry: AssistantEntry
    readonly mode: AssistantSession['mode']
  }) => Promise<AssistantResult<AssistantSession>>
  readonly listSessions: () => Promise<AssistantResult<readonly AssistantSessionSummary[]>>
  readonly getSession: (input: AssistantSessionInput) => Promise<AssistantResult<AssistantSession>>
  readonly deleteSession: (
    input: AssistantSessionInput
  ) => Promise<AssistantResult<{ readonly deleted: true }>>
  readonly setScope: (
    input: AssistantSessionInput & {
      readonly expectedRevision: number
      readonly scope: AssistantScope
    }
  ) => Promise<AssistantResult<AssistantSession>>
  readonly sendTurn: (input: AssistantTurnInput) => Promise<AssistantResult<AssistantRun>>
  readonly getRun: (input: AssistantRunInput) => Promise<AssistantResult<AssistantRun>>
  readonly cancelTurn: (
    input: AssistantRunInput
  ) => Promise<AssistantResult<{ readonly cancelled: true }>>
  readonly previewWrite: (
    input: AssistantPreviewInput
  ) => Promise<AssistantResult<AssistantWritePreview>>
  readonly confirmWrite: (
    input: AssistantConfirmInput
  ) => Promise<AssistantResult<AssistantWriteReceipt>>
}
