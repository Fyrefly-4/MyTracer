import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ActionRecordService } from '../../src/application/action-records'
import { ActionService } from '../../src/application/actions'
import { GoalService } from '../../src/application/goals'
import { TodayService } from '../../src/application/today'
import type { RepositoryPort, UnitOfWorkPort } from '../../src/application/ports/persistence'
import { SqliteConnection } from '../../src/infrastructure/sqlite/sqlite-connection'
import { FakeClock } from '../support/fake-clock'
import {
  createTemporaryTestRoot,
  removeTemporaryTestRoot,
  type TemporaryTestRoot
} from '../support/temporary-test-root'

const roots: TemporaryTestRoot[] = []
const instant = '2026-08-12T08:00:00.000Z'

async function openDatabase() {
  const root = await createTemporaryTestRoot()
  roots.push(root)
  const path = join(root.database, `action-record-${crypto.randomUUID()}.sqlite3`)
  return { path, connection: SqliteConnection.open(path) }
}

function servicesFor(
  connection: SqliteConnection,
  clock: FakeClock,
  ids: string[],
  unitOfWork: UnitOfWorkPort = connection
) {
  const dependencies = {
    repository: connection.repository,
    unitOfWork,
    clock,
    generateId: () => ids.shift() ?? crypto.randomUUID()
  }
  return {
    actions: new ActionService(dependencies),
    goals: new GoalService(dependencies),
    records: new ActionRecordService(dependencies),
    today: new TodayService({ repository: connection.repository, unitOfWork, clock })
  }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => removeTemporaryTestRoot(root)))
})

