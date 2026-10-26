import { createHash, randomUUID } from 'node:crypto'
import { expect, it, vi } from 'vitest'
import { AssistantSessionService } from '../../src/application/assistant/service'
import { ActionRecordingContextStore } from '../../src/main/action-recording-contexts'
import type { AssistantCandidatePayload } from '../../src/contracts/assistant'

function setup() {
  const contexts = new ActionRecordingContextStore(randomUUID)
  const context = contexts.begin(1, 'unsaved-action', '2026-10-26', true)
  const target = { kind: 'record-draft' as const, id: context.id }
  const payload: AssistantCandidatePayload = {
    kind: 'record-summary',
    text: '只整理了一部分，时长不确定。'
  }
  const readSnapshot = vi.fn(() => {
    throw new Error('must not read business data')
  })
  const save = vi.fn()
  const complete = vi.fn(async (request: { requestId: string }) => ({
    requestId: request.requestId,
    text: JSON.stringify({
      text: '候选',
      sourceRefs: [target],
      candidates: [{ target, sourceRefs: [target], payload }]
    }),
    toolCalls: [],
    finishReason: 'stop' as const
  }))
  const service = new AssistantSessionService({
    store: { load: () => ({ version: 1, sessions: [], operations: [] }), save },
    provider: { complete },
    readSnapshot,
    resolveRecordDraft: (id) => contexts.firstDraft(1, id),
    fingerprint: (value) => createHash('sha256').update(value).digest('hex'),
    generateId: randomUUID,
    now: () => '2026-10-26T12:00:00Z'
  })
  const entry = {
    object: target,
    intent: 'organize',
    editorText: '都收好了。不对，右侧没动。5分钟？也许20。',
    editorRevision: 'draft-1'
  }
  const session = service.createSession({ entry, mode: 'temporary' })
  const run = () =>
    service.sendTurn({
      sessionId: session.id,
      expectedRevision: session.revision,
      requestId: randomUUID(),
      text: '保留不确定性，提炼简述'
    })
  return {
    contexts,
    context,
    target,
    payload,
    readSnapshot,
    save,
    complete,
    service,
    entry,
    session,
    run
  }
}
it('only uses current unsaved text and owned context; candidate preview never persists or reads records', async () => {
  const h = setup()
  const run = await h.run()
  expect(run.state).toBe('completed')
  expect(run.manifest.sources.every((s) => s.ref.id === h.context.id)).toBe(true)
  expect(JSON.stringify(run.manifest)).toContain(h.entry.editorText)
  const candidate = run.candidates[0]
  const preview = h.service.previewWrite({
    sessionId: h.session.id,
    candidateId: candidate.id,
    payload: candidate.payload,
    expectedTargetRevision: candidate.expectedTargetRevision
  })
  expect(preview).toMatchObject({
    destination: 'editor-draft',
    editorRevision: 'draft-1',
    payload: h.payload
  })
  expect(() =>
    h.service.confirmWrite({
      sessionId: h.session.id,
      previewId: preview.previewId,
      operationId: randomUUID()
    })
  ).toThrow('unsupported')
  expect(h.readSnapshot).not.toHaveBeenCalled()
  expect(h.save).not.toHaveBeenCalled()
  h.contexts.cancel(1, h.context.id)
  expect(() =>
    h.service.previewWrite({
      sessionId: h.session.id,
      candidateId: candidate.id,
      payload: candidate.payload,
      expectedTargetRevision: candidate.expectedTargetRevision
    })
  ).toThrow('stale-context')
})
it('rejects persistence, missing text, forged contexts and expanded scope', () => {
  const h = setup()
  expect(() => h.service.createSession({ entry: h.entry, mode: 'persistent' })).toThrow(
    'validation'
  )
  expect(() =>
    h.service.createSession({ entry: { object: h.target, intent: 'organize' }, mode: 'temporary' })
  ).toThrow('validation')
  expect(() =>
    h.service.createSession({
      entry: { ...h.entry, object: { ...h.target, id: 'forged' } },
      mode: 'temporary'
    })
  ).toThrow('stale-context')
  expect(() =>
    h.service.setScope({
      sessionId: h.session.id,
      expectedRevision: h.session.revision,
      scope: { current: h.target, selectedObjects: [{ kind: 'goal', id: 'outside' }] }
    })
  ).toThrow('validation')
  expect(h.contexts.firstDraft(2, h.context.id)).toBeNull()
  const regular = h.contexts.begin(1, 'regular', '2026-10-26')
  expect(h.contexts.firstDraft(1, regular.id)).toBeNull()
  expect(h.readSnapshot).not.toHaveBeenCalled()
})
it('a cancelled context invalidates a late provider answer', async () => {
  const h = setup()
  const original = h.complete.getMockImplementation()!
  h.complete.mockImplementation(async (request) => {
    h.contexts.cancel(1, h.context.id)
    return original(request)
  })
  const result = await h.run()
  expect(result.state).toBe('failed')
  expect(result.candidates).toEqual([])
  expect(h.save).not.toHaveBeenCalled()
})
it('rejects append and action proposals for an unsaved first note', async () => {
  const h = setup()
  h.complete.mockImplementation(async (request) => ({
    requestId: request.requestId,
    text: JSON.stringify({
      text: '候选',
      sourceRefs: [h.target],
      candidates: [
        {
          target: h.target,
          sourceRefs: [h.target],
          payload: { kind: 'note-append', text: 'unsupported' }
        }
      ]
    }),
    toolCalls: [],
    finishReason: 'stop'
  }))
  expect((await h.run()).state).toBe('failed')
})
