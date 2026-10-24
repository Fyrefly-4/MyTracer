import { join } from 'node:path'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'
import { asCompleteExportRepository } from '../../src/application/ports/persistence'
import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { RoutineService } from '../../src/application/routines'
import { RoutineRecordService } from '../../src/application/routine-records'
import { TodayService } from '../../src/application/today'
import { ProgressService } from '../../src/application/progress'
import { buildCompleteExport, validateCompleteExport } from '../../src/application/complete-export'
import { buildRecordBook } from '../../src/application/record-book'
import { SqliteConnection } from '../../src/infrastructure/sqlite/sqlite-connection'
import { migrateToCurrentSchema } from '../../src/infrastructure/sqlite/migrations'
import initial from '../../src/infrastructure/sqlite/migrations/001_initial.sql?raw'
import second from '../../src/infrastructure/sqlite/migrations/002_add_routine_record_planned_for_date_basis.sql?raw'
import third from '../../src/infrastructure/sqlite/migrations/003_review_results_v3.sql?raw'
import fourth from '../../src/infrastructure/sqlite/migrations/004_unknown_action_duration.sql?raw'
import { FakeClock } from '../support/fake-clock'

const instant = '2026-08-10T08:00:00.000Z'
const day = '2026-08-10'
const clock = () => new FakeClock({ instant, localDate: day, timeZone: 'Asia/Shanghai' })