describe('ActionRecord SQLite integration', () => {
  it('adds one confirmed AI Understanding transactionally and preserves the ActionRecord', async () => {
    const { path, connection } = await openDatabase()
    const clock = new FakeClock({ instant, localDate: '2026-08-12', timeZone: 'Asia/Shanghai' })
    const services = servicesFor(connection, clock, [
      'goal-1',
      'action-1',
      'record-1',
      'understanding-ai-1'
    ])
    services.goals.createGoal({ name: 'Goal', initialNextAction: { title: 'Action' } })
    services.records.recordAction({
      actionId: 'action-1',
      capturedOn: '2026-08-12',
      durationMinutes: 7,
      outcome: 'partial',
      nextStep: 'Keep the original record'
    })
    const before = connection.repository.readSnapshot()

    expect(
      services.records.addConfirmedUnderstandingToActionRecord({
        actionRecordId: 'record-1',
        expectedGoalId: 'goal-1',
        text: 'A confirmed candidate'
      })
    ).toMatchObject({ source: 'ai_candidate_confirmed', text: 'A confirmed candidate' })
    const after = connection.repository.readSnapshot()
    expect(after.actionRecords).toEqual(before.actionRecords)
    expect(after.actions).toEqual(before.actions)
    expect(after.goals).toEqual(before.goals)
    expect(after.todaySelections).toEqual(before.todaySelections)
    expect(after.understandings).toEqual([
      expect.objectContaining({
        id: 'understanding-ai-1',
        actionRecordId: 'record-1',
        source: 'ai_candidate_confirmed'
      })
    ])

    connection.close()
    const reopened = SqliteConnection.open(path)
    try {
      expect(
        servicesFor(reopened, clock, []).records.getActionRecordDetail('record-1').understandings
      ).toEqual([expect.objectContaining({ source: 'ai_candidate_confirmed' })])
    } finally {
      reopened.close()
    }
  })

  it('rolls back a confirmed Understanding when its single transaction fails', async () => {
    const { connection } = await openDatabase()
    const clock = new FakeClock({ instant, localDate: '2026-08-12', timeZone: 'Asia/Shanghai' })
    const initial = servicesFor(connection, clock, ['goal-1', 'action-1', 'record-1'])
    initial.goals.createGoal({ name: 'Goal', initialNextAction: { title: 'Action' } })
    initial.records.recordAction({
      actionId: 'action-1',
      capturedOn: '2026-08-12',
      durationMinutes: 1,
      outcome: 'partial'
    })
    const before = connection.repository.readSnapshot()
    const failingUnitOfWork: UnitOfWorkPort = {
      transaction: <T>(work: (repository: RepositoryPort) => T): T =>
        connection.transaction((repository) =>
          work(
            new Proxy(repository, {
              get(target, property, receiver) {
                if (property === 'saveUnderstanding') {
                  return () => {
                    throw new Error('injected Understanding write failure')
                  }
                }
                const value = Reflect.get(target, property, receiver) as unknown
                return typeof value === 'function' ? value.bind(target) : value
              }
            })
          )
        )
    }
    const failing = servicesFor(connection, clock, ['understanding-ai-1'], failingUnitOfWork)

    expect(() =>
      failing.records.addConfirmedUnderstandingToActionRecord({
        actionRecordId: 'record-1',
        expectedGoalId: 'goal-1',
        text: 'Must roll back'
      })
    ).toThrow('injected Understanding write failure')
    expect(connection.repository.readSnapshot()).toEqual(before)
    connection.close()
  })

  it('saves quick/deep facts, applies an explicit post-record choice, and survives a real reopen', async () => {
    const { path, connection } = await openDatabase()
    const clock = new FakeClock({ instant, localDate: '2026-08-12', timeZone: 'Asia/Shanghai' })
    const services = servicesFor(connection, clock, [
      'goal-1',
      'action-1',
      'record-quick',
      'record-deep',
      'understanding-1',
      'confusion-1',
      'action-2'
    ])
    services.goals.createGoal({
      name: 'Systematically learn React',
      initialNextAction: { title: 'Run a React state update example' }
    })

    expect(
      services.records.recordAction({
        actionId: 'action-1',
        capturedOn: '2026-08-12',
        durationMinutes: 0,
        outcome: 'partial'
      })
    ).toMatchObject({ kind: 'saved', action: { status: 'pending', selectedForToday: false } })
    services.today.selectActionForToday('action-1')
    expect(
      services.records.recordAction({
        actionId: 'action-1',
        capturedOn: '2026-08-12',
        durationMinutes: 25,
        outcome: 'stopped',
        understanding: 'State setters enqueue updates',
        confusion: 'When does batching stop?',
        nextStep: 'Run the functional update version',
        note: 'Stopped after reproducing batching',
        postRecord: {
          action: 'reschedule',
          currentNextResolution: { kind: 'create-from-recorded-next-step' }
        }
      })
    ).toMatchObject({
      kind: 'saved',
      action: { status: 'rescheduled', selectedForToday: false },
      appliedNextActionId: 'action-2'
    })

    const detail = services.records.getActionRecordDetail('record-deep')
    expect(detail).toMatchObject({
      durationMinutes: 25,
      outcome: 'stopped',
      understandings: [{ text: 'State setters enqueue updates', source: 'manual' }],
      confusions: [{ text: 'When does batching stop?', status: 'open' }]
    })
    expect(services.records.listActionRecordsForAction('action-1').map((item) => item.id)).toEqual([
      'record-deep',
      'record-quick'
    ])
    expect(services.goals.getGoalDetail('goal-1')).toMatchObject({
      currentNextActionId: 'action-2',
      currentNextAction: { title: 'Run the functional update version', status: 'pending' }
    })
    expect(services.today.getToday().focuses).toEqual([])

    const beforeReopen = connection.repository.readSnapshot()
    connection.close()
    const reopened = SqliteConnection.open(path)
    try {
      const reopenedServices = servicesFor(reopened, clock, [])
      expect(reopenedServices.records.getActionRecordDetail('record-deep')).toEqual(detail)
      expect(reopenedServices.records.listActionRecordsForAction('action-1')).toHaveLength(2)
      expect(reopened.repository.readSnapshot()).toEqual(beforeReopen)
    } finally {
      reopened.close()
    }
  })

  it('uses Main-captured LocalDate choices and never needs a TodaySelection', async () => {
    const { connection } = await openDatabase()
    const clock = new FakeClock({ instant, localDate: '2026-08-12', timeZone: 'Asia/Shanghai' })
    const services = servicesFor(connection, clock, ['action-1', 'record-1', 'record-2'])
    services.actions.createAction({ title: 'Standalone Action' })
    const prepared = services.records.beginActionRecording('action-1')
    clock.setState({
      instant: '2026-08-13T00:01:00.000+08:00',
      localDate: '2026-08-13',
      timeZone: 'Asia/Shanghai'
    })

    const before = connection.repository.readSnapshot()
    expect(
      services.records.recordAction({ ...prepared, durationMinutes: 1, outcome: 'stopped' })
    ).toMatchObject({ kind: 'date-confirmation-required' })
    expect(connection.repository.readSnapshot()).toEqual(before)
    expect(
      services.records.recordAction({
        ...prepared,
        dateChoice: 'keep-captured-on',
        durationMinutes: 1,
        outcome: 'stopped'
      })
    ).toMatchObject({ kind: 'saved', record: { occurredOn: '2026-08-12' } })

    expect(
      services.records.recordAction({
        actionId: 'action-1',
        capturedOn: '2026-08-12',
        dateChoice: 'use-current-on',
        durationMinutes: 1,
        outcome: 'completed'
      })
    ).toMatchObject({ kind: 'saved', record: { occurredOn: '2026-08-13' } })
    expect(connection.repository.readSnapshot().todaySelections).toEqual([])
    connection.close()
  })

  it('rejects terminal/rescheduled Actions and paused/ended linked Goals with zero writes', async () => {
    const { connection } = await openDatabase()
    const clock = new FakeClock({ instant, localDate: '2026-08-12', timeZone: 'Asia/Shanghai' })
    const services = servicesFor(connection, clock, ['goal-1', 'action-1'])
    services.goals.createGoal({ name: 'Goal', initialNextAction: { title: 'Current' } })
    services.goals.pauseGoal('goal-1')
    const beforePaused = connection.repository.readSnapshot()
    expect(() => services.records.beginActionRecording('action-1')).toThrowError(
      expect.objectContaining({ code: 'invalid-transition' })
    )
    expect(connection.repository.readSnapshot()).toEqual(beforePaused)

    services.goals.resumeGoal('goal-1')
    services.actions.rescheduleAction({
      actionId: 'action-1',
      currentNextResolution: { kind: 'clear' }
    })
    const beforeRescheduled = connection.repository.readSnapshot()
    expect(() => services.records.beginActionRecording('action-1')).toThrowError(
      expect.objectContaining({ code: 'invalid-transition' })
    )
    expect(connection.repository.readSnapshot()).toEqual(beforeRescheduled)
    connection.close()
  })

  it('rolls back parent, children, Action, Goal, and Today at every write failure', async () => {
    const { connection } = await openDatabase()
    const clock = new FakeClock({ instant, localDate: '2026-08-12', timeZone: 'Asia/Shanghai' })
    const initial = servicesFor(connection, clock, ['goal-1', 'action-1'])
    initial.goals.createGoal({ name: 'Goal', initialNextAction: { title: 'Current' } })
    initial.today.selectActionForToday('action-1')
    const before = connection.repository.readSnapshot()

    for (const failingMethod of [
      'saveActionRecord',
      'saveUnderstanding',
      'saveConfusion',
      'saveAction',
      'saveGoal',
      'deleteTodaySelection'
    ] as const) {
      const failingUnitOfWork: UnitOfWorkPort = {
        transaction: <T>(work: (repository: RepositoryPort) => T): T =>
          connection.transaction((repository) => {
            const failingRepository = new Proxy(repository, {
              get(target, property, receiver) {
                if (property === failingMethod) {
                  return () => {
                    throw new Error(`injected ${failingMethod} failure`)
                  }
                }
                const value = Reflect.get(target, property, receiver) as unknown
                return typeof value === 'function' ? value.bind(target) : value
              }
            })
            return work(failingRepository)
          })
      }
      const failing = servicesFor(
        connection,
        clock,
        ['record-1', 'understanding-1', 'confusion-1', 'action-2'],
        failingUnitOfWork
      )
      expect(() =>
        failing.records.recordAction({
          actionId: 'action-1',
          capturedOn: '2026-08-12',
          durationMinutes: 10,
          outcome: 'partial',
          understanding: 'A fact',
          confusion: 'A question',
          nextStep: 'Replacement',
          postRecord: {
            action: 'reschedule',
            currentNextResolution: { kind: 'create-from-recorded-next-step' }
          }
        })
      ).toThrow(`injected ${failingMethod} failure`)
      expect(connection.repository.readSnapshot(), failingMethod).toEqual(before)
    }
    connection.close()
  })
})

