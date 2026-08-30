import type Database from 'better-sqlite3'
import type {
  ActionPersistenceRecord,
  ActionRecordRepositoryPort,
  ActionRecordPersistenceRecord,
  ConfusionPersistenceRecord,
  CompleteCorePersistenceSnapshot,
  CorePersistenceSnapshot,
  DataControlRepositoryPort,
  GoalActionRecordSummaryPersistenceRecord,
  GoalPersistenceRecord,
  GoalStatus,
  ProgressQueryFilterPersistence,
  ProgressQueryRowPersistenceRecord,
  ProgressQuerySnapshotPersistence,
  RecoveryQuerySnapshotPersistence,
  ReviewQuerySnapshotPersistence,
  ReviewResultPersistenceRecord,
  RoutinePersistenceRecord,
  RoutineRecordPersistenceRecord,
  RoutineRecordRepositoryPort,
  RoutineProgressQueryRecordPersistence,
  RoutineScheduleDayPersistenceRecord,
  StartHelpActionRecordFactPersistence,
  StartHelpContextQueryPort,
  StartHelpContextQuerySnapshotPersistence,
  TodaySelectionPersistenceRecord,
  UnderstandingPersistenceRecord
} from '../../application/ports/persistence'
import type { DeleteImpact, DeleteTarget } from '../../domain/data-control'

type Row = Readonly<Record<string, unknown>>

const asString = (row: Row, name: string): string => String(row[name])
const asNullableString = (row: Row, name: string): string | null =>
  row[name] === null ? null : asString(row, name)

