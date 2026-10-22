import type Database from 'better-sqlite3'
import type { HomeQueryPort } from '../../application/home'
import type { HomeDayDto, HomeOverviewDto, HomeRecordDto } from '../../contracts/home'
import type { GoalSummaryDto } from '../../contracts/goals'

type FactKey = {
  id: string
  type: HomeRecordDto['type']
  occurredOn: string
  goalId: string | null
}
// Only keys and occurrence dates participate in aggregation/sorting. Text is read
// after LIMIT, never materialized as a full database snapshot in JavaScript/IPC.
const facts = `SELECT r.id, 'action-record' AS type, r.occurred_on AS occurredOn, a.goal_id AS goalId
 FROM action_records r JOIN actions a ON a.id = r.action_id
 UNION ALL SELECT r.id, 'routine-record' AS type, r.occurred_on AS occurredOn, a.goal_id AS goalId
 FROM routine_records r JOIN routines a ON a.id = r.routine_id`
const order = 'occurredOn DESC, type ASC, id ASC'
export class SqliteHomeQuery implements HomeQueryPort {
  constructor(private readonly database: Database.Database) {}
  private record(key: FactKey): HomeRecordDto {
    const row =
      key.type === 'action-record'
        ? this.database
            .prepare(
              `SELECT r.id, r.occurred_on AS occurredOn, a.title, a.goal_id AS goalId,
          COALESCE(NULLIF(r.note, ''), (SELECT u.text FROM understandings u WHERE u.action_record_id=r.id AND u.revoked_at IS NULL ORDER BY u.created_at, u.id LIMIT 1)) AS note,
          r.outcome, r.duration_minutes AS durationMinutes FROM action_records r JOIN actions a ON a.id=r.action_id WHERE r.id=?`
            )
            .get(key.id)
        : this.database
            .prepare(
              `SELECT r.id, r.occurred_on AS occurredOn, a.name AS title, a.goal_id AS goalId,
          r.note, r.outcome, r.duration_minutes AS durationMinutes FROM routine_records r JOIN routines a ON a.id=r.routine_id WHERE r.id=?`
            )
            .get(key.id)
    return { ...(row as Omit<HomeRecordDto, 'type'>), type: key.type }
  }
  overview(today: string, from: string): HomeOverviewDto {
    return this.database.transaction(() => {
      const goals = this.database
        .prepare(
          `WITH facts AS (${facts}), latest AS (
        SELECT goalId, MAX(occurredOn) AS lastDate FROM facts WHERE occurredOn <= ? AND goalId IS NOT NULL GROUP BY goalId
      ) SELECT g.id, g.title AS name, g.description, g.status, g.current_next_action_id AS currentNextActionId,
        g.created_at AS createdAt, g.updated_at AS updatedAt FROM goals g LEFT JOIN latest l ON l.goalId=g.id
        WHERE g.status='active' ORDER BY COALESCE(l.lastDate, '') DESC, g.updated_at DESC, g.id ASC LIMIT 3`
        )
        .all(today) as GoalSummaryDto[]
      const latestByGoal: HomeRecordDto[] = []
      const currentActions: HomeOverviewDto['currentActions'][number][] = []
      for (const goal of goals) {
        const key = this.database
          .prepare(
            `SELECT * FROM (${facts}) WHERE goalId=? AND occurredOn<=? ORDER BY ${order} LIMIT 1`
          )
          .get(goal.id, today) as FactKey | undefined
        if (key) latestByGoal.push(this.record(key))
        if (goal.currentNextActionId) {
          const action = this.database
            .prepare(
              'SELECT id, goal_id AS goalId, title, status FROM actions WHERE id=? AND goal_id=?'
            )
            .get(goal.currentNextActionId, goal.id) as
            HomeOverviewDto['currentActions'][number] | undefined
          if (action) currentActions.push(action)
        }
      }
      const recentKeys = this.database
        .prepare(`SELECT * FROM (${facts}) WHERE occurredOn<=? ORDER BY ${order} LIMIT 3`)
        .all(today) as FactKey[]
      const calendarCounts = this.database
        .prepare(
          `SELECT occurredOn AS date, COUNT(*) AS count FROM (${facts}) WHERE occurredOn BETWEEN ? AND ? GROUP BY occurredOn ORDER BY occurredOn LIMIT 182`
        )
        .all(from, today) as HomeOverviewDto['calendarCounts']
      const counts = this.database
        .prepare("SELECT COUNT(*) AS total, COALESCE(SUM(status='active'), 0) AS active FROM goals")
        .get() as { total: number; active: number }
      return {
        localDate: today,
        goals,
        activeGoalCount: counts.active,
        totalGoalCount: counts.total,
        latestByGoal,
        recentRecords: recentKeys.map((key) => this.record(key)),
        currentActions,
        calendarCounts
      }
    })()
  }
  day(date: string, page: number): HomeDayDto {
    return this.database.transaction(() => {
      const total = (
        this.database
          .prepare(`SELECT COUNT(*) AS count FROM (${facts}) WHERE occurredOn=?`)
          .get(date) as { count: number }
      ).count
      const keys = this.database
        .prepare(`SELECT * FROM (${facts}) WHERE occurredOn=? ORDER BY ${order} LIMIT 10 OFFSET ?`)
        .all(date, (page - 1) * 10) as FactKey[]
      return { total, records: keys.map((key) => this.record(key)) }
    })()
  }
}
