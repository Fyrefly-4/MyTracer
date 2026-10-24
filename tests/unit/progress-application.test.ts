import { describe, expect, it } from 'vitest'
import { ProgressApplicationError, ProgressService } from '../../src/application/progress'
import type {
  GoalPersistenceRecord,
  ProgressQueryFilterPersistence,
  ProgressQueryRowPersistenceRecord,
  ProgressRepositoryPort,
  RoutineProgressQueryRecordPersistence
} from '../../src/application/ports/persistence'

const goal: GoalPersistenceRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Learn React',
  description: null,
  status: 'active',
  predecessorGoalId: null,
  currentNextActionId: null,
  createdAt: '2026-08-10T08:00:00.000Z',
  updatedAt: '2026-08-10T08:00:00.000Z'
}

function row(
  input: Partial<ProgressQueryRowPersistenceRecord> = {}
): ProgressQueryRowPersistenceRecord {
  return {
    recordId: 'record-1',
    actionId: 'action-1',
    goalId: goal.id,
    actionTitle: 'Run a state update example',
    hasRecordedText: false,
    occurredOn: '2026-08-12',
    durationMinutes: 25,
    outcome: 'partial',
    recordCreatedAt: '2026-08-12T08:00:00.000Z',
    understandingId: null,
    understandingText: null,
    understandingCreatedAt: null,
    confusionId: null,
    confusionText: null,
    confusionCreatedAt: null,
    ...input
  }
}

function serviceWith(
  rows: readonly ProgressQueryRowPersistenceRecord[],
  routineRecords: readonly RoutineProgressQueryRecordPersistence[] = []
) {
  let received: ProgressQueryFilterPersistence | undefined
  const repository = {
    findGoalById: (id: string) => (id === goal.id ? goal : null),
    queryProgressSnapshot: (filter: ProgressQueryFilterPersistence) => {
      received = filter
      return { actionRows: rows, routineRecords }
    }
  } as unknown as ProgressRepositoryPort
  return {
    service: new ProgressService({ repository }),
    received: () => received
  }
}

describe('Progress application projection', () => {
  it('normalizes all filter combinations and keeps inclusive endpoints explicit', () => {
    for (const input of [
      {},
      { goalId: goal.id },
      { from: '2026-08-11', through: '2026-08-12' },
      { goalId: goal.id, from: '2026-08-11', through: '2026-08-12' },
      { from: '2026-08-11' },
      { through: '2026-08-12' }
    ]) {
      const context = serviceWith([])
      const result = context.service.getProgress(input)
      expect(context.received()).toEqual({
        goalId: input.goalId ?? null,
        from: input.from ?? null,
        through: input.through ?? null
      })
      expect(result.filter).toEqual(context.received())
      expect(result).toMatchObject({
        totalDurationMinutes: 0,
        realActionCount: 0,
        targetMetCount: 0,
        plannedTargetMetCount: 0,
        records: [],
        routineRecords: []
      })
    }
  })

  it('rejects invalid dates, reversed endpoints, and missing Goals', () => {
    const context = serviceWith([])
    for (const input of [
      { from: '2026-02-30' },
      { through: '2026/08/12' },
      { from: '2026-08-13', through: '2026-08-12' }
    ]) {
      expect(() => context.service.getProgress(input)).toThrowError(
        expect.objectContaining<Partial<ProgressApplicationError>>({ code: 'validation' })
      )
    }
    expect(() =>
      context.service.getProgress({ goalId: '22222222-2222-4222-8222-222222222222' })
    ).toThrowError(
      expect.objectContaining<Partial<ProgressApplicationError>>({ code: 'not-found' })
    )
  })

  it('counts every record once while de-duplicating joined children in stable order', () => {
    const rows = [
      row({
        understandingId: 'understanding-1',
        understandingText: 'State setters enqueue updates',
        understandingCreatedAt: '2026-08-12T08:01:00.000Z',
        confusionId: 'confusion-1',
        confusionText: 'When does batching stop?',
        confusionCreatedAt: '2026-08-12T08:03:00.000Z'
      }),
      row({
        understandingId: 'understanding-1',
        understandingText: 'State setters enqueue updates',
        understandingCreatedAt: '2026-08-12T08:01:00.000Z',
        confusionId: 'confusion-2',
        confusionText: 'How are transitions flushed?',
        confusionCreatedAt: '2026-08-12T08:04:00.000Z'
      }),
      row({
        recordId: 'record-2',
        occurredOn: '2026-08-11',
        recordCreatedAt: '2026-08-11T09:00:00.000Z',
        durationMinutes: 0,
        outcome: 'stopped'
      }),
      row({
        recordId: 'record-3',
        occurredOn: '2026-08-10',
        recordCreatedAt: '2026-08-10T09:00:00.000Z',
        durationMinutes: 5,
        outcome: 'completed'
      })
    ]
    const result = serviceWith(rows).service.getProgress({})

    expect(result.totalDurationMinutes).toBe(30)
    expect(result.realActionCount).toBe(3)
    expect(result.records.map((record) => record.recordId)).toEqual([
      'record-1',
      'record-2',
      'record-3'
    ])
    expect(result.records[0].understandings.map((item) => item.id)).toEqual(['understanding-1'])
    expect(result.records[0].openConfusions.map((item) => item.id)).toEqual([
      'confusion-1',
      'confusion-2'
    ])
    expect(Object.keys(result)).toEqual([
      'filter',
      'totalDurationMinutes',
      'unknownDurationCount',
      'realActionCount',
      'targetMetCount',
      'plannedTargetMetCount',
      'records',
      'routineRecords'
    ])
  })

  it('keeps Routine facts distinct and counts only real action and planned target facts', () => {
    const routineRecords: RoutineProgressQueryRecordPersistence[] = [
      {
        recordId: 'routine-record-1',
        routineId: 'routine-1',
        goalId: goal.id,
        routineName: 'Move',
        occurredOn: '2026-08-12',
        outcome: 'target_met',
        plannedForDate: true,
        durationMinutes: 10,
        summary: null,
        note: null,
        recordCreatedAt: '2026-08-12T10:00:00.000Z'
      },
      {
        recordId: 'routine-record-2',
        routineId: 'routine-1',
        goalId: goal.id,
        routineName: 'Move',
        occurredOn: '2026-08-11',
        outcome: 'acted',
        plannedForDate: false,
        durationMinutes: null,
        summary: null,
        note: 'Unplanned walk',
        recordCreatedAt: '2026-08-11T10:00:00.000Z'
      },
      {
        recordId: 'routine-record-3',
        routineId: 'routine-1',
        goalId: goal.id,
        routineName: 'Move',
        occurredOn: '2026-08-10',
        outcome: 'not_done',
        plannedForDate: true,
        durationMinutes: null,
        summary: null,
        note: null,
        recordCreatedAt: '2026-08-10T10:00:00.000Z'
      }
    ]
    const result = serviceWith([row()], routineRecords).service.getProgress({})

    expect(result.totalDurationMinutes).toBe(35)
    expect(result.realActionCount).toBe(3)
    expect(result.targetMetCount).toBe(1)
    expect(result.plannedTargetMetCount).toBe(1)
    expect(result.records).toHaveLength(1)
    expect(result.routineRecords.map((record) => record.outcome)).toEqual([
      'target_met',
      'acted',
      'not_done'
    ])
  })
})
