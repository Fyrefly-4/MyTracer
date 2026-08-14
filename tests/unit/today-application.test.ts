import { describe, expect, it } from 'vitest'
import { TodayService } from '../../src/application/today'
import type {
  ActionPersistenceRecord,
  ActionRepositoryPort,
  CorePersistenceSnapshot,
  GoalPersistenceRecord,
  TodaySelectionPersistenceRecord,
  UnitOfWorkPort
} from '../../src/application/ports/persistence'
import { FakeClock } from '../support/fake-clock'

const instant = '2026-08-09T08:00:00.000Z'

function setup(goalStatus: GoalPersistenceRecord['status'] = 'active') {
  const goal: GoalPersistenceRecord = {
    id: 'goal-1',
    title: 'Goal',
    description: null,
    status: goalStatus,
    currentNextActionId: 'action-1',
    createdAt: instant,
    updatedAt: instant
  }
  const actions = new Map<string, ActionPersistenceRecord>([
    [
      'action-1',
      {
        id: 'action-1',
        goalId: 'goal-1',
        title: 'Action',
        description: null,
        status: 'pending',
        createdAt: instant,
        updatedAt: instant
      }
    ],
    [
      'standalone',
      {
        id: 'standalone',
        goalId: null,
        title: 'Standalone',
        description: null,
        status: 'rescheduled',
        createdAt: instant,
        updatedAt: instant
      }
    ]
  ])
  const selections = new Map<string, TodaySelectionPersistenceRecord>()
  const routines = [
    {
      id: 'routine-1',
      goalId: 'goal-1',
      name: 'Sunday movement',
      description: null,
      minimumAction: 'Stretch once',
      status: 'active' as const,
      createdAt: instant,
      updatedAt: instant
    },
    {
      id: 'routine-paused',
      goalId: null,
      name: 'Paused routine',
      description: null,
      minimumAction: 'Pause',
      status: 'paused' as const,
      createdAt: instant,
      updatedAt: instant
    }
  ]
  const repository = {
    saveAction: (action: ActionPersistenceRecord) => actions.set(action.id, { ...action }),
    saveTodaySelection: (selection: TodaySelectionPersistenceRecord) =>
      selections.set(`${selection.actionId}:${selection.selectedFor}`, { ...selection }),
    findGoalById: (id: string) => (id === goal.id ? goal : null),
    findActionById: (id: string) => actions.get(id) ?? null,
    findTodaySelection: (id: string, date: string) => selections.get(`${id}:${date}`) ?? null,
    listActions: () => [...actions.values()],
    listTodaySelectionsOn: (date: string) =>
      [...selections.values()].filter((selection) => selection.selectedFor === date),
    findRoutineById: (id: string) => routines.find((routine) => routine.id === id) ?? null,
    listRoutines: (status?: string) =>
      routines.filter((routine) => !status || routine.status === status),
    listRoutineScheduleDays: (routineId: string) =>
      routineId === 'routine-1' ? [{ routineId, weekday: 7 }] : [],
    replaceRoutineScheduleDays: () => undefined,
    deleteTodaySelection: (id: string, date: string) => void selections.delete(`${id}:${date}`),
    readSnapshot: (): CorePersistenceSnapshot => ({
      goals: [goal],
      actions: [...actions.values()],
      routines,
      routineScheduleDays: [{ routineId: 'routine-1', weekday: 7 }],
      todaySelections: [...selections.values()],
      actionRecords: [],
      routineRecords: [],
      understandings: [],
      confusions: [],
      reviewResults: []
    })
  } as unknown as ActionRepositoryPort
  const unitOfWork: UnitOfWorkPort = { transaction: (work) => work(repository) }
  const clock = new FakeClock({ instant, localDate: '2026-08-09', timeZone: 'Asia/Shanghai' })
  const service = new TodayService({ repository, unitOfWork, clock })
  return { actions, clock, goal, repository, selections, service }
}

describe('Today application', () => {
  it('selects only by explicit user command and restores a rescheduled Action in the same operation', () => {
    const { actions, repository, service } = setup()
    expect(service.getToday()).toMatchObject({ localDate: '2026-08-09', focuses: [] })
    expect(service.selectActionForToday('standalone')).toMatchObject({
      id: 'standalone',
      status: 'pending',
      selectedForToday: true,
      canStart: true
    })
    expect(actions.get('standalone')?.status).toBe('pending')
    expect(repository.findTodaySelection('standalone', '2026-08-09')).toMatchObject({
      kind: 'focus',
      selectedBy: 'user'
    })
    service.selectActionForToday('action-1')
    expect(service.getToday().focuses.map((action) => action.id)).toEqual([
      'standalone',
      'action-1'
    ])
  })

  it('does not impose a hard limit on explicit Today focus selections', () => {
    const { actions, service } = setup()
    for (let index = 0; index < 12; index += 1) {
      const id = `extra-${index}`
      actions.set(id, {
        id,
        goalId: null,
        title: `Extra ${index}`,
        description: null,
        status: 'pending',
        createdAt: instant,
        updatedAt: instant
      })
      service.selectActionForToday(id)
    }
    expect(service.getToday().focuses).toHaveLength(12)
  })

  it('removes only the current LocalDate and never carries a focus to the next day', () => {
    const { clock, repository, service } = setup()
    service.selectActionForToday('action-1')
    clock.setState({
      instant: '2026-08-10T08:00:00.000Z',
      localDate: '2026-08-10',
      timeZone: 'Asia/Shanghai'
    })
    expect(service.getToday()).toMatchObject({ localDate: '2026-08-10', focuses: [] })
    expect(repository.findTodaySelection('action-1', '2026-08-09')).not.toBeNull()
    service.removeActionFromToday('action-1')
    expect(repository.findTodaySelection('action-1', '2026-08-09')).not.toBeNull()
  })

  it('keeps paused/ended Goal selections visible but rejects new focus selection', () => {
    for (const status of ['paused', 'ended'] as const) {
      const context = setup(status)
      context.repository.saveTodaySelection({
        actionId: 'action-1',
        selectedFor: '2026-08-09',
        kind: 'focus',
        selectedBy: 'user',
        createdAt: instant
      })
      expect(context.service.getToday().focuses[0]).toMatchObject({
        goal: { status },
        canStart: false,
        unavailableReason: status === 'paused' ? 'goal-paused' : 'goal-ended'
      })
      context.service.removeActionFromToday('action-1')
      expect(() => context.service.selectActionForToday('action-1')).toThrowError(
        expect.objectContaining({ code: 'invalid-transition' })
      )
    }
  })

  it('projects only active matching Routines and keeps paused or ended Goal context actionable', () => {
    for (const status of ['paused', 'ended'] as const) {
      const context = setup(status)
      expect(context.service.getToday().plannedRoutines).toEqual([
        expect.objectContaining({
          id: 'routine-1',
          goal: expect.objectContaining({ status }),
          plannedForToday: true,
          canRecord: true
        })
      ])
      context.clock.setState({
        instant: '2026-08-10T08:00:00.000Z',
        localDate: '2026-08-10',
        timeZone: 'Asia/Shanghai'
      })
      expect(context.service.getToday().plannedRoutines).toEqual([])
    }
  })
})
