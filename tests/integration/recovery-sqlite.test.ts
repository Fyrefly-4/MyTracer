import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { RecoveryService } from '../../src/application/recovery'
import {
  asCompleteExportRepository,
  type ActionPersistenceRecord,
  type ActionRecordPersistenceRecord,
  type GoalPersistenceRecord,
  type RoutinePersistenceRecord,
  type RoutineRecordPersistenceRecord
} from '../../src/application/ports/persistence'
import { SqliteConnection } from '../../src/infrastructure/sqlite/sqlite-connection'
import { FakeClock } from '../support/fake-clock'
import {
  createTemporaryTestRoot,
  removeTemporaryTestRoot,
  type TemporaryTestRoot
} from '../support/temporary-test-root'

const roots: TemporaryTestRoot[] = []
const goalId = '11111111-1111-4111-8111-111111111111'
const clock = new FakeClock({
  instant: '2026-09-01T00:05:00.000+08:00',
  localDate: '2026-09-01',
  timeZone: 'Asia/Shanghai'
})
const at = (day: number, minute = 0) =>
  `2026-08-${String(day).padStart(2, '0')}T08:${String(minute).padStart(2, '0')}:00.000Z`

async function openDatabase() {
  const root = await createTemporaryTestRoot()
  roots.push(root)
  const path = join(root.database, `recovery-${crypto.randomUUID()}.sqlite3`)
  return { path, connection: SqliteConnection.open(path) }
}
afterEach(async () => {
  await Promise.all(roots.splice(0).map(removeTemporaryTestRoot))
})

function seed(connection: SqliteConnection): void {
  const repository = connection.repository
  const goal: GoalPersistenceRecord = {
    id: goalId,
    title: 'Learn React',
    description: null,
    status: 'active',
    currentNextActionId: null,
    createdAt: at(1),
    updatedAt: at(31)
  }
  const actions: ActionPersistenceRecord[] = [
    {
      id: '22222222-2222-4222-8222-222222222222',
      goalId,
      title: 'Run example',
      description: null,
      status: 'pending',
      createdAt: at(2),
      updatedAt: at(2)
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      goalId,
      title: 'Read docs',
      description: null,
      status: 'pending',
      createdAt: at(3),
      updatedAt: at(3)
    }
  ]
  repository.saveGoal(goal)
  actions.forEach((item) => repository.saveAction(item))
  repository.saveGoal({ ...goal, currentNextActionId: actions[0].id, updatedAt: at(4) })
  const actionRecord: ActionRecordPersistenceRecord = {
    id: '44444444-4444-4444-8444-444444444444',
    actionId: actions[0].id,
    occurredOn: '2026-08-30',
    durationMinutes: 0,
    outcome: 'partial',
    nextStep: null,
    note: null,
    createdAt: at(30),
    updatedAt: at(30)
  }
  repository.saveActionRecord(actionRecord)
  repository.saveUnderstanding({
    id: '55555555-5555-4555-8555-555555555555',
    actionRecordId: actionRecord.id,
    text: 'State queues work',
    source: 'manual',
    revokedAt: null,
    createdAt: at(30, 1),
    updatedAt: at(30, 1)
  })
  repository.saveConfusion({
    id: '66666666-6666-4666-8666-666666666666',
    actionRecordId: actionRecord.id,
    text: 'When is it flushed?',
    status: 'open',
    resolvedAt: null,
    resolution: null,
    createdAt: at(30, 2),
    updatedAt: at(30, 2)
  })
  const routine: RoutinePersistenceRecord = {
    id: '77777777-7777-4777-8777-777777777777',
    goalId,
    name: 'Practice',
    minimumAction: 'Open editor',
    description: null,
    status: 'active',
    createdAt: at(1),
    updatedAt: at(1)
  }
  repository.saveRoutine(routine)
  const routineRecords: RoutineRecordPersistenceRecord[] = [
    {
      id: '88888888-8888-4888-8888-888888888888',
      routineId: routine.id,
      occurredOn: '2026-08-31',
      outcome: 'acted',
      plannedForDate: false,
      plannedForDateBasis: 'schedule_at_recording',
      durationMinutes: 0,
      note: null,
      createdAt: at(31),
      updatedAt: at(31)
    },
    {
      id: '99999999-9999-4999-8999-999999999999',
      routineId: routine.id,
      occurredOn: '2026-09-01',
      outcome: 'intentional_rest',
      plannedForDate: true,
      plannedForDateBasis: 'schedule_at_recording',
      durationMinutes: null,
      note: null,
      createdAt: '2026-09-01T00:01:00.000Z',
      updatedAt: '2026-09-01T00:01:00.000Z'
    },
    {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      routineId: routine.id,
      occurredOn: '2026-08-29',
      outcome: 'not_done',
      plannedForDate: true,
      plannedForDateBasis: 'schedule_at_recording',
      durationMinutes: null,
      note: null,
      createdAt: at(29),
      updatedAt: at(29)
    },
    {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      routineId: routine.id,
      occurredOn: '2026-08-28',
      outcome: 'target_met',
      plannedForDate: true,
      plannedForDateBasis: 'schedule_at_recording',
      durationMinutes: null,
      note: null,
      createdAt: at(28),
      updatedAt: at(28)
    }
  ]
  routineRecords.forEach((item) => repository.saveRoutineRecord(item))
}

