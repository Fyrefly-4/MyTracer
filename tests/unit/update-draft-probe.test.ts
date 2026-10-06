import { describe, expect, it, vi } from 'vitest'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore Main is compiled by the node project; Vitest exercises this probe at runtime.
import { RendererDraftProbe } from '../../src/main/renderer-draft-probe'

describe('T083 Renderer draft probe', () => {
  it('requires a matching reply before considering a renderer clear', async () => {
    const sendRequest = vi.fn(() => true)
    const probe = new RendererDraftProbe({ sendRequest, generateId: () => 'request-1' })
    const pending = probe.request()
    expect(sendRequest).toHaveBeenCalledWith('request-1')
    probe.reply({ requestId: 'stale-request', hasUnsavedContent: false })
    probe.reply({ requestId: 'request-1', hasUnsavedContent: true })
    expect(await pending).toBe('unsaved')
  })

  it('fails closed when no renderer is available or the request times out', async () => {
    const missing = new RendererDraftProbe({ sendRequest: () => false, generateId: () => 'x' })
    expect(await missing.request()).toBe('unavailable')
    vi.useFakeTimers()
    try {
      const stale = new RendererDraftProbe({
        sendRequest: () => true,
        generateId: () => 'y',
        deadlineMs: 10
      })
      const pending = stale.request()
      await vi.advanceTimersByTimeAsync(10)
      expect(await pending).toBe('unavailable')
    } finally {
      vi.useRealTimers()
    }
  })
})
