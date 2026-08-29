import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { GoalApplicationError, type GoalService } from '../../src/application/goals'
import { GOAL_CHANNELS } from '../../src/contracts/goals'

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown
const goalId = '11111111-1111-4111-8111-111111111111'
interface GoalIpcMain {
  removeHandler(channel: string): void
  handle(channel: string, listener: Handler): void
}
type RegisterGoalIpc = (options: {
  readonly ipc: GoalIpcMain
  readonly service: GoalService
  readonly assertSender: (event: IpcMainInvokeEvent) => void
}) => void

const goalIpcModulePath = '../../src/main/goals-ipc'
const { registerGoalIpc } = (await import(goalIpcModulePath)) as {
  readonly registerGoalIpc: RegisterGoalIpc
}
const ipcSecurityModulePath = '../../src/main/ipc-security'
const { assertTrustedSender } = (await import(ipcSecurityModulePath)) as {
  readonly assertTrustedSender: (
    event: IpcMainInvokeEvent,
    expectedWindow: BrowserWindow | null,
    location: { readonly developmentUrl?: string; readonly productionUrl: string }
  ) => void
}

function setup() {
  const handlers = new Map<string, Handler>()
  const ipc: GoalIpcMain = {
    removeHandler: vi.fn((channel: string) => handlers.delete(channel)),
    handle: vi.fn((channel: string, handler: Handler) => handlers.set(channel, handler))
  }
  const service = {
    createGoal: vi.fn(() => ({ id: 'goal-1' })),
    updateGoalDetails: vi.fn(() => ({ id: 'goal-1' })),
    pauseGoal: vi.fn(() => ({ id: 'goal-1', status: 'paused' })),
    resumeGoal: vi.fn(() => ({ id: 'goal-1', status: 'active' })),
    endGoal: vi.fn(() => ({ id: 'goal-1', status: 'ended' })),
    setGoalCurrentNextAction: vi.fn(() => ({ id: 'goal-1' })),
    createAndSetGoalCurrentNextAction: vi.fn(() => ({ id: 'goal-1' })),
    listGoals: vi.fn(() => []),
    getGoalDetail: vi.fn(() => ({ id: 'goal-1' }))
  }
  const assertSender = vi.fn()
  registerGoalIpc({ ipc, service: service as unknown as GoalService, assertSender })
  const event = {} as IpcMainInvokeEvent
  const invoke = (channel: string, ...args: unknown[]) => handlers.get(channel)!(event, ...args)
  return { assertSender, event, handlers, invoke, service }
}

