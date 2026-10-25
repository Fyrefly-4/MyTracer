/** Explicit synthetic-only exploration adapter. Never installed as a production fallback. */
import type {
  AssistantApi,
  AssistantCandidate,
  AssistantEntry,
  AssistantResult,
  AssistantRun,
  AssistantSession,
  AssistantSource,
  AssistantWritePreview
} from '../../../../contracts/assistant'
import type {
  AssistantServiceApi,
  AssistantServiceStatus
} from '../../../../contracts/assistant-service'
import { candidateText } from './assistant-controller'
export const syntheticAssistantEntries: readonly { label: string; entry: AssistantEntry }[] = [
  {
    label: '整理居住空间 · 未保存笔记',
    entry: {
      object: { kind: 'action-record', id: 'synthetic-record' },
      intent: 'organize',
      editorText: '今天清理了书桌左侧，把散落的纸放进一个盒子。还有右侧没整理。',
      editorRevision: 'draft-1'
    }
  },
  {
    label: '整理居住空间',
    entry: { object: { kind: 'goal', id: 'synthetic-goal' }, intent: 'resume' }
  },
  {
    label: '本周选定事实',
    entry: {
      object: { kind: 'review', id: 'synthetic-review' },
      intent: 'review',
      editorText: '本周整理书桌一次；其他日期未记录。',
      editorRevision: 'draft-1'
    }
  }
]
const ok = <T>(value: T): AssistantResult<T> => ({ ok: true, value })
const failure = <T>(
  code:
    | 'not-found'
    | 'stale-context'
    | 'out-of-scope'
    | 'cancelled'
    | 'provider-unavailable'
    | 'unsupported'
    | 'validation'
): AssistantResult<T> => ({ ok: false, error: { code } })
export function createFakeAssistantAdapter(
  options: { delayMs?: number; failSend?: boolean; ignoreCancellation?: boolean } = {}
): {
  api: AssistantApi
  serviceApi: AssistantServiceApi
  status: AssistantServiceStatus
  writes: string[]
} {
  const sessions = new Map<string, AssistantSession>()
  const runs = new Map<string, AssistantRun>()
  const previews = new Map<string, AssistantWritePreview & { sessionId: string }>()
  const cancelled = new Set<string>()
  const receipts = new Map<
    string,
    {
      operationId: string
      previewId: string
      target: AssistantEntry['object']
      status: 'committed'
    }
  >()
  const writes: string[] = []
  let status: AssistantServiceStatus = {
    endpoint: 'https://synthetic.invalid/v1',
    model: 'synthetic-organizer',
    enabled: true,
    credentialPresent: true,
    credentialProtection: 'available'
  }
  const api: AssistantApi = {
    createSession: async ({ entry, mode }) => {
      if (
        entry.editorText !== undefined &&
        (!entry.editorText.trim() ||
          entry.editorText.length > 12000 ||
          !entry.editorRevision ||
          entry.editorRevision.length > 128)
      )
        return failure('validation')
      if (
        !syntheticAssistantEntries.some(
          (item) =>
            item.entry.object.id === entry.object.id && item.entry.object.kind === entry.object.kind
        )
      )
        return failure('out-of-scope')
      const time = new Date().toISOString()
      const session: AssistantSession = {
        id: crypto.randomUUID(),
        mode,
        entry,
        scope: { current: entry.object, selectedObjects: [] },
        revision: 1,
        messages: [],
        createdAt: time,
        updatedAt: time
      }
      sessions.set(session.id, session)
      return ok(session)
    },
    listSessions: async () =>
      ok(
        [...sessions.values()]
          .filter((s) => s.mode === 'persistent')
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      ),
    getSession: async ({ sessionId }) =>
      sessions.has(sessionId) ? ok(sessions.get(sessionId)!) : failure('not-found'),
    deleteSession: async ({ sessionId }) => {
      sessions.delete(sessionId)
      for (const [id, preview] of previews) if (preview.sessionId === sessionId) previews.delete(id)
      return ok({ deleted: true })
    },
    setScope: async ({ sessionId, expectedRevision, scope }) => {
      const session = sessions.get(sessionId)
      if (!session) return failure('not-found')
      if (session.revision !== expectedRevision) return failure('stale-context')
      if (
        [scope.current, ...scope.selectedObjects].some(
          (ref) =>
            !syntheticAssistantEntries.some(
              (item) => item.entry.object.id === ref.id && item.entry.object.kind === ref.kind
            )
        )
      )
        return failure('out-of-scope')
      const next = { ...session, scope, revision: session.revision + 1 }
      sessions.set(sessionId, next)
      return ok(next)
    },
    sendTurn: async ({ sessionId, expectedRevision, requestId, text }) => {
      const session = sessions.get(sessionId)
      if (!session) return failure('not-found')
      if (session.revision !== expectedRevision) return failure('stale-context')
      const userMessage = {
        id: crypto.randomUUID(),
        role: 'user' as const,
        text,
        sourceRefs: [],
        createdAt: new Date().toISOString()
      }
      sessions.set(sessionId, {
        ...session,
        revision: session.revision + 1,
        messages: [...session.messages, userMessage]
      })
      await new Promise((resolve) => setTimeout(resolve, options.delayMs ?? 350))
      if (!sessions.has(sessionId)) return failure('not-found')
      if (cancelled.has(requestId) && !options.ignoreCancellation) return failure('cancelled')
      if (options.failSend) return failure('provider-unavailable')
      const source: AssistantSource = {
        ref: session.entry.object,
        sourceRevision: 'synthetic-1',
        label: '合成来源：整理居住空间',
        excerpt: session.entry.editorText ?? '目标是让书桌可以舒服使用；上次整理了左侧。',
        fields: [session.entry.editorText ? 'editorText' : 'description'],
        origin: session.entry.editorText ? 'editor-draft' : 'saved',
        truncated: false
      }
      const candidate: AssistantCandidate = {
        id: crypto.randomUUID(),
        requestId,
        sourceRefs: [source.ref],
        target: source.ref,
        expectedTargetRevision: source.sourceRevision,
        state: 'proposed',
        payload:
          session.entry.intent === 'review'
            ? {
                kind: 'review-draft',
                confirmedProgress: '整理了一次书桌。',
                mainObstacle: '右侧仍需整理；未记录的日期保持未知。',
                nextAdjustment: '下次只整理右侧的一小块。'
              }
            : session.entry.object.kind === 'goal'
              ? { kind: 'action-create', title: '整理书桌右侧的一小块' }
              : {
                  kind: 'record-summary',
                  text: '整理了书桌左侧，把散落的纸集中到盒子里；右侧留待下次。'
                }
      }
      const messages = [
        ...session.messages,
        userMessage,
        {
          id: crypto.randomUUID(),
          role: 'assistant' as const,
          text: '这是合成服务的演示回答：你已经整理出一小块可用空间。下次可以只看书桌右侧。',
          sourceRefs: [source.ref],
          createdAt: new Date().toISOString()
        }
      ]
      const run: AssistantRun = {
        requestId,
        state: 'completed',
        manifest: {
          revision: 'synthetic-1',
          scopeRevision: session.revision,
          sources: [source],
          truncated: false,
          omittedCount: 0,
          historyOmittedCount: 0
        },
        steps: [],
        messages: messages.slice(-2),
        candidates: [candidate],
        budget: {
          maxToolCalls: 3,
          usedToolCalls: 0,
          maxOutputCharacters: 4000,
          usedOutputCharacters: 60,
          maxHistoryMessages: 12
        }
      }
      runs.set(requestId, run)
      sessions.set(sessionId, {
        ...session,
        revision: session.revision + 2,
        messages,
        updatedAt: new Date().toISOString()
      })
      return ok(run)
    },
    getRun: async ({ requestId }) =>
      runs.has(requestId) ? ok(runs.get(requestId)!) : failure('not-found'),
    cancelTurn: async ({ requestId }) => {
      cancelled.add(requestId)
      return ok({ cancelled: true })
    },
    previewWrite: async ({ sessionId, candidateId, payload, expectedTargetRevision }) => {
      if (payload.kind === 'review-draft') return failure('unsupported')
      const session = sessions.get(sessionId)
      const candidate = [...runs.values()]
        .flatMap((run) => run.candidates)
        .find((c) => c.id === candidateId)
      if (!session || !candidate) return failure('not-found')
      if (expectedTargetRevision !== 'synthetic-1') return failure('stale-context')
      const preview = {
        previewId: crypto.randomUUID(),
        candidateId,
        sessionId,
        sessionRevision: session.revision,
        sources: [],
        targetRevision: expectedTargetRevision,
        payload,
        changes: [
          {
            target: candidate.target,
            label: '模拟正式写入（不会修改真实记录）',
            before: '',
            after: candidateText(payload)
          }
        ]
      }
      previews.set(preview.previewId, preview)
      return ok(preview)
    },
    confirmWrite: async ({ sessionId, previewId, operationId }) => {
      const previous = receipts.get(operationId)
      if (previous) return ok(previous)
      const preview = previews.get(previewId)
      if (!preview || preview.sessionId !== sessionId) return failure('not-found')
      if (sessions.get(sessionId)?.revision !== preview.sessionRevision)
        return failure('stale-context')
      const receipt = {
        operationId,
        previewId,
        target: preview.changes[0].target,
        status: 'committed' as const
      }
      const session = sessions.get(sessionId)!
      sessions.set(sessionId, { ...session, revision: session.revision + 1 })
      for (const [id, run] of runs)
        runs.set(id, {
          ...run,
          candidates: run.candidates.map((candidate) => ({
            ...candidate,
            state:
              candidate.id === preview.candidateId
                ? 'committed'
                : candidate.state === 'committed'
                  ? 'committed'
                  : 'stale'
          }))
        })
      writes.push(candidateText(preview.payload))
      receipts.set(operationId, receipt)
      previews.delete(previewId)
      return ok(receipt)
    }
  }
  const serviceApi: AssistantServiceApi = {
    getStatus: async () => ({ ok: true, value: status }),
    saveConfiguration: async (input) => {
      status = {
        endpoint: input.endpoint,
        model: input.model,
        enabled: input.enabled,
        credentialPresent:
          Boolean(input.apiKey) || (input.endpoint === status.endpoint && status.credentialPresent),
        credentialProtection: 'available'
      }
      return { ok: true, value: status }
    },
    deleteCredential: async () => {
      status = { ...status, credentialPresent: false }
      return { ok: true, value: status }
    },
    testConnection: async () =>
      status.credentialPresent && status.enabled
        ? { ok: true, value: { connection: 'connected', tools: 'unknown', streaming: 'unknown' } }
        : { ok: false, error: { code: 'not-configured' } }
  }
  return { api, serviceApi, status, writes }
}
