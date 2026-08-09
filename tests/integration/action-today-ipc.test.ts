import type { IpcMainInvokeEvent } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { ActionApplicationError, type ActionService } from '../../src/application/actions'
import type { TodayService } from '../../src/application/today'
import { ACTION_CHANNELS } from '../../src/contracts/actions'
import { TODAY_CHANNELS } from '../../src/contracts/today'

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown
interface FakeIpcMain {
  removeHandler(channel: string): void
  handle(channel: string, listener: Handler): void
}

const actionIpcModulePath = '../../src/main/actions-ipc'
const { registerActionIpc } = (await import(actionIpcModulePath)) as {
  readonly registerActionIpc: (options: {
    readonly ipc: FakeIpcMain
    readonly service: ActionService
    readonly assertSender: (event: IpcMainInvokeEvent) => void
  }) => void
}
const todayIpcModulePath = '../../src/main/today-ipc'
const { registerTodayIpc } = (await import(todayIpcModulePath)) as {
  readonly registerTodayIpc: (options: {
    readonly ipc: FakeIpcMain
    readonly service: TodayService
    readonly assertSender: (event: IpcMainInvokeEvent) => void
  }) => void
}

const actionId = '11111111-1111-4111-8111-111111111111'
const goalId = '22222222-2222-4222-8222-222222222222'
const replacementId = '33333333-3333-4333-8333-333333333333'

function setup() {
  const handlers = new Map<string, Handler>()
  const ipc: FakeIpcMain = {
    removeHandler: vi.fn((channel: string) => handlers.delete(channel)),
    handle: vi.fn((channel: string, handler: Handler) => handlers.set(channel, handler))
  }
  const actionService = {
    createAction: vi.fn(() => ({ id: actionId })),
    updateActionDetails: vi.fn(() => ({ id: actionId })),
    completeAction: vi.fn(() => ({ id: actionId, status: 'completed' })),
    cancelAction: vi.fn(() => ({ id: actionId, status: 'cancelled' })),
    rescheduleAction: vi.fn(() => ({ id: actionId, status: 'rescheduled' })),
    getActionDetail: vi.fn(() => ({ id: actionId }))
  }
  const todayService = {
    selectActionForToday: vi.fn(() => ({ id: actionId, selectedForToday: true })),
    removeActionFromToday: vi.fn(() => ({ localDate: '2026-08-09', focuses: [] })),
    getToday: vi.fn(() => ({ localDate: '2026-08-09', focuses: [] }))
  }
  const assertSender = vi.fn()
  registerActionIpc({
    ipc,
    service: actionService as unknown as ActionService,
    assertSender
  })
  registerTodayIpc({
    ipc,
    service: todayService as unknown as TodayService,
    assertSender
  })
  const event = {} as IpcMainInvokeEvent
  const invoke = (channel: string, ...args: unknown[]) => handlers.get(channel)!(event, ...args)
  return { actionService, assertSender, handlers, invoke, todayService }
}

