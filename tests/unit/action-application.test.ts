import { describe, expect, it } from 'vitest'
import { ActionService } from '../../src/application/actions'
import type {
  ActionRepositoryPort,
  ActionPersistenceRecord,
  CorePersistenceSnapshot,
  GoalPersistenceRecord,
  TodaySelectionPersistenceRecord,
  UnitOfWorkPort
} from '../../src/application/ports/persistence'
import { FakeClock } from '../support/fake-clock'

const instant = '2026-08-09T08:00:00.000Z'

function memoryContext(seed?: {
  readonly goals?: readonly GoalPersistenceRecord[]
  readonly actions?: readonly ActionPersistenceRecord[]
  readonly selections?: readonly TodaySelectionPersistenceRecord[]
}) {
  const goals = new Map((seed?.goals ?? []).map((goal) => [goal.id, goal]))
  const actions = new Map((seed?.actions ?? []).map((action) => [action.id, action]))
  const selections = new Map(
    (seed?.selections ?? []).map((selection) => [
      `${selection.actionId}:${selection.selectedFor}`,
      selection
    ])
  )
  const records: CorePersistenceSnapshot['actionRecords'] = [
    {
      id: 'record-1',
      actionId: 'action-1',
      occurredOn: '2026-08-08',
      durationMinutes: 5,
      outcome: 'partial',
      nextStep: null,
      summary: null,
      note: null,
      createdAt: instant,
      updatedAt: instant
    }
  ]
  const repository = {
    saveGoal: (goal: GoalPersistenceRecord) => goals.set(goal.id, Object.freeze({ ...goal })),
    saveAction: (action: ActionPersistenceRecord) =>
      actions.set(action.id, Object.freeze({ ...action })),
    createTodaySelection: (selection: TodaySelectionPersistenceRecord) => {
      const key = `${selection.actionId}:${selection.selectedFor}`
      if (selections.has(key)) return false
      selections.set(key, Object.freeze({ ...selection }))
      return true
    },
    findGoalById: (id: string) => goals.get(id) ?? null,
    findActionById: (id: string) => actions.get(id) ?? null,
    findTodaySelection: (actionId: string, date: string) =>
      selections.get(`${actionId}:${date}`) ?? null,
    listActions: () => [...actions.values()],
    listTodaySelectionsOn: (date: string) =>
      [...selections.values()].filter((selection) => selection.selectedFor === date),
    deleteTodaySelection: (actionId: string, date: string) =>
      void selections.delete(`${actionId}:${date}`),
    deleteTodaySelectionByKind: (
      actionId: string,
      date: string,
      kind: TodaySelectionPersistenceRecord['kind']
    ) => {
      const key = `${actionId}:${date}`
      if (selections.get(key)?.kind !== kind) return false
      return selections.delete(key)
    },
    updateTodaySelectionCommitment: (
      actionId: string,
      date: string,
      current: TodaySelectionPersistenceRecord['kind'],
      requested: TodaySelectionPersistenceRecord['kind']
    ) => {
      const key = `${actionId}:${date}`
      const selection = selections.get(key)
      if (!selection || selection.kind !== current) return false
      selections.set(key, Object.freeze({ ...selection, kind: requested }))
      return true
    },
    readSnapshot: (): CorePersistenceSnapshot => ({
      goals: [...goals.values()],
      actions: [...actions.values()],
      routines: [],
      routineScheduleDays: [],
      todaySelections: [...selections.values()],
      actionRecords: records,
      routineRecords: [],
      understandings: [],
      confusions: [],
      reviewResults: []
    })
  } as unknown as ActionRepositoryPort
  const unitOfWork: UnitOfWorkPort = { transaction: (work) => work(repository) }
  return { actions, goals, records, repository, selections, unitOfWork }
}

function activeGoal(currentNextActionId: string | null = null): GoalPersistenceRecord {
  return {
    id: 'goal-1',
    title: 'Learn React',
    description: null,
    status: 'active',
    predecessorGoalId: null,
    currentNextActionId,
    createdAt: instant,
    updatedAt: instant
  }
}

function pendingAction(id = 'action-1'): ActionPersistenceRecord {
  return {
    id,
    goalId: 'goal-1',
    title: `Action ${id}`,
    description: null,
    status: 'pending',
    createdAt: instant,
    updatedAt: instant
  }
}

