import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { RoutineService } from '../../src/application/routines'
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
const instant = '2026-08-14T08:00:00.000Z'

async function openDatabase() {
  const root = await createTemporaryTestRoot()
  roots.push(root)
  const path = join(root.database, `routine-${crypto.randomUUID()}.sqlite3`)
  return { path, connection: SqliteConnection.open(path) }
}

function services(
  connection: SqliteConnection,
  unitOfWork: UnitOfWorkPort = connection,
  id = '11111111-1111-4111-8111-111111111111'
) {
  const clock = new FakeClock({ instant, localDate: '2026-08-14', timeZone: 'Asia/Shanghai' })
  return {
    clock,
    routine: new RoutineService({
      repository: connection.repository,
      unitOfWork,
      clock,
      generateId: () => id
    }),
    today: new TodayService({ repository: connection.repository, unitOfWork, clock })
  }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => removeTemporaryTestRoot(root)))
})

describe('Routine SQLite integration', () => {
  it('persists lifecycle, schedule, Goal state, history, Today projection, and real reopen', async () => {
    const { path, connection } = await openDatabase()
    connection.repository.saveGoal({
      id: '22222222-2222-4222-8222-222222222222',
      title: 'Movement',
      description: null,
      status: 'paused',
      currentNextActionId: null,
      createdAt: instant,
      updatedAt: instant
    })
    const current = services(connection)
    const created = current.routine.createRoutine({
      goalId: '22222222-2222-4222-8222-222222222222',
      name: 'Light activity',
      description: 'Current description',
      minimumAction: 'Stretch once',
      weekdays: [5, 1, 7]
    })
    expect(created).toMatchObject({
      status: 'active',
      weekdays: [1, 5, 7],
      goal: { status: 'paused' }
    })
    expect(current.today.getToday().plannedRoutines).toEqual([
      expect.objectContaining({
        id: created.id,
        goal: { id: expect.any(String), name: 'Movement', status: 'paused' },
        canRecord: true
      })
    ])

    connection.repository.saveRoutineRecord({
      id: '33333333-3333-4333-8333-333333333333',
      routineId: created.id,
      occurredOn: '2026-08-13',
      outcome: 'acted',
      plannedForDate: false,
      durationMinutes: 5,
      note: null,
      createdAt: instant,
      updatedAt: instant
    })
    const historyBefore = connection.repository.readSnapshot().routineRecords
    current.routine.updateRoutineDetails({
      routineId: created.id,
      name: 'Renamed activity',
      description: null,
      minimumAction: 'Walk five minutes'
    })
    current.routine.replaceRoutineSchedule({ routineId: created.id, weekdays: [2, 4] })
    expect(connection.repository.readSnapshot().routineRecords).toEqual(historyBefore)
    expect(current.today.getToday().plannedRoutines).toEqual([])
    expect(current.routine.pauseRoutine(created.id).status).toBe('paused')
    expect(connection.repository.readSnapshot().routineRecords).toEqual(historyBefore)
    expect(current.routine.resumeRoutine(created.id).status).toBe('active')
    expect(current.routine.endRoutine(created.id).status).toBe('ended')
    expect(connection.repository.readSnapshot().routineRecords).toEqual(historyBefore)
    connection.close()

    const reopened = SqliteConnection.open(path)
    try {
      const reopenedServices = services(reopened)
      expect(reopenedServices.routine.getRoutineDetail(created.id)).toMatchObject({
        id: created.id,
        name: 'Renamed activity',
        minimumAction: 'Walk five minutes',
        status: 'ended',
        weekdays: [2, 4],
        goal: { status: 'paused' }
      })
      expect(reopened.repository.readSnapshot().routineRecords).toEqual(historyBefore)
      expect(reopenedServices.today.getToday().plannedRoutines).toEqual([])
    } finally {
      reopened.close()
    }
  })

  it('rolls back create and full schedule replacement on injected adapter failures', async () => {
    const { connection } = await openDatabase()
    let scheduleWrites = 0
    const failingCreate: UnitOfWorkPort = {
      transaction: <T>(work: (repository: RepositoryPort) => T): T =>
        connection.transaction((repository) =>
          work(
            new Proxy(repository, {
              get(target, property, receiver) {
                if (property === 'saveRoutineScheduleDay') {
                  return (...args: unknown[]) => {
                    scheduleWrites += 1
                    if (scheduleWrites === 2) throw new Error('injected schedule write failure')
                    return Reflect.apply(target.saveRoutineScheduleDay, target, args as [never])
                  }
                }
                const value = Reflect.get(target, property, receiver) as unknown
                return typeof value === 'function' ? value.bind(target) : value
              }
            })
          )
        )
    }
    expect(() =>
      services(connection, failingCreate).routine.createRoutine({
        name: 'Rollback',
        minimumAction: 'Move',
        weekdays: [1, 2]
      })
    ).toThrow(/injected schedule write failure/)
    expect(connection.repository.readSnapshot().routines).toEqual([])
    expect(connection.repository.readSnapshot().routineScheduleDays).toEqual([])

    const normal = services(connection)
    const created = normal.routine.createRoutine({
      name: 'Stable',
      minimumAction: 'Move',
      weekdays: [1, 2]
    })
    const before = structuredClone(connection.repository.readSnapshot())
    const failingReplace: UnitOfWorkPort = {
      transaction: <T>(work: (repository: RepositoryPort) => T): T =>
        connection.transaction((repository) =>
          work(
            new Proxy(repository, {
              get(target, property, receiver) {
                if (property === 'replaceRoutineScheduleDays') {
                  return (...args: unknown[]) => {
                    Reflect.apply(
                      (
                        target as RepositoryPort & {
                          replaceRoutineScheduleDays: (...values: unknown[]) => void
                        }
                      ).replaceRoutineScheduleDays,
                      target,
                      args
                    )
                    throw new Error('injected replace failure')
                  }
                }
                const value = Reflect.get(target, property, receiver) as unknown
                return typeof value === 'function' ? value.bind(target) : value
              }
            })
          )
        )
    }
    expect(() =>
      services(connection, failingReplace).routine.replaceRoutineSchedule({
        routineId: created.id,
        weekdays: [4, 5]
      })
    ).toThrow(/injected replace failure/)
    expect(connection.repository.readSnapshot()).toEqual(before)
    connection.close()
  })
})
