import type { IpcMainInvokeEvent } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import {
  ActionRecordApplicationError,
  type ActionRecordService
} from '../../src/application/action-records'
import { RECORD_CHANNELS } from '../../src/contracts/records'

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown
interface FakeIpcMain {
  removeHandler(channel: string): void
  handle(channel: string, listener: Handler): void
}

const recordsIpcModulePath = '../../src/main/records-ipc'
const { registerRecordIpc } = (await import(recordsIpcModulePath)) as {
  readonly registerRecordIpc: (options: {
    readonly ipc: FakeIpcMain
    readonly service: ActionRecordService
    readonly contexts: {
      begin(
        senderId: number,
        actionId: string,
        capturedOn: string
      ): {
        readonly id: string
      }
      require(
        senderId: number,
        actionId: string,
        contextId: string
      ): {
        readonly capturedOn: string
      }
      cancel(senderId: number, contextId: string): void
      consume(senderId: number, actionId: string, contextId: string): void
    }
    readonly assertSender: (event: IpcMainInvokeEvent) => void
  }) => void
}
const contextsModulePath = '../../src/main/action-recording-contexts'
const { ActionRecordingContextStore } = (await import(contextsModulePath)) as {
  readonly ActionRecordingContextStore: new (generateId: () => string) => {
    begin(senderId: number, actionId: string, capturedOn: string): { readonly id: string }
    require(
      senderId: number,
      actionId: string,
      contextId: string
    ): {
      readonly capturedOn: string
    }
    cancel(senderId: number, contextId: string): void
    consume(senderId: number, actionId: string, contextId: string): void
    firstDraft(senderId: number, contextId: string): { readonly capturedOn: string } | null
    clearSender(senderId: number): void
  }
}

const actionId = '11111111-1111-4111-8111-111111111111'
const otherActionId = '22222222-2222-4222-8222-222222222222'
const recordId = '33333333-3333-4333-8333-333333333333'
const contextId = '44444444-4444-4444-8444-444444444444'
const replacementId = '55555555-5555-4555-8555-555555555555'

function setup(contextIds: string[] = []) {
  const handlers = new Map<string, Handler>()
  const ipc: FakeIpcMain = {
    removeHandler: vi.fn((channel: string) => handlers.delete(channel)),
    handle: vi.fn((channel: string, handler: Handler) => handlers.set(channel, handler))
  }
  const service = {
    beginFirstActionRecording: vi.fn(() => ({ actionId, capturedOn: '2026-08-12' })),
    recordFirstAction: vi.fn(() => ({
      kind: 'saved',
      action: { id: actionId },
      record: { id: contextId }
    })),
    beginActionRecording: vi.fn(() => ({ actionId, capturedOn: '2026-08-12' })),
    recordAction: vi.fn<(input: unknown) => unknown>(() => ({
      kind: 'saved',
      record: { id: recordId, actionId },
      action: { id: actionId, status: 'pending' },
      appliedNextActionId: null
    })),
    listActionRecordsForAction: vi.fn(() => [{ id: recordId, actionId }]),
    getActionRecordDetail: vi.fn(() => ({ id: recordId, actionId }))
  }
  const contexts = new ActionRecordingContextStore(() => contextIds.shift() ?? contextId)
  const assertSender = vi.fn()
  registerRecordIpc({
    ipc,
    service: service as unknown as ActionRecordService,
    contexts,
    assertSender
  })
  const event = { sender: { id: 7 } } as unknown as IpcMainInvokeEvent
  const otherEvent = { sender: { id: 8 } } as unknown as IpcMainInvokeEvent
  const invoke = (channel: string, ...args: unknown[]) => handlers.get(channel)!(event, ...args)
  const invokeOther = (channel: string, ...args: unknown[]) =>
    handlers.get(channel)!(otherEvent, ...args)
  return { assertSender, contexts, handlers, invoke, invokeOther, service }
}

