import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'
import { expect, it, vi } from 'vitest'
import { APPEARANCE_CHANNELS } from '../../src/contracts/appearance'
import { assertAppearanceSender, registerAppearanceIpc } from '../../src/main/appearance-ipc'

it('rejects other windows, foreign origins and same-URL subframes before reading or writing', () => {
  const frame = { url: 'file:///trusted/index.html' }
  const window = { webContents: { id: 7, mainFrame: frame } } as unknown as BrowserWindow
  const event = { sender: { id: 7 }, senderFrame: frame } as IpcMainInvokeEvent
  const location = { productionUrl: frame.url }
  const handlers = new Map<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown>()
  const state = { mode: 'mica', intensity: 'strong', materialRequested: false, overlay: 1 } as const
  const get = vi.fn(() => state)
  const set = vi.fn(() => state)
  registerAppearanceIpc({
    ipc: {
      removeHandler: vi.fn(),
      handle: (name, handler) => {
        handlers.set(name, handler)
      }
    },
    assertSender: (incoming) => assertAppearanceSender(incoming, window, location),
    get,
    set
  })
  for (const incoming of [
    { ...event, sender: { id: 8 } },
    { ...event, senderFrame: { url: 'https://untrusted.test/' } },
    { ...event, senderFrame: { url: frame.url } },
    { ...event, senderFrame: null }
  ]) {
    expect(() => handlers.get(APPEARANCE_CHANNELS.get)!(incoming as IpcMainInvokeEvent)).toThrow()
    expect(() =>
      handlers.get(APPEARANCE_CHANNELS.set)!(incoming as IpcMainInvokeEvent, {
        mode: 'solid',
        intensity: 'strong'
      })
    ).toThrow()
  }
  expect(get).not.toHaveBeenCalled()
  expect(set).not.toHaveBeenCalled()
  expect(() =>
    handlers.get(APPEARANCE_CHANNELS.set)!(event, { mode: 'acrylic', intensity: 'strong' })
  ).toThrow()
  expect(() =>
    handlers.get(APPEARANCE_CHANNELS.set)!(event, { mode: 'solid', intensity: 'strong' }, 'extra')
  ).toThrow()
  expect(() => handlers.get(APPEARANCE_CHANNELS.get)!(event, 'extra')).toThrow()
  expect(set).not.toHaveBeenCalled()
  expect(handlers.get(APPEARANCE_CHANNELS.get)!(event)).toBe(state)
  handlers.get(APPEARANCE_CHANNELS.set)!(event, { mode: 'solid', intensity: 'subtle' })
  expect(set).toHaveBeenCalledWith({ mode: 'solid', intensity: 'subtle' })
})
