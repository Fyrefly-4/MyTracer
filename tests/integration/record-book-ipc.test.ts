import { describe, expect, it, vi } from 'vitest'
import type { IpcMainInvokeEvent } from 'electron'
import {
  RecordBookBusyError,
  type RecordBookService
} from '../../src/application/record-book-service'
import { ExportDeliveryError } from '../../src/application/ports/export'
import { RECORD_BOOK_CHANNELS } from '../../src/contracts/record-book'

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown
const modulePath = '../../src/main/record-book-ipc'
const { registerRecordBookIpc } = (await import(modulePath)) as {
  registerRecordBookIpc: (options: {
    ipc: {
      removeHandler: (channel: string) => void
      handle: (channel: string, handler: Handler) => void
    }
    service: RecordBookService
    assertSender: (event: IpcMainInvokeEvent) => void
  }) => void
}
function setup() {
  const handlers = new Map<string, Handler>()
  const service = {
    read: vi.fn(() => ({ book: { months: [], exclusions: [] }, readAt: 'now' })),
    export: vi.fn(async () => ({ kind: 'cancelled' }))
  }
  const assertSender = vi.fn()
  registerRecordBookIpc({
    ipc: {
      removeHandler: (key) => {
        handlers.delete(key)
      },
      handle: (key, value) => {
        handlers.set(key, value)
      }
    },
    service: service as unknown as RecordBookService,
    assertSender
  })
  const invoke = (operation: 'read' | 'export', ...args: unknown[]) =>
    handlers.get(RECORD_BOOK_CHANNELS[operation])!({} as IpcMainInvokeEvent, ...args)
  return { handlers, service, assertSender, invoke }
}
describe('record book IPC', () => {
  it('exposes exactly two zero-input operations and validates sender before arguments', async () => {
    const { handlers, service, assertSender, invoke } = setup()
    expect([...handlers.keys()]).toEqual(Object.values(RECORD_BOOK_CHANNELS))
    for (const op of ['read', 'export'] as const) {
      for (const arg of [null, {}, '<script>', { path: 'private', month: '2026-01' }])
        await expect(invoke(op, arg)).resolves.toEqual({ ok: false, error: { code: 'validation' } })
      expect(service[op]).not.toHaveBeenCalled()
      assertSender.mockImplementationOnce(() => {
        throw new Error('untrusted')
      })
      await expect(invoke(op)).rejects.toThrow('untrusted')
      await expect(invoke(op)).resolves.toMatchObject({ ok: true })
    }
  })
  it('maps read, busy and delivery failures without exposing paths or exception messages', async () => {
    const { service, invoke } = setup()
    service.read.mockImplementationOnce(() => {
      throw new Error('C:\\private.sqlite3')
    })
    await expect(invoke('read')).resolves.toEqual({ ok: false, error: { code: 'read-failed' } })
    service.export.mockRejectedValueOnce(new RecordBookBusyError())
    await expect(invoke('export')).resolves.toEqual({ ok: false, error: { code: 'busy' } })
    for (const code of [
      'destination-changed',
      'write-failed',
      'replace-not-supported',
      'export-validation-failed'
    ] as const) {
      service.export.mockRejectedValueOnce(new ExportDeliveryError(code, 'C:\\private'))
      await expect(invoke('export')).resolves.toEqual({ ok: false, error: { code } })
    }
  })
})