describe('first Action record atomic boundary (#125)', () => {
  const input = {
    actionId: 'first-action',
    recordId: 'first-record',
    capturedOn: '2026-08-12',
    title: '修紧把手',
    goalId: null,
    durationMinutes: null,
    outcome: 'partial' as const,
    lifecycle: 'keep-pending' as const,
    note: '还要继续'
  }
  it.each([null, 0, 8])(
    'saves duration %s, explicit lifecycle and optional goal without Today/next mutations',
    async (durationMinutes) => {
      const { path, connection } = await openDatabase()
      const clock = new FakeClock({
        instant,
        localDate: input.capturedOn,
        timeZone: 'Asia/Shanghai'
      })
      const services = servicesFor(connection, clock, ['goal', 'next'])
      services.goals.createGoal({
        name: 'Synthetic goal',
        initialNextAction: { title: 'Untouched next step' }
      })
      const before = connection.repository.readSnapshot()
      for (const [index, lifecycle, outcome, goalId] of [
        ['1', 'keep-pending', 'partial', null],
        ['2', 'keep-pending', 'completed', 'goal'],
        ['3', 'complete', 'partial', 'goal'],
        ['4', 'complete', 'completed', null]
      ] as const) {
        const request = {
          ...input,
          actionId: `action-${index}`,
          recordId: `record-${index}`,
          lifecycle,
          outcome,
          goalId,
          durationMinutes
        }
        const result = services.records.recordFirstAction(request)
        expect(result).toMatchObject({
          kind: 'saved',
          action: {
            status: lifecycle === 'complete' ? 'completed' : 'pending',
            selectedForToday: false,
            goalId
          },
          record: { durationMinutes, outcome },
          appliedNextActionId: null
        })
        expect(services.records.recordFirstAction(request)).toEqual(result)
      }
      const after = connection.repository.readSnapshot()
      expect(after.actions).toHaveLength(before.actions.length + 4)
      expect(after.actionRecords).toHaveLength(4)
      expect(after.goals).toEqual(before.goals)
      expect(after.todaySelections).toEqual(before.todaySelections)
      connection.close()
      const reopened = SqliteConnection.open(path)
      try {
        expect(reopened.repository.readSnapshot()).toEqual(after)
        const retry = servicesFor(reopened, clock, []).records.recordFirstAction({
          ...input,
          actionId: 'action-1',
          recordId: 'record-1',
          durationMinutes
        })
        expect(retry).toMatchObject({ kind: 'saved', record: { durationMinutes } })
        expect(reopened.repository.readSnapshot()).toEqual(after)
      } finally {
        reopened.close()
      }
    }
  )
  it.each(['paused', 'ended'])('rejects a goal that became %s while drafting', async (status) => {
    const { connection } = await openDatabase()
    try {
      const clock = new FakeClock({
        instant,
        localDate: input.capturedOn,
        timeZone: 'Asia/Shanghai'
      })
      const services = servicesFor(connection, clock, ['goal', 'next'])
      services.goals.createGoal({
        name: 'Synthetic goal',
        initialNextAction: { title: 'Keep next' }
      })
      if (status === 'paused') services.goals.pauseGoal('goal')
      else services.goals.endGoal('goal')
      const before = connection.repository.readSnapshot()
      expect(() => services.records.recordFirstAction({ ...input, goalId: 'goal' })).toThrow(
        'not active'
      )
      expect(connection.repository.readSnapshot()).toEqual(before)
    } finally {
      connection.close()
    }
  })
  it.each(['saveAction', 'saveActionRecord', 'after-work'])(
    'rolls back %s failure and safely retries',
    async (failurePoint) => {
      const { connection } = await openDatabase()
      try {
        const clock = new FakeClock({
          instant,
          localDate: input.capturedOn,
          timeZone: 'Asia/Shanghai'
        })
        const before = connection.repository.readSnapshot()
        const failing: UnitOfWorkPort = {
          transaction: <T>(work: (repository: RepositoryPort) => T): T =>
            connection.transaction((repository) => {
              const result = work(
                new Proxy(repository, {
                  get(target, property, receiver) {
                    if (property === failurePoint)
                      return () => {
                        throw Error('synthetic write failure')
                      }
                    const value = Reflect.get(target, property, receiver) as unknown
                    return typeof value === 'function' ? value.bind(target) : value
                  }
                })
              )
              if (failurePoint === 'after-work') throw Error('synthetic commit-boundary failure')
              return result
            })
        }
        expect(() =>
          servicesFor(connection, clock, [], failing).records.recordFirstAction(input)
        ).toThrow('synthetic')
        expect(connection.repository.readSnapshot()).toEqual(before)
        const service = servicesFor(connection, clock, []).records
        expect(service.recordFirstAction(input)).toMatchObject({ kind: 'saved' })
        const after = connection.repository.readSnapshot()
        expect(service.recordFirstAction(input)).toMatchObject({ kind: 'saved' })
        expect(connection.repository.readSnapshot()).toEqual(after)
      } finally {
        connection.close()
      }
    }
  )
  it('begin creates no objects; midnight asks before writing, and committed retry survives midnight', async () => {
    const { connection } = await openDatabase()
    try {
      const clock = new FakeClock({
        instant,
        localDate: input.capturedOn,
        timeZone: 'Asia/Shanghai'
      })
      const service = servicesFor(connection, clock, []).records
      const before = connection.repository.readSnapshot()
      expect(service.beginFirstActionRecording()).toMatchObject({ capturedOn: input.capturedOn })
      expect(connection.repository.readSnapshot()).toEqual(before)
      clock.setState({
        instant: '2026-08-13T00:00:00Z',
        localDate: '2026-08-13',
        timeZone: 'Asia/Shanghai'
      })
      expect(service.recordFirstAction(input)).toMatchObject({ kind: 'date-confirmation-required' })
      expect(connection.repository.readSnapshot()).toEqual(before)
      expect(service.recordFirstAction({ ...input, dateChoice: 'keep-captured-on' })).toMatchObject(
        { kind: 'saved', record: { occurredOn: input.capturedOn } }
      )
      const saved = connection.repository.readSnapshot()
      expect(
        service.recordFirstAction({ ...input, title: 'changed retry', lifecycle: 'complete' })
      ).toMatchObject({ kind: 'saved', action: { title: input.title, status: 'pending' } })
      expect(connection.repository.readSnapshot()).toEqual(saved)
    } finally {
      connection.close()
    }
  })
  it.each([
    { title: ' ' },
    { durationMinutes: -1 },
    { durationMinutes: undefined },
    { goalId: 'missing' },
    { lifecycle: undefined }
  ])('rejects invalid %j without objects', async (invalid) => {
    const { connection } = await openDatabase()
    try {
      const clock = new FakeClock({
        instant,
        localDate: input.capturedOn,
        timeZone: 'Asia/Shanghai'
      })
      const service = servicesFor(connection, clock, []).records
      const before = connection.repository.readSnapshot()
      expect(() =>
        service.recordFirstAction({ ...input, ...invalid } as Parameters<
          typeof service.recordFirstAction
        >[0])
      ).toThrow()
      expect(connection.repository.readSnapshot()).toEqual(before)
    } finally {
      connection.close()
    }
  })
})
