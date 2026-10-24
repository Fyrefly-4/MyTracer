import type { IpcMainInvokeEvent } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import {
  DataControlApplicationError,
  type DataControlService
} from '../../src/application/data-control'
import { DATA_CONTROL_CHANNELS } from '../../src/contracts/data-control'

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown
const ipcModulePath = '../../src/main/data-control-ipc'
const { registerDataControlIpc } = await import(ipcModulePath)
const contextModulePath = '../../src/main/delete-preview-contexts'
const { DeletePreviewContextStore } = await import(contextModulePath)

const actionId = '11111111-1111-4111-8111-111111111111'
const previewId = '22222222-2222-4222-8222-222222222222'
const target = { type: 'action' as const, id: actionId }
const counts = {
  goals: 0,
  actions: 1,
  routines: 0,
  routineScheduleDays: 0,
  todaySelections: 1,
  actionRecords: 1,
  routineRecords: 0,
  understandings: 1,
  confusions: 1,
  reviewResults: 0,
  detachedRoutines: 0,
  detachedGoalStages: 0,
  detachedReviewResults: 0,
  clearedCurrentNext: 1
}

function setup() {
  const handlers = new Map<string, Handler>()
  const ipc = {
    removeHandler: vi.fn((channel: string) => handlers.delete(channel)),
    handle: vi.fn((channel: string, handler: Handler) => handlers.set(channel, handler))
  }
  const service = {
    listData: vi.fn(() => ({
      actionRecords: [],
      routineRecords: [],
      understandings: [],
      confusions: []
    })),
    backfillActionRecord: vi.fn((input) => input),
    updateActionRecord: vi.fn((input) => input),
    backfillRoutineRecord: vi.fn((input) => input),
    updateRoutineRecord: vi.fn((input) => input),
    updateUnderstandingText: vi.fn(),
    revokeUnderstanding: vi.fn(),
    updateConfusionText: vi.fn(),
    resolveConfusion: vi.fn(),
    reopenConfusion: vi.fn(),
    previewDelete: vi.fn(() => ({ target, counts, fingerprint: 'trusted-fingerprint' })),
    confirmDelete: vi.fn(() => counts)
  }
  const contexts = new DeletePreviewContextStore(() => previewId)
  const assertSender = vi.fn()
  registerDataControlIpc({
    ipc,
    service: service as unknown as DataControlService,
    contexts,
    assertSender,
    now: () => '2026-08-19T08:00:00.000Z'
  })
  const invokeAs = (senderId: number, channel: string, ...args: unknown[]) =>
    handlers.get(channel)!({ sender: { id: senderId } } as IpcMainInvokeEvent, ...args)
  return { handlers, service, assertSender, invokeAs }
}

