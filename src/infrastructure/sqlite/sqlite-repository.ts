import type Database from 'better-sqlite3'
import type {
  ActionPersistenceRecord,
  ActionRepositoryPort,
  ActionRecordPersistenceRecord,
  ConfusionPersistenceRecord,
  CorePersistenceSnapshot,
  GoalActionRecordSummaryPersistenceRecord,
  GoalPersistenceRecord,
  GoalStatus,
  ReviewResultPersistenceRecord,
  RoutinePersistenceRecord,
  RoutineRecordPersistenceRecord,
  RoutineScheduleDayPersistenceRecord,
  TodaySelectionPersistenceRecord,
  UnderstandingPersistenceRecord
} from '../../application/ports/persistence'

type Row = Readonly<Record<string, unknown>>

const asString = (row: Row, name: string): string => String(row[name])
const asNullableString = (row: Row, name: string): string | null =>
  row[name] === null ? null : asString(row, name)

export class SqliteRepository implements ActionRepositoryPort {
  constructor(private readonly database: Database.Database) {}

  saveGoal(record: GoalPersistenceRecord): void {
    this.database
      .prepare(
        `INSERT INTO goals (id, title, description, status, current_next_action_id, created_at, updated_at)
         VALUES (@id, @title, @description, @status, @currentNextActionId, @createdAt, @updatedAt)
         ON CONFLICT(id) DO UPDATE SET title = excluded.title, description = excluded.description,
           status = excluded.status, current_next_action_id = excluded.current_next_action_id,
           updated_at = excluded.updated_at`
      )
      .run(record)
  }

  saveAction(record: ActionPersistenceRecord): void {
    this.database
      .prepare(
        `INSERT INTO actions (id, goal_id, title, description, status, created_at, updated_at)
         VALUES (@id, @goalId, @title, @description, @status, @createdAt, @updatedAt)
         ON CONFLICT(id) DO UPDATE SET goal_id = excluded.goal_id, title = excluded.title,
           description = excluded.description, status = excluded.status, updated_at = excluded.updated_at`
      )
      .run(record)
  }

  saveRoutine(record: RoutinePersistenceRecord): void {
    this.database
      .prepare(
        `INSERT INTO routines (id, goal_id, name, minimum_action, description, status, created_at, updated_at)
         VALUES (@id, @goalId, @name, @minimumAction, @description, @status, @createdAt, @updatedAt)
         ON CONFLICT(id) DO UPDATE SET goal_id = excluded.goal_id, name = excluded.name,
           minimum_action = excluded.minimum_action, description = excluded.description,
           status = excluded.status, updated_at = excluded.updated_at`
      )
      .run(record)
  }

  saveRoutineScheduleDay(record: RoutineScheduleDayPersistenceRecord): void {
    this.database
      .prepare(
        `INSERT INTO routine_schedule_days (routine_id, weekday) VALUES (@routineId, @weekday)
         ON CONFLICT(routine_id, weekday) DO NOTHING`
      )
      .run(record)
  }

  saveTodaySelection(record: TodaySelectionPersistenceRecord): void {
    this.database
      .prepare(
        `INSERT INTO today_selections (action_id, selected_for, kind, selected_by, created_at)
         VALUES (@actionId, @selectedFor, @kind, @selectedBy, @createdAt)
         ON CONFLICT(action_id, selected_for) DO UPDATE SET kind = excluded.kind,
           selected_by = excluded.selected_by, created_at = excluded.created_at`
      )
      .run(record)
  }

  saveActionRecord(record: ActionRecordPersistenceRecord): void {
    this.database
      .prepare(
        `INSERT INTO action_records (id, action_id, occurred_on, duration_minutes, outcome, next_step, note, created_at, updated_at)
         VALUES (@id, @actionId, @occurredOn, @durationMinutes, @outcome, @nextStep, @note, @createdAt, @updatedAt)
         ON CONFLICT(id) DO UPDATE SET action_id = excluded.action_id, occurred_on = excluded.occurred_on,
           duration_minutes = excluded.duration_minutes, outcome = excluded.outcome, next_step = excluded.next_step,
           note = excluded.note, updated_at = excluded.updated_at`
      )
      .run(record)
  }

