import type { IpcMainInvokeEvent } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { RecoveryApplicationError, type RecoveryService } from '../../src/application/recovery'
import { RECOVERY_CHANNELS } from '../../src/contracts/recovery'

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown
const recoveryIpcModulePath = '../../src/main/recovery-ipc'
const { registerRecoveryIpc } = (await import(recoveryIpcModulePath)) as {
  readonly registerRecoveryIpc: (options: {
    readonly ipc: {
      removeHandler(channel: string): void
      handle(channel: string, listener: Handler): void
    }
    readonly service: RecoveryService
    readonly assertSender: (event: IpcMainInvokeEvent) => void
  }) => void
}
const goalId = '11111111-1111-4111-8111-111111111111'
function setup() {
  const handlers = new Map<string, Handler>()
  const service = {
    getContext: vi.fn(() => ({ goal: { id: goalId, name: 'Learn', status: 'active' } }))
  }
  const assertSender = vi.fn()
  registerRecoveryIpc({
    ipc: {
      removeHandler: (channel) => handlers.delete(channel),
      handle: (channel, handler) => handlers.set(channel, handler)
    },
    service: service as unknown as RecoveryService,
    assertSender
  })
  const event = { sender: { id: 7 } } as unknown as IpcMainInvokeEvent
  return {
    invoke: (...args: unknown[]) => handlers.get(RECOVERY_CHANNELS.getContext)!(event, ...args),
    handlers,
    service,
    assertSender
  }
}

describe('Recovery IPC boundary', () => {
  it('exposes one fixed channel and only accepts one UUID goalId', () => {
    const { invoke, handlers, service, assertSender } = setup()
    expect([...handlers.keys()]).toEqual([RECOVERY_CHANNELS.getContext])
    expect(invoke({ goalId })).toMatchObject({ ok: true, value: { goal: { id: goalId } } })
    expect(service.getContext).toHaveBeenCalledWith({ goalId })
    expect(assertSender).toHaveBeenCalledOnce()
    for (const args of [[], [null], [{}], [{ goalId: 'bad' }], [{ goalId, extra: true }]])
      expect(invoke(...args)).toMatchObject({ ok: false, error: { code: 'validation' } })
  })

  it('maps safe failures and preserves sender rejection', () => {
    const { invoke, service, assertSender } = setup()
    service.getContext.mockImplementationOnce(() => {
      throw new RecoveryApplicationError('not-found', 'private')
    })
    expect(invoke({ goalId })).toEqual({
      ok: false,
      error: { code: 'not-found', message: 'The requested Goal was not found.' }
    })
    service.getContext.mockImplementationOnce(() => {
      throw new Error('SELECT secret FROM C:\\Users\\real-user')
    })
    const failed = invoke({ goalId })
    expect(failed).toMatchObject({ ok: false, error: { code: 'persistence-failed' } })
    expect(JSON.stringify(failed)).not.toMatch(/SELECT|real-user/)
    assertSender.mockImplementationOnce(() => {
      throw new Error('untrusted renderer')
    })
    expect(() => invoke({ goalId })).toThrow(/untrusted renderer/)
  })
})
