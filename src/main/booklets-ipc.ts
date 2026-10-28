import type { IpcMainInvokeEvent } from 'electron'
import { BookletConflict, type BookletService } from '../application/booklets'
import { BOOKLET_CHANNELS, type BookletSave } from '../contracts/booklets'
import { ExportDeliveryError } from '../application/ports/export'
interface BookletIpcMain {
  removeHandler(channel: string): void
  handle(
    channel: string,
    listener: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown
  ): void
}
function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError()
  const row = value as Record<string, unknown>
  if (Object.keys(row).length !== keys.length || keys.some((key) => !Object.hasOwn(row, key)))
    throw new TypeError()
  return row
}
function id(value: unknown): void {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  )
    throw new TypeError()
}
export function registerBookletIpc(options: {
  ipc: BookletIpcMain
  service: BookletService
  assertSender: (event: IpcMainInvokeEvent) => void
}): void {
  for (const name of Object.keys(BOOKLET_CHANNELS) as (keyof typeof BOOKLET_CHANNELS)[]) {
    const channel = BOOKLET_CHANNELS[name]
    options.ipc.removeHandler(channel)
    options.ipc.handle(channel, async (event, ...args) => {
      options.assertSender(event)
      try {
        if (name === 'list' || name === 'sources') {
          if (args.length) throw new TypeError()
          return { ok: true, value: options.service[name]() }
        }
        if (args.length !== 1) throw new TypeError()
        const input = object(
          args[0],
          name === 'save'
            ? ['id', 'expectedRevision', 'title', 'note', 'entries']
            : name === 'delete'
              ? ['id', 'expectedRevision', 'confirmed']
              : ['id']
        )
        id(input.id)
        if (name === 'save' || name === 'delete') {
          if (!Number.isSafeInteger(input.expectedRevision) || Number(input.expectedRevision) < 0)
            throw new TypeError()
        }
        if (name === 'save') {
          if (
            typeof input.title !== 'string' ||
            typeof input.note !== 'string' ||
            !Array.isArray(input.entries) ||
            input.entries.length > 1000
          )
            throw new TypeError()
          for (const value of input.entries) {
            const entry = object(value, ['id', 'kind', 'sourceId'])
            id(entry.id)
            if (entry.sourceId !== null) id(entry.sourceId)
            if (entry.kind !== 'action-record' && entry.kind !== 'thought') throw new TypeError()
          }
          return { ok: true, value: options.service.save(input as unknown as BookletSave) }
        }
        if (name === 'delete') {
          if (input.confirmed !== true) throw new TypeError()
          return {
            ok: true,
            value: options.service.delete(
              input as unknown as { id: string; expectedRevision: number; confirmed: true }
            )
          }
        }
        return { ok: true, value: await options.service[name](input.id as string) }
      } catch (error) {
        return {
          ok: false,
          error: {
            message:
              error instanceof BookletConflict
                ? error.message
                : error instanceof TypeError
                  ? '请求无效；请检查标题、自己的话和所选来源。'
                  : error instanceof ExportDeliveryError
                    ? '文件未能安全交付，请重试或选择新文件名。'
                    : '小册子暂时无法读取或保存，请重试。'
          }
        }
      }
    })
  }
}