describe('data-control IPC boundary', () => {
  it.each([null, 0, 12])(
    'preserves explicit duration %s in backfill and edit commands',
    (durationMinutes) => {
      const { invokeAs } = setup()
      for (const [channel, identity] of [
        [DATA_CONTROL_CHANNELS.backfillActionRecord, { actionId }],
        [DATA_CONTROL_CHANNELS.updateActionRecord, { recordId: actionId }]
      ] as const) {
        expect(
          invokeAs(7, channel, {
            ...identity,
            occurredOn: '2026-10-24',
            durationMinutes,
            outcome: 'partial'
          })
        ).toMatchObject({ ok: true, value: { durationMinutes } })
        expect(
          invokeAs(7, channel, { ...identity, occurredOn: '2026-10-24', outcome: 'partial' })
        ).toMatchObject({ ok: false, error: { code: 'validation' } })
      }
    }
  )

  it('registers only fixed channels and exposes counts without the trusted fingerprint', () => {
    const { handlers, invokeAs } = setup()
    expect([...handlers.keys()].sort()).toEqual(Object.values(DATA_CONTROL_CHANNELS).sort())
    const result = invokeAs(7, DATA_CONTROL_CHANNELS.previewDelete, { target })
    expect(result).toMatchObject({ ok: true, value: { previewId, target, counts } })
    expect(JSON.stringify(result)).not.toContain('trusted-fingerprint')
  })

  it('binds confirmation to sender, consumes valid attempts, supports cancel, and prevents replay', () => {
    const { invokeAs, service } = setup()
    invokeAs(7, DATA_CONTROL_CHANNELS.previewDelete, { target })
    expect(
      invokeAs(8, DATA_CONTROL_CHANNELS.confirmDelete, {
        previewId,
        target,
        confirmation: 'permanently-delete'
      })
    ).toMatchObject({ ok: false, error: { code: 'invalid-delete-preview' } })
    expect(
      invokeAs(7, DATA_CONTROL_CHANNELS.confirmDelete, {
        previewId,
        target,
        confirmation: 'permanently-delete'
      })
    ).toMatchObject({ ok: true, value: { counts } })
    expect(service.confirmDelete).toHaveBeenCalledWith(target, 'trusted-fingerprint')
    expect(
      invokeAs(7, DATA_CONTROL_CHANNELS.confirmDelete, {
        previewId,
        target,
        confirmation: 'permanently-delete'
      })
    ).toMatchObject({ ok: false, error: { code: 'invalid-delete-preview' } })

    invokeAs(7, DATA_CONTROL_CHANNELS.previewDelete, { target })
    expect(invokeAs(7, DATA_CONTROL_CHANNELS.cancelDelete, { previewId })).toMatchObject({
      ok: true,
      value: { cancelled: true }
    })
    expect(
      invokeAs(7, DATA_CONTROL_CHANNELS.confirmDelete, {
        previewId,
        target,
        confirmation: 'permanently-delete'
      })
    ).toMatchObject({ ok: false, error: { code: 'invalid-delete-preview' } })
  })

  it('consumes a valid stale or storage-failed attempt and maps safe errors', () => {
    const { invokeAs, service } = setup()
    invokeAs(7, DATA_CONTROL_CHANNELS.previewDelete, { target })
    service.confirmDelete.mockImplementationOnce(() => {
      throw new DataControlApplicationError('delete-preview-stale', 'private details')
    })
    expect(
      invokeAs(7, DATA_CONTROL_CHANNELS.confirmDelete, {
        previewId,
        target,
        confirmation: 'permanently-delete'
      })
    ).toEqual({
      ok: false,
      error: {
        code: 'delete-preview-stale',
        message: 'The delete impact changed. Preview it again.'
      }
    })
    expect(
      invokeAs(7, DATA_CONTROL_CHANNELS.confirmDelete, {
        previewId,
        target,
        confirmation: 'permanently-delete'
      })
    ).toMatchObject({ ok: false, error: { code: 'invalid-delete-preview' } })
  })

  it('rejects extra fields, invalid dates, ids, outcomes, confirmation, and untrusted senders', () => {
    const { invokeAs, assertSender, service } = setup()
    for (const [channel, input] of [
      ...[123, {}, 'x'.repeat(501)].map(
        (summary) =>
          [
            DATA_CONTROL_CHANNELS.backfillActionRecord,
            {
              actionId,
              occurredOn: '2026-10-24',
              durationMinutes: null,
              outcome: 'partial',
              summary
            }
          ] as const
      ),
      [
        DATA_CONTROL_CHANNELS.backfillActionRecord,
        {
          actionId,
          occurredOn: '2026-02-30',
          durationMinutes: 1,
          outcome: 'partial'
        }
      ],
      [
        DATA_CONTROL_CHANNELS.backfillRoutineRecord,
        {
          routineId: actionId,
          occurredOn: '2026-08-19',
          outcome: 'unknown',
          plannedForDate: true
        }
      ],
      [DATA_CONTROL_CHANNELS.previewDelete, { target: { type: 'action', id: 'not-uuid' } }],
      [
        DATA_CONTROL_CHANNELS.confirmDelete,
        {
          previewId,
          target,
          confirmation: 'yes',
          surprise: true
        }
      ]
    ] as const) {
      expect(invokeAs(7, channel, input)).toMatchObject({
        ok: false,
        error: { code: 'validation' }
      })
    }
    expect(service.backfillActionRecord).not.toHaveBeenCalled()
    assertSender.mockImplementationOnce(() => {
      throw new Error('untrusted renderer')
    })
    expect(() => invokeAs(7, DATA_CONTROL_CHANNELS.list)).toThrow(/untrusted/)
  })
})
