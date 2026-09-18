import { join } from 'node:path'
import { expect, it } from 'vitest'
import { ProgressService } from '../../src/application/progress'
import {
  asCompleteExportRepository,
  asDataControlRepository
} from '../../src/application/ports/persistence'
import { SqliteConnection } from '../../src/infrastructure/sqlite/sqlite-connection'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'
import { FakeClock } from '../support/fake-clock'

it('queries isolated Goal dates and weekly facts without writes, recalculates corrections/deletion, and survives reopening', async () => {
  const root = await createTemporaryTestRoot()
  const path = join(root.database, 'should.sqlite3')
  let connection = SqliteConnection.open(path)
  const clock = new FakeClock({
    instant: '2026-09-19T00:00:00Z',
    localDate: '2026-09-19',
    timeZone: 'Asia/Shanghai'
  })
  const timestamp = '2026-09-19T00:00:00Z'
  try {
    const repo = connection.repository
    for (const [id, status] of [
      ['g1', 'active'],
      ['g2', 'paused'],
      ['g3', 'ended']
    ] as const) {
      repo.saveGoal({
        id,
        title: id,
        status,
        description: null,
        currentNextActionId: null,
        createdAt: timestamp,
        updatedAt: timestamp
      })
    }
    repo.saveAction({
      id: 'a1',
      goalId: 'g1',
      title: 'A',
      description: null,
      status: 'pending',
      createdAt: timestamp,
      updatedAt: timestamp
    })
    repo.saveActionRecord({
      id: 'ar1',
      actionId: 'a1',
      occurredOn: '2026-09-08',
      durationMinutes: 0,
      outcome: 'stopped',
      nextStep: null,
      note: null,
      createdAt: timestamp,
      updatedAt: timestamp
    })
    repo.saveRoutine({
      id: 'r1',
      goalId: 'g2',
      name: 'R',
      minimumAction: 'Small',
      description: null,
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp
    })
    for (const [id, occurredOn, outcome] of [
      ['rr1', '2026-09-14', 'acted'],
      ['rr2', '2026-09-18', 'intentional_rest'],
      ['rr3', '2026-09-19', 'not_done']
    ] as const)
      repo.saveRoutineRecord({
        id,
        routineId: 'r1',
        occurredOn,
        outcome,
        plannedForDate: false,
        plannedForDateBasis: 'schedule_at_recording',
        durationMinutes: null,
        note: null,
        createdAt: timestamp,
        updatedAt: timestamp
      })
    let service = new ProgressService({ repository: repo, clock })
    const snapshot = () =>
      asCompleteExportRepository(connection.repository).readCompleteCoreSnapshot()
    const before = snapshot()
    const activity = service.getGoalActivity()
    expect(activity.goals).toEqual([
      { goalId: 'g1', lastRealActionOn: '2026-09-08', daysSinceLastRealAction: 11 },
      { goalId: 'g2', lastRealActionOn: '2026-09-14', daysSinceLastRealAction: 5 },
      { goalId: 'g3', lastRealActionOn: null, daysSinceLastRealAction: null }
    ])
    expect(service.compareWeeks({ goalId: 'g1' })).toMatchObject({
      current: { realActionCount: 0 },
      previous: { realActionCount: 1 }
    })
    expect(service.compareWeeks({})).toMatchObject({
      current: { realActionCount: 1 },
      previous: { realActionCount: 1 }
    })
    expect(snapshot()).toEqual(before)
    connection.close()
    connection = SqliteConnection.open(path)
    service = new ProgressService({ repository: connection.repository, clock })
    expect(service.getGoalActivity()).toEqual(activity)
    expect(snapshot()).toEqual(before)
    asDataControlRepository(connection.repository).updateActionRecord({
      id: 'ar1',
      actionId: 'a1',
      occurredOn: '2026-09-19',
      durationMinutes: 15,
      outcome: 'partial',
      nextStep: null,
      note: null,
      createdAt: timestamp,
      updatedAt: timestamp
    })
    expect(service.getGoalActivity().goals[0]).toMatchObject({
      lastRealActionOn: '2026-09-19',
      daysSinceLastRealAction: 0
    })
    expect(service.compareWeeks({ goalId: 'g1' })).toMatchObject({
      current: { realActionCount: 1, totalDurationMinutes: 15 },
      previous: { realActionCount: 0 }
    })
  } finally {
    connection.close()
    await removeTemporaryTestRoot(root)
  }
})