describe('explicit unscheduled routine arrangements', () => {
  it('roundtrips both switches without rewriting history, inventing obligations or permitting duplicates', async () => {
    const root = await createTemporaryTestRoot()
    const connection = SqliteConnection.open(join(root.database, 'test.sqlite3'))
    try {
      const time = clock()
      let id = 0
      const dependencies = {
        repository: connection.repository,
        unitOfWork: connection,
        clock: time,
        generateId: () => `id-${++id}`
      }
      const routines = new RoutineService(dependencies)
      const records = new RoutineRecordService(dependencies)
      const today = new TodayService(dependencies)
      const routine = routines.createRoutine({
        name: '合成弹琴',
        minimumAction: '一小段',
        arrangementMode: 'weekly',
        weekdays: [1]
      })
      const input = {
        routineId: routine.id,
        capturedOn: day,
        outcome: 'target_met' as const,
        durationMinutes: null
      }
      records.recordRoutine(input)
      const historical = connection.repository.readSnapshot().routineRecords
      routines.replaceRoutineSchedule({
        routineId: routine.id,
        arrangementMode: 'unscheduled',
        weekdays: []
      })
      expect(today.getToday().plannedRoutines).toEqual([])
      expect(today.getToday().unscheduledRoutines.map((r) => r.id)).toEqual([routine.id])
      expect(() => records.recordRoutine(input)).toThrowError(
        expect.objectContaining({ code: 'record-already-exists' })
      )
      expect(connection.repository.readSnapshot().routineRecords).toEqual(historical)
      time.setState({
        instant: '2026-08-11T08:00:00.000Z',
        localDate: '2026-08-11',
        timeZone: 'Asia/Shanghai'
      })
      expect(records.getRoutineDayState(routine.id, '2026-08-11')).toMatchObject({
        recordState: 'unknown',
        plannedByCurrentSchedule: false
      })
      records.recordRoutine({ ...input, capturedOn: '2026-08-11', outcome: 'acted' })
      const unscheduledHistory = connection.repository.readSnapshot().routineRecords
      expect(unscheduledHistory[1]).toMatchObject({
        plannedForDate: false,
        plannedForDateBasis: 'schedule_at_recording',
        durationMinutes: null
      })
      const exported = buildCompleteExport(
        asCompleteExportRepository(connection.repository).readCompleteCoreSnapshot(),
        time
      )
      const parsed = JSON.parse(JSON.stringify(exported))
      expect(() => validateCompleteExport(parsed)).not.toThrow()
      expect(parsed).toEqual(exported)
      const reopened = SqliteConnection.open(join(root.database, 'test.sqlite3'))
      try {
        expect(reopened.repository.readSnapshot()).toEqual(connection.repository.readSnapshot())
      } finally {
        reopened.close()
      }
      expect(parsed).toMatchObject({
        exportVersion: 6,
        sourceDataVersion: 7,
        data: { routines: [{ id: routine.id, arrangementMode: 'unscheduled' }] }
      })
    } finally {
      connection.close()
      await removeTemporaryTestRoot(root)
    }
  })

  it('creates unscheduled directly, respects lifecycle, and preserves facts across a return to weekly', async () => {
    const root = await createTemporaryTestRoot()
    const connection = SqliteConnection.open(join(root.database, 'test.sqlite3'))
    try {
      const time = clock()
      let id = 0
      const dependencies = {
        repository: connection.repository,
        unitOfWork: connection,
        clock: time,
        generateId: () => `id-${++id}`
      }
      const routines = new RoutineService(dependencies)
      const records = new RoutineRecordService(dependencies)
      const today = new TodayService(dependencies)
      const routine = routines.createRoutine({
        name: '合成弹琴',
        minimumAction: '一小段',
        arrangementMode: 'unscheduled',
        weekdays: []
      })
      expect(routines.getRoutineDetail(routine.id)).toMatchObject({
        arrangementMode: 'unscheduled',
        weekdays: []
      })
      expect(new ProgressService(dependencies).getProgress({})).toMatchObject({
        realActionCount: 0,
        plannedTargetMetCount: 0,
        routineRecords: []
      })
      records.recordRoutine({
        routineId: routine.id,
        capturedOn: day,
        outcome: 'target_met',
        durationMinutes: null
      })
      const history = connection.repository.readSnapshot().routineRecords
      routines.replaceRoutineSchedule({
        routineId: routine.id,
        arrangementMode: 'weekly',
        weekdays: [2]
      })
      expect(connection.repository.readSnapshot().routineRecords).toEqual(history)
      expect(new ProgressService(dependencies).getProgress({})).toMatchObject({
        realActionCount: 1,
        targetMetCount: 1,
        plannedTargetMetCount: 0,
        unknownDurationCount: 1
      })
      expect(
        buildRecordBook(connection.repository.readSnapshot()).months[0].days[0].entries[0].fields
      ).toContainEqual({ label: '记录时的计划日', text: '否' })
      routines.replaceRoutineSchedule({
        routineId: routine.id,
        arrangementMode: 'unscheduled',
        weekdays: []
      })
      routines.pauseRoutine(routine.id)
      expect(today.getToday().unscheduledRoutines).toEqual([])
      routines.resumeRoutine(routine.id)
      expect(today.getToday().unscheduledRoutines).toHaveLength(1)
      routines.endRoutine(routine.id)
      expect(today.getToday().unscheduledRoutines).toEqual([])
      expect(connection.repository.readSnapshot().routineRecords).toEqual(history)
    } finally {
      connection.close()
      await removeTemporaryTestRoot(root)
    }
  })

  it('migrates v4 losslessly, rolls back invalid legacy data, and refuses unknown future schema', () => {
    for (const valid of [true, false]) {
      const db = new Database(':memory:')
      try {
        db.pragma('foreign_keys = ON')
        for (const sql of [initial, second, third, fourth]) db.exec(sql)
        db.prepare("INSERT INTO metadata (key,value) VALUES ('schemaVersion','4')").run()
        db.prepare(
          'INSERT INTO routines (id,goal_id,name,minimum_action,description,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)'
        ).run('r', null, '合成', '一步', null, 'active', instant, instant)
        if (valid) db.prepare('INSERT INTO routine_schedule_days VALUES (?,?)').run('r', 1)
        db.prepare(
          'INSERT INTO routine_records (id,routine_id,occurred_on,outcome,planned_for_date,planned_for_date_basis,duration_minutes,note,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)'
        ).run(
          'record',
          'r',
          day,
          'acted',
          1,
          'schedule_at_recording',
          null,
          '原文',
          instant,
          instant
        )
        const before = db.prepare('SELECT * FROM routines').all()
        const records = db.prepare('SELECT * FROM routine_records').all()
        if (valid) {
          migrateToCurrentSchema(db)
          expect(db.prepare('SELECT * FROM routines').all()).toEqual(
            before.map((r) => ({ ...(r as object), arrangement_mode: 'weekly' }))
          )
          expect(db.prepare('SELECT * FROM routine_records').all()).toEqual(
            records.map((r) => ({ ...(r as object), summary: null }))
          )
          expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
          migrateToCurrentSchema(db)
          db.prepare("UPDATE metadata SET value = '8' WHERE key = 'schemaVersion'").run()
          expect(() => migrateToCurrentSchema(db)).toThrow(/newer/)
        } else {
          expect(() => migrateToCurrentSchema(db)).toThrow(/legacy weekdays/)
          expect(db.prepare('SELECT * FROM routines').all()).toEqual(before)
          expect(db.prepare('SELECT * FROM routine_records').all()).toEqual(records)
          expect(
            db.prepare("SELECT value FROM metadata WHERE key = 'schemaVersion'").get()
          ).toEqual({ value: '4' })
        }
      } finally {
        db.close()
      }
    }
  })
})
