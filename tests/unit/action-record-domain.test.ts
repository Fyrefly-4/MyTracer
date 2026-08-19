import { describe, expect, it } from 'vitest'
import {
  createActionRecord,
  createManualUnderstanding,
  createOpenConfusion,
  updateActionRecord
} from '../../src/domain/action-record'

const now = '2026-08-12T08:00:00.000Z'

describe('ActionRecord domain', () => {
  it('creates completed, partial, and stopped facts with only the quick fields', () => {
    for (const outcome of ['completed', 'partial', 'stopped'] as const) {
      expect(
        createActionRecord({
          id: `record-${outcome}`,
          actionId: 'action-1',
          occurredOn: '2026-08-12',
          durationMinutes: 0,
          outcome,
          now
        })
      ).toMatchObject({
        durationMinutes: 0,
        outcome,
        nextStep: null,
        note: null
      })
    }
  })

  it('normalizes optional deep text without making it required', () => {
    expect(
      createActionRecord({
        id: 'record-1',
        actionId: 'action-1',
        occurredOn: '2026-08-12',
        durationMinutes: 25,
        outcome: 'partial',
        nextStep: '  Run another example  ',
        note: '  ',
        now
      })
    ).toMatchObject({ nextStep: 'Run another example', note: null })
  })

  it('rejects negative, fractional, and invalid occurrence values', () => {
    for (const durationMinutes of [-1, 0.5]) {
      expect(() =>
        createActionRecord({
          id: 'record-1',
          actionId: 'action-1',
          occurredOn: '2026-08-12',
          durationMinutes,
          outcome: 'partial',
          now
        })
      ).toThrowError(expect.objectContaining({ code: 'validation' }))
    }
    expect(() =>
      createActionRecord({
        id: 'record-1',
        actionId: 'action-1',
        occurredOn: '2026-02-30',
        durationMinutes: 1,
        outcome: 'partial',
        now
      })
    ).toThrowError(expect.objectContaining({ code: 'validation' }))
  })

  it('creates only manual Understanding and open Confusion children', () => {
    expect(
      createManualUnderstanding({
        id: 'understanding-1',
        actionRecordId: 'record-1',
        text: '  State is a snapshot  ',
        now
      })
    ).toMatchObject({ text: 'State is a snapshot', source: 'manual', revokedAt: null })
    expect(
      createOpenConfusion({
        id: 'confusion-1',
        actionRecordId: 'record-1',
        text: '  Why batching?  ',
        now
      })
    ).toMatchObject({ text: 'Why batching?', status: 'open', resolvedAt: null, resolution: null })
    expect(() =>
      createManualUnderstanding({
        id: 'understanding-1',
        actionRecordId: 'record-1',
        text: ' ',
        now
      })
    ).toThrowError(expect.objectContaining({ code: 'validation' }))
  })

  it('updates editable facts while preserving identity, parent, and creation time', () => {
    const current = createActionRecord({
      id: 'record-1', actionId: 'action-1', occurredOn: '2026-08-12',
      durationMinutes: 1, outcome: 'partial', now
    })
    expect(updateActionRecord(current, {
      occurredOn: '2026-08-11', durationMinutes: 3, outcome: 'stopped',
      note: 'Edited', now: '2026-08-13T08:00:00.000Z'
    })).toMatchObject({
      id: 'record-1', actionId: 'action-1', createdAt: now,
      occurredOn: '2026-08-11', updatedAt: '2026-08-13T08:00:00.000Z'
    })
  })
})
