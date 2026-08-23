import { describe, expect, it } from 'vitest'
import {
  COMPLETE_EXPORT_ENUM_VALUES,
  COMPLETE_EXPORT_FORMAT,
  COMPLETE_EXPORT_VERSION,
  CompleteExportApplicationError,
  CompleteExportService,
  buildCompleteExport,
  validateCompleteExport
} from '../../src/application/complete-export'
import type { CompleteCorePersistenceSnapshot } from '../../src/application/ports/persistence'
import { createLocalDate } from '../../src/domain/local-date'
import { FakeClock } from '../support/fake-clock'

const instant = '2026-08-20T08:00:00.000Z'
const emptySnapshot: CompleteCorePersistenceSnapshot = {
  sourceDataVersion: 2,
  coreSnapshot: {
    goals: [],
    actions: [],
    routines: [],
    routineScheduleDays: [],
    todaySelections: [],
    actionRecords: [],
    routineRecords: [],
    understandings: [],
    confusions: [],
    reviewResults: []
  }
}

describe('complete export application', () => {
  it('builds the approved v1 envelope from one versioned snapshot and stable enums', () => {
    const clock = new FakeClock({ instant, localDate: '2026-08-20', timeZone: 'Asia/Shanghai' })
    const document = buildCompleteExport(emptySnapshot, clock)
    expect(document).toMatchObject({
      format: COMPLETE_EXPORT_FORMAT,
      exportVersion: COMPLETE_EXPORT_VERSION,
      sourceDataVersion: 2,
      exportedAt: instant,
      localTimeZone: 'Asia/Shanghai',
      enumValues: COMPLETE_EXPORT_ENUM_VALUES
    })
    expect(Object.isFrozen(document.data)).toBe(true)
  })

  it('rejects unsupported fields, bad references, unknown outcomes, and technical paths', () => {
    const valid = buildCompleteExport(
      emptySnapshot,
      new FakeClock({ instant, localDate: '2026-08-20', timeZone: 'Asia/Shanghai' })
    )
    for (const candidate of [
      { ...valid, data: { ...valid.data, cachePath: [] } },
      { ...valid, enumValues: { ...valid.enumValues, goalStatus: ['active'] } },
      {
        ...valid,
        data: {
          ...valid.data,
          routineRecords: [
            { id: 'r', routineId: 'missing', occurredOn: '2026-08-20', outcome: 'unknown' }
          ]
        }
      }
    ]) {
      expect(() => validateCompleteExport(candidate)).toThrow(CompleteExportApplicationError)
    }
  })

  it('accepts every persisted status and enum value without serializing unknown as a Routine record', () => {
    const snapshot: CompleteCorePersistenceSnapshot = {
      sourceDataVersion: 2,
      coreSnapshot: {
        goals: ['active', 'ended', 'paused'].map((status) => ({
          id: `goal-${status}`,
          title: status,
          description: null,
          status: status as 'active' | 'paused' | 'ended',
          currentNextActionId: status === 'active' ? 'action-pending' : null,
          createdAt: instant,
          updatedAt: instant
        })),
        actions: ['cancelled', 'completed', 'pending', 'rescheduled'].map((status) => ({
          id: `action-${status}`,
          goalId: 'goal-active',
          title: status,
          description: null,
          status: status as 'pending' | 'completed' | 'cancelled' | 'rescheduled',
          createdAt: instant,
          updatedAt: instant
        })),
        routines: ['active', 'ended', 'paused'].map((status) => ({
          id: `routine-${status}`,
          goalId: status === 'active' ? 'goal-active' : null,
          name: status,
          minimumAction: 'One',
          description: null,
          status: status as 'active' | 'paused' | 'ended',
          createdAt: instant,
          updatedAt: instant
        })),
        routineScheduleDays: [
          { routineId: 'routine-active', weekday: 1 },
          { routineId: 'routine-active', weekday: 2 }
        ],
        todaySelections: [
          {
            actionId: 'action-pending',
            selectedFor: '2026-08-20',
            kind: 'focus',
            selectedBy: 'user',
            createdAt: instant
          },
          {
            actionId: 'action-completed',
            selectedFor: '2026-08-21',
            kind: 'intention',
            selectedBy: 'user',
            createdAt: instant
          }
        ],
        actionRecords: ['completed', 'partial', 'stopped'].map((outcome, index) => ({
          id: `action-record-${outcome}`,
          actionId: index === 0 ? 'action-pending' : 'action-completed',
          occurredOn: `2026-08-2${index}`,
          durationMinutes: index,
          outcome: outcome as 'completed' | 'partial' | 'stopped',
          nextStep: null,
          note: null,
          createdAt: instant,
          updatedAt: instant
        })),
        routineRecords: ['target_met', 'acted', 'intentional_rest', 'not_done'].map(
          (outcome, index) => ({
            id: `routine-record-${outcome}`,
            routineId: 'routine-active',
            occurredOn: `2026-08-2${index}`,
            outcome: outcome as 'target_met' | 'acted' | 'intentional_rest' | 'not_done',
            plannedForDate: index % 2 === 0,
            plannedForDateBasis:
              index % 2 === 0 ? 'schedule_at_recording' : 'user_confirmed_history',
            durationMinutes:
              outcome === 'intentional_rest' || outcome === 'not_done' ? null : index,
            note: null,
            createdAt: instant,
            updatedAt: instant
          })
        ),
        understandings: [
          {
            id: 'understanding-ai',
            actionRecordId: 'action-record-partial',
            text: 'ai',
            source: 'ai_candidate_confirmed',
            revokedAt: instant,
            createdAt: instant,
            updatedAt: instant
          },
          {
            id: 'understanding-manual',
            actionRecordId: 'action-record-completed',
            text: 'manual',
            source: 'manual',
            revokedAt: null,
            createdAt: instant,
            updatedAt: instant
          }
        ],
        confusions: [
          {
            id: 'confusion-open',
            actionRecordId: 'action-record-completed',
            text: 'open',
            status: 'open',
            resolvedAt: null,
            resolution: null,
            createdAt: instant,
            updatedAt: instant
          },
          {
            id: 'confusion-resolved',
            actionRecordId: 'action-record-partial',
            text: 'resolved',
            status: 'resolved',
            resolvedAt: instant,
            resolution: 'known',
            createdAt: instant,
            updatedAt: instant
          }
        ],
        reviewResults: [
          {
            id: 'review-goal',
            periodStartedOn: '2026-08-17',
            summary: 'Summary',
            adjustment: 'Adjustment',
            nextFocus: 'Focus',
            goalId: 'goal-active',
            createdAt: instant,
            updatedAt: instant
          },
          {
            id: 'review-global',
            periodStartedOn: '2026-08-18',
            summary: 'Summary',
            adjustment: 'Adjustment',
            nextFocus: 'Focus',
            goalId: null,
            createdAt: instant,
            updatedAt: instant
          }
        ]
      }
    }
    expect(() =>
      validateCompleteExport(
        buildCompleteExport(
          snapshot,
          new FakeClock({ instant, localDate: '2026-08-20', timeZone: 'Asia/Shanghai' })
        )
      )
    ).not.toThrow()
  })

  it('uses no destination path in the application command and keeps cancellation non-exceptional', async () => {
    const clock = {
      snapshot: () => ({
        instant,
        localDate: createLocalDate('2026-08-20'),
        timeZone: 'Asia/Shanghai'
      }),
      nowInstant: () => {
        throw new Error('must use one snapshot')
      },
      currentLocalDate: () => {
        throw new Error('must use one snapshot')
      },
      currentTimeZone: () => {
        throw new Error('must use one snapshot')
      }
    }
    const deliverCompleteExport = async () => ({ kind: 'cancelled' as const })
    const service = new CompleteExportService({
      repository: { readCompleteCoreSnapshot: () => emptySnapshot } as never,
      clock,
      exportPort: { deliverCompleteExport }
    })
    await expect(service.generateCompleteExport()).resolves.toEqual({ kind: 'cancelled' })
  })
})