  saveRoutineRecord(record: RoutineRecordPersistenceRecord): void {
    this.database
      .prepare(
        `INSERT INTO routine_records (id, routine_id, occurred_on, outcome, planned_for_date, duration_minutes, note, created_at, updated_at)
         VALUES (@id, @routineId, @occurredOn, @outcome, @plannedForDate, @durationMinutes, @note, @createdAt, @updatedAt)
         ON CONFLICT(id) DO UPDATE SET routine_id = excluded.routine_id, occurred_on = excluded.occurred_on,
           outcome = excluded.outcome, planned_for_date = excluded.planned_for_date,
           duration_minutes = excluded.duration_minutes, note = excluded.note, updated_at = excluded.updated_at`
      )
      .run({ ...record, plannedForDate: record.plannedForDate ? 1 : 0 })
  }

  saveUnderstanding(record: UnderstandingPersistenceRecord): void {
    this.database
      .prepare(
        `INSERT INTO understandings (id, action_record_id, text, source, revoked_at, created_at, updated_at)
         VALUES (@id, @actionRecordId, @text, @source, @revokedAt, @createdAt, @updatedAt)
         ON CONFLICT(id) DO UPDATE SET action_record_id = excluded.action_record_id, text = excluded.text,
           source = excluded.source, revoked_at = excluded.revoked_at, updated_at = excluded.updated_at`
      )
      .run(record)
  }

  saveConfusion(record: ConfusionPersistenceRecord): void {
    this.database
      .prepare(
        `INSERT INTO confusions (id, action_record_id, text, status, resolved_at, resolution, created_at, updated_at)
         VALUES (@id, @actionRecordId, @text, @status, @resolvedAt, @resolution, @createdAt, @updatedAt)
         ON CONFLICT(id) DO UPDATE SET action_record_id = excluded.action_record_id, text = excluded.text,
           status = excluded.status, resolved_at = excluded.resolved_at, resolution = excluded.resolution,
           updated_at = excluded.updated_at`
      )
      .run(record)
  }

  saveReviewResult(record: ReviewResultPersistenceRecord): void {
    this.database
      .prepare(
        `INSERT INTO review_results (id, period_started_on, summary, adjustment, next_focus, goal_id, created_at, updated_at)
         VALUES (@id, @periodStartedOn, @summary, @adjustment, @nextFocus, @goalId, @createdAt, @updatedAt)
         ON CONFLICT(id) DO UPDATE SET period_started_on = excluded.period_started_on,
           summary = excluded.summary, adjustment = excluded.adjustment, next_focus = excluded.next_focus,
           goal_id = excluded.goal_id, updated_at = excluded.updated_at`
      )
      .run(record)
  }

  findGoalById(id: string): GoalPersistenceRecord | null {
    const row = this.database.prepare('SELECT * FROM goals WHERE id = ?').get(id) as Row | undefined
    return row ? this.goalFromRow(row) : null
  }

  findActionById(id: string): ActionPersistenceRecord | null {
    const row = this.database.prepare('SELECT * FROM actions WHERE id = ?').get(id) as
      Row | undefined
    return row ? this.actionFromRow(row) : null
  }

  findTodaySelection(
    actionId: string,
    selectedFor: string
  ): TodaySelectionPersistenceRecord | null {
    const row = this.database
      .prepare('SELECT * FROM today_selections WHERE action_id = ? AND selected_for = ?')
      .get(actionId, selectedFor) as Row | undefined
    return row ? this.todaySelectionFromRow(row) : null
  }

  listGoals(status?: GoalStatus): readonly GoalPersistenceRecord[] {
    const rows = status
      ? (this.database
          .prepare('SELECT * FROM goals WHERE status = ? ORDER BY created_at ASC, id ASC')
          .all(status) as readonly Row[])
      : this.rows('SELECT * FROM goals ORDER BY created_at ASC, id ASC')
    return rows.map((row) => this.goalFromRow(row))
  }

  listActions(): readonly ActionPersistenceRecord[] {
    return this.rows('SELECT * FROM actions ORDER BY created_at ASC, id ASC').map((row) =>
      this.actionFromRow(row)
    )
  }

