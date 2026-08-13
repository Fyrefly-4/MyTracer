import type { IpcMainInvokeEvent } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { ProgressApplicationError, type ProgressService } from '../../src/application/progress'
import { PROGRESS_CHANNELS } from '../../src/contracts/progress'

const progressIpcModulePath = '../../src/main/progress-ipc'
const { registerProgressIpc } = (await import(progressIpcModulePath)) as {
  readonly registerProgressIpc: (options: {
    readonly ipc: {
      removeHandler(channel: string): void
      handle(channel: string, listener: Handler): void
    }
    readonly service: ProgressService
    readonly assertSender: (event: IpcMainInvokeEvent) => void
  }) => void
}

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown

const goalId = '11111111-1111-4111-8111-111111111111'

function setup() {
  const handlers = new Map<string, Handler>()
  const ipc = {
    removeHandler: vi.fn((channel: string) => handlers.delete(channel)),
    handle: vi.fn((channel: string, handler: Handler) => handlers.set(channel, handler))
  }
  const service = {
    getProgress: vi.fn(() => ({
      filter: { goalId: null, from: null, through: null },
      totalDurationMinutes: 0,
      realActionCount: 0,
      records: []
    }))
  }
  const assertSender = vi.fn()
  registerProgressIpc({
    ipc,
    service: service as unknown as ProgressService,
    assertSender
  })
  const event = { sender: { id: 7 } } as unknown as IpcMainInvokeEvent
  const invoke = (...args: unknown[]) => handlers.get(PROGRESS_CHANNELS.get)!(event, ...args)
  return { assertSender, handlers, invoke, service }
}

describe('Progress IPC boundary', () => {
  it('registers one fixed channel and forwards narrow validated filters', () => {
    const { assertSender, handlers, invoke, service } = setup()
    expect([...handlers.keys()]).toEqual([PROGRESS_CHANNELS.get])
    expect(invoke({ goalId, from: '2026-08-01', through: '2026-08-12' })).toMatchObject({
      ok: true,
      value: { realActionCount: 0 }
    })
    expect(service.getProgress).toHaveBeenCalledWith({
      goalId,
      from: '2026-08-01',
      through: '2026-08-12'
    })
    expect(assertSender).toHaveBeenCalledOnce()
  })

  it('rejects malformed UUID, LocalDate, shapes, ranges, and unknown fields', () => {
    const { invoke, service } = setup()
    for (const args of [
      [],
      [null],
      [{ goalId: 'bad' }],
      [{ goalId: 7 }],
      [{ from: '2026-02-30' }],
      [{ through: '2026/08/12' }],
      [{ from: 7 }],
      [{ sort: 'duration' }]
    ]) {
      expect(invoke(...args)).toMatchObject({ ok: false, error: { code: 'validation' } })
    }
    service.getProgress.mockImplementationOnce(() => {
      throw new ProgressApplicationError('validation', 'private range detail')
    })
    expect(invoke({ from: '2026-08-13', through: '2026-08-12' })).toEqual({
      ok: false,
      error: { code: 'validation', message: 'Please check the Progress date range.' }
    })
  })

  it('maps private failures and never downgrades sender rejection', () => {
    const { assertSender, invoke, service } = setup()
    service.getProgress.mockImplementationOnce(() => {
      throw new Error('SELECT secret FROM C:\\Users\\real-user')
    })
    const failed = invoke({})
    expect(failed).toMatchObject({ ok: false, error: { code: 'persistence-failed' } })
    expect(JSON.stringify(failed)).not.toMatch(/SELECT|real-user/)

    assertSender.mockImplementationOnce(() => {
      throw new Error('Rejected IPC request from an untrusted renderer.')
    })
    expect(() => invoke({})).toThrow(/untrusted renderer/)
  })
})
