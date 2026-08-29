import { describe, expect, it } from 'vitest'
import { GoalApplicationError, GoalService } from '../../src/application/goals'
import type {
  ActionPersistenceRecord,
  ActionRecordPersistenceRecord,
  ConfusionPersistenceRecord,
  CorePersistenceSnapshot,
  GoalActionRecordSummaryPersistenceRecord,
  GoalPersistenceRecord,
  GoalStatus,
  RepositoryPort,
  ReviewResultPersistenceRecord,
  RoutinePersistenceRecord,
  RoutineRecordPersistenceRecord,
  RoutineScheduleDayPersistenceRecord,
  TodaySelectionPersistenceRecord,
  UnderstandingPersistenceRecord,
  UnitOfWorkPort
} from '../../src/application/ports/persistence'
import { FakeClock } from '../support/fake-clock'

const instant = '2026-08-09T08:00:00.000Z'

class MemoryPersistence implements RepositoryPort, UnitOfWorkPort {
  goals: GoalPersistenceRecord[] = []
  actions: ActionPersistenceRecord[] = []
  routines: RoutinePersistenceRecord[] = []
  routineScheduleDays: RoutineScheduleDayPersistenceRecord[] = []
  todaySelections: TodaySelectionPersistenceRecord[] = []
  actionRecords: ActionRecordPersistenceRecord[] = []
  routineRecords: RoutineRecordPersistenceRecord[] = []
  understandings: UnderstandingPersistenceRecord[] = []
  confusions: ConfusionPersistenceRecord[] = []
  reviewResults: ReviewResultPersistenceRecord[] = []
  failOnSaveAction = false
  failOnSaveGoal = false

  transaction<T>(work: (repository: RepositoryPort) => T): T {
    const before = structuredClone(this.readSnapshot())
    try {
      return work(this)
    } catch (error) {
      this.restore(before)
      throw error
    }
  }

  saveGoal(record: GoalPersistenceRecord): void {
    if (this.failOnSaveGoal) throw new Error('injected Goal write failure')
    this.upsert(this.goals, record)
  }
  saveAction(record: ActionPersistenceRecord): void {
    if (this.failOnSaveAction) throw new Error('injected persistence failure')
    this.upsert(this.actions, record)
  }
  saveRoutine(record: RoutinePersistenceRecord): void {
    this.upsert(this.routines, record)
  }
  saveRoutineScheduleDay(record: RoutineScheduleDayPersistenceRecord): void {
    this.routineScheduleDays.push(record)
  }
  createTodaySelection(record: TodaySelectionPersistenceRecord): boolean {
    this.todaySelections.push(record)
    return true
  }
  saveActionRecord(record: ActionRecordPersistenceRecord): void {
    this.upsert(this.actionRecords, record)
  }
  saveRoutineRecord(record: RoutineRecordPersistenceRecord): void {
    this.upsert(this.routineRecords, record)
  }
  saveUnderstanding(record: UnderstandingPersistenceRecord): void {
    this.upsert(this.understandings, record)
  }
  saveConfusion(record: ConfusionPersistenceRecord): void {
    this.upsert(this.confusions, record)
  }
  saveReviewResult(record: ReviewResultPersistenceRecord): void {
    this.upsert(this.reviewResults, record)
  }
  findGoalById(id: string): GoalPersistenceRecord | null {
    return this.goals.find((goal) => goal.id === id) ?? null
  }
  findActionById(id: string): ActionPersistenceRecord | null {
    return this.actions.find((action) => action.id === id) ?? null
  }
  listGoals(status?: GoalStatus): readonly GoalPersistenceRecord[] {
    return this.goals.filter((goal) => !status || goal.status === status)
  }
  listActionsByGoalId(goalId: string): readonly ActionPersistenceRecord[] {
    return this.actions.filter((action) => action.goalId === goalId)
  }
  listActionRecordSummariesByGoalId(
    goalId: string
  ): readonly GoalActionRecordSummaryPersistenceRecord[] {
    const actionIds = new Set(this.listActionsByGoalId(goalId).map((action) => action.id))
    return this.actionRecords
      .filter((record) => actionIds.has(record.actionId))
      .map((record) => ({
        ...record,
        actionTitle: this.findActionById(record.actionId)?.title ?? 'missing'
      }))
  }
  listTodaySelectionActionIdsByGoalIdOn(goalId: string, selectedFor: string): readonly string[] {
    const actionIds = new Set(this.listActionsByGoalId(goalId).map((action) => action.id))
    return this.todaySelections
      .filter(
        (selection) => selection.selectedFor === selectedFor && actionIds.has(selection.actionId)
      )
      .map((selection) => selection.actionId)
  }
  readSnapshot(): CorePersistenceSnapshot {
    return {
      goals: this.goals,
      actions: this.actions,
      routines: this.routines,
      routineScheduleDays: this.routineScheduleDays,
      todaySelections: this.todaySelections,
      actionRecords: this.actionRecords,
      routineRecords: this.routineRecords,
      understandings: this.understandings,
      confusions: this.confusions,
      reviewResults: this.reviewResults
    }
  }