export class SqliteRepository
  implements
    ActionRecordRepositoryPort,
    RoutineRecordRepositoryPort,
    DataControlRepositoryPort,
    StartHelpContextQueryPort
{
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

  createTodaySelection(record: TodaySelectionPersistenceRecord): boolean {
    const result = this.database
      .prepare(
        `INSERT INTO today_selections (action_id, selected_for, kind, selected_by, created_at)
         VALUES (@actionId, @selectedFor, @kind, @selectedBy, @createdAt)
         ON CONFLICT(action_id, selected_for) DO NOTHING`
      )
      .run(record)
    return result.changes === 1
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

  createActionRecord(record: ActionRecordPersistenceRecord): boolean {
    const result = this.database
      .prepare(
        `INSERT INTO action_records (id, action_id, occurred_on, duration_minutes, outcome, next_step, note, created_at, updated_at)
         VALUES (@id, @actionId, @occurredOn, @durationMinutes, @outcome, @nextStep, @note, @createdAt, @updatedAt)
         ON CONFLICT(id) DO NOTHING`
      )
      .run(record)
    return result.changes === 1
  }

  updateActionRecord(record: ActionRecordPersistenceRecord): boolean {
    const result = this.database
      .prepare(
        `UPDATE action_records SET occurred_on = @occurredOn, duration_minutes = @durationMinutes,
           outcome = @outcome, next_step = @nextStep, note = @note, updated_at = @updatedAt
         WHERE id = @id AND action_id = @actionId`
      )
      .run(record)
    return result.changes === 1
  }

  saveRoutineRecord(record: RoutineRecordPersistenceRecord): void {
    this.database
      .prepare(
        `INSERT INTO routine_records (id, routine_id, occurred_on, outcome, planned_for_date, planned_for_date_basis, duration_minutes, note, created_at, updated_at)
         VALUES (@id, @routineId, @occurredOn, @outcome, @plannedForDate, @plannedForDateBasis, @durationMinutes, @note, @createdAt, @updatedAt)
         ON CONFLICT(id) DO UPDATE SET routine_id = excluded.routine_id, occurred_on = excluded.occurred_on,
           outcome = excluded.outcome, planned_for_date = excluded.planned_for_date,
           planned_for_date_basis = excluded.planned_for_date_basis,
           duration_minutes = excluded.duration_minutes, note = excluded.note, updated_at = excluded.updated_at`
      )
      .run({ ...record, plannedForDate: record.plannedForDate ? 1 : 0 })
  }

  createRoutineRecord(record: RoutineRecordPersistenceRecord): boolean {
    try {
      this.database
        .prepare(
          `INSERT INTO routine_records (id, routine_id, occurred_on, outcome, planned_for_date, planned_for_date_basis, duration_minutes, note, created_at, updated_at)
           VALUES (@id, @routineId, @occurredOn, @outcome, @plannedForDate, @plannedForDateBasis, @durationMinutes, @note, @createdAt, @updatedAt)`
        )
        .run({ ...record, plannedForDate: record.plannedForDate ? 1 : 0 })
      return true
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
      if (
        code.startsWith('SQLITE_CONSTRAINT') &&
        this.findRoutineRecordByRoutineAndDate(record.routineId, record.occurredOn)
      ) {
        return false
      }
      throw error
    }
  }

  updateRoutineRecord(record: RoutineRecordPersistenceRecord): boolean {
    const result = this.database
      .prepare(
        `UPDATE routine_records SET occurred_on = @occurredOn, outcome = @outcome,
           planned_for_date = @plannedForDate, planned_for_date_basis = @plannedForDateBasis,
           duration_minutes = @durationMinutes, note = @note, updated_at = @updatedAt
         WHERE id = @id AND routine_id = @routineId`
      )
      .run({ ...record, plannedForDate: record.plannedForDate ? 1 : 0 })
    return result.changes === 1
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
        `INSERT INTO review_results (id, period_started_on, confirmed_progress, main_obstacle, next_adjustment, goal_id, created_at, updated_at)
         VALUES (@id, @periodStartedOn, @confirmedProgress, @mainObstacle, @nextAdjustment, @goalId, @createdAt, @updatedAt)
         ON CONFLICT(period_started_on) DO UPDATE SET
           confirmed_progress = excluded.confirmed_progress, main_obstacle = excluded.main_obstacle,
           next_adjustment = excluded.next_adjustment,
           goal_id = excluded.goal_id, updated_at = excluded.updated_at`
      )
      .run(record)
  }

  findReviewResultByPeriodStartedOn(periodStartedOn: string): ReviewResultPersistenceRecord | null {
    const row = this.database
      .prepare('SELECT * FROM review_results WHERE period_started_on = ?')
      .get(periodStartedOn) as Row | undefined
    return row ? this.reviewResultFromRow(row) : null
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

  findRoutineById(id: string): RoutinePersistenceRecord | null {
    const row = this.database.prepare('SELECT * FROM routines WHERE id = ?').get(id) as
      Row | undefined
    return row ? this.routineFromRow(row) : null
  }

  findActionRecordById(id: string): ActionRecordPersistenceRecord | null {
    const row = this.database.prepare('SELECT * FROM action_records WHERE id = ?').get(id) as
      Row | undefined
    return row ? this.actionRecordFromRow(row) : null
  }

  findRoutineRecordById(id: string): RoutineRecordPersistenceRecord | null {
    const row = this.database.prepare('SELECT * FROM routine_records WHERE id = ?').get(id) as
      Row | undefined
    return row ? this.routineRecordFromRow(row) : null
  }

  findUnderstandingById(id: string): UnderstandingPersistenceRecord | null {
    const row = this.database.prepare('SELECT * FROM understandings WHERE id = ?').get(id) as
      Row | undefined
    return row ? this.understandingFromRow(row) : null
  }

  updateUnderstanding(record: UnderstandingPersistenceRecord): boolean {
    const result = this.database
      .prepare(
        `UPDATE understandings SET text = @text, revoked_at = @revokedAt, updated_at = @updatedAt
         WHERE id = @id AND action_record_id = @actionRecordId`
      )
      .run(record)
    return result.changes === 1
  }

  findConfusionById(id: string): ConfusionPersistenceRecord | null {
    const row = this.database.prepare('SELECT * FROM confusions WHERE id = ?').get(id) as
      Row | undefined
    return row ? this.confusionFromRow(row) : null
  }

  updateConfusion(record: ConfusionPersistenceRecord): boolean {
    const result = this.database
      .prepare(
        `UPDATE confusions SET text = @text, status = @status, resolved_at = @resolvedAt,
           resolution = @resolution, updated_at = @updatedAt
         WHERE id = @id AND action_record_id = @actionRecordId`
      )
      .run(record)
    return result.changes === 1
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

  listRoutines(status?: RoutinePersistenceRecord['status']): readonly RoutinePersistenceRecord[] {
    const rows = status
      ? (this.database
          .prepare('SELECT * FROM routines WHERE status = ? ORDER BY created_at ASC, id ASC')
          .all(status) as readonly Row[])
      : this.rows('SELECT * FROM routines ORDER BY created_at ASC, id ASC')
    return rows.map((row) => this.routineFromRow(row))
  }

  listRoutineScheduleDays(routineId: string): readonly RoutineScheduleDayPersistenceRecord[] {
    return (
      this.database
        .prepare('SELECT * FROM routine_schedule_days WHERE routine_id = ? ORDER BY weekday ASC')
        .all(routineId) as readonly Row[]
    ).map((row) => ({ routineId: asString(row, 'routine_id'), weekday: Number(row.weekday) }))
  }

  replaceRoutineScheduleDays(
    routineId: string,
    records: readonly RoutineScheduleDayPersistenceRecord[]
  ): void {
    this.database.prepare('DELETE FROM routine_schedule_days WHERE routine_id = ?').run(routineId)
    for (const record of records) {
      this.saveRoutineScheduleDay(record)
    }
  }

  listActionsByGoalId(goalId: string): readonly ActionPersistenceRecord[] {
    return (
      this.database
        .prepare('SELECT * FROM actions WHERE goal_id = ? ORDER BY created_at ASC, id ASC')
        .all(goalId) as readonly Row[]
    ).map((row) => this.actionFromRow(row))
  }

  listActionRecordsByActionId(actionId: string): readonly ActionRecordPersistenceRecord[] {
    return (
      this.database
        .prepare(
          `SELECT * FROM action_records WHERE action_id = ?
           ORDER BY occurred_on DESC, created_at DESC, id ASC`
        )
        .all(actionId) as readonly Row[]
    ).map((row) => this.actionRecordFromRow(row))
  }

  listUnderstandingsByActionRecordId(
    actionRecordId: string
  ): readonly UnderstandingPersistenceRecord[] {
    return (
      this.database
        .prepare(
          `SELECT * FROM understandings WHERE action_record_id = ?
           ORDER BY created_at ASC, id ASC`
        )
        .all(actionRecordId) as readonly Row[]
    ).map((row) => ({
      id: asString(row, 'id'),
      actionRecordId: asString(row, 'action_record_id'),
      text: asString(row, 'text'),
      source: asString(row, 'source') as UnderstandingPersistenceRecord['source'],
      revokedAt: asNullableString(row, 'revoked_at'),
      createdAt: asString(row, 'created_at'),
      updatedAt: asString(row, 'updated_at')
    }))
  }

  listConfusionsByActionRecordId(actionRecordId: string): readonly ConfusionPersistenceRecord[] {
    return (
      this.database
        .prepare(
          `SELECT * FROM confusions WHERE action_record_id = ?
           ORDER BY created_at ASC, id ASC`
        )
        .all(actionRecordId) as readonly Row[]
    ).map((row) => ({
      id: asString(row, 'id'),
      actionRecordId: asString(row, 'action_record_id'),
      text: asString(row, 'text'),
      status: asString(row, 'status') as ConfusionPersistenceRecord['status'],
      resolvedAt: asNullableString(row, 'resolved_at'),
      resolution: asNullableString(row, 'resolution'),
      createdAt: asString(row, 'created_at'),
      updatedAt: asString(row, 'updated_at')
    }))
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
           WHERE actions.goal_id = ? AND selections.selected_for = ? AND selections.kind = 'focus'
           ORDER BY selections.action_id ASC`
        )
        .all(goalId, selectedFor) as readonly Row[]
    ).map((row) => asString(row, 'action_id'))
  }

  queryStartHelpContext(
    actionId: string,
    selectedFor: string
  ): StartHelpContextQuerySnapshotPersistence {
    return this.database.transaction(() => {
      const contextRow = this.database
        .prepare(
          `SELECT actions.id AS action_id, actions.goal_id AS action_goal_id,
             actions.title AS action_title, actions.description AS action_description,
             actions.status AS action_status, actions.created_at AS action_created_at,
             actions.updated_at AS action_updated_at,
             goals.id AS goal_id, goals.title AS goal_title,
             goals.description AS goal_description, goals.status AS goal_status,
             goals.current_next_action_id, goals.created_at AS goal_created_at,
             goals.updated_at AS goal_updated_at,
             selections.selected_for, selections.kind AS selection_kind,
             selections.selected_by, selections.created_at AS selection_created_at
           FROM actions
           INNER JOIN goals ON goals.id = actions.goal_id AND goals.status = 'active'
           INNER JOIN today_selections AS selections ON selections.action_id = actions.id
             AND selections.selected_for = @selectedFor
           WHERE actions.id = @actionId AND actions.status = 'pending'`
        )
        .get({ actionId, selectedFor }) as Row | undefined

      if (!contextRow) {
        return Object.freeze({
          goal: null,
          action: null,
          todaySelection: null,
          currentNextAction: null,
          records: Object.freeze([])
        })
      }

      const goal: GoalPersistenceRecord = Object.freeze({
        id: asString(contextRow, 'goal_id'),
        title: asString(contextRow, 'goal_title'),
        description: asNullableString(contextRow, 'goal_description'),
        status: asString(contextRow, 'goal_status') as GoalPersistenceRecord['status'],
        currentNextActionId: asNullableString(contextRow, 'current_next_action_id'),
        createdAt: asString(contextRow, 'goal_created_at'),
        updatedAt: asString(contextRow, 'goal_updated_at')
      })
      const action: ActionPersistenceRecord = Object.freeze({
        id: asString(contextRow, 'action_id'),
        goalId: asNullableString(contextRow, 'action_goal_id'),
        title: asString(contextRow, 'action_title'),
        description: asNullableString(contextRow, 'action_description'),
        status: asString(contextRow, 'action_status') as ActionPersistenceRecord['status'],
        createdAt: asString(contextRow, 'action_created_at'),
        updatedAt: asString(contextRow, 'action_updated_at')
      })
      const todaySelection: TodaySelectionPersistenceRecord = Object.freeze({
        actionId: action.id,
        selectedFor: asString(contextRow, 'selected_for'),
        kind: asString(contextRow, 'selection_kind') as TodaySelectionPersistenceRecord['kind'],
        selectedBy: asString(contextRow, 'selected_by') as 'user',
        createdAt: asString(contextRow, 'selection_created_at')
      })

      const currentNextAction =
        goal.currentNextActionId && goal.currentNextActionId !== action.id
          ? this.currentNextActionForGoal(goal.currentNextActionId, goal.id)
          : null

      const recordRows = this.database
        .prepare(
          `SELECT records.id, records.action_id, records.occurred_on,
             records.duration_minutes, records.outcome, records.next_step,
             records.created_at
           FROM action_records AS records
           INNER JOIN actions ON actions.id = records.action_id
           WHERE actions.goal_id = @goalId
           ORDER BY records.occurred_on DESC, records.created_at DESC, records.id ASC`
        )
        .all({ goalId: goal.id }) as readonly Row[]

      const records = recordRows.map((row): StartHelpActionRecordFactPersistence => {
        const recordId = asString(row, 'id')
        const understandings = (
          this.database
            .prepare(
              `SELECT id, text FROM understandings
               WHERE action_record_id = ? AND revoked_at IS NULL
               ORDER BY created_at ASC, id ASC`
            )
            .all(recordId) as readonly Row[]
        ).map((item) => Object.freeze({ id: asString(item, 'id'), text: asString(item, 'text') }))
        const confusions = (
          this.database
            .prepare(
              `SELECT id, text FROM confusions
               WHERE action_record_id = ? AND status = 'open'
               ORDER BY created_at ASC, id ASC`
            )
            .all(recordId) as readonly Row[]
        ).map((item) => Object.freeze({ id: asString(item, 'id'), text: asString(item, 'text') }))

        return Object.freeze({
          id: recordId,
          actionId: asString(row, 'action_id'),
          occurredOn: asString(row, 'occurred_on'),
          durationMinutes: Number(row.duration_minutes),
          outcome: asString(row, 'outcome') as ActionRecordPersistenceRecord['outcome'],
          nextStep: asNullableString(row, 'next_step'),
          createdAt: asString(row, 'created_at'),
          understandings: Object.freeze(understandings),
          confusions: Object.freeze(confusions)
        })
      })

      return Object.freeze({
        goal,
        action,
        todaySelection,
        currentNextAction,
        records: Object.freeze(records)
      })
    })()
  }

  private currentNextActionForGoal(
    actionId: string,
    goalId: string
  ): ActionPersistenceRecord | null {
    const row = this.database
      .prepare(
        `SELECT * FROM actions
         WHERE id = @actionId AND goal_id = @goalId AND status = 'pending'`
      )
      .get({ actionId, goalId }) as Row | undefined
    return row ? this.actionFromRow(row) : null
  }

  queryProgressSnapshot(filter: ProgressQueryFilterPersistence): ProgressQuerySnapshotPersistence {
    return this.database.transaction(() =>
      Object.freeze({
        actionRows: this.queryActionProgressRows(filter),
        routineRecords: this.queryRoutineProgressRecords(filter)
      })
    )()
  }

  queryRecoverySnapshot(goalId: string): RecoveryQuerySnapshotPersistence {
    return this.database.transaction(() => {
      const goal = this.findGoalById(goalId)
      return Object.freeze({
        goal,
        actions: goal ? this.listActionsByGoalId(goalId) : Object.freeze([]),
        progress: Object.freeze({
          actionRows: this.queryActionProgressRows({ goalId, from: null, through: null }),
          routineRecords: this.queryRoutineProgressRecords({ goalId, from: null, through: null })
        })
      })
    })()
  }

  queryReviewSummarySnapshot(
    periodStartedOn: string,
    periodEndedOn: string
  ): ReviewQuerySnapshotPersistence {
    return this.database.transaction(() =>
      Object.freeze({
        actionRows: this.queryActionProgressRows({
          goalId: null,
          from: periodStartedOn,
          through: periodEndedOn
        }),
        routineRecords: this.queryRoutineProgressRecords({
          goalId: null,
          from: periodStartedOn,
          through: periodEndedOn
        })
      })
    )()
  }

  private queryActionProgressRows(
    filter: ProgressQueryFilterPersistence
  ): readonly ProgressQueryRowPersistenceRecord[] {
    const rows = this.database
      .prepare(
        `SELECT records.id AS record_id, records.action_id, actions.goal_id,
           actions.title AS action_title, records.occurred_on, records.duration_minutes,
           records.outcome, records.created_at AS record_created_at,
           understandings.id AS understanding_id, understandings.text AS understanding_text,
           understandings.created_at AS understanding_created_at,
           confusions.id AS confusion_id, confusions.text AS confusion_text,
           confusions.created_at AS confusion_created_at
         FROM action_records AS records
         INNER JOIN actions ON actions.id = records.action_id
         LEFT JOIN understandings ON understandings.action_record_id = records.id
           AND understandings.revoked_at IS NULL
         LEFT JOIN confusions ON confusions.action_record_id = records.id
           AND confusions.status = 'open'
         WHERE (@goalId IS NULL OR actions.goal_id = @goalId)
           AND (@fromDate IS NULL OR records.occurred_on >= @fromDate)
           AND (@throughDate IS NULL OR records.occurred_on <= @throughDate)
         ORDER BY records.occurred_on DESC, records.created_at DESC, records.id ASC,
           understandings.created_at ASC, understandings.id ASC,
           confusions.created_at ASC, confusions.id ASC`
      )
      .all({
        goalId: filter.goalId,
        fromDate: filter.from,
        throughDate: filter.through
      }) as readonly Row[]

    return rows.map((row) => ({
      recordId: asString(row, 'record_id'),
      actionId: asString(row, 'action_id'),
      goalId: asNullableString(row, 'goal_id'),
      actionTitle: asString(row, 'action_title'),
      occurredOn: asString(row, 'occurred_on'),
      durationMinutes: Number(row.duration_minutes),
      outcome: asString(row, 'outcome') as ActionRecordPersistenceRecord['outcome'],
      recordCreatedAt: asString(row, 'record_created_at'),
      understandingId: asNullableString(row, 'understanding_id'),
      understandingText: asNullableString(row, 'understanding_text'),
      understandingCreatedAt: asNullableString(row, 'understanding_created_at'),
      confusionId: asNullableString(row, 'confusion_id'),
      confusionText: asNullableString(row, 'confusion_text'),
      confusionCreatedAt: asNullableString(row, 'confusion_created_at')
    }))
  }

  private queryRoutineProgressRecords(
    filter: ProgressQueryFilterPersistence
  ): readonly RoutineProgressQueryRecordPersistence[] {
    const rows = this.database
      .prepare(
        `SELECT records.id AS record_id, records.routine_id, routines.goal_id,
           routines.name AS routine_name, records.occurred_on, records.outcome,
           records.planned_for_date, records.duration_minutes, records.note,
           records.created_at AS record_created_at
         FROM routine_records AS records
         INNER JOIN routines ON routines.id = records.routine_id
         WHERE (@goalId IS NULL OR routines.goal_id = @goalId)
           AND (@fromDate IS NULL OR records.occurred_on >= @fromDate)
           AND (@throughDate IS NULL OR records.occurred_on <= @throughDate)
         ORDER BY records.occurred_on DESC, records.created_at DESC, records.id ASC`
      )
      .all({
        goalId: filter.goalId,
        fromDate: filter.from,
        throughDate: filter.through
      }) as readonly Row[]

    return rows.map((row) => ({
      recordId: asString(row, 'record_id'),
      routineId: asString(row, 'routine_id'),
      goalId: asNullableString(row, 'goal_id'),
      routineName: asString(row, 'routine_name'),
      occurredOn: asString(row, 'occurred_on'),
      outcome: asString(row, 'outcome') as RoutineRecordPersistenceRecord['outcome'],
      plannedForDate: Number(row.planned_for_date) === 1,
      durationMinutes: row.duration_minutes === null ? null : Number(row.duration_minutes),
      note: asNullableString(row, 'note'),
      recordCreatedAt: asString(row, 'record_created_at')
    }))
  }

  findRoutineRecordByRoutineAndDate(
    routineId: string,
    occurredOn: string
  ): RoutineRecordPersistenceRecord | null {
    const row = this.database
      .prepare('SELECT * FROM routine_records WHERE routine_id = ? AND occurred_on = ?')
      .get(routineId, occurredOn) as Row | undefined
    return row ? this.routineRecordFromRow(row) : null
  }

  listRoutineRecordsByRoutineId(routineId: string): readonly RoutineRecordPersistenceRecord[] {
    return (
      this.database
        .prepare(
          `SELECT * FROM routine_records WHERE routine_id = ?
           ORDER BY occurred_on DESC, created_at DESC, id ASC`
        )
        .all(routineId) as readonly Row[]
    ).map((row) => this.routineRecordFromRow(row))
  }

  deleteTodaySelection(actionId: string, selectedFor: string): void {
    this.database
      .prepare('DELETE FROM today_selections WHERE action_id = ? AND selected_for = ?')
      .run(actionId, selectedFor)
  }

  deleteTodaySelectionByKind(
    actionId: string,
    selectedFor: string,
    kind: TodaySelectionPersistenceRecord['kind']
  ): boolean {
    const result = this.database
      .prepare('DELETE FROM today_selections WHERE action_id = ? AND selected_for = ? AND kind = ?')
      .run(actionId, selectedFor, kind)
    return result.changes === 1
  }

  updateTodaySelectionCommitment(
    actionId: string,
    selectedFor: string,
    current: TodaySelectionPersistenceRecord['kind'],
    requested: TodaySelectionPersistenceRecord['kind']
  ): boolean {
    const result = this.database
      .prepare(
        `UPDATE today_selections SET kind = ?
         WHERE action_id = ? AND selected_for = ? AND kind = ?`
      )
      .run(requested, actionId, selectedFor, current)
    return result.changes === 1
  }

  findDeleteImpact(target: DeleteTarget): DeleteImpact | null {
    const existsTable =
      target.type === 'action-record'
        ? 'action_records'
        : target.type === 'routine-record'
          ? 'routine_records'
          : `${target.type}s`
    if (!this.database.prepare(`SELECT 1 FROM ${existsTable} WHERE id = ?`).get(target.id)) {
      return null
    }

    const goals = target.type === 'goal' ? [target.id] : []
    const actions =
      target.type === 'action'
        ? [target.id]
        : target.type === 'goal'
          ? this.stringColumn('SELECT id FROM actions WHERE goal_id = ?', target.id)
          : []
    const routines = target.type === 'routine' ? [target.id] : []
    const actionRecords =
      target.type === 'action-record'
        ? [target.id]
        : actions.length
          ? this.stringColumn(
              `SELECT id FROM action_records WHERE action_id IN (${actions.map(() => '?').join(',')})`,
              ...actions
            )
          : []
    const routineRecords =
      target.type === 'routine-record'
        ? [target.id]
        : routines.length
          ? this.stringColumn(
              `SELECT id FROM routine_records WHERE routine_id IN (${routines.map(() => '?').join(',')})`,
              ...routines
            )
          : []
    const understandings = actionRecords.length
      ? this.stringColumn(
          `SELECT id FROM understandings WHERE action_record_id IN (${actionRecords.map(() => '?').join(',')})`,
          ...actionRecords
        )
      : []
    const confusions = actionRecords.length
      ? this.stringColumn(
          `SELECT id FROM confusions WHERE action_record_id IN (${actionRecords.map(() => '?').join(',')})`,
          ...actionRecords
        )
      : []
    const todaySelections = actions.length
      ? (
          this.database
            .prepare(
              `SELECT action_id, selected_for FROM today_selections WHERE action_id IN (${actions.map(() => '?').join(',')})`
            )
            .all(...actions) as readonly Row[]
        ).map((row) => `${asString(row, 'action_id')}|${asString(row, 'selected_for')}`)
      : []
    const routineScheduleDays = routines.length
      ? (
          this.database
            .prepare(
              `SELECT routine_id, weekday FROM routine_schedule_days WHERE routine_id IN (${routines.map(() => '?').join(',')})`
            )
            .all(...routines) as readonly Row[]
        ).map((row) => `${asString(row, 'routine_id')}|${Number(row.weekday)}`)
      : []
    const detachedRoutines =
      target.type === 'goal'
        ? this.stringColumn('SELECT id FROM routines WHERE goal_id = ?', target.id).map(
            (id) => `${id}|${target.id}`
          )
        : []
    const detachedReviewResults =
      target.type === 'goal'
        ? this.stringColumn('SELECT id FROM review_results WHERE goal_id = ?', target.id).map(
            (id) => `${id}|${target.id}`
          )
        : []
    const clearedCurrentNext =
      target.type === 'action'
        ? this.stringColumn('SELECT id FROM goals WHERE current_next_action_id = ?', target.id).map(
            (id) => `${id}|${target.id}`
          )
        : []

    return {
      target,
      goals,
      actions,
      routines,
      routineScheduleDays,
      todaySelections,
      actionRecords,
      routineRecords,
      understandings,
      confusions,
      reviewResults: [],
      detachedRoutines,
      detachedReviewResults,
      clearedCurrentNext
    }
  }

  deleteRoot(target: DeleteTarget): boolean {
    const table =
      target.type === 'action-record'
        ? 'action_records'
        : target.type === 'routine-record'
          ? 'routine_records'
          : `${target.type}s`
    return this.database.prepare(`DELETE FROM ${table} WHERE id = ?`).run(target.id).changes === 1
  }

  readSnapshot(): CorePersistenceSnapshot {
    return this.readCoreSnapshot()
  }

  readCompleteCoreSnapshot(): CompleteCorePersistenceSnapshot {
    return this.database.transaction(() => {
      const version = this.database
        .prepare("SELECT value FROM metadata WHERE key = 'schemaVersion'")
        .get() as { readonly value?: unknown } | undefined
      if (typeof version?.value !== 'string' || !/^[1-9][0-9]*$/.test(version.value)) {
        throw new Error('SQLite metadata.schemaVersion is missing or invalid.')
      }
      return Object.freeze({
        sourceDataVersion: Number(version.value),
        coreSnapshot: this.freezeCoreSnapshot(this.readCoreSnapshot())
      })
    })()
  }

  private readCoreSnapshot(): CorePersistenceSnapshot {
    return {
      goals: this.rows('SELECT * FROM goals ORDER BY id').map((row) => this.goalFromRow(row)),
      actions: this.rows('SELECT * FROM actions ORDER BY id').map((row) => this.actionFromRow(row)),
      routines: this.rows('SELECT * FROM routines ORDER BY id').map((row) =>
        this.routineFromRow(row)
      ),
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
        (row) => this.routineRecordFromRow(row)
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
        (row) => this.reviewResultFromRow(row)
      )
    }
  }

  private freezeCoreSnapshot(snapshot: CorePersistenceSnapshot): CorePersistenceSnapshot {
    const freezeRows = <T extends object>(rows: readonly T[]): readonly T[] =>
      Object.freeze(rows.map((row) => Object.freeze({ ...row })))
    return Object.freeze({
      goals: freezeRows(snapshot.goals),
      actions: freezeRows(snapshot.actions),
      routines: freezeRows(snapshot.routines),
      routineScheduleDays: freezeRows(snapshot.routineScheduleDays),
      todaySelections: freezeRows(snapshot.todaySelections),
      actionRecords: freezeRows(snapshot.actionRecords),
      routineRecords: freezeRows(snapshot.routineRecords),
      understandings: freezeRows(snapshot.understandings),
      confusions: freezeRows(snapshot.confusions),
      reviewResults: freezeRows(snapshot.reviewResults)
    })
  }

  private rows(sql: string): readonly Row[] {
    return this.database.prepare(sql).all() as readonly Row[]
  }

  private stringColumn(sql: string, ...parameters: readonly unknown[]): string[] {
    return (this.database.prepare(sql).all(...parameters) as readonly Row[]).map((row) =>
      asString(row, 'id')
    )
  }

  private understandingFromRow(row: Row): UnderstandingPersistenceRecord {
    return {
      id: asString(row, 'id'),
      actionRecordId: asString(row, 'action_record_id'),
      text: asString(row, 'text'),
      source: asString(row, 'source') as UnderstandingPersistenceRecord['source'],
      revokedAt: asNullableString(row, 'revoked_at'),
      createdAt: asString(row, 'created_at'),
      updatedAt: asString(row, 'updated_at')
    }
  }

  private confusionFromRow(row: Row): ConfusionPersistenceRecord {
    return {
      id: asString(row, 'id'),
      actionRecordId: asString(row, 'action_record_id'),
      text: asString(row, 'text'),
      status: asString(row, 'status') as ConfusionPersistenceRecord['status'],
      resolvedAt: asNullableString(row, 'resolved_at'),
      resolution: asNullableString(row, 'resolution'),
      createdAt: asString(row, 'created_at'),
      updatedAt: asString(row, 'updated_at')
    }
  }

  private reviewResultFromRow(row: Row): ReviewResultPersistenceRecord {
    return {
      id: asString(row, 'id'),
      periodStartedOn: asString(row, 'period_started_on'),
      confirmedProgress: asString(row, 'confirmed_progress'),
      mainObstacle: asString(row, 'main_obstacle'),
      nextAdjustment: asString(row, 'next_adjustment'),
      goalId: asNullableString(row, 'goal_id'),
      createdAt: asString(row, 'created_at'),
      updatedAt: asString(row, 'updated_at')
    }
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

  private routineFromRow(row: Row): RoutinePersistenceRecord {
    return {
      id: asString(row, 'id'),
      goalId: asNullableString(row, 'goal_id'),
      name: asString(row, 'name'),
      minimumAction: asString(row, 'minimum_action'),
      description: asNullableString(row, 'description'),
      status: asString(row, 'status') as RoutinePersistenceRecord['status'],
      createdAt: asString(row, 'created_at'),
      updatedAt: asString(row, 'updated_at')
    }
  }

  private routineRecordFromRow(row: Row): RoutineRecordPersistenceRecord {
    return {
      id: asString(row, 'id'),
      routineId: asString(row, 'routine_id'),
      occurredOn: asString(row, 'occurred_on'),
      outcome: asString(row, 'outcome') as RoutineRecordPersistenceRecord['outcome'],
      plannedForDate: Number(row.planned_for_date) === 1,
      plannedForDateBasis: asString(
        row,
        'planned_for_date_basis'
      ) as RoutineRecordPersistenceRecord['plannedForDateBasis'],
      durationMinutes: row.duration_minutes === null ? null : Number(row.duration_minutes),
      note: asNullableString(row, 'note'),
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

  private actionRecordFromRow(row: Row): ActionRecordPersistenceRecord {
    return {
      id: asString(row, 'id'),
      actionId: asString(row, 'action_id'),
      occurredOn: asString(row, 'occurred_on'),
      durationMinutes: Number(row.duration_minutes),
      outcome: asString(row, 'outcome') as ActionRecordPersistenceRecord['outcome'],
      nextStep: asNullableString(row, 'next_step'),
      note: asNullableString(row, 'note'),
      createdAt: asString(row, 'created_at'),
      updatedAt: asString(row, 'updated_at')
    }
  }
}