describe('Action and Today IPC boundary', () => {
  it('registers fixed channels and forwards all nine valid narrow commands and queries', () => {
    const { actionService, assertSender, handlers, invoke, todayService } = setup()
    expect([...handlers.keys()].sort()).toEqual(
      [...Object.values(ACTION_CHANNELS), ...Object.values(TODAY_CHANNELS)].sort()
    )

    expect(invoke(ACTION_CHANNELS.create, { goalId, title: 'Action', description: null })).toEqual({
      ok: true,
      value: { id: actionId }
    })
    expect(
      invoke(ACTION_CHANNELS.updateDetails, {
        actionId,
        title: 'Updated',
        description: null
      })
    ).toMatchObject({ ok: true })
    expect(
      invoke(ACTION_CHANNELS.complete, {
        actionId,
        currentNextResolution: { kind: 'use-existing', actionId: replacementId }
      })
    ).toMatchObject({ ok: true, value: { status: 'completed' } })
    expect(invoke(ACTION_CHANNELS.cancel, { actionId })).toMatchObject({ ok: true })
    expect(
      invoke(ACTION_CHANNELS.reschedule, {
        actionId,
        currentNextResolution: { kind: 'create-and-use', title: 'Next' }
      })
    ).toMatchObject({ ok: true })
    expect(invoke(ACTION_CHANNELS.getDetail, { actionId })).toMatchObject({ ok: true })
    expect(invoke(TODAY_CHANNELS.selectAction, { actionId })).toMatchObject({ ok: true })
    expect(invoke(TODAY_CHANNELS.removeAction, { actionId })).toMatchObject({ ok: true })
    expect(invoke(TODAY_CHANNELS.get, {})).toMatchObject({ ok: true })

    expect(actionService.completeAction).toHaveBeenCalledWith({
      actionId,
      currentNextResolution: { kind: 'use-existing', actionId: replacementId }
    })
    expect(todayService.getToday).toHaveBeenCalledOnce()
    expect(assertSender).toHaveBeenCalledTimes(9)
  })

  it('rejects malformed IDs, blank text, unknown fields, forged dates, and invalid resolutions', () => {
    const { actionService, invoke, todayService } = setup()
    const invalid: Array<[string, ...unknown[]]> = [
      [ACTION_CHANNELS.create],
      [ACTION_CHANNELS.create, { title: ' ' }],
      [ACTION_CHANNELS.create, { title: 'Action', goalId: 'goal-1' }],
      [ACTION_CHANNELS.create, { title: 'Action', status: 'partial' }],
      [ACTION_CHANNELS.updateDetails, { actionId, title: 3 }],
      [ACTION_CHANNELS.complete, { actionId, currentNextResolution: { kind: 'clear', extra: 1 } }],
      [
        ACTION_CHANNELS.complete,
        { actionId, currentNextResolution: { kind: 'use-existing', actionId: 'bad' } }
      ],
      [ACTION_CHANNELS.cancel, { actionId: 'bad' }],
      [ACTION_CHANNELS.getDetail, { actionId, extra: true }],
      [TODAY_CHANNELS.selectAction, { actionId, selectedFor: '2026-08-10' }],
      [TODAY_CHANNELS.removeAction, { actionId: 'bad' }],
      [TODAY_CHANNELS.get, { selectedFor: '2026-08-10' }]
    ]
    for (const [channel, ...args] of invalid) {
      expect(invoke(channel, ...args)).toMatchObject({
        ok: false,
        error: { code: 'validation' }
      })
    }
    expect(actionService.createAction).not.toHaveBeenCalled()
    expect(todayService.selectActionForToday).not.toHaveBeenCalled()
  })

  it('maps private failures to stable errors and never downgrades sender rejection', () => {
    const { actionService, assertSender, invoke } = setup()
    actionService.completeAction.mockImplementationOnce(() => {
      throw new ActionApplicationError('invalid-transition', 'private lifecycle detail')
    })
    expect(invoke(ACTION_CHANNELS.complete, { actionId })).toEqual({
      ok: false,
      error: {
        code: 'invalid-transition',
        message: 'That Action change is not available in its current state.'
      }
    })
    actionService.getActionDetail.mockImplementationOnce(() => {
      throw new Error('SELECT secret FROM C:\\Users\\real-user')
    })
    const failed = invoke(ACTION_CHANNELS.getDetail, { actionId })
    expect(failed).toMatchObject({ ok: false, error: { code: 'persistence-failed' } })
    expect(JSON.stringify(failed)).not.toMatch(/SELECT|real-user|private lifecycle detail/)

    assertSender.mockImplementationOnce(() => {
      throw new Error('Rejected IPC request from an untrusted renderer.')
    })
    expect(() => invoke(TODAY_CHANNELS.get, {})).toThrow(/untrusted renderer/)
  })
})
