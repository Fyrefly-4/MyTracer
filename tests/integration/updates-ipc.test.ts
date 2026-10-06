import { describe, expect, it, vi } from 'vitest'
import type { IpcMainInvokeEvent } from 'electron'
import { UpdateService } from '../../src/application/update-service'
import { UpdatePortError } from '../../src/application/ports/update'
import { UPDATE_CHANNELS } from '../../src/contracts/updates'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore Main is compiled by the node project; Vitest exercises this handler at runtime.
import { registerUpdatesIpc } from '../../src/main/updates-ipc'

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown

class FakeIpc {
  readonly handlers = new Map<string, Handler>()
  removeHandler(channel: string): void {
    this.handlers.delete(channel)
  }
  handle(channel: string, handler: Handler): void {
    this.handlers.set(channel, handler)
  }
  invoke(channel: string, senderId: number, ...args: unknown[]): unknown {
    const handler = this.handlers.get(channel)
    if (!handler) throw new Error('missing handler')
    return handler({ sender: { id: senderId } } as IpcMainInvokeEvent, ...args)
  }
}

describe('T082 update IPC boundary', () => {
  const installCoordinator = {
    install: vi.fn(async () => ({ status: { state: 'idle' as const, currentVersion: '0.1.2' } })),
    cancelPreparation: vi.fn(() => ({ state: 'idle' as const, currentVersion: '0.1.2' }))
  }
  const draftProbe = { reply: vi.fn() }
  it('exposes fixed channels, verifies sender and requires an exact candidate', async () => {
    const ipc = new FakeIpc()
    const download = vi.fn(async () => ({ verify: async () => true, startInstall: () => true }))
    const check = vi.fn(async () => ({
      version: '0.1.3',
      releaseNotes: '<script>unsafe</script>',
      download
    }))
    const service = new UpdateService({
      port: { check },
      currentVersion: '0.1.2',
      generateId: () => 'op-1'
    })
    const assertSender = vi.fn((event: IpcMainInvokeEvent) => {
      if (event.sender.id !== 1) throw new TypeError('Untrusted sender')
    })
    registerUpdatesIpc({ ipc, service, installCoordinator, draftProbe, assertSender })

    expect([...ipc.handlers.keys()].sort()).toEqual(
      [
        UPDATE_CHANNELS.status,
        UPDATE_CHANNELS.check,
        UPDATE_CHANNELS.download,
        UPDATE_CHANNELS.cancel,
        UPDATE_CHANNELS.install,
        UPDATE_CHANNELS.cancelPreparation,
        UPDATE_CHANNELS.draftReply
      ].sort()
    )
    expect(() => ipc.invoke(UPDATE_CHANNELS.check, 2)).toThrow('Untrusted sender')
    expect(() => ipc.invoke(UPDATE_CHANNELS.status, 1, {})).toThrow()
    expect(() =>
      ipc.invoke(UPDATE_CHANNELS.download, 1, {
        operationId: 'op-1',
        version: '0.1.3',
        url: 'https://evil.invalid'
      })
    ).toThrow()
    expect(() =>
      ipc.invoke(UPDATE_CHANNELS.cancel, 1, { operationId: 'op-1', filePath: 'x' })
    ).toThrow()
    expect(check).not.toHaveBeenCalled()

    const available = await ipc.invoke(UPDATE_CHANNELS.check, 1)
    expect(available).toMatchObject({ state: 'available', candidate: { version: '0.1.3' } })
    await ipc.invoke(UPDATE_CHANNELS.download, 1, { operationId: 'op-1', version: '0.1.4' })
    expect(download).not.toHaveBeenCalled()
    const result = await ipc.invoke(UPDATE_CHANNELS.download, 1, {
      operationId: 'op-1',
      version: '0.1.3'
    })
    expect(result).toMatchObject({ state: 'downloaded' })
    expect(download).toHaveBeenCalledOnce()
    expect(JSON.stringify(result)).not.toMatch(
      /token|credential|filePath|installPath|providerBody/i
    )
  })

  it('keeps source failure as a bounded DTO without exposing error detail', async () => {
    const ipc = new FakeIpc()
    const service = new UpdateService({
      port: {
        check: async () => {
          throw new UpdatePortError('authentication')
        }
      },
      currentVersion: '0.1.2',
      generateId: () => 'op-2'
    })
    registerUpdatesIpc({
      ipc,
      service,
      installCoordinator,
      draftProbe,
      assertSender: vi.fn()
    })
    expect(await ipc.invoke(UPDATE_CHANNELS.check, 1)).toEqual({
      state: 'error',
      currentVersion: '0.1.2',
      operationId: 'op-2',
      error: { code: 'authentication', retryable: true, retryAction: 'check' }
    })
  })
})
