import type { IpcMainInvokeEvent } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import {
  RoutineRecordApplicationError,
  type RoutineRecordService
} from '../../src/application/routine-records'
import { ROUTINE_RECORD_CHANNELS } from '../../src/contracts/routine-records'

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown
const ipcModulePath = '../../src/main/routine-records-ipc'
const { registerRoutineRecordIpc } = await import(ipcModulePath)
const contextModulePath = '../../src/main/routine-recording-contexts'
const { RoutineRecordingContextStore } = (await import(contextModulePath)) as {
  readonly RoutineRecordingContextStore: new (generateId: () => string) => {
    begin(senderId: number, routineId: string, capturedOn: string): unknown
    require(senderId: number, routineId: string, contextId: string): { readonly capturedOn: string }
    cancel(senderId: number, contextId: string): void
    consume(senderId: number, routineId: string, contextId: string): void
  }
}
const routineId = '11111111-1111-4111-8111-111111111111'
const contextId = '22222222-2222-4222-8222-222222222222'

function setup() {
  const handlers = new Map<string, Handler>()
  const ipc = {
    removeHandler: vi.fn((channel: string) => handlers.delete(channel)),
    handle: vi.fn((channel: string, handler: Handler) => handlers.set(channel, handler))
  }
  const service = {
    beginRoutineRecording: vi.fn(() => ({ routineId, capturedOn: '2026-08-10' })),
    recordRoutine: vi.fn(() => ({ kind: 'saved', record: { routineId, outcome: 'acted' } })),
    getRoutineDayState: vi.fn(() => ({ routineId, recordState: 'unknown', record: null }))
  }
  const contexts = new RoutineRecordingContextStore(() => contextId)
  const assertSender = vi.fn()
  registerRoutineRecordIpc({
    ipc,
    service: service as unknown as RoutineRecordService,
    contexts,
    assertSender
  })
  const event = { sender: { id: 7 } } as IpcMainInvokeEvent
  const invoke = (channel: string, ...args: unknown[]) => handlers.get(channel)!(event, ...args)
  return { assertSender, handlers, invoke, service }
}

describe('RoutineRecord IPC boundary', () => {
  it('registers narrow channels and keeps the context until a cross-midnight choice saves', () => {
    const { handlers, invoke, service } = setup()
    expect([...handlers.keys()].sort()).toEqual(Object.values(ROUTINE_RECORD_CHANNELS).sort())
    expect(invoke(ROUTINE_RECORD_CHANNELS.begin, { routineId })).toMatchObject({
      ok: true,
      value: { recordingContextId: contextId, capturedOn: '2026-08-10' }
    })
    service.recordRoutine.mockReturnValueOnce({
      kind: 'date-confirmation-required',
      capturedOn: '2026-08-10',
      currentLocalDate: '2026-08-11'
    } as never)
    expect(
      invoke(ROUTINE_RECORD_CHANNELS.record, {
        routineId,
        recordingContextId: contextId,
        outcome: 'acted',
        durationMinutes: 0
      })
    ).toMatchObject({ ok: true, value: { kind: 'date-confirmation-required' } })
    expect(
      invoke(ROUTINE_RECORD_CHANNELS.record, {
        routineId,
        recordingContextId: contextId,
        dateChoice: 'use-current-on',
        outcome: 'acted',
        durationMinutes: 0
      })
    ).toMatchObject({ ok: true, value: { kind: 'saved' } })
    expect(
      invoke(ROUTINE_RECORD_CHANNELS.record, {
        routineId,
        recordingContextId: contextId,
        outcome: 'acted'
      })
    ).toMatchObject({ ok: false, error: { code: 'invalid-recording-context' } })
  })

  it('rejects unknown, invalid duration, extra fields, and untrusted senders', () => {
    const { assertSender, invoke, service } = setup()
    for (const input of [
      ...[123, {}, 'x'.repeat(501)].map((summary) => ({
        routineId,
        recordingContextId: contextId,
        outcome: 'acted',
        summary
      })),
      { routineId, recordingContextId: contextId, outcome: 'unknown' },
      { routineId, recordingContextId: contextId, outcome: 'not_done', durationMinutes: 0 },
      { routineId, recordingContextId: contextId, outcome: 'acted', durationMinutes: -1 },
      { routineId, recordingContextId: contextId, outcome: 'acted', surprise: true }
    ]) {
      expect(invoke(ROUTINE_RECORD_CHANNELS.record, input)).toMatchObject({
        ok: false,
        error: { code: 'validation' }
      })
    }
    expect(service.recordRoutine).not.toHaveBeenCalled()
    assertSender.mockImplementationOnce(() => {
      throw new Error('untrusted renderer')
    })
    expect(() => invoke(ROUTINE_RECORD_CHANNELS.begin, { routineId })).toThrow(/untrusted/)
  })

  it('maps duplicate conflicts without leaking persistence details', () => {
    const { invoke, service } = setup()
    invoke(ROUTINE_RECORD_CHANNELS.begin, { routineId })
    service.recordRoutine.mockImplementationOnce(() => {
      throw new RoutineRecordApplicationError('record-already-exists', 'private sqlite detail')
    })
    const result = invoke(ROUTINE_RECORD_CHANNELS.record, {
      routineId,
      recordingContextId: contextId,
      outcome: 'acted'
    })
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'record-already-exists',
        message: 'This Routine already has a record for that date.'
      }
    })
    expect(JSON.stringify(result)).not.toContain('private sqlite detail')
  })
})
