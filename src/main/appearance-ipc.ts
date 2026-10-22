import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'
import {
  APPEARANCE_CHANNELS,
  validateAppearance,
  type AppearanceSettings,
  type AppearanceState
} from '../contracts/appearance'
import { assertTrustedSender, type RendererLocation } from './ipc-security'

export function assertAppearanceSender(
  event: IpcMainInvokeEvent,
  window: BrowserWindow,
  location: RendererLocation
): void {
  assertTrustedSender(event, window, location)
  if (event.senderFrame !== window.webContents.mainFrame)
    throw new Error('Untrusted appearance frame')
}

export function registerAppearanceIpc(options: {
  ipc: {
    removeHandler(channel: string): void
    handle(
      channel: string,
      handler: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown
    ): void
  }
  assertSender(event: IpcMainInvokeEvent): void
  get(): AppearanceState
  set(settings: AppearanceSettings): AppearanceState
}): void {
  for (const channel of [APPEARANCE_CHANNELS.get, APPEARANCE_CHANNELS.set])
    options.ipc.removeHandler(channel)
  options.ipc.handle(APPEARANCE_CHANNELS.get, (event, ...args) => {
    options.assertSender(event)
    if (args.length !== 0) throw new TypeError('Invalid appearance query')
    return options.get()
  })
  options.ipc.handle(APPEARANCE_CHANNELS.set, (event, ...args) => {
    options.assertSender(event)
    if (args.length !== 1) throw new TypeError('Invalid appearance request')
    return options.set(validateAppearance(args[0]))
  })
}
