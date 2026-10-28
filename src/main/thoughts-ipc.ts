import type { IpcMainInvokeEvent } from 'electron'
import { ThoughtConflict, type ThoughtService } from '../application/thoughts'
import { THOUGHT_CHANNELS, type ThoughtApi, type ThoughtResult } from '../contracts/thoughts'
interface ThoughtIpcMain {
  removeHandler(channel: string): void
  handle(
    channel: string,
    listener: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown
  ): void
}

export function registerThoughtIpc(options: {
  ipc: ThoughtIpcMain
  service: ThoughtService
  assertSender: (event: IpcMainInvokeEvent) => void
}): void {
  for (const name of Object.keys(THOUGHT_CHANNELS) as (keyof ThoughtApi)[]) {
    const channel = THOUGHT_CHANNELS[name]
    options.ipc.removeHandler(channel)
    options.ipc.handle(channel, (event, ...args): ThoughtResult<unknown> => {
      options.assertSender(event)
      try {
        const value = args[0]
        if (args.length !== 1 || !value || typeof value !== 'object' || Array.isArray(value))
          throw new TypeError()
        const input = value as Record<string, unknown>
        const keys =
          name === 'list'
            ? ['date']
            : name === 'create'
              ? ['id', 'occurredOn', 'text']
              : name === 'update'
                ? ['id', 'text', 'expectedText']
                : ['id', 'expectedText', 'confirmed']
        if (
          Object.keys(input).length !== keys.length ||
          keys.some((key) =>
            key === 'confirmed' ? input[key] !== true : typeof input[key] !== 'string'
          )
        )
          throw new TypeError()
        if (
          name !== 'list' &&
          !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            String(input.id)
          )
        )
          throw new TypeError()
        let result: unknown
        switch (name) {
          case 'list':
            result = options.service.list(input.date as string)
            break
          case 'create':
            result = options.service.create(input as unknown as Parameters<ThoughtApi['create']>[0])
            break
          case 'update':
            result = options.service.update(input as unknown as Parameters<ThoughtApi['update']>[0])
            break
          case 'delete':
            options.service.delete(input as unknown as Parameters<ThoughtApi['delete']>[0])
            result = null
        }
        return { ok: true, value: result }
      } catch (error) {
        if (error instanceof ThoughtConflict)
          return { ok: false, error: { code: 'conflict', message: error.message } }
        if (error instanceof TypeError)
          return {
            ok: false,
            error: { code: 'validation', message: '请填写想法正文，并检查日期。' }
          }
        return {
          ok: false,
          error: { code: 'persistence-failed', message: '想法暂时无法保存或读取，请重试。' }
        }
      }
    })
  }
}
