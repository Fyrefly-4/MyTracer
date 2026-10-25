import { createHash, randomUUID } from 'node:crypto'
import { expect, it, vi } from 'vitest'
import { AssistantSessionService } from '../../src/application/assistant/service'
import { AssistantError } from '../../src/application/assistant/validation'
import type {
  AssistantApi,
  AssistantCandidatePayload,
  AssistantResult
} from '../../src/contracts/assistant'
import type { CorePersistenceSnapshot } from '../../src/application/ports/persistence'
import { AssistantController } from '../../src/renderer/src/features/assistant/assistant-controller'

/** Real B orchestration and context validation; only provider, storage and business writer are fake. */
function setup() {
  const target = { kind: 'review' as const, id: 'live-review-context' }
  const payload: AssistantCandidatePayload = {
    kind: 'review-draft',
    confirmedProgress: '清出一小块书桌。',
    mainObstacle: '右侧暂未整理，其他日期保持未知。',
    nextAdjustment: '下次只整理右侧的一角。'
  }
  let active = true
  let editorRevision = 'editor-1'
  const timestamps = { createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' }
  let snapshot: CorePersistenceSnapshot = {
    goals: [],
    actions: [],
    actionRecords: [],
    routines: [],
    routineRecords: [],
    routineScheduleDays: [],
    todaySelections: [],
    understandings: [],
    confusions: [],
    reviewResults: [
      {
        id: 'selected-fact',
        periodStartedOn: '2026-10-01',
        confirmedProgress: '整理了一角。',
        mainObstacle: '还有纸张。',
        nextAdjustment: '先保留。',
        goalId: null,
        ...timestamps
      }
    ]
  }
  const write = vi.fn(() => target)
  const service = new AssistantSessionService({
    store: { load: () => ({ version: 1, sessions: [], operations: [] }), save: () => undefined },
    provider: {
      complete: async (request) => ({
        requestId: request.requestId,
        text: JSON.stringify({
          text: '这是可修改的候选。',
          sourceRefs: [target, { kind: 'review', id: 'selected-fact' }],
          candidates: [
            { target, sourceRefs: [target, { kind: 'review', id: 'selected-fact' }], payload }
          ]
        }),
        toolCalls: [],
        finishReason: 'stop'
      })
    },
    resolveReviewContext: (id) =>
      active && id === target.id
        ? { periodStartedOn: '2026-10-01', periodEndedOn: '2026-10-31' }
        : null,
    readSnapshot: () => snapshot,
    fingerprint: (value) => createHash('sha256').update(value).digest('hex'),
    generateId: randomUUID,
    now: () => '2026-10-25T00:00:00Z',
    write
  })
  async function result<T>(work: () => T | Promise<T>): Promise<AssistantResult<T>> {
    try {
      return { ok: true, value: await work() }
    } catch (error) {
      if (!(error instanceof AssistantError)) throw error
      return { ok: false, error: { code: error.code } }
    }
  }
  const api: AssistantApi = {
    createSession: (input) => result(() => service.createSession(input)),
    listSessions: () => result(() => service.listSessions()),
    getSession: (input) => result(() => service.getSession(input)),
    deleteSession: (input) => result(() => service.deleteSession(input)),
    setScope: (input) => result(() => service.setScope(input)),
    sendTurn: (input) => result(() => service.sendTurn(input)),
    getRun: (input) => result(() => service.getRun(input)),
    cancelTurn: (input) => result(() => service.cancelTurn(input)),
    previewWrite: (input) => result(() => service.previewWrite(input)),
    confirmWrite: (input) => result(() => service.confirmWrite(input))
  }
  const controller = new AssistantController(
    api,
    {
      endpoint: 'https://synthetic.invalid/v1',
      model: 'fake',
      enabled: true,
      credentialPresent: true
    },
    true
  )
  const apply = vi.fn(() => true)
  const launch = {
    label: '选定事实回顾',
    entry: {
      object: target,
      intent: 'review' as const,
      editorText: '显式选定：整理了一角书桌。',
      editorRevision
    },
    selectedObjects: [{ kind: 'review' as const, id: 'selected-fact' }],
    draft: { revision: () => editorRevision, apply }
  }
  return {
    controller,
    api,
    service,
    payload,
    write,
    apply,
    launch,
    expire: () => {
      active = false
    },
    edit: () => {
      editorRevision = 'editor-2'
    },
    changeSource: () => {
      snapshot = {
        ...snapshot,
        reviewResults: snapshot.reviewResults.map((record) => ({
          ...record,
          confirmedProgress: '来源已经修改。'
        }))
      }
    }
  }
}

it('real B review preview fills all three draft fields and performs zero business writes', async () => {
  const h = setup()
  await h.controller.open(h.launch)
  await h.controller.send('回顾选定内容')
  const run = h.controller.getSnapshot().run!
  expect(run.state).toBe('completed')
  expect(run.manifest.sources.some((source) => source.ref.id === 'selected-fact')).toBe(true)
  const candidate = run.candidates[0]
  const previewSpy = vi.spyOn(h.api, 'previewWrite')
  await h.controller.preview(candidate, candidate.payload, true)
  expect(h.apply).toHaveBeenCalledExactlyOnceWith(h.payload)
  const result = await previewSpy.mock.results[0].value
  expect(result).toMatchObject({
    ok: true,
    value: { destination: 'editor-draft', editorRevision: 'editor-1', payload: h.payload }
  })
  if (!result.ok) throw new Error('expected preview')
  const confirm = await h.api.confirmWrite({
    sessionId: h.controller.getSnapshot().session!.id,
    previewId: result.value.previewId,
    operationId: 'not-a-review-write'
  })
  expect(confirm).toEqual({ ok: false, error: { code: 'unsupported' } })
  expect(h.write).not.toHaveBeenCalled()
})

it.each(['expire', 'edit', 'changeSource'] as const)(
  'real B review fill rejects changed %s',
  async (change) => {
    const h = setup()
    await h.controller.open(h.launch)
    await h.controller.send('回顾')
    const candidate = h.controller.getSnapshot().run!.candidates[0]
    h[change]()
    await h.controller.preview(candidate, candidate.payload, true)
    expect(h.apply).not.toHaveBeenCalled()
    expect(h.write).not.toHaveBeenCalled()
    expect(h.controller.getSnapshot().notice).toContain('没有覆盖新输入')
  }
)

it('rejects a mismatched preview editor token even if the local editor is unchanged', async () => {
  const h = setup()
  await h.controller.open(h.launch)
  await h.controller.send('回顾')
  const candidate = h.controller.getSnapshot().run!.candidates[0]
  const real = h.api.previewWrite
  vi.spyOn(h.api, 'previewWrite').mockImplementation(async (input) => {
    const result = await real(input)
    return result.ok
      ? { ok: true, value: { ...result.value, editorRevision: 'wrong-token' } }
      : result
  })
  await h.controller.preview(candidate, candidate.payload, true)
  expect(h.apply).not.toHaveBeenCalled()
  expect(h.write).not.toHaveBeenCalled()
})
