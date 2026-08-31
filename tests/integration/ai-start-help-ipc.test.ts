import { describe, expect, it, vi } from 'vitest'
import type { IpcMainInvokeEvent } from 'electron'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore Main is compiled by the node project; Vitest exercises this exact handler at runtime.
import { registerAiStartHelpIpc } from '../../src/main/ai-start-help-ipc'
import {
  AI_CONFIGURATION_CHANNELS,
  AI_START_HELP_CHANNELS
} from '../../src/contracts/ai-start-help'

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown

class FakeIpc {
  readonly handlers = new Map<string, Handler>()
  removeHandler(channel: string): void {
    this.handlers.delete(channel)
  }
  handle(channel: string, handler: Handler): void {
    this.handlers.set(channel, handler)
  }
  invoke(channel: string, senderId: number, ...args: unknown[]): unknown {
    const handler = this.handlers.get(channel)
    if (!handler) throw new Error('missing handler')
    return handler({ sender: { id: senderId } } as IpcMainInvokeEvent, ...args)
  }
}

describe('AI Start Help IPC boundary', () => {
  it('registers only fixed channels and validates sender before DTO parsing', async () => {
    const ipc = new FakeIpc()
    const order: string[] = []
    const sessions = {
      status: vi.fn(() => ({ state: 'closed', generation: 0 })),
      start: vi.fn(async () => ({
        state: 'failed',
        generation: 1,
        error: { code: 'network', retryable: true }
      })),
      cancel: vi.fn(),
      retry: vi.fn(),
      close: vi.fn(),
      configurationChanged: vi.fn()
    }
    const configuration = {
      readState: () => ({
        configured: false,
        availability: 'not-configured',
        credentialProtection: 'available'
      }),
      importFromEnvironment: vi.fn(),
      enable: vi.fn(),
      disable: vi.fn(),
      deleteCredential: vi.fn(),
      readProviderCredential: () => null
    }
    registerAiStartHelpIpc({
      ipc,
      sessions: sessions as never,
      configuration: configuration as never,
      assertSender: () => {
        order.push('sender')
      }
    })
    expect([...ipc.handlers.keys()].sort()).toEqual(
      [...Object.values(AI_START_HELP_CHANNELS), ...Object.values(AI_CONFIGURATION_CHANNELS)].sort()
    )
    const result = await ipc.invoke(AI_START_HELP_CHANNELS.start, 42, {
      actionId: '00000000-0000-4000-8000-000000000001',
      locale: 'zh-CN',
      userInput: '卡住了'
    })
    expect(order).toEqual(['sender'])
    expect(sessions.start).toHaveBeenCalledWith(42, {
      actionId: '00000000-0000-4000-8000-000000000001',
      locale: 'zh-CN',
      userInput: '卡住了'
    })
    expect(result).toEqual({
      state: 'failed',
      generation: 1,
      error: { code: 'network', retryable: true }
    })
    expect(JSON.stringify(result)).not.toMatch(/stack|credential|api.?key|path|provider body/i)
  })

  it('rejects unknown fields and input on no-argument channels', async () => {
    const ipc = new FakeIpc()
    registerAiStartHelpIpc({
      ipc,
      sessions: {
        status: vi.fn(),
        start: vi.fn(),
        cancel: vi.fn(),
        retry: vi.fn(),
        close: vi.fn(),
        configurationChanged: vi.fn()
      } as never,
      configuration: {
        readState: () => ({
          configured: false,
          availability: 'not-configured',
          credentialProtection: 'available'
        })
      } as never,
      assertSender: vi.fn()
    })
    expect(() =>
      ipc.invoke(AI_START_HELP_CHANNELS.start, 1, {
        actionId: '00000000-0000-4000-8000-000000000001',
        locale: 'zh-CN',
        userInput: 'x',
        url: 'https://forbidden.invalid'
      })
    ).toThrow()
    expect(() => ipc.invoke(AI_START_HELP_CHANNELS.status, 1, {})).toThrow()
  })
})
