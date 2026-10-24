import type { RecordBookService } from '../application/record-book-service'
import { RecordBookBusyError } from '../application/record-book-service'
import { ExportDeliveryError } from '../application/ports/export'
import { RECORD_BOOK_CHANNELS, type RecordBookErrorCode } from '../contracts/record-book'
import type { ExportIpcMain } from './exports-ipc'
import type { IpcMainInvokeEvent } from 'electron'

export function registerRecordBookIpc(options: {
  ipc: ExportIpcMain
  service: RecordBookService
  assertSender: (event: IpcMainInvokeEvent) => void
}): void {
  for (const operation of ['read', 'export'] as const) {
    const channel = RECORD_BOOK_CHANNELS[operation]
    options.ipc.removeHandler(channel)
    options.ipc.handle(channel, async (event, ...args) => {
      options.assertSender(event)
      if (args.length) return fail('validation')
      try {
        return { ok: true, value: await options.service[operation]() }
      } catch (error) {
        return fail(
          error instanceof RecordBookBusyError
            ? 'busy'
            : error instanceof ExportDeliveryError
              ? error.code
              : operation === 'read'
                ? 'read-failed'
                : 'write-failed'
        )
      }
    })
  }
}
function fail(code: RecordBookErrorCode) {
  return { ok: false, error: { code } }
}
