import type { IpcMainInvokeEvent } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { RoutineApplicationError, type RoutineService } from '../../src/application/routines'
import { ROUTINE_CHANNELS } from '../../src/contracts/routines'

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown
interface RoutineIpcMain {
  removeHandler(channel: string): void
  handle(channel: string, listener: Handler): void
}
type RegisterRoutineIpc = (options: {
  readonly ipc: RoutineIpcMain
  readonly service: RoutineService
  readonly assertSender: (event: IpcMainInvokeEvent) => void
}) => void

const routineIpcModulePath = '../../src/main/routines-ipc'
const { registerRoutineIpc } = (await import(routineIpcModulePath)) as {
  readonly registerRoutineIpc: RegisterRoutineIpc
}
const routineId = '11111111-1111-4111-8111-111111111111'
const goalId = '22222222-2222-4222-8222-222222222222'

function setup() {
  const handlers = new Map<string, Handler>()
  const ipc: RoutineIpcMain = {
    removeHandler: vi.fn((channel: string) => handlers.delete(channel)),
    handle: vi.fn((channel: string, handler: Handler) => handlers.set(channel, handler))
  }
  const service = {
    createRoutine: vi.fn(() => ({ id: routineId })),
    updateRoutineDetails: vi.fn(() => ({ id: routineId })),
    replaceRoutineSchedule: vi.fn(() => ({ id: routineId })),
    pauseRoutine: vi.fn(() => ({ id: routineId, status: 'paused' })),
    resumeRoutine: vi.fn(() => ({ id: routineId, status: 'active' })),
    endRoutine: vi.fn(() => ({ id: routineId, status: 'ended' })),
    listRoutines: vi.fn(() => []),
    getRoutineDetail: vi.fn(() => ({ id: routineId }))
  }
  const assertSender = vi.fn()
  registerRoutineIpc({ ipc, service: service as unknown as RoutineService, assertSender })
  const event = {} as IpcMainInvokeEvent
  const invoke = (channel: string, ...args: unknown[]) => handlers.get(channel)!(event, ...args)
  return { assertSender, handlers, invoke, service }
}

describe('Routine IPC boundary', () => {
  it('registers fixed channels and forwards valid narrow DTOs after sender validation', () => {
    const { assertSender, handlers, invoke, service } = setup()
    expect([...handlers.keys()].sort()).toEqual(Object.values(ROUTINE_CHANNELS).sort())
    expect(
      invoke(ROUTINE_CHANNELS.create, {
        goalId,
        name: 'Routine',
        description: null,
        minimumAction: 'Move',
        weekdays: [5, 1]
      })
    ).toEqual({ ok: true, value: { id: routineId } })
    expect(service.createRoutine).toHaveBeenCalledWith({
      goalId,
      name: 'Routine',
      description: null,
      minimumAction: 'Move',
      weekdays: [5, 1]
    })
    expect(invoke(ROUTINE_CHANNELS.list, { status: 'paused' })).toEqual({ ok: true, value: [] })
    expect(service.listRoutines).toHaveBeenCalledWith('paused')
    expect(assertSender).toHaveBeenCalledTimes(2)
  })

  it('rejects invalid UUIDs, text, weekday sets, enum values, and extra fields', () => {
    const { invoke, service } = setup()
    const invalid: Array<[string, ...unknown[]]> = [
      [ROUTINE_CHANNELS.create],
      [ROUTINE_CHANNELS.create, { name: ' ', minimumAction: 'Move', weekdays: [1] }],
      [ROUTINE_CHANNELS.create, { name: 'Routine', minimumAction: ' ', weekdays: [1] }],
      [ROUTINE_CHANNELS.create, { name: 'Routine', minimumAction: 'Move', weekdays: [] }],
      [ROUTINE_CHANNELS.create, { name: 'Routine', minimumAction: 'Move', weekdays: [1, 1] }],
      [ROUTINE_CHANNELS.create, { name: 'Routine', minimumAction: 'Move', weekdays: [0] }],
      [
        ROUTINE_CHANNELS.create,
        { name: 'Routine', minimumAction: 'Move', weekdays: [1], today: '2026-08-14' }
      ],
      [ROUTINE_CHANNELS.replaceSchedule, { routineId, weekdays: [8] }],
      [ROUTINE_CHANNELS.list, { status: 'failed' }],
      [ROUTINE_CHANNELS.getDetail, { routineId: 'not-a-uuid' }]
    ]
    for (const [channel, ...args] of invalid) {
      expect(invoke(channel, ...args)).toEqual({
        ok: false,
        error: { code: 'validation', message: 'The Routine request was invalid.' }
      })
    }
    expect(service.createRoutine).not.toHaveBeenCalled()
    expect(service.replaceRoutineSchedule).not.toHaveBeenCalled()
  })

  it('maps application and persistence failures without leaking details', () => {
    const { invoke, service } = setup()
    service.pauseRoutine.mockImplementationOnce(() => {
      throw new RoutineApplicationError('invalid-transition', 'private state')
    })
    expect(invoke(ROUTINE_CHANNELS.pause, { routineId })).toEqual({
      ok: false,
      error: {
        code: 'invalid-transition',
        message: 'That Routine change is not available in its current state.'
      }
    })
    service.getRoutineDetail.mockImplementationOnce(() => {
      throw new Error('SELECT secret FROM C:\\Users\\real-user')
    })
    const result = invoke(ROUTINE_CHANNELS.getDetail, { routineId })
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'persistence-failed',
        message: 'MyTracer could not save or load the Routine.'
      }
    })
    expect(JSON.stringify(result)).not.toMatch(/SELECT|real-user|private state/)
  })

  it('does not downgrade sender rejection', () => {
    const { assertSender, invoke, service } = setup()
    assertSender.mockImplementationOnce(() => {
      throw new Error('Rejected IPC request from an untrusted renderer.')
    })
    expect(() => invoke(ROUTINE_CHANNELS.getDetail, { routineId })).toThrow(/untrusted renderer/)
    expect(service.getRoutineDetail).not.toHaveBeenCalled()
  })
})
