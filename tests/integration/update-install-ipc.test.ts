import { describe, expect, it, vi } from 'vitest'
import type { IpcMainInvokeEvent } from 'electron'
import { UpdateService } from '../../src/application/update-service'
import { UPDATE_CHANNELS } from '../../src/contracts/updates'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore Main is compiled by the node project; Vitest exercises IPC at runtime.
import { registerUpdatesIpc } from '../../src/main/updates-ipc'

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown

describe('T083 install IPC boundary', () => {
  it('validates trusted sender and narrow payloads before coordinating install or draft response', async () => {
    const handlers = new Map<string, Handler>()
    const service = new UpdateService({
      port: {
        check: async () => ({
          version: '0.1.4',
          releaseNotes: '',
          download: async () => ({ verify: async () => true, startInstall: () => true })
        })
      },
      currentVersion: '0.1.3',
      generateId: () => 'op-1'
    })
    const coordinator = {
      install: vi.fn(async () => ({ status: service.getStatus() })),
      cancelPreparation: vi.fn(() => service.getStatus())
    }
    const probe = { reply: vi.fn() }
    registerUpdatesIpc({
      ipc: {
        handle: (channel, handler) => {
          handlers.set(channel, handler)
        },
        removeHandler: (channel) => {
          handlers.delete(channel)
        }
      },
      service,
      installCoordinator: coordinator,
      draftProbe: probe,
      assertSender: (event) => {
        if (event.sender.id !== 1) throw new Error('untrusted sender')
      }
    })
    const invoke = (channel: string, senderId: number, ...args: unknown[]): unknown =>
      handlers.get(channel)!({ sender: { id: senderId } } as IpcMainInvokeEvent, ...args)
    expect(() =>
      invoke(UPDATE_CHANNELS.install, 2, { operationId: 'op-1', version: '0.1.4' })
    ).toThrow('untrusted')
    expect(() =>
      invoke(UPDATE_CHANNELS.install, 1, {
        operationId: 'op-1',
        version: '0.1.4',
        path: 'C:\\arbitrary.exe'
      })
    ).toThrow('Invalid update candidate')
    expect(() =>
      invoke(UPDATE_CHANNELS.install, 1, { operationId: 'op-1', version: '0.1.4-beta' })
    ).toThrow('Invalid update candidate')
    expect(() =>
      invoke(UPDATE_CHANNELS.cancelPreparation, 1, { operationId: 'op-1', force: true })
    ).toThrow('Invalid update operation')
    expect(() =>
      invoke(UPDATE_CHANNELS.draftReply, 1, {
        requestId: 'id',
        hasUnsavedContent: false,
        content: 'private'
      })
    ).toThrow('Invalid draft response')
    expect(coordinator.install).not.toHaveBeenCalled()
    expect(probe.reply).not.toHaveBeenCalled()

    await invoke(UPDATE_CHANNELS.install, 1, { operationId: 'op-1', version: '0.1.4' })
    invoke(UPDATE_CHANNELS.cancelPreparation, 1, { operationId: 'op-1' })
    invoke(UPDATE_CHANNELS.draftReply, 1, { requestId: 'id-1', hasUnsavedContent: true })
    expect(coordinator.install).toHaveBeenCalledWith({ operationId: 'op-1', version: '0.1.4' })
    expect(coordinator.cancelPreparation).toHaveBeenCalledWith({ operationId: 'op-1' })
    expect(probe.reply).toHaveBeenCalledWith({ requestId: 'id-1', hasUnsavedContent: true })
  })
})