describe('Recovery SQLite query', () => {
  it('projects one Goal-centred snapshot with five Routine day semantics and remains read-only after reopen', async () => {
    const { path, connection } = await openDatabase()
    seed(connection)
    const completeRepository = asCompleteExportRepository(connection.repository)
    const before = completeRepository.readCompleteCoreSnapshot()
    const service = new RecoveryService({ repository: connection.repository, clock })
    const result = service.getContext({ goalId })
    expect(result).toMatchObject({
      goal: { id: goalId },
      lastRealActionOn: '2026-08-31',
      daysSinceLastRealAction: 1,
      latestRealRecord: { kind: 'routine', outcome: 'acted', durationMinutes: 0 },
      currentNextAction: { title: 'Run example' }
    })
    expect(result.pendingActions.map((item) => item.title)).toEqual(['Run example', 'Read docs'])
    expect(result.confirmedUnderstandings.map((item) => item.text)).toEqual(['State queues work'])
    expect(result.openConfusions.map((item) => item.text)).toEqual(['When is it flushed?'])
    expect(completeRepository.readCompleteCoreSnapshot()).toEqual(before)
    expect(service.getContext({ goalId })).toEqual(result)
    clock.setState({
      instant: '2026-09-03T00:05:00.000+08:00',
      localDate: '2026-09-03',
      timeZone: 'Asia/Shanghai'
    })
    const advanced = service.getContext({ goalId })
    expect(advanced).toMatchObject({
      asOfLocalDate: '2026-09-03',
      lastRealActionOn: '2026-08-31',
      daysSinceLastRealAction: 3,
      latestRealRecord: result.latestRealRecord
    })
    expect(completeRepository.readCompleteCoreSnapshot()).toEqual(before)
    connection.close()
    const reopened = SqliteConnection.open(path)
    try {
      expect(
        new RecoveryService({ repository: reopened.repository, clock }).getContext({ goalId })
      ).toEqual(advanced)
      expect(asCompleteExportRepository(reopened.repository).readCompleteCoreSnapshot()).toEqual(
        before
      )
    } finally {
      reopened.close()
    }
  })

  it('returns null when Goal timestamps exist but no real action exists', async () => {
    const { connection } = await openDatabase()
    connection.repository.saveGoal({
      id: goalId,
      title: 'Empty',
      description: null,
      status: 'active',
      currentNextActionId: null,
      createdAt: at(1),
      updatedAt: at(31)
    })
    expect(
      new RecoveryService({ repository: connection.repository, clock }).getContext({ goalId })
    ).toMatchObject({ lastRealActionOn: null, daysSinceLastRealAction: null })
    connection.close()
  })
})
