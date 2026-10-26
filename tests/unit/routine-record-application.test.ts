import { describe, expect, it } from 'vitest'
import { RoutineRecordService } from '../../src/application/routine-records'
import type {
  CorePersistenceSnapshot,
  RepositoryPort,
  RoutinePersistenceRecord,
  RoutineRecordPersistenceRecord,
  UnitOfWorkPort
} from '../../src/application/ports/persistence'
import { FakeClock } from '../support/fake-clock'

const instant = '2026-08-10T08:00:00.000Z'

function setup(status: RoutinePersistenceRecord['status'] = 'active') {
  const routine: RoutinePersistenceRecord = {
    arrangementMode: 'weekly' as const,
    id: 'routine-1',
    goalId: null,
    name: 'Move',
    description: null,
    minimumAction: 'Stretch',
    status,
    createdAt: instant,
    updatedAt: instant
  }
  const records = new Map<string, RoutineRecordPersistenceRecord>()
  const repository = {
    findRoutineById: (id: string) => (id === routine.id ? routine : null),
    listRoutines: () => [routine],
    listRoutineScheduleDays: () => [{ routineId: routine.id, weekday: 1 }],
    replaceRoutineScheduleDays: () => undefined,
    createRoutineRecord: (record: RoutineRecordPersistenceRecord) => {
      const key = `${record.routineId}:${record.occurredOn}`
      if (records.has(key)) return false
      records.set(key, record)
      return true
    },
    findRoutineRecordByRoutineAndDate: (routineId: string, occurredOn: string) =>
      records.get(`${routineId}:${occurredOn}`) ?? null,
    listRoutineRecordsByRoutineId: () => [...records.values()],
    readSnapshot: (): CorePersistenceSnapshot => ({
      goals: [],
      actions: [],
      routines: [routine],
      routineScheduleDays: [],
      todaySelections: [],
      actionRecords: [],
      routineRecords: [...records.values()],
      understandings: [],
      confusions: [],
      reviewResults: []
    })
  } as unknown as RepositoryPort
  const unitOfWork: UnitOfWorkPort = { transaction: (work) => work(repository) }
  const clock = new FakeClock({ instant, localDate: '2026-08-10', timeZone: 'Asia/Shanghai' })
  let nextId = 0
  return {
    clock,
    records,
    service: new RoutineRecordService({
      repository,
      unitOfWork,
      clock,
      generateId: () => `record-${++nextId}`
    })
  }
}

describe('RoutineRecord application', () => {
  it('defaults day-state reads to the application date without moving saved facts', () => {
    const { service, clock, records } = setup()
    service.recordRoutine({
      routineId: 'routine-1',
      capturedOn: '2026-08-10',
      outcome: 'acted',
      durationMinutes: 0
    })
    expect(service.getRoutineDayState('routine-1')).toMatchObject({
      localDate: '2026-08-10',
      recordState: 'acted',
      record: { durationMinutes: 0 }
    })
    clock.setState({
      instant: '2026-08-11T00:01:00.000Z',
      localDate: '2026-08-11',
      timeZone: 'Asia/Shanghai'
    })
    expect(service.getRoutineDayState('routine-1')).toMatchObject({
      localDate: '2026-08-11',
      recordState: 'unknown',
      record: null
    })
    expect(service.getRoutineDayState('routine-1', '2026-08-10')).toMatchObject({
      localDate: '2026-08-10',
      recordState: 'acted'
    })
    expect(records.size).toBe(1)
  })

  it('creates once with a plannedForDate snapshot and exposes all explicit states', () => {
    for (const outcome of ['target_met', 'acted', 'intentional_rest', 'not_done'] as const) {
      const context = setup()
      const result = context.service.recordRoutine({
        routineId: 'routine-1',
        capturedOn: '2026-08-10',
        outcome
      })
      expect(result).toMatchObject({
        kind: 'saved',
        record: { outcome, plannedForDate: true, occurredOn: '2026-08-10' }
      })
      expect(context.service.getRoutineDayState('routine-1', '2026-08-10').recordState).toBe(
        outcome
      )
      expect(() =>
        context.service.recordRoutine({
          routineId: 'routine-1',
          capturedOn: '2026-08-10',
          outcome: 'acted'
        })
      ).toThrowError(expect.objectContaining({ code: 'record-already-exists' }))
    }
  })

  it('records an unplanned real action without changing the plan snapshot', () => {
    const context = setup()
    context.clock.setState({
      instant: '2026-08-11T08:00:00.000Z',
      localDate: '2026-08-11',
      timeZone: 'Asia/Shanghai'
    })
    const result = context.service.recordRoutine({
      routineId: 'routine-1',
      capturedOn: '2026-08-11',
      outcome: 'acted',
      durationMinutes: 5
    })
    expect(result).toMatchObject({ kind: 'saved', record: { plannedForDate: false } })
  })

  it('requires an explicit date choice across midnight and never silently changes the date', () => {
    const context = setup()
    const begun = context.service.beginRoutineRecording('routine-1')
    context.clock.setState({
      instant: '2026-08-11T08:00:00.000Z',
      localDate: '2026-08-11',
      timeZone: 'Asia/Shanghai'
    })
    expect(
      context.service.recordRoutine({
        routineId: 'routine-1',
        capturedOn: begun.capturedOn,
        outcome: 'acted'
      })
    ).toEqual({
      kind: 'date-confirmation-required',
      capturedOn: '2026-08-10',
      currentLocalDate: '2026-08-11'
    })
    expect(context.records).toHaveLength(0)
    expect(
      context.service.recordRoutine({
        routineId: 'routine-1',
        capturedOn: begun.capturedOn,
        dateChoice: 'keep-captured-on',
        outcome: 'acted'
      })
    ).toMatchObject({ kind: 'saved', record: { occurredOn: '2026-08-10' } })
  })

  it('keeps missing rows unknown and rejects paused or ended Routines', () => {
    expect(setup().service.getRoutineDayState('routine-1', '2026-08-10')).toMatchObject({
      recordState: 'unknown',
      record: null
    })
    for (const status of ['paused', 'ended'] as const) {
      expect(() => setup(status).service.beginRoutineRecording('routine-1')).toThrowError(
        expect.objectContaining({ code: 'invalid-transition' })
      )
    }
  })
})
