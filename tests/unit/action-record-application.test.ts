import { describe, expect, it } from 'vitest'
import { ActionRecordService } from '../../src/application/action-records'
import type {
  ActionPersistenceRecord,
  ActionRecordPersistenceRecord,
  ActionRecordRepositoryPort,
  ConfusionPersistenceRecord,
  CorePersistenceSnapshot,
  GoalPersistenceRecord,
  TodaySelectionPersistenceRecord,
  UnderstandingPersistenceRecord,
  UnitOfWorkPort
} from '../../src/application/ports/persistence'
import { FakeClock } from '../support/fake-clock'

const instant = '2026-08-12T08:00:00.000Z'

function goal(status: GoalPersistenceRecord['status'] = 'active'): GoalPersistenceRecord {
  return {
    id: 'goal-1',
    title: 'Learn React',
    description: null,
    status,
    currentNextActionId: 'action-1',
    createdAt: instant,
    updatedAt: instant
  }
}

function action(input?: Partial<ActionPersistenceRecord>): ActionPersistenceRecord {
  return {
    id: 'action-1',
    goalId: 'goal-1',
    title: 'Run a state example',
    description: null,
    status: 'pending',
    createdAt: instant,
    updatedAt: instant,
    ...input
  }
}

function memoryContext(seed?: {
  readonly goals?: readonly GoalPersistenceRecord[]
  readonly actions?: readonly ActionPersistenceRecord[]
  readonly selections?: readonly TodaySelectionPersistenceRecord[]
}) {
  const goals = new Map((seed?.goals ?? [goal()]).map((item) => [item.id, item]))
  const actions = new Map((seed?.actions ?? [action()]).map((item) => [item.id, item]))
  const records = new Map<string, ActionRecordPersistenceRecord>()
  const understandings = new Map<string, UnderstandingPersistenceRecord>()
  const confusions = new Map<string, ConfusionPersistenceRecord>()
  const selections = new Map(
    (seed?.selections ?? []).map((item) => [`${item.actionId}:${item.selectedFor}`, item])
  )
  const repository = {
    saveGoal: (item: GoalPersistenceRecord) => goals.set(item.id, Object.freeze({ ...item })),
    saveAction: (item: ActionPersistenceRecord) => actions.set(item.id, Object.freeze({ ...item })),
    saveActionRecord: (item: ActionRecordPersistenceRecord) =>
      records.set(item.id, Object.freeze({ ...item })),
    saveUnderstanding: (item: UnderstandingPersistenceRecord) =>
      understandings.set(item.id, Object.freeze({ ...item })),
    saveConfusion: (item: ConfusionPersistenceRecord) =>
      confusions.set(item.id, Object.freeze({ ...item })),
    findGoalById: (id: string) => goals.get(id) ?? null,
    findActionById: (id: string) => actions.get(id) ?? null,
    findActionRecordById: (id: string) => records.get(id) ?? null,
    findTodaySelection: (actionId: string, date: string) =>
      selections.get(`${actionId}:${date}`) ?? null,
    listActions: () => [...actions.values()],
    listTodaySelectionsOn: (date: string) =>
      [...selections.values()].filter((item) => item.selectedFor === date),
    listActionRecordsByActionId: (actionId: string) =>
      [...records.values()]
        .filter((item) => item.actionId === actionId)
        .sort(
          (left, right) =>
            right.occurredOn.localeCompare(left.occurredOn) ||
            right.createdAt.localeCompare(left.createdAt) ||
            left.id.localeCompare(right.id)
        ),
    listUnderstandingsByActionRecordId: (recordId: string) =>
      [...understandings.values()].filter((item) => item.actionRecordId === recordId),
    listConfusionsByActionRecordId: (recordId: string) =>
      [...confusions.values()].filter((item) => item.actionRecordId === recordId),
    deleteTodaySelection: (actionId: string, date: string) =>
      void selections.delete(`${actionId}:${date}`),
    readSnapshot: (): CorePersistenceSnapshot => ({
      goals: [...goals.values()],
      actions: [...actions.values()],
      routines: [],
      routineScheduleDays: [],
      todaySelections: [...selections.values()],
      actionRecords: [...records.values()],
      routineRecords: [],
      understandings: [...understandings.values()],
      confusions: [...confusions.values()],
      reviewResults: []
    })
  } as unknown as ActionRecordRepositoryPort
  const unitOfWork: UnitOfWorkPort = { transaction: (work) => work(repository) }
  return { actions, confusions, goals, records, repository, selections, understandings, unitOfWork }
}