describe('ActionRecord IPC boundary', () => {
  it.each([null, 0, 12])(
    'forwards explicit duration %s without coercing null',
    (durationMinutes) => {
      const { invoke, service } = setup()
      invoke(RECORD_CHANNELS.begin, { actionId })
      expect(
        invoke(RECORD_CHANNELS.record, {
          actionId,
          recordingContextId: contextId,
          durationMinutes,
          outcome: 'partial'
        })
      ).toMatchObject({ ok: true })
      expect(service.recordAction).toHaveBeenCalledWith(
        expect.objectContaining({ durationMinutes })
      )
    }
  )

  it.each([undefined, '', '12', -1, 1.5])('rejects invalid duration %s', (durationMinutes) => {
    const { invoke, service } = setup()
    invoke(RECORD_CHANNELS.begin, { actionId })
    expect(
      invoke(RECORD_CHANNELS.record, {
        actionId,
        recordingContextId: contextId,
        durationMinutes,
        outcome: 'partial'
      })
    ).toMatchObject({ ok: false, error: { code: 'validation' } })
    expect(service.recordAction).not.toHaveBeenCalled()
  })

  it('registers fixed channels and forwards valid narrow commands and queries', () => {
    const { assertSender, handlers, invoke, service } = setup()
    expect([...handlers.keys()].sort()).toEqual([...Object.values(RECORD_CHANNELS)].sort())
    expect(invoke(RECORD_CHANNELS.begin, { actionId })).toEqual({
      ok: true,
      value: { actionId, capturedOn: '2026-08-12', recordingContextId: contextId }
    })
    expect(
      invoke(RECORD_CHANNELS.record, {
        actionId,
        recordingContextId: contextId,
        durationMinutes: 0,
        outcome: 'partial',
        understanding: 'State updates are queued',
        confusion: 'Why batching?',
        nextStep: 'Try a functional update',
        summary: null,
        note: 'Short action',
        postRecord: {
          action: 'complete',
          currentNextResolution: { kind: 'use-existing', actionId: replacementId }
        }
      })
    ).toMatchObject({ ok: true, value: { kind: 'saved' } })
    expect(service.recordAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId,
        capturedOn: '2026-08-12',
        durationMinutes: 0,
        outcome: 'partial'
      })
    )
    expect(invoke(RECORD_CHANNELS.listForAction, { actionId })).toMatchObject({ ok: true })
    expect(invoke(RECORD_CHANNELS.getDetail, { recordId })).toMatchObject({ ok: true })

    expect(invoke(RECORD_CHANNELS.begin, { actionId })).toMatchObject({ ok: true })
    expect(invoke(RECORD_CHANNELS.cancel, { recordingContextId: contextId })).toMatchObject({
      ok: true,
      value: { cancelled: true }
    })
    expect(assertSender).toHaveBeenCalledTimes(6)
  })

  it('keeps context for midnight confirmation and consumes it only after successful save', () => {
    const { invoke, service } = setup()
    invoke(RECORD_CHANNELS.begin, { actionId })
    service.recordAction
      .mockReturnValueOnce({
        kind: 'date-confirmation-required',
        capturedOn: '2026-08-12',
        currentLocalDate: '2026-08-13'
      })
      .mockReturnValueOnce({
        kind: 'saved',
        record: { id: recordId, actionId },
        action: { id: actionId, status: 'pending' },
        appliedNextActionId: null
      })
    const input = {
      actionId,
      recordingContextId: contextId,
      durationMinutes: 1,
      outcome: 'stopped'
    }
    expect(invoke(RECORD_CHANNELS.record, input)).toMatchObject({
      ok: true,
      value: { kind: 'date-confirmation-required' }
    })
    expect(
      invoke(RECORD_CHANNELS.record, { ...input, dateChoice: 'use-current-on' })
    ).toMatchObject({ ok: true, value: { kind: 'saved' } })
    expect(invoke(RECORD_CHANNELS.record, input)).toMatchObject({
      ok: false,
      error: { code: 'invalid-recording-context' }
    })
  })

  it('rejects malformed fields, Renderer dates, and illegal post-record choices', () => {
    const { invoke, service } = setup()
    const invalid: Array<[string, ...unknown[]]> = [
      ...[123, {}, 'x'.repeat(501)].map((summary): [string, unknown] => [
        RECORD_CHANNELS.record,
        {
          actionId,
          recordingContextId: contextId,
          durationMinutes: null,
          outcome: 'partial',
          summary
        }
      ]),
      [RECORD_CHANNELS.begin],
      [RECORD_CHANNELS.begin, { actionId: 'bad' }],
      [RECORD_CHANNELS.cancel, { recordingContextId: 'bad' }],
      [
        RECORD_CHANNELS.record,
        { actionId, recordingContextId: contextId, durationMinutes: -1, outcome: 'partial' }
      ],
      [
        RECORD_CHANNELS.record,
        { actionId, recordingContextId: contextId, durationMinutes: 0.5, outcome: 'partial' }
      ],
      [
        RECORD_CHANNELS.record,
        { actionId, recordingContextId: contextId, durationMinutes: 1, outcome: 'acted' }
      ],
      [
        RECORD_CHANNELS.record,
        {
          actionId,
          recordingContextId: contextId,
          durationMinutes: 1,
          outcome: 'partial',
          occurredOn: '2026-08-12'
        }
      ],
      [
        RECORD_CHANNELS.record,
        {
          actionId,
          recordingContextId: contextId,
          durationMinutes: 1,
          outcome: 'partial',
          understanding: ' '
        }
      ],
      [
        RECORD_CHANNELS.record,
        {
          actionId,
          recordingContextId: contextId,
          durationMinutes: 1,
          outcome: 'partial',
          dateChoice: 'yesterday'
        }
      ],
      [
        RECORD_CHANNELS.record,
        {
          actionId,
          recordingContextId: contextId,
          durationMinutes: 1,
          outcome: 'partial',
          postRecord: { action: 'auto-complete' }
        }
      ],
      [
        RECORD_CHANNELS.record,
        {
          actionId,
          recordingContextId: contextId,
          durationMinutes: 1,
          outcome: 'partial',
          postRecord: { applyRecordedNextStep: 'yes' }
        }
      ],
      [RECORD_CHANNELS.listForAction, { actionId, from: '2026-08-12' }],
      [RECORD_CHANNELS.getDetail, { recordId: 'bad' }]
    ]
    for (const [channel, ...args] of invalid) {
      expect(invoke(channel, ...args)).toMatchObject({
        ok: false,
        error: { code: 'validation' }
      })
    }
    expect(service.recordAction).not.toHaveBeenCalled()
  })

  it('rejects forged, replaced, sender-mismatched, Action-mismatched, and cleared contexts', () => {
    const { contexts, invoke, invokeOther, service } = setup()
    invoke(RECORD_CHANNELS.begin, { actionId })
    const record = (id: string, targetActionId = actionId) =>
      invoke(RECORD_CHANNELS.record, {
        actionId: targetActionId,
        recordingContextId: id,
        durationMinutes: 1,
        outcome: 'partial'
      })
    expect(record('77777777-7777-4777-8777-777777777777')).toMatchObject({
      ok: false,
      error: { code: 'invalid-recording-context' }
    })
    expect(record(contextId, otherActionId)).toMatchObject({
      ok: false,
      error: { code: 'invalid-recording-context' }
    })
    expect(
      invokeOther(RECORD_CHANNELS.record, {
        actionId,
        recordingContextId: contextId,
        durationMinutes: 1,
        outcome: 'partial'
      })
    ).toMatchObject({ ok: false, error: { code: 'invalid-recording-context' } })
    contexts.clearSender(7)
    expect(record(contextId)).toMatchObject({
      ok: false,
      error: { code: 'invalid-recording-context' }
    })
    expect(service.recordAction).not.toHaveBeenCalled()
  })

  it('maps private failures to stable errors and never downgrades sender rejection', () => {
    const { assertSender, invoke, service } = setup()
    service.beginActionRecording.mockImplementationOnce(() => {
      throw new ActionRecordApplicationError('invalid-transition', 'private state detail')
    })
    expect(invoke(RECORD_CHANNELS.begin, { actionId })).toEqual({
      ok: false,
      error: {
        code: 'invalid-transition',
        message: 'That Action cannot be recorded in its current state.'
      }
    })
    service.getActionRecordDetail.mockImplementationOnce(() => {
      throw new Error('SELECT secret FROM C:\\Users\\real-user')
    })
    const failed = invoke(RECORD_CHANNELS.getDetail, { recordId })
    expect(failed).toMatchObject({ ok: false, error: { code: 'persistence-failed' } })
    expect(JSON.stringify(failed)).not.toMatch(/SELECT|real-user|private state detail/)

    assertSender.mockImplementationOnce(() => {
      throw new Error('Rejected IPC request from an untrusted renderer.')
    })
    expect(() => invoke(RECORD_CHANNELS.listForAction, { actionId })).toThrow(/untrusted renderer/)
  })
})