function serviceFor(context: ReturnType<typeof memoryContext>, ids: string[] = []) {
  return new ActionService({
    repository: context.repository,
    unitOfWork: context.unitOfWork,
    clock: new FakeClock({ instant, localDate: '2026-08-09', timeZone: 'Asia/Shanghai' }),
    generateId: () => ids.shift() ?? 'generated-action'
  })
}

describe('Action application', () => {
  it('creates standalone or active-Goal Actions and updates details without reassigning Goal', () => {
    const context = memoryContext({ goals: [activeGoal()] })
    const service = serviceFor(context, ['standalone', 'linked'])
    expect(service.createAction({ title: 'Standalone' })).toMatchObject({
      id: 'standalone',
      goalId: null,
      status: 'pending'
    })
    const linked = service.createAction({ goalId: 'goal-1', title: 'Linked' })
    expect(linked).toMatchObject({ id: 'linked', goalId: 'goal-1', goal: { status: 'active' } })
    expect(
      service.updateActionDetails({ actionId: linked.id, title: 'Linked updated' })
    ).toMatchObject({ id: 'linked', goalId: 'goal-1', title: 'Linked updated', status: 'pending' })

    context.repository.saveGoal({ ...activeGoal(), status: 'paused' })
    expect(() => service.createAction({ goalId: 'goal-1', title: 'Rejected' })).toThrowError(
      expect.objectContaining({ code: 'invalid-transition' })
    )
  })

  it('requires an explicit current-next resolution and atomically clears or replaces it', () => {
    const context = memoryContext({
      goals: [activeGoal('action-1')],
      actions: [pendingAction(), pendingAction('action-2')]
    })
    const service = serviceFor(context, ['action-3'])
    expect(() => service.completeAction({ actionId: 'action-1' })).toThrowError(
      expect.objectContaining({ code: 'invariant-violation' })
    )
    expect(
      service.completeAction({
        actionId: 'action-1',
        currentNextResolution: { kind: 'use-existing', actionId: 'action-2' }
      })
    ).toMatchObject({ status: 'completed', isCurrentNextAction: false })
    expect(context.goals.get('goal-1')?.currentNextActionId).toBe('action-2')

    context.repository.saveGoal({
      ...context.goals.get('goal-1')!,
      currentNextActionId: 'action-2'
    })
    expect(
      service.cancelAction({
        actionId: 'action-2',
        currentNextResolution: { kind: 'create-and-use', title: 'New next' }
      })
    ).toMatchObject({ status: 'cancelled' })
    expect(context.goals.get('goal-1')?.currentNextActionId).toBe('action-3')
    expect(context.actions.get('action-3')).toMatchObject({ goalId: 'goal-1', status: 'pending' })
  })

  it('allows paused/ended current context only to clear and rejects resolutions on non-current Actions', () => {
    const context = memoryContext({
      goals: [{ ...activeGoal('action-1'), status: 'paused' }],
      actions: [pendingAction(), pendingAction('action-2')]
    })
    const service = serviceFor(context)
    expect(() =>
      service.completeAction({
        actionId: 'action-1',
        currentNextResolution: { kind: 'use-existing', actionId: 'action-2' }
      })
    ).toThrowError(expect.objectContaining({ code: 'invalid-transition' }))
    expect(
      service.completeAction({
        actionId: 'action-1',
        currentNextResolution: { kind: 'clear' }
      })
    ).toMatchObject({ status: 'completed', unavailableReason: 'action-completed' })
    expect(context.goals.get('goal-1')?.currentNextActionId).toBeNull()
    expect(() =>
      service.cancelAction({
        actionId: 'action-2',
        currentNextResolution: { kind: 'clear' }
      })
    ).toThrowError(expect.objectContaining({ code: 'invariant-violation' }))
  })

  it('reschedules the same Action, removes only the current focus, and preserves partial history', () => {
    const selection = {
      actionId: 'action-1',
      selectedFor: '2026-08-09',
      kind: 'focus' as const,
      selectedBy: 'user' as const,
      createdAt: instant
    }
    const context = memoryContext({
      goals: [activeGoal()],
      actions: [pendingAction()],
      selections: [selection, { ...selection, selectedFor: '2026-08-08' }]
    })
    const service = serviceFor(context)
    const before = context.repository.readSnapshot().actionRecords
    expect(service.rescheduleAction({ actionId: 'action-1' })).toMatchObject({
      id: 'action-1',
      status: 'rescheduled',
      selectedForToday: false
    })
    expect(context.repository.findTodaySelection('action-1', '2026-08-08')).not.toBeNull()
    expect(context.repository.readSnapshot().actionRecords).toEqual(before)
  })
})
