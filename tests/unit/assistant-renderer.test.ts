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
    const { controller, api } = setup({ delayMs: 15, ignoreCancellation: true })
    await controller.open(launch)
    const pending = controller.send('整理')
    controller.stop()
    await pending
    expect(controller.getSnapshot().run).toBeNull()
    expect(controller.getSnapshot().notice).toContain('晚到')
    const send = vi.spyOn(api, 'sendTurn')
    controller.close()
    await controller.open(launch)
    expect(send).not.toHaveBeenCalled()
  })
  it('does not let an old turn overwrite another selected session', async () => {
    const { controller } = setup({ delayMs: 15, ignoreCancellation: true })
    await controller.open(launch)
    const pending = controller.send('整理')
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
  it('keeps the same operation id when confirmation outcome is uncertain', async () => {
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
    expect(confirm.mock.calls[0][0].operationId).toBe(confirm.mock.calls[1][0].operationId)
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
