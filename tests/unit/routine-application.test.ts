import { describe, expect, it } from 'vitest'
import { RoutineApplicationError, RoutineService } from '../../src/application/routines'
import type {
  CorePersistenceSnapshot,
  GoalPersistenceRecord,
  RepositoryPort,
  RoutinePersistenceRecord,
  RoutineRepositoryPort,
  RoutineScheduleDayPersistenceRecord,
  RoutineStatus,
  UnitOfWorkPort
} from '../../src/application/ports/persistence'
import { FakeClock } from '../support/fake-clock'

const instant = '2026-08-14T08:00:00.000Z'

class MemoryRoutinePersistence implements RoutineRepositoryPort, UnitOfWorkPort {
  goals: GoalPersistenceRecord[] = []
  routines: RoutinePersistenceRecord[] = []
  scheduleDays: RoutineScheduleDayPersistenceRecord[] = []
  failOnScheduleSaveAt: number | null = null
  private scheduleSaveCount = 0

  transaction<T>(work: (repository: RepositoryPort) => T): T {
    const before = structuredClone(this.readSnapshot())
    this.scheduleSaveCount = 0
    try {
      return work(this)
    } catch (error) {
      this.routines = [...before.routines]
      this.scheduleDays = [...before.routineScheduleDays]
      throw error
    }
  }

  saveRoutine(record: RoutinePersistenceRecord): void {
    const index = this.routines.findIndex((item) => item.id === record.id)
    if (index >= 0) this.routines[index] = record
    else this.routines.push(record)
  }
  saveRoutineScheduleDay(record: RoutineScheduleDayPersistenceRecord): void {
    this.scheduleSaveCount += 1
    if (this.failOnScheduleSaveAt === this.scheduleSaveCount) throw new Error('injected failure')
    this.scheduleDays.push(record)
  }
  replaceRoutineScheduleDays(
    routineId: string,
    records: readonly RoutineScheduleDayPersistenceRecord[]
  ): void {
    this.scheduleDays = this.scheduleDays.filter((item) => item.routineId !== routineId)
    for (const record of records) this.saveRoutineScheduleDay(record)
  }
  findRoutineById(id: string): RoutinePersistenceRecord | null {
    return this.routines.find((routine) => routine.id === id) ?? null
  }
  listRoutines(status?: RoutineStatus): readonly RoutinePersistenceRecord[] {
    return this.routines.filter((routine) => !status || routine.status === status)
  }
  listRoutineScheduleDays(routineId: string): readonly RoutineScheduleDayPersistenceRecord[] {
    return this.scheduleDays
      .filter((item) => item.routineId === routineId)
      .sort((left, right) => left.weekday - right.weekday)
  }
  findGoalById(id: string): GoalPersistenceRecord | null {
    return this.goals.find((goal) => goal.id === id) ?? null
  }
  readSnapshot(): CorePersistenceSnapshot {
    return {
      goals: this.goals,
      actions: [],
      routines: this.routines,
      routineScheduleDays: this.scheduleDays,
      todaySelections: [],
      actionRecords: [],
      routineRecords: [],
      understandings: [],
      confusions: [],
      reviewResults: []
    }
  }

  saveGoal(): void {}
  saveAction(): void {}
  saveTodaySelection(): void {}
  saveActionRecord(): void {}
  saveRoutineRecord(): void {}
  saveUnderstanding(): void {}
  saveConfusion(): void {}
  saveReviewResult(): void {}
  findActionById(): null {
    return null
  }
  listGoals(): readonly GoalPersistenceRecord[] {
    return this.goals
  }
  listActionsByGoalId(): readonly [] {
    return []
  }
  listActionRecordSummariesByGoalId(): readonly [] {
    return []
  }
  listTodaySelectionActionIdsByGoalIdOn(): readonly [] {
    return []
  }
}

function setup() {
  const persistence = new MemoryRoutinePersistence()
  persistence.goals.push({
    id: 'goal-1',
    title: 'Movement',
    description: null,
    status: 'paused',
    currentNextActionId: null,
    createdAt: instant,
    updatedAt: instant
  })
  const service = new RoutineService({
    repository: persistence,
    unitOfWork: persistence,
    clock: new FakeClock({ instant, localDate: '2026-08-14', timeZone: 'Asia/Shanghai' }),
    generateId: () => 'routine-1'
  })
  return { persistence, service }
}

describe('Routine application service', () => {
  it('atomically creates a Routine with a complete schedule and paused Goal summary', () => {
    const { persistence, service } = setup()
    const detail = service.createRoutine({
      goalId: 'goal-1',
      name: 'Movement',
      minimumAction: 'Stretch once',
      weekdays: [5, 1]
    })
    expect(detail).toMatchObject({
      id: 'routine-1',
      status: 'active',
      weekdays: [1, 5],
      goal: { id: 'goal-1', status: 'paused' }
    })
    expect(persistence.scheduleDays).toHaveLength(2)
    expect(service.listRoutines('active')).toHaveLength(1)
    const before = structuredClone(persistence.readSnapshot())
    expect(service.getRoutineDetail('routine-1')).toEqual(detail)
    expect(persistence.readSnapshot()).toEqual(before)
  })

  it('rolls back creation and replacement when a schedule write fails', () => {
    const { persistence, service } = setup()
    persistence.failOnScheduleSaveAt = 2
    expect(() =>
      service.createRoutine({ name: 'Routine', minimumAction: 'Move', weekdays: [1, 2] })
    ).toThrow(/injected failure/)
    expect(persistence.routines).toEqual([])
    expect(persistence.scheduleDays).toEqual([])

    persistence.failOnScheduleSaveAt = null
    service.createRoutine({ name: 'Routine', minimumAction: 'Move', weekdays: [1, 2] })
    const before = structuredClone(persistence.readSnapshot())
    persistence.failOnScheduleSaveAt = 2
    expect(() =>
      service.replaceRoutineSchedule({ routineId: 'routine-1', weekdays: [3, 4] })
    ).toThrow(/injected failure/)
    expect(persistence.readSnapshot()).toEqual(before)
  })

  it('updates current configuration, preserves goalId, and enforces ended terminal', () => {
    const { service } = setup()
    service.createRoutine({
      goalId: 'goal-1',
      name: 'Routine',
      minimumAction: 'Move',
      weekdays: [1]
    })
    expect(
      service.updateRoutineDetails({
        routineId: 'routine-1',
        name: 'Renamed',
        description: 'Current details',
        minimumAction: 'Stretch'
      })
    ).toMatchObject({ goalId: 'goal-1', name: 'Renamed', minimumAction: 'Stretch' })
    expect(service.pauseRoutine('routine-1').status).toBe('paused')
    expect(service.resumeRoutine('routine-1').status).toBe('active')
    expect(service.endRoutine('routine-1').status).toBe('ended')
    expect(() => service.resumeRoutine('routine-1')).toThrowError(
      expect.objectContaining({ code: 'invalid-transition' })
    )
  })

  it('rejects a missing linked Goal and missing Routine', () => {
    const { service } = setup()
    expect(() =>
      service.createRoutine({
        goalId: 'missing',
        name: 'Routine',
        minimumAction: 'Move',
        weekdays: [1]
      })
    ).toThrowError(new RoutineApplicationError('not-found', 'Goal was not found.'))
    expect(() => service.getRoutineDetail('missing')).toThrowError(
      new RoutineApplicationError('not-found', 'Routine was not found.')
    )
  })
})
