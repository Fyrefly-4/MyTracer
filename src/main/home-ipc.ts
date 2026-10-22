import type { IpcMainInvokeEvent } from 'electron'
import { HomeValidationError, type HomeService } from '../application/home'
import { HOME_CHANNELS, type HomeResult } from '../contracts/home'
type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown
export function registerHomeIpc(options: {
  readonly ipc: {
    removeHandler(channel: string): void
    handle(channel: string, handler: Handler): void
  }
  readonly service: HomeService
  readonly assertSender: (event: IpcMainInvokeEvent) => void
}): void {
  for (const [kind, channel] of Object.entries(HOME_CHANNELS)) {
    options.ipc.removeHandler(channel)
    options.ipc.handle(channel, (event, ...args): HomeResult<unknown> => {
      options.assertSender(event)
      try {
        if (args.length !== 1 || !args[0] || typeof args[0] !== 'object' || Array.isArray(args[0]))
          throw new HomeValidationError()
        const input = args[0] as Record<string, unknown>
        if (kind === 'get') {
          if (Object.keys(input).length) throw new HomeValidationError()
          return { ok: true, value: options.service.get() }
        }
        if (
          Object.keys(input).some((key) => key !== 'date' && key !== 'page') ||
          typeof input.date !== 'string' ||
          typeof input.page !== 'number'
        )
          throw new HomeValidationError()
        return { ok: true, value: options.service.day({ date: input.date, page: input.page }) }
      } catch (error) {
        return {
          ok: false,
          error: {
            code: error instanceof HomeValidationError ? 'validation' : 'persistence-failed',
            message:
              error instanceof HomeValidationError
                ? 'The Home request was invalid.'
                : 'MyTracer could not load Home facts.'
          }
        }
      }
    })
  }
}
