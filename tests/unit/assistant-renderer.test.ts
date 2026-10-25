import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AssistantController } from '../../src/renderer/src/features/assistant/assistant-controller'
import {
  createFakeAssistantAdapter,
  syntheticAssistantEntries
} from '../../src/renderer/src/features/assistant/fake-assistant-adapter'
import { AssistantPanel } from '../../src/renderer/src/features/assistant/AssistantPanel'
import { AssistantSettings } from '../../src/renderer/src/features/assistant/AssistantSettings'

function setup(options: Parameters<typeof createFakeAssistantAdapter>[0] = {}) {
  const fake = createFakeAssistantAdapter({ delayMs: 0, ...options })
  return { ...fake, controller: new AssistantController(fake.api, fake.status, true) }
}
const launch = syntheticAssistantEntries[0]

describe('Assistant renderer orchestration with synthetic-only adapter', () => {
  it('opens each entry without requesting a model and resumes old goal sessions regardless of date', async () => {
    const { api, controller } = setup()
    const send = vi.spyOn(api, 'sendTurn')
    for (const entry of syntheticAssistantEntries) {
      await controller.open(entry)
      expect(controller.getSnapshot().session?.entry).toEqual(entry.entry)
      controller.close()
    }
    await controller.open(syntheticAssistantEntries[1])
    const id = controller.getSnapshot().session?.id
    await controller.send('接着整理')
    controller.close()
    await controller.open(syntheticAssistantEntries[1])
    expect(controller.getSnapshot().session?.id).toBe(id)
    expect(controller.getSnapshot().session?.messages).toHaveLength(2)
    expect(send).toHaveBeenCalledTimes(1)
  })
  it('ignores a late response after stopping and never implicitly retries on reopen', async () => {
    const { controller, api } = setup({ delayMs: 100, ignoreCancellation: true })
    await controller.open(launch)
    const inFlight = vi.spyOn(api, 'sendTurn')
    const pending = controller.send('整理')
    await vi.waitFor(() => expect(inFlight).toHaveBeenCalledTimes(1), { interval: 1 })
    controller.stop()
    await pending
    expect(controller.getSnapshot().run).toBeNull()
    expect(controller.getSnapshot().notice).toContain('晚到')
    const send = vi.spyOn(api, 'sendTurn').mockClear()
    controller.close()
    await controller.open(launch)
    expect(send).not.toHaveBeenCalled()
  })
  it('does not let an old turn overwrite another selected session', async () => {
    const { controller, api } = setup({ delayMs: 100, ignoreCancellation: true })
    await controller.open(launch)
    const inFlight = vi.spyOn(api, 'sendTurn')
    const pending = controller.send('整理')
    await vi.waitFor(() => expect(inFlight).toHaveBeenCalledTimes(1), { interval: 1 })
    await controller.open(syntheticAssistantEntries[1])
    const selected = controller.getSnapshot().session?.id
    await pending
    expect(controller.getSnapshot().session?.id).toBe(selected)
    expect(controller.getSnapshot().run).toBeNull()
  })
  it('discards temporary sessions on close and mode switch, without writing to browser storage', async () => {
    const { controller, api } = setup()
    await controller.open(launch, 'temporary')
    const id = controller.getSnapshot().session!.id
    expect(controller.getSnapshot().sessions).toHaveLength(0)
    await controller.open(launch, 'persistent')
    expect((await api.getSession({ sessionId: id })).ok).toBe(false)
    await controller.open(launch, 'temporary')
    const second = controller.getSnapshot().session!.id
    controller.close()
    expect((await api.getSession({ sessionId: second })).ok).toBe(false)
  })
  it('rejects stale editor input before and after asynchronous preview and never writes on fill', async () => {
    const { controller, api, writes } = setup()
    let revision = 'draft-1'
    const apply = vi.fn(() => true)
    await controller.open({ ...launch, draft: { revision: () => revision, apply } })
    await controller.send('整理')
    const candidate = controller.getSnapshot().run!.candidates[0]
    revision = 'draft-2'
    await controller.preview(candidate, candidate.payload, true)
    expect(apply).not.toHaveBeenCalled()
    revision = 'draft-1'
    const preview = api.previewWrite
    vi.spyOn(api, 'previewWrite').mockImplementation(async (input) => {
      const result = await preview(input)
      revision = 'draft-3'
      return result
    })
    await controller.preview(candidate, candidate.payload, true)
    expect(apply).not.toHaveBeenCalled()
    expect(writes).toHaveLength(0)
    expect(controller.getSnapshot().notice).toContain('没有覆盖')
  })
  it('fills only an unchanged editor, separately previews formal write, and suppresses duplicate confirmation', async () => {
    const { controller, writes } = setup()
    const apply = vi.fn(() => true)
    await controller.open({ ...launch, draft: { revision: () => 'draft-1', apply } })
    await controller.send('整理')
    const candidate = controller.getSnapshot().run!.candidates[0]
    await controller.preview(candidate, candidate.payload, true)
    expect(apply).toHaveBeenCalledTimes(1)
    expect(writes).toHaveLength(0)
    await controller.preview(candidate, candidate.payload)
    expect(writes).toHaveLength(0)
    await Promise.all([controller.confirm(), controller.confirm()])
    expect(writes).toHaveLength(1)
    await controller.remove(controller.getSnapshot().session!.id)
    expect(writes).toHaveLength(1)
    expect(controller.getSnapshot().session).toBeNull()
  })
  it('marks uncertain candidates and does not retry an uncertain write', async () => {
    const { api, controller } = setup()
    await controller.open(launch)
    await controller.send('整理')
    const candidate = controller.getSnapshot().run!.candidates[0]
    await controller.preview(candidate, candidate.payload)
    const realConfirm = api.confirmWrite
    const confirm = vi
      .spyOn(api, 'confirmWrite')
      .mockResolvedValueOnce({ ok: false, error: { code: 'operation-uncertain' } })
      .mockImplementationOnce(realConfirm)
    await controller.confirm()
    await controller.confirm()
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(controller.getSnapshot().run!.candidates[0].state).toBe('uncertain')
    expect(controller.getSnapshot().notice).toContain('请先检查目标记录')
  })
  it('invalidates previews on scope change and shows safe configuration/provider failure messages', async () => {
    const { controller, api } = setup()
    await controller.open(launch)
    await controller.send('整理')
    const candidate = controller.getSnapshot().run!.candidates[0]
    await controller.preview(candidate, candidate.payload)
    await controller.changeScope(controller.getSnapshot().session!.scope)
    expect(controller.getSnapshot().preview).toBeNull()
    expect(controller.getSnapshot().run).toBeNull()
    controller.updateService({ ...controller.service, credentialPresent: false })
    const send = vi.spyOn(api, 'sendTurn')
    await controller.send('整理')
    expect(send).not.toHaveBeenCalled()
    expect(controller.getSnapshot().notice).toContain('尚未配置')
    const failed = setup({ failSend: true })
    await failed.controller.open(launch)
    await failed.controller.send('整理')
    expect(failed.controller.getSnapshot().notice).toContain('服务暂时不可用')
  })
  it('rejects non-synthetic object IDs and renders escaped text, explicit simulation and honest capabilities', async () => {
    const { controller, api, serviceApi } = setup()
    const result = await api.createSession({
      entry: { object: { kind: 'goal', id: 'real-data' }, intent: 'resume' },
      mode: 'persistent'
    })
    expect(result.ok).toBe(false)
    await controller.open({ ...launch, label: '<script>alert(1)</script>' })
    const html = renderToStaticMarkup(createElement(AssistantPanel, { controller }))
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('合成数据')
    expect(html).toContain('仅内存')
    expect(html).toContain('未知不代表支持')
    const settings = renderToStaticMarkup(
      createElement(AssistantSettings, { api: serviceApi, simulation: true })
    )
    expect(settings).toContain('type="password"')
    expect(settings).toContain('模拟设置')
  })
})

