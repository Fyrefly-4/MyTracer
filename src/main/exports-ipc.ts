import type { IpcMainInvokeEvent } from 'electron'
import {
  CompleteExportApplicationError,
  type CompleteExportService
} from '../application/complete-export'
import {
  EXPORT_CHANNELS,
  type CompleteExportErrorCode,
  type CompleteExportResult
} from '../contracts/exports'

export interface ExportIpcMain {
  removeHandler(channel: string): void
  handle(
    channel: string,
    listener: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown
  ): void
}

export function registerExportIpc(options: {
  readonly ipc: ExportIpcMain
  readonly service: CompleteExportService
  readonly assertSender: (event: IpcMainInvokeEvent) => void
}): void {
  options.ipc.removeHandler(EXPORT_CHANNELS.generate)
  options.ipc.handle(EXPORT_CHANNELS.generate, async (event, ...args: unknown[]) => {
    options.assertSender(event)
    if (args.length !== 0) return fail('validation', 'The export request was invalid.')
    try {
      return Object.freeze({
        ok: true as const,
        value: await options.service.generateCompleteExport()
      })
    } catch (error) {
      if (error instanceof CompleteExportApplicationError) {
        const messages: Record<Exclude<CompleteExportErrorCode, 'validation'>, string> = {
          'snapshot-failed': 'MyTracer could not prepare a complete export.',
          'serialization-failed': 'MyTracer could not serialize the export.',
          'export-validation-failed': 'MyTracer could not validate the export.',
          'write-failed': 'MyTracer could not safely write the export file.',
          'destination-changed': 'The selected export destination changed. Choose it again.',
          'replace-not-supported': 'Choose a new file name to keep the existing export unchanged.'
        }
        return fail(error.code, messages[error.code])
      }
      return fail('write-failed', 'MyTracer could not safely write the export file.')
    }
  })
}

function fail(code: CompleteExportErrorCode, message: string): CompleteExportResult {
  return Object.freeze({ ok: false, error: Object.freeze({ code, message }) })
}