describe('first Action record IPC', () => {
  const request = {
    actionId,
    recordingContextId: contextId,
    title: '修理',
    goalId: null,
    durationMinutes: null,
    outcome: 'partial',
    lifecycle: 'keep-pending'
  }
  it('uses sender-bound first-record capability, retains retry identity and cancels drafts', () => {
    const { invoke, invokeOther, service, contexts } = setup()
    expect(invoke(RECORD_CHANNELS.beginFirst)).toMatchObject({
      ok: true,
      value: { actionId, recordingContextId: contextId }
    })
    expect(contexts.firstDraft(7, contextId)).toEqual({ capturedOn: '2026-08-12' })
    expect(contexts.firstDraft(8, contextId)).toBeNull()
    expect(service.recordFirstAction).not.toHaveBeenCalled()
    expect(invokeOther(RECORD_CHANNELS.saveFirst, request)).toMatchObject({
      ok: false,
      error: { code: 'invalid-recording-context' }
    })
    expect(
      invoke(RECORD_CHANNELS.record, {
        actionId,
        recordingContextId: contextId,
        durationMinutes: 2,
        outcome: 'partial'
      })
    ).toMatchObject({ ok: false, error: { code: 'invalid-recording-context' } })
    for (let i = 0; i < 2; i++)
      expect(invoke(RECORD_CHANNELS.saveFirst, request)).toMatchObject({ ok: true })
    expect(contexts.firstDraft(7, contextId)).toBeNull()
    expect(service.recordFirstAction).toHaveBeenCalledTimes(1)
    expect(service.recordFirstAction).toHaveBeenLastCalledWith(
      expect.objectContaining({
        actionId,
        recordId: contextId,
        capturedOn: '2026-08-12',
        durationMinutes: null,
        lifecycle: 'keep-pending'
      })
    )
    invoke(RECORD_CHANNELS.cancel, { recordingContextId: contextId })
    expect(invoke(RECORD_CHANNELS.saveFirst, request)).toMatchObject({
      ok: false,
      error: { code: 'invalid-recording-context' }
    })
  })
  it('replays its saved receipt after opening another record, without recreating edited/deleted facts', () => {
    const { invoke, service } = setup([contextId, replacementId])
    invoke(RECORD_CHANNELS.beginFirst)
    const saved = invoke(RECORD_CHANNELS.saveFirst, request)
    invoke(RECORD_CHANNELS.begin, { actionId })
    service.recordFirstAction.mockImplementation(() => {
      throw Error('must not write again')
    })
    expect(invoke(RECORD_CHANNELS.saveFirst, request)).toEqual(saved)
    expect(service.recordFirstAction).toHaveBeenCalledTimes(1)
  })
  it.each(['not-found', 'invalid-transition'] as const)(
    'only returns %s before commit; a saved receipt wins over later goal changes',
    (code) => {
      const { invoke, service } = setup()
      invoke(RECORD_CHANNELS.beginFirst)
      service.recordFirstAction.mockImplementationOnce(() => {
        throw new ActionRecordApplicationError(code, 'goal changed before commit')
      })
      expect(invoke(RECORD_CHANNELS.saveFirst, request)).toMatchObject({
        ok: false,
        error: { code }
      })
      const saved = invoke(RECORD_CHANNELS.saveFirst, { ...request, goalId: null })
      expect(saved).toMatchObject({ ok: true })
      service.recordFirstAction.mockImplementation(() => {
        throw new ActionRecordApplicationError(code, 'goal changed after commit')
      })
      expect(invoke(RECORD_CHANNELS.saveFirst, request)).toEqual(saved)
      // Parsing precedes receipt lookup: validation is not proof of no prior commit.
      expect(invoke(RECORD_CHANNELS.saveFirst, { ...request, durationMinutes: -1 })).toMatchObject({
        ok: false,
        error: { code: 'validation' }
      })
      expect(invoke(RECORD_CHANNELS.saveFirst, request)).toEqual(saved)
      expect(service.recordFirstAction).toHaveBeenCalledTimes(2)
    }
  )
  it('cannot use an existing-action context to create a new action', () => {
    const { invoke, service } = setup()
    invoke(RECORD_CHANNELS.begin, { actionId })
    expect(invoke(RECORD_CHANNELS.saveFirst, request)).toMatchObject({
      ok: false,
      error: { code: 'invalid-recording-context' }
    })
    expect(service.recordFirstAction).not.toHaveBeenCalled()
  })
  it.each([
    { lifecycle: undefined },
    { lifecycle: 'cancel' },
    { goalId: 'wrong' },
    { durationMinutes: undefined },
    { durationMinutes: '0' },
    { durationMinutes: -1 },
    { outcome: 'unknown' },
    { capturedOn: '2020-01-01' },
    { postRecord: { applyRecordedNextStep: true } }
  ])('rejects invalid or wider authority %j', (invalid) => {
    const { invoke, service } = setup()
    invoke(RECORD_CHANNELS.beginFirst)
    expect(invoke(RECORD_CHANNELS.saveFirst, { ...request, ...invalid })).toMatchObject({
      ok: false,
      error: { code: 'validation' }
    })
    expect(service.recordFirstAction).not.toHaveBeenCalled()
  })
  it('retains the draft capability after a persistence failure', () => {
    const { invoke, service } = setup()
    invoke(RECORD_CHANNELS.beginFirst)
    service.recordFirstAction.mockImplementationOnce(() => {
      throw Error('synthetic persistence failure')
    })
    expect(invoke(RECORD_CHANNELS.saveFirst, request)).toMatchObject({
      ok: false,
      error: { code: 'persistence-failed' }
    })
    expect(invoke(RECORD_CHANNELS.saveFirst, request)).toMatchObject({ ok: true })
  })
})