  listActionsByGoalId(goalId: string): readonly ActionPersistenceRecord[] {
    return (
      this.database
        .prepare('SELECT * FROM actions WHERE goal_id = ? ORDER BY created_at ASC, id ASC')
        .all(goalId) as readonly Row[]
    ).map((row) => this.actionFromRow(row))
  }

  listTodaySelectionsOn(selectedFor: string): readonly TodaySelectionPersistenceRecord[] {
    return (
      this.database
        .prepare(
          'SELECT * FROM today_selections WHERE selected_for = ? ORDER BY created_at ASC, action_id ASC'
        )
        .all(selectedFor) as readonly Row[]
    ).map((row) => this.todaySelectionFromRow(row))
  }

  listActionRecordSummariesByGoalId(
    goalId: string
  ): readonly GoalActionRecordSummaryPersistenceRecord[] {
    const rows = this.database
      .prepare(
        `SELECT records.*, actions.title AS action_title
         FROM action_records AS records
         INNER JOIN actions ON actions.id = records.action_id
         WHERE actions.goal_id = ?
         ORDER BY records.occurred_on DESC, records.created_at DESC, records.id ASC`
      )
      .all(goalId) as readonly Row[]

    return rows.map((row) => ({
      id: asString(row, 'id'),
      actionId: asString(row, 'action_id'),
      actionTitle: asString(row, 'action_title'),
      occurredOn: asString(row, 'occurred_on'),
      durationMinutes: Number(row.duration_minutes),
      outcome: asString(row, 'outcome') as ActionRecordPersistenceRecord['outcome'],
      nextStep: asNullableString(row, 'next_step'),
      note: asNullableString(row, 'note'),
      createdAt: asString(row, 'created_at')
    }))
  }

  listTodaySelectionActionIdsByGoalIdOn(goalId: string, selectedFor: string): readonly string[] {
    return (
      this.database
        .prepare(
          `SELECT selections.action_id
           FROM today_selections AS selections
           INNER JOIN actions ON actions.id = selections.action_id
           WHERE actions.goal_id = ? AND selections.selected_for = ?
           ORDER BY selections.action_id ASC`
        )
        .all(goalId, selectedFor) as readonly Row[]
    ).map((row) => asString(row, 'action_id'))
  }

  deleteTodaySelection(actionId: string, selectedFor: string): void {
    this.database
      .prepare('DELETE FROM today_selections WHERE action_id = ? AND selected_for = ?')
      .run(actionId, selectedFor)
  }

