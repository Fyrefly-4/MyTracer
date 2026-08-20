import type { IpcMainInvokeEvent } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import {
  CompleteExportApplicationError,
  type CompleteExportService
} from '../../src/application/complete-export'
import { EXPORT_CHANNELS } from '../../src/contracts/exports'

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown

const exportIpcModulePath = '../../src/main/exports-ipc'
const { registerExportIpc } = (await import(exportIpcModulePath)) as {
  readonly registerExportIpc: (options: {
    readonly ipc: {
      removeHandler(channel: string): void
      handle(channel: string, listener: Handler): void
    }
    readonly service: CompleteExportService
    readonly assertSender: (event: IpcMainInvokeEvent) => void
  }) => void
}

function setup() {
  const handlers = new Map<string, Handler>()
  const ipc = {
    removeHandler: vi.fn((channel: string) => handlers.delete(channel)),
    handle: vi.fn((channel: string, handler: Handler) => handlers.set(channel, handler))
  }
  const service = {
    generateCompleteExport: vi.fn(async () => ({
      kind: 'exported' as const,
      fileName: 'safe.json',
      byteLength: 7,
      exportVersion: 1 as const,
      exportedAt: '2026-08-20T08:00:00.000Z'
    }))
  }
  const assertSender = vi.fn()
  registerExportIpc({ ipc, service: service as unknown as CompleteExportService, assertSender })
  const event = { sender: { id: 7 } } as unknown as IpcMainInvokeEvent
  return {
    handlers,
    service,
    assertSender,
    invoke: (...args: unknown[]) => handlers.get(EXPORT_CHANNELS.generate)!(event, ...args)
  }
}

describe('complete export IPC boundary', () => {
  it('registers one zero-input channel and never returns a destination path or document', async () => {
    const { handlers, invoke, service } = setup()
    expect([...handlers.keys()]).toEqual([EXPORT_CHANNELS.generate])
    await expect(invoke()).resolves.toMatchObject({
      ok: true,
      value: { kind: 'exported', fileName: 'safe.json' }
    })
    expect(service.generateCompleteExport).toHaveBeenCalledOnce()
  })

  it('rejects path-like input, preserves sender rejection, and maps private failures', async () => {
    const { invoke, assertSender, service } = setup()
    await expect(invoke({ path: 'C:\\secret.json' })).resolves.toMatchObject({
      ok: false,
      error: { code: 'validation' }
    })
    service.generateCompleteExport.mockRejectedValueOnce(
      new CompleteExportApplicationError('write-failed', 'C:\\private')
    )
    const failed = await invoke()
    expect(failed).toMatchObject({ ok: false, error: { code: 'write-failed' } })
    expect(JSON.stringify(failed)).not.toContain('private')
    assertSender.mockImplementationOnce(() => {
      throw new Error('untrusted renderer')
    })
    await expect(invoke()).rejects.toThrow(/untrusted renderer/)
  })
})