it('uses the refreshed revision after a confirmed write before sending again', async () => {
  const { controller, api } = setup()
  await controller.open(launch)
  await controller.send('整理')
  const candidate = controller.getSnapshot().run!.candidates[0]
  await controller.preview(candidate, candidate.payload)
  await controller.confirm()
  const current = await api.getSession({ sessionId: controller.getSnapshot().session!.id })
  expect(current.ok).toBe(true)
  const send = vi.spyOn(api, 'sendTurn')
  await controller.send('继续')
  expect(send.mock.calls[0][0].expectedRevision).toBe(current.ok ? current.value.revision : -1)
  expect(controller.getSnapshot().run?.state).toBe('completed')
})

it('shows running read-only steps while a final-result send is still pending', async () => {
  const { controller, api } = setup()
  await controller.open(launch)
  await controller.send('首次')
  const initial = controller.getSnapshot().run!
  const send = api.sendTurn
  vi.spyOn(api, 'sendTurn').mockImplementation(async (input) => {
    await new Promise((resolve) => setTimeout(resolve, 650))
    return send(input)
  })
  vi.spyOn(api, 'getRun').mockImplementation(async (input) => ({
    ok: true,
    value: {
      ...initial,
      requestId: input.requestId,
      state: 'running',
      steps: [{ call: { name: 'getStatistics' }, sources: [], truncated: false, omittedCount: 0 }]
    }
  }))
  const pending = controller.send('继续')
  await vi.waitFor(() => expect(controller.getSnapshot().run?.steps).toHaveLength(1), {
    timeout: 1000
  })
  expect(controller.getSnapshot().busy).toBe(true)
  await pending
  expect(controller.getSnapshot().run?.state).toBe('completed')
})