  private upsert<T extends { readonly id: string }>(records: T[], record: T): void {
    const index = records.findIndex((candidate) => candidate.id === record.id)
    if (index >= 0) records[index] = record
    else records.push(record)
  }

  private restore(snapshot: CorePersistenceSnapshot): void {
    this.goals = [...snapshot.goals]
    this.actions = [...snapshot.actions]
    this.routines = [...snapshot.routines]
    this.routineScheduleDays = [...snapshot.routineScheduleDays]
    this.todaySelections = [...snapshot.todaySelections]
    this.actionRecords = [...snapshot.actionRecords]
    this.routineRecords = [...snapshot.routineRecords]
    this.understandings = [...snapshot.understandings]
    this.confusions = [...snapshot.confusions]
    this.reviewResults = [...snapshot.reviewResults]
  }
}

function setup() {
  const persistence = new MemoryPersistence()
  const ids = ['goal-1', 'action-1', 'goal-2', 'action-2']
  const service = new GoalService({
    repository: persistence,
    unitOfWork: persistence,
    clock: new FakeClock({ instant, localDate: '2026-08-09', timeZone: 'Asia/Shanghai' }),
    generateId: () => ids.shift() ?? 'extra-id'
  })
  return { persistence, service }
}

describe('Goal application service', () => {
  it('atomically creates a Goal with one initial pending Action and exposes read-only views', () => {
    const { persistence, service } = setup()
    const detail = service.createGoal({
      name: 'Systematically learn React',
      description: 'Build a stable foundation',
      initialNextAction: { title: 'Run a React state update example' }
    })

    expect(detail).toMatchObject({
      id: 'goal-1',
      status: 'active',
      currentNextActionId: 'action-1',
      currentNextAction: { id: 'action-1', status: 'pending' }
    })
    expect(persistence.goals).toHaveLength(1)
    expect(persistence.actions).toEqual([
      expect.objectContaining({ id: 'action-1', goalId: 'goal-1', status: 'pending' })
    ])
    const beforeQueries = structuredClone(persistence.readSnapshot())
    expect(service.listGoals('active')).toHaveLength(1)
    expect(service.getGoalDetail('goal-1')).toEqual(detail)
    expect(persistence.readSnapshot()).toEqual(beforeQueries)
  })

  it('rolls back the Goal when initial Action persistence fails', () => {
    const { persistence, service } = setup()
    persistence.failOnSaveAction = true
    expect(() =>
      service.createGoal({ name: 'Goal', initialNextAction: { title: 'Action' } })
    ).toThrow(/injected persistence failure/)
    expect(persistence.goals).toEqual([])
    expect(persistence.actions).toEqual([])
  })

  it('updates details, preserves the current reference, and enforces the terminal lifecycle', () => {
    const { service } = setup()
    const created = service.createGoal({ name: 'Goal', initialNextAction: { title: 'Action' } })
    expect(
      service.updateGoalDetails({ goalId: created.id, name: 'Renamed', description: 'Reason' })
    ).toMatchObject({ id: created.id, name: 'Renamed', currentNextActionId: 'action-1' })
    expect(service.pauseGoal(created.id)).toMatchObject({
      status: 'paused',
      currentNextActionId: 'action-1'
    })
    expect(() =>
      service.setGoalCurrentNextAction({ goalId: created.id, actionId: null })
    ).toThrowError(expect.objectContaining({ code: 'invalid-transition' }))
    expect(service.resumeGoal(created.id).status).toBe('active')
    expect(
      service.setGoalCurrentNextAction({ goalId: created.id, actionId: null }).currentNextActionId
    ).toBeNull()
    expect(
      service.setGoalCurrentNextAction({ goalId: created.id, actionId: 'action-1' })
        .currentNextActionId
    ).toBe('action-1')
    expect(service.endGoal(created.id)).toMatchObject({
      status: 'ended',
      currentNextActionId: 'action-1'
    })
    expect(() => service.resumeGoal(created.id)).toThrowError(
      expect.objectContaining({ code: 'invalid-transition' })
    )
  })

  it('rejects missing, cross-Goal, and non-pending current next actions', () => {
    const { persistence, service } = setup()
    const first = service.createGoal({
      name: 'First',
      initialNextAction: { title: 'First action' }
    })
    const second = service.createGoal({
      name: 'Second',
      initialNextAction: { title: 'Second action' }
    })

    expect(() =>
      service.setGoalCurrentNextAction({ goalId: first.id, actionId: 'missing' })
    ).toThrowError(new GoalApplicationError('not-found', 'Action was not found.'))
    expect(() =>
      service.setGoalCurrentNextAction({ goalId: first.id, actionId: second.currentNextActionId })
    ).toThrowError(expect.objectContaining({ code: 'invariant-violation' }))
    const firstAction = persistence.findActionById(first.currentNextActionId as string)
    persistence.saveAction({ ...firstAction!, status: 'completed' })
    expect(() =>
      service.setGoalCurrentNextAction({ goalId: first.id, actionId: firstAction!.id })
    ).toThrowError(expect.objectContaining({ code: 'invariant-violation' }))
  })

  it('atomically creates a pending Action for the same active Goal and sets it as current next', () => {
    const { persistence, service } = setup()
    const goal = service.createGoal({ name: 'Goal' })
    const before = structuredClone(persistence.readSnapshot())

    const changed = service.createAndSetGoalCurrentNextAction({
      goalId: goal.id,
      title: 'Small next step',
      description: 'Start here'
    })

    expect(changed).toMatchObject({
      id: goal.id,
      currentNextActionId: 'action-1',
      currentNextAction: {
        id: 'action-1',
        title: 'Small next step',
        status: 'pending',
        selectedForToday: false
      }
    })
    expect(persistence.actions).toEqual([
      expect.objectContaining({ id: 'action-1', goalId: goal.id, status: 'pending' })
    ])
    expect(persistence.todaySelections).toEqual(before.todaySelections)
  })

  it('rolls back create-and-set failures and rejects an inactive Goal without an orphan Action', () => {
    const { persistence, service } = setup()
    const goal = service.createGoal({ name: 'Goal' })
    persistence.failOnSaveGoal = true
    const beforeFailure = structuredClone(persistence.readSnapshot())
    expect(() =>
      service.createAndSetGoalCurrentNextAction({ goalId: goal.id, title: 'Will roll back' })
    ).toThrow(/injected Goal write failure/)
    expect(persistence.readSnapshot()).toEqual(beforeFailure)

    persistence.failOnSaveGoal = false
    service.pauseGoal(goal.id)
    const beforeInactive = structuredClone(persistence.readSnapshot())
    expect(() =>
      service.createAndSetGoalCurrentNextAction({ goalId: goal.id, title: 'Not allowed' })
    ).toThrowError(expect.objectContaining({ code: 'invalid-transition' }))
    expect(persistence.readSnapshot()).toEqual(beforeInactive)
  })
})