function serviceFor(context: ReturnType<typeof memoryContext>, clock: FakeClock, ids: string[]) {
  return new ActionRecordService({
    repository: context.repository,
    unitOfWork: context.unitOfWork,
    clock,
    generateId: () => ids.shift() ?? 'generated-id'
  })
}

function fakeClock() {
  return new FakeClock({ instant, localDate: '2026-08-12', timeZone: 'Asia/Shanghai' })
}

describe('ActionRecord application', () => {
  it('saves a zero-minute partial quick record without Today or Action state inference', () => {
    const context = memoryContext()
    const clock = fakeClock()
    const service = serviceFor(context, clock, ['record-1'])
    const prepared = service.beginActionRecording('action-1')
    const result = service.recordAction({
      ...prepared,
      durationMinutes: 0,
      outcome: 'partial'
    })

    expect(result).toMatchObject({
      kind: 'saved',
      record: { durationMinutes: 0, outcome: 'partial', understandings: [], confusions: [] },
      action: { status: 'pending', selectedForToday: false }
    })
    expect(context.actions.get('action-1')?.status).toBe('pending')
  })

  it('atomically creates manual Understanding, open Confusion, and recorded deep fields', () => {
    const context = memoryContext()
    const service = serviceFor(context, fakeClock(), ['record-1', 'understanding-1', 'confusion-1'])
    const result = service.recordAction({
      actionId: 'action-1',
      capturedOn: '2026-08-12',
      durationMinutes: 25,
      outcome: 'stopped',
      understanding: 'State updates are queued',
      confusion: 'Why are updates batched?',
      nextStep: 'Run a functional update example',
      note: 'Stopped after reproducing the behavior'
    })

    expect(result).toMatchObject({
      kind: 'saved',
      record: {
        outcome: 'stopped',
        nextStep: 'Run a functional update example',
        understandings: [{ source: 'manual' }],
        confusions: [{ status: 'open' }]
      },
      action: { status: 'pending' }
    })
    expect([...context.understandings.values()][0]).toMatchObject({
      source: 'manual',
      revokedAt: null
    })
    expect([...context.confusions.values()][0]).toMatchObject({ status: 'open', resolvedAt: null })
  })

  it('keeps outcome independent while applying an explicit transition and recorded next step', () => {
    const selection: TodaySelectionPersistenceRecord = {
      actionId: 'action-1',
      selectedFor: '2026-08-12',
      kind: 'focus',
      selectedBy: 'user',
      createdAt: instant
    }
    const context = memoryContext({ selections: [selection] })
    const service = serviceFor(context, fakeClock(), ['record-1', 'action-2'])
    const result = service.recordAction({
      actionId: 'action-1',
      capturedOn: '2026-08-12',
      durationMinutes: 5,
      outcome: 'partial',
      nextStep: 'Try the reducer version',
      postRecord: {
        action: 'reschedule',
        currentNextResolution: { kind: 'create-from-recorded-next-step' }
      }
    })

    expect(result).toMatchObject({
      kind: 'saved',
      action: { status: 'rescheduled', selectedForToday: false },
      appliedNextActionId: 'action-2'
    })
    expect(context.records.get('record-1')?.outcome).toBe('partial')
    expect(context.goals.get('goal-1')?.currentNextActionId).toBe('action-2')
    expect(context.actions.get('action-2')).toMatchObject({
      title: 'Try the reducer version',
      goalId: 'goal-1',
      status: 'pending'
    })
    expect(context.selections.size).toBe(0)
  })

  it('rechecks pending and active state at begin and save', () => {
    const context = memoryContext()
    const service = serviceFor(context, fakeClock(), ['record-1'])
    const prepared = service.beginActionRecording('action-1')
    context.repository.saveAction({ ...action(), status: 'completed' })
    expect(() =>
      service.recordAction({ ...prepared, durationMinutes: 1, outcome: 'completed' })
    ).toThrowError(expect.objectContaining({ code: 'invalid-transition' }))
    expect(context.records.size).toBe(0)

    context.repository.saveAction(action())
    context.repository.saveGoal(goal('paused'))
    expect(() => service.beginActionRecording('action-1')).toThrowError(
      expect.objectContaining({ code: 'invalid-transition' })
    )
  })

  it('requires a zero-write midnight decision and accepts only explicit dates', () => {
    const context = memoryContext()
    const clock = fakeClock()
    const service = serviceFor(context, clock, ['record-1'])
    const prepared = service.beginActionRecording('action-1')
    clock.setState({
      instant: '2026-08-13T00:01:00.000+08:00',
      localDate: '2026-08-13',
      timeZone: 'Asia/Shanghai'
    })
    expect(service.recordAction({ ...prepared, durationMinutes: 1, outcome: 'stopped' })).toEqual({
      kind: 'date-confirmation-required',
      capturedOn: '2026-08-12',
      currentLocalDate: '2026-08-13'
    })
    expect(context.records.size).toBe(0)
    expect(
      service.recordAction({
        ...prepared,
        dateChoice: 'keep-captured-on',
        durationMinutes: 1,
        outcome: 'stopped'
      })
    ).toMatchObject({ kind: 'saved', record: { occurredOn: '2026-08-12' } })

    expect(() =>
      service.recordAction({
        actionId: 'action-1',
        capturedOn: '2026-08-13',
        dateChoice: 'use-current-on',
        durationMinutes: 1,
        outcome: 'stopped'
      })
    ).toThrowError(expect.objectContaining({ code: 'validation' }))
  })

  it('returns stable read-only list and detail projections', () => {
    const context = memoryContext()
    const service = serviceFor(context, fakeClock(), ['record-2', 'understanding-1', 'record-1'])
    service.recordAction({
      actionId: 'action-1',
      capturedOn: '2026-08-12',
      durationMinutes: 2,
      outcome: 'completed',
      understanding: 'A fact'
    })
    service.recordAction({
      actionId: 'action-1',
      capturedOn: '2026-08-12',
      durationMinutes: 3,
      outcome: 'partial'
    })
    const before = context.repository.readSnapshot()
    expect(service.listActionRecordsForAction('action-1').map((item) => item.id)).toEqual([
      'record-1',
      'record-2'
    ])
    expect(service.getActionRecordDetail('record-2').understandings).toHaveLength(1)
    expect(context.repository.readSnapshot()).toEqual(before)
  })

  it('adds one fixed-source confirmed Understanding to an existing same-Goal record', () => {
    const context = memoryContext()
    context.records.set('record-1', {
      id: 'record-1',
      actionId: 'action-1',
      occurredOn: '2026-08-12',
      durationMinutes: 5,
      outcome: 'partial',
      nextStep: null,
      note: null,
      createdAt: instant,
      updatedAt: instant
    })
    const service = serviceFor(context, fakeClock(), ['understanding-ai-1'])

    expect(
      service.addConfirmedUnderstandingToActionRecord({
        actionRecordId: 'record-1',
        expectedGoalId: 'goal-1',
        text: '  State updates use the queued snapshot  '
      })
    ).toEqual({
      id: 'understanding-ai-1',
      text: 'State updates use the queued snapshot',
      source: 'ai_candidate_confirmed',
      createdAt: instant
    })
    expect(service.getActionRecordDetail('record-1').understandings).toEqual([
      expect.objectContaining({ source: 'ai_candidate_confirmed' })
    ])
  })

  it('rejects missing, cross-Goal and inactive Understanding targets with zero writes', () => {
    const context = memoryContext()
    context.records.set('record-1', {
      id: 'record-1',
      actionId: 'action-1',
      occurredOn: '2026-08-12',
      durationMinutes: 5,
      outcome: 'partial',
      nextStep: null,
      note: null,
      createdAt: instant,
      updatedAt: instant
    })
    const service = serviceFor(context, fakeClock(), ['understanding-ai-1'])
    const before = structuredClone(context.repository.readSnapshot())

    expect(() =>
      service.addConfirmedUnderstandingToActionRecord({
        actionRecordId: 'missing',
        expectedGoalId: 'goal-1',
        text: 'No target'
      })
    ).toThrowError(expect.objectContaining({ code: 'not-found' }))
    expect(() =>
      service.addConfirmedUnderstandingToActionRecord({
        actionRecordId: 'record-1',
        expectedGoalId: 'goal-other',
        text: 'Wrong Goal'
      })
    ).toThrowError(expect.objectContaining({ code: 'invariant-violation' }))
    context.repository.saveGoal(goal('paused'))
    const beforePaused = structuredClone(context.repository.readSnapshot())
    expect(() =>
      service.addConfirmedUnderstandingToActionRecord({
        actionRecordId: 'record-1',
        expectedGoalId: 'goal-1',
        text: 'Inactive Goal'
      })
    ).toThrowError(expect.objectContaining({ code: 'invalid-transition' }))
    expect(context.repository.readSnapshot()).toEqual(beforePaused)
    expect(before.understandings).toEqual([])
  })
})