describe('Goal IPC boundary', () => {
  it('registers fixed channels and forwards valid narrow DTOs after sender validation', () => {
    const { assertSender, handlers, invoke, service } = setup()
    expect([...handlers.keys()].sort()).toEqual(Object.values(GOAL_CHANNELS).sort())

    expect(
      invoke(GOAL_CHANNELS.create, {
        name: 'Goal',
        description: null,
        initialNextAction: { title: 'Action', description: null }
      })
    ).toEqual({ ok: true, value: { id: 'goal-1' } })
    expect(service.createGoal).toHaveBeenCalledWith({
      name: 'Goal',
      description: null,
      initialNextAction: { title: 'Action', description: null }
    })
    expect(
      invoke(GOAL_CHANNELS.createAndSetCurrentNextAction, {
        goalId,
        title: 'Small action',
        description: null
      })
    ).toEqual({ ok: true, value: { id: 'goal-1' } })
    expect(service.createAndSetGoalCurrentNextAction).toHaveBeenCalledWith({
      goalId,
      title: 'Small action',
      description: null
    })
    expect(invoke(GOAL_CHANNELS.list, { status: 'paused' })).toEqual({ ok: true, value: [] })
    expect(service.listGoals).toHaveBeenCalledWith('paused')
    expect(assertSender).toHaveBeenCalledTimes(3)
  })

  it('rejects missing, blank, wrong-type, invalid-enum, and unknown fields without calling Application', () => {
    const { invoke, service } = setup()
    const invalidRequests: Array<[string, ...unknown[]]> = [
      [GOAL_CHANNELS.create],
      [GOAL_CHANNELS.create, { name: ' ' }],
      [GOAL_CHANNELS.create, { name: 'Goal', extra: true }],
      [GOAL_CHANNELS.create, { name: 'Goal', initialNextAction: { title: 1 } }],
      [GOAL_CHANNELS.updateDetails, { goalId: 'goal-1', name: 3 }],
      [GOAL_CHANNELS.setCurrentNextAction, { goalId: 'goal-1' }],
      [GOAL_CHANNELS.createAndSetCurrentNextAction, { goalId, title: ' ' }],
      [GOAL_CHANNELS.createAndSetCurrentNextAction, { goalId, title: 'Action', extra: true }],
      [GOAL_CHANNELS.createAndSetCurrentNextAction, { goalId: 'goal-1', title: 'Action' }],
      [GOAL_CHANNELS.list, { status: 'failed' }],
      [GOAL_CHANNELS.getDetail, { goalId: 'goal-1' }],
      [GOAL_CHANNELS.getDetail, { goalId: '', extra: 'x' }]
    ]

    for (const [channel, ...args] of invalidRequests) {
      expect(invoke(channel, ...args)).toEqual({
        ok: false,
        error: { code: 'validation', message: 'The Goal request was invalid.' }
      })
    }
    expect(service.createGoal).not.toHaveBeenCalled()
    expect(service.updateGoalDetails).not.toHaveBeenCalled()
    expect(service.setGoalCurrentNextAction).not.toHaveBeenCalled()
    expect(service.createAndSetGoalCurrentNextAction).not.toHaveBeenCalled()
  })

  it('maps Application and persistence failures to stable messages without leaking details', () => {
    const { invoke, service } = setup()
    service.pauseGoal.mockImplementationOnce(() => {
      throw new GoalApplicationError('invalid-transition', 'private current state detail')
    })
    expect(invoke(GOAL_CHANNELS.pause, { goalId })).toEqual({
      ok: false,
      error: {
        code: 'invalid-transition',
        message: 'That Goal change is not available in its current state.'
      }
    })

    service.getGoalDetail.mockImplementationOnce(() => {
      throw new Error('SELECT secret FROM C:\\Users\\real-user')
    })
    const result = invoke(GOAL_CHANNELS.getDetail, { goalId })
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'persistence-failed',
        message: 'MyTracer could not save or load the Goal.'
      }
    })
    expect(JSON.stringify(result)).not.toMatch(/SELECT|real-user|private current state detail/)
  })

  it('does not catch or downgrade an untrusted sender rejection', () => {
    const { assertSender, invoke, service } = setup()
    assertSender.mockImplementationOnce(() => {
      throw new Error('Rejected IPC request from an untrusted renderer.')
    })
    expect(() => invoke(GOAL_CHANNELS.getDetail, { goalId })).toThrow(/untrusted renderer/)
    expect(service.getGoalDetail).not.toHaveBeenCalled()
  })

  it('validates the sender before create-and-set parsing or Application execution', () => {
    const { assertSender, invoke, service } = setup()
    assertSender.mockImplementationOnce(() => {
      throw new Error('Rejected IPC request from an untrusted renderer.')
    })
    expect(() =>
      invoke(GOAL_CHANNELS.createAndSetCurrentNextAction, {
        goalId,
        title: 'Small action',
        extra: true
      })
    ).toThrow(/untrusted renderer/)
    expect(service.createAndSetGoalCurrentNextAction).not.toHaveBeenCalled()
  })

  it('accepts only the expected webContents and exact trusted production or development URL', () => {
    const productionUrl = 'file:///D:/MyTracer/out/renderer/index.html'
    const developmentUrl = 'http://localhost:5173/app'
    const expectedWindow = { webContents: { id: 7 } } as BrowserWindow
    const eventFor = (id: number, url: string) =>
      ({ sender: { id }, senderFrame: { url } }) as unknown as IpcMainInvokeEvent

    expect(() =>
      assertTrustedSender(eventFor(7, productionUrl), expectedWindow, { productionUrl })
    ).not.toThrow()
    expect(() =>
      assertTrustedSender(eventFor(7, developmentUrl), expectedWindow, {
        productionUrl,
        developmentUrl
      })
    ).not.toThrow()
    expect(() =>
      assertTrustedSender(eventFor(8, productionUrl), expectedWindow, { productionUrl })
    ).toThrow(/untrusted renderer/)
    expect(() =>
      assertTrustedSender(eventFor(7, 'http://localhost:5173/other'), expectedWindow, {
        productionUrl,
        developmentUrl
      })
    ).toThrow(/untrusted renderer/)
    expect(() => assertTrustedSender(eventFor(7, productionUrl), null, { productionUrl })).toThrow(
      /untrusted renderer/
    )
  })
})