  readSnapshot(): CorePersistenceSnapshot {
    return {
      goals: this.rows('SELECT * FROM goals ORDER BY id').map((row) => this.goalFromRow(row)),
      actions: this.rows('SELECT * FROM actions ORDER BY id').map((row) => this.actionFromRow(row)),
      routines: this.rows('SELECT * FROM routines ORDER BY id').map((row) => ({
        id: asString(row, 'id'),
        goalId: asNullableString(row, 'goal_id'),
        name: asString(row, 'name'),
        minimumAction: asString(row, 'minimum_action'),
        description: asNullableString(row, 'description'),
        status: asString(row, 'status') as RoutinePersistenceRecord['status'],
        createdAt: asString(row, 'created_at'),
        updatedAt: asString(row, 'updated_at')
      })),
      routineScheduleDays: this.rows(
        'SELECT * FROM routine_schedule_days ORDER BY routine_id, weekday'
      ).map((row) => ({
        routineId: asString(row, 'routine_id'),
        weekday: Number(row.weekday)
      })),
      todaySelections: this.rows(
        'SELECT * FROM today_selections ORDER BY selected_for, action_id'
      ).map((row) => ({
        actionId: asString(row, 'action_id'),
        selectedFor: asString(row, 'selected_for'),
        kind: asString(row, 'kind') as TodaySelectionPersistenceRecord['kind'],
        selectedBy: asString(row, 'selected_by') as 'user',
        createdAt: asString(row, 'created_at')
      })),
      actionRecords: this.rows('SELECT * FROM action_records ORDER BY occurred_on, id').map(
        (row) => ({
          id: asString(row, 'id'),
          actionId: asString(row, 'action_id'),
          occurredOn: asString(row, 'occurred_on'),
          durationMinutes: Number(row.duration_minutes),
          outcome: asString(row, 'outcome') as ActionRecordPersistenceRecord['outcome'],
          nextStep: asNullableString(row, 'next_step'),
          note: asNullableString(row, 'note'),
          createdAt: asString(row, 'created_at'),
          updatedAt: asString(row, 'updated_at')
        })
      ),
      routineRecords: this.rows('SELECT * FROM routine_records ORDER BY occurred_on, id').map(
        (row) => ({
          id: asString(row, 'id'),
          routineId: asString(row, 'routine_id'),
          occurredOn: asString(row, 'occurred_on'),
          outcome: asString(row, 'outcome') as RoutineRecordPersistenceRecord['outcome'],
          plannedForDate: Number(row.planned_for_date) === 1,
          durationMinutes: row.duration_minutes === null ? null : Number(row.duration_minutes),
          note: asNullableString(row, 'note'),
          createdAt: asString(row, 'created_at'),
          updatedAt: asString(row, 'updated_at')
        })
      ),
      understandings: this.rows('SELECT * FROM understandings ORDER BY id').map((row) => ({
        id: asString(row, 'id'),
        actionRecordId: asString(row, 'action_record_id'),
        text: asString(row, 'text'),
        source: asString(row, 'source') as UnderstandingPersistenceRecord['source'],
        revokedAt: asNullableString(row, 'revoked_at'),
        createdAt: asString(row, 'created_at'),
        updatedAt: asString(row, 'updated_at')
      })),
      confusions: this.rows('SELECT * FROM confusions ORDER BY id').map((row) => ({
        id: asString(row, 'id'),
        actionRecordId: asString(row, 'action_record_id'),
        text: asString(row, 'text'),
        status: asString(row, 'status') as ConfusionPersistenceRecord['status'],
        resolvedAt: asNullableString(row, 'resolved_at'),
        resolution: asNullableString(row, 'resolution'),
        createdAt: asString(row, 'created_at'),
        updatedAt: asString(row, 'updated_at')
      })),
      reviewResults: this.rows('SELECT * FROM review_results ORDER BY period_started_on, id').map(
        (row) => ({
          id: asString(row, 'id'),
          periodStartedOn: asString(row, 'period_started_on'),
          summary: asString(row, 'summary'),
          adjustment: asString(row, 'adjustment'),
          nextFocus: asString(row, 'next_focus'),
          goalId: asNullableString(row, 'goal_id'),
          createdAt: asString(row, 'created_at'),
          updatedAt: asString(row, 'updated_at')
        })
      )
    }
  }

  private rows(sql: string): readonly Row[] {
    return this.database.prepare(sql).all() as readonly Row[]
  }

  private goalFromRow(row: Row): GoalPersistenceRecord {
    return {
      id: asString(row, 'id'),
      title: asString(row, 'title'),
      description: asNullableString(row, 'description'),
      status: asString(row, 'status') as GoalPersistenceRecord['status'],
      currentNextActionId: asNullableString(row, 'current_next_action_id'),
      createdAt: asString(row, 'created_at'),
      updatedAt: asString(row, 'updated_at')
    }
  }

  private actionFromRow(row: Row): ActionPersistenceRecord {
    return {
      id: asString(row, 'id'),
      goalId: asNullableString(row, 'goal_id'),
      title: asString(row, 'title'),
      description: asNullableString(row, 'description'),
      status: asString(row, 'status') as ActionPersistenceRecord['status'],
      createdAt: asString(row, 'created_at'),
      updatedAt: asString(row, 'updated_at')
    }
  }

  private todaySelectionFromRow(row: Row): TodaySelectionPersistenceRecord {
    return {
      actionId: asString(row, 'action_id'),
      selectedFor: asString(row, 'selected_for'),
      kind: asString(row, 'kind') as TodaySelectionPersistenceRecord['kind'],
      selectedBy: asString(row, 'selected_by') as 'user',
      createdAt: asString(row, 'created_at')
    }
  }
}