it('fills a validated review editor draft but never requests formal review save', async () => {
  const { controller, api, writes } = setup()
  const apply = vi.fn(() => true)
  await controller.open({
    ...syntheticAssistantEntries[2],
    draft: { revision: () => 'draft-1', apply }
  })
  await controller.send('回顾')
  const candidate = controller.getSnapshot().run!.candidates[0]
  const preview = vi.spyOn(api, 'previewWrite')
  await controller.preview(candidate, candidate.payload)
  expect(preview).not.toHaveBeenCalled()
  expect(controller.getSnapshot().notice).toContain('不直接保存复盘')
  await controller.preview(candidate, candidate.payload, true)
  expect(apply).toHaveBeenCalledTimes(1)
  expect(writes).toHaveLength(0)
  expect(controller.getSnapshot().notice).toContain('未保存草稿')
})

it('explicit new goal conversation creates a different ID while resume reuses history', async () => {
  const { controller } = setup()
  const goal = syntheticAssistantEntries[1]
  await controller.open(goal)
  const first = controller.getSnapshot().session!.id
  await controller.send('接续')
  await controller.open(goal)
  expect(controller.getSnapshot().session!.id).toBe(first)
  await controller.createNew(goal, 'persistent')
  expect(controller.getSnapshot().session!.id).not.toBe(first)
  expect(controller.getSnapshot().session!.messages).toHaveLength(0)
})

it('refreshes the authoritative turn revision after cancel before scope change or next send', async () => {
  const { controller, api } = setup()
  await controller.open(launch)
  const originalSession = controller.getSnapshot().session!
  let current = originalSession
  let finish: (() => void) | undefined
  const send = vi
    .spyOn(api, 'sendTurn')
    .mockImplementationOnce(async () => {
      current = { ...current, revision: current.revision + 1 }
      await new Promise<void>((resolve) => {
        finish = resolve
      })
      return { ok: false, error: { code: 'cancelled' } }
    })
    .mockImplementationOnce(async (input) => {
      expect(input.expectedRevision).toBe(current.revision)
      return { ok: false, error: { code: 'provider-unavailable' } }
    })
  vi.spyOn(api, 'getSession').mockImplementation(async () => ({ ok: true, value: current }))
  vi.spyOn(api, 'cancelTurn').mockImplementation(async () => {
    finish?.()
    return { ok: true, value: { cancelled: true } }
  })
  const first = controller.send('开始')
  await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1))
  controller.stop()
  await first
  await vi.waitFor(() => expect(controller.getSnapshot().busy).toBe(false))
  expect(controller.getSnapshot().session!.revision).toBe(originalSession.revision + 1)
  const scope = vi.spyOn(api, 'setScope').mockImplementation(async (input) => {
    expect(input.expectedRevision).toBe(current.revision)
    return { ok: true, value: current }
  })
  await controller.changeScope(current.scope)
  expect(scope).toHaveBeenCalledTimes(1)
  await controller.send('继续')
  expect(send).toHaveBeenCalledTimes(2)
})

it('reloads authoritative committed and sibling-stale candidates after confirmation', async () => {
  const { controller, api } = setup()
  await controller.open(launch)
  await controller.send('整理')
  const run = controller.getSnapshot().run!
  const candidate = run.candidates[0]
  const sibling = { ...candidate, id: 'sibling' }
  const get = api.getSession
  vi.spyOn(api, 'getSession').mockImplementation(get)
  vi.spyOn(api, 'getRun').mockResolvedValue({
    ok: true,
    value: {
      ...run,
      candidates: [
        { ...candidate, state: 'committed' },
        { ...sibling, state: 'stale' }
      ]
    }
  })
  await controller.preview(candidate, candidate.payload)
  const revision = controller.getSnapshot().session!.revision
  await controller.confirm()
  expect(controller.getSnapshot().session!.revision).toBe(revision + 1)
  expect(controller.getSnapshot().run!.candidates.map((c) => c.state)).toEqual([
    'committed',
    'stale'
  ])
})
