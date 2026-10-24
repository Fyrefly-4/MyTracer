import Database from 'better-sqlite3'
import { describe, expect, it, vi } from 'vitest'
import { HomeService, homeCalendarStart, HomeValidationError } from '../../src/application/home'
import type { ClockPort } from '../../src/application/ports/clock'
import { createLocalDate } from '../../src/domain/local-date'
import { SqliteHomeQuery } from '../../src/infrastructure/sqlite/home-query'
import { migrateToCurrentSchema } from '../../src/infrastructure/sqlite/migrations'

const today = '2026-10-22'
const clock: ClockPort = {
  currentLocalDate: () => createLocalDate(today),
  currentTimeZone: () => 'Asia/Shanghai',
  nowInstant: () => '2026-10-22T01:00:00Z',
  snapshot: () => ({
    localDate: createLocalDate(today),
    timeZone: 'Asia/Shanghai',
    instant: '2026-10-22T01:00:00Z'
  })
}
function fixture() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  migrateToCurrentSchema(db)
  const at = '2026-10-01T00:00:00Z'
  for (let i = 0; i < 5; i++) {
    db.prepare('INSERT INTO goals(id,title,status,created_at,updated_at) VALUES(?,?,?,?,?)').run(
      `g${i}`,
      `Goal${i}`,
      'active',
      at,
      at
    )
    db.prepare(
      'INSERT INTO actions(id,goal_id,title,status,created_at,updated_at) VALUES(?,?,?,?,?,?)'
    ).run(`a${i}`, `g${i}`, `Action${i}`, 'pending', at, at)
    db.prepare('UPDATE goals SET current_next_action_id=? WHERE id=?').run(`a${i}`, `g${i}`)
  }
  const insert = db.prepare(
    "INSERT INTO action_records(id,action_id,occurred_on,duration_minutes,outcome,note,created_at,updated_at) VALUES(?,?,?,5,'completed',?,?,?)"
  )
  db.transaction(() => {
    for (let i = 0; i < 1200; i++)
      insert.run(`r${String(i).padStart(4, '0')}`, 'a0', today, 'fact', at, at)
    insert.run('old', 'a1', '2025-01-01', null, at, at)
    insert.run('future', 'a4', '2027-01-01', 'not yet', at, at)
  })()
  for (const [i, outcome] of ['target_met', 'acted', 'intentional_rest', 'not_done'].entries()) {
    db.prepare(
      "INSERT INTO routines(id,goal_id,name,minimum_action,status,created_at,updated_at) VALUES(?,?,?,'minimum','active',?,?)"
    ).run(`routine${i}`, 'g0', `Routine${i}`, at, at)
    db.prepare(
      'INSERT INTO routine_records(id,routine_id,occurred_on,outcome,planned_for_date,created_at,updated_at) VALUES(?,?,?,?,0,?,?)'
    ).run(`rr${i}`, `routine${i}`, today, outcome, at, at)
  }
  db.prepare(
    "INSERT INTO understandings(id,action_record_id,text,source,created_at,updated_at) VALUES('u','old','Old insight','manual',?,?)"
  ).run(at, at)
  return { db, service: new HomeService(new SqliteHomeQuery(db), clock) }
}
describe('bounded Home read model', () => {
  it('bounds all collections and preserves old goal recency, actual dates and routine outcomes', () => {
    const { db, service } = fixture()
    try {
      const overview = service.get()
      expect(overview.goals.map((g) => g.id)).toEqual(['g0', 'g1', 'g2'])
      expect(overview).toMatchObject({ activeGoalCount: 5, totalGoalCount: 5, localDate: today })
      expect(overview.latestByGoal).toHaveLength(2)
      expect(overview.latestByGoal[1]).toMatchObject({
        id: 'old',
        occurredOn: '2025-01-01',
        summary: null,
        hasNote: false
      })
      expect(overview.recentRecords).toHaveLength(3)
      expect(overview.currentActions).toHaveLength(3)
      expect(overview.calendarCounts).toEqual([{ date: today, count: 1204 }])
      const first = service.day({ date: today, page: 1 }),
        second = service.day({ date: today, page: 2 })
      expect(first.total).toBe(1204)
      expect(first.records).toHaveLength(10)
      expect(new Set([...first.records, ...second.records].map((r) => r.id)).size).toBe(20)
      expect(service.day({ date: today, page: 121 }).records.map((r) => r.outcome)).toEqual([
        'target_met',
        'acted',
        'intentional_rest',
        'not_done'
      ])
      expect(service.day({ date: today, page: 122 })).toEqual({ total: 1204, records: [] })
    } finally {
      db.close()
    }
  })
  it('validates occurrence range, leap dates and pagination; calendar arithmetic crosses DST/year safely', () => {
    const { db, service } = fixture()
    try {
      for (const input of [
        { date: '2026-02-30', page: 1 },
        { date: '2025-01-01', page: 1 },
        { date: '2026-10-23', page: 1 },
        { date: today, page: 0 },
        { date: today, page: 1.5 },
        { date: today, page: Infinity }
      ])
        expect(() => service.day(input)).toThrow(HomeValidationError)
      expect(homeCalendarStart('2026-10-22')).toBe('2026-04-27')
      expect(homeCalendarStart('2026-01-01')).toBe('2025-07-07')
      expect(service.day({ date: '2026-04-27', page: 1 })).toEqual({ records: [], total: 0 })
    } finally {
      db.close()
    }
  })
  it('validates exact IPC inputs and sender and redacts query failure details', async () => {
    const modulePath = '../../src/main/home-ipc'
    const { registerHomeIpc } = await import(modulePath)
    const handlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>()
    const query = {
      overview: vi.fn(() => {
        throw new Error('/private/db.sqlite SELECT secret')
      }),
      day: vi.fn()
    }
    const assertSender = vi.fn()
    registerHomeIpc({
      ipc: {
        removeHandler: vi.fn(),
        handle: (channel: string, handler: (event: unknown, ...args: unknown[]) => unknown) =>
          handlers.set(channel, handler)
      },
      service: new HomeService(query, clock),
      assertSender
    })
    const get = handlers.get('home:get')!,
      day = handlers.get('home:day')!
    expect(get({}, {})).toEqual({
      ok: false,
      error: { code: 'persistence-failed', message: 'MyTracer could not load Home facts.' }
    })
    for (const args of [[], [null], [[]], [{ extra: true }], [{}, {}]])
      expect(get({}, ...args)).toMatchObject({ ok: false, error: { code: 'validation' } })
    expect(day({}, { date: today, page: 1, extra: true })).toMatchObject({
      ok: false,
      error: { code: 'validation' }
    })
    expect(query.day).not.toHaveBeenCalled()
    assertSender.mockImplementation(() => {
      throw new Error('untrusted sender')
    })
    expect(() => get({}, {})).toThrow('untrusted sender')
    expect(query.overview).toHaveBeenCalledTimes(1)
  })
})
