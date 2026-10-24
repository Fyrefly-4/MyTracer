import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ProgressService } from '../../src/application/progress'
import { RoutineRecordService } from '../../src/application/routine-records'
import { RoutineService } from '../../src/application/routines'
import { TodayService } from '../../src/application/today'
import { SqliteConnection } from '../../src/infrastructure/sqlite/sqlite-connection'
import { FakeClock } from '../support/fake-clock'
import {
  createTemporaryTestRoot,
  removeTemporaryTestRoot,
  type TemporaryTestRoot
} from '../support/temporary-test-root'

const roots: TemporaryTestRoot[] = []
const routineId = '11111111-1111-4111-8111-111111111111'

async function openDatabase() {
  const root = await createTemporaryTestRoot()
  roots.push(root)
  const path = join(root.database, `routine-record-${crypto.randomUUID()}.sqlite3`)
  return { path, connection: SqliteConnection.open(path) }
}

function services(connection: SqliteConnection, clock: FakeClock) {
  let sequence = 1
  return {
    routines: new RoutineService({
      repository: connection.repository,
      unitOfWork: connection,
      clock,
      generateId: () => routineId
    }),
    records: new RoutineRecordService({
      repository: connection.repository,
      unitOfWork: connection,
      clock,
      generateId: () => `22222222-2222-4222-8222-${String(sequence++).padStart(12, '0')}`
    }),
    today: new TodayService({ repository: connection.repository, unitOfWork: connection, clock }),
    progress: new ProgressService({ repository: connection.repository })
  }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => removeTemporaryTestRoot(root)))
})

describe('RoutineRecord SQLite integration', () => {
  it('persists four explicit outcomes, preserves missing unknown, and rejects duplicate day rows', async () => {
    const { connection } = await openDatabase()
    const clock = new FakeClock({
      instant: '2026-08-10T08:00:00.000Z',
      localDate: '2026-08-10',
      timeZone: 'Asia/Shanghai'
    })
    const service = services(connection, clock)
    service.routines.createRoutine({
      arrangementMode: 'weekly' as const,
      name: 'Move',
      minimumAction: 'Stretch',
      weekdays: [1]
    })

    expect(service.records.getRoutineDayState(routineId, '2026-08-09').recordState).toBe('unknown')
    for (const [index, outcome] of (
      ['target_met', 'acted', 'intentional_rest', 'not_done'] as const
    ).entries()) {
      const day = `2026-08-${String(10 + index).padStart(2, '0')}`
      clock.setState({
        instant: `2026-08-${String(10 + index).padStart(2, '0')}T08:00:00.000Z`,
        localDate: day,
        timeZone: 'Asia/Shanghai'
      })
      expect(
        service.records.recordRoutine({
          routineId,
          capturedOn: day,
          outcome,
          durationMinutes: outcome === 'target_met' || outcome === 'acted' ? index : null
        })
      ).toMatchObject({ kind: 'saved', record: { outcome } })
    }
    expect(connection.repository.readSnapshot().routineRecords).toHaveLength(4)
    expect(() =>
      service.records.recordRoutine({
        routineId,
        capturedOn: '2026-08-13',
        outcome: 'not_done'
      })
    ).toThrowError(expect.objectContaining({ code: 'record-already-exists' }))
    expect(connection.repository.readSnapshot().routineRecords).toHaveLength(4)
    connection.close()
  })

  it('keeps the plan snapshot stable and projects planned and unplanned facts after reopen', async () => {
    const { path, connection } = await openDatabase()
    const clock = new FakeClock({
      instant: '2026-08-10T08:00:00.000Z',
      localDate: '2026-08-10',
      timeZone: 'Asia/Shanghai'
    })
    const service = services(connection, clock)
    service.routines.createRoutine({
      arrangementMode: 'weekly' as const,
      name: 'Move',
      minimumAction: 'Stretch',
      weekdays: [1]
    })
    service.records.recordRoutine({
      routineId,
      capturedOn: '2026-08-10',
      outcome: 'target_met',
      durationMinutes: 10
    })
    clock.setState({
      instant: '2026-08-11T08:00:00.000Z',
      localDate: '2026-08-11',
      timeZone: 'Asia/Shanghai'
    })
    service.records.recordRoutine({
      routineId,
      capturedOn: '2026-08-11',
      outcome: 'acted',
      durationMinutes: null
    })
    service.routines.replaceRoutineSchedule({
      arrangementMode: 'weekly' as const,
      routineId,
      weekdays: [2]
    })

    expect(service.records.getRoutineDayState(routineId, '2026-08-10')).toMatchObject({
      plannedByCurrentSchedule: false,
      record: { plannedForDate: true }
    })
    expect(service.today.getToday().plannedRoutines[0]).toMatchObject({
      recordState: 'acted',
      record: { plannedForDate: false }
    })
    expect(service.progress.getProgress({})).toMatchObject({
      totalDurationMinutes: 10,
      realActionCount: 2,
      targetMetCount: 1,
      plannedTargetMetCount: 1
    })
    connection.close()

    const reopened = SqliteConnection.open(path)
    try {
      expect(
        new ProgressService({ repository: reopened.repository }).getProgress({})
      ).toMatchObject({
        realActionCount: 2,
        routineRecords: [
          expect.objectContaining({ occurredOn: '2026-08-11', plannedForDate: false }),
          expect.objectContaining({ occurredOn: '2026-08-10', plannedForDate: true })
        ]
      })
    } finally {
      reopened.close()
    }
  })
})
