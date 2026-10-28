import { join } from 'node:path'
import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { GoalService } from '../../src/application/goals'
import { DataControlService } from '../../src/application/data-control'
import { TodayService } from '../../src/application/today'
import { buildCompleteExport, validateCompleteExport } from '../../src/application/complete-export'
import {
  asCompleteExportRepository,
  asDataControlRepository,
  type UnitOfWorkPort
} from '../../src/application/ports/persistence'
import { SqliteConnection } from '../../src/infrastructure/sqlite/sqlite-connection'
import { migrateToCurrentSchema } from '../../src/infrastructure/sqlite/migrations'
import initial from '../../src/infrastructure/sqlite/migrations/001_initial.sql?raw'
import second from '../../src/infrastructure/sqlite/migrations/002_add_routine_record_planned_for_date_basis.sql?raw'
import third from '../../src/infrastructure/sqlite/migrations/003_review_results_v3.sql?raw'
import fourth from '../../src/infrastructure/sqlite/migrations/004_unknown_action_duration.sql?raw'
import fifth from '../../src/infrastructure/sqlite/migrations/005_routine_arrangement.sql?raw'
import { FakeClock } from '../support/fake-clock'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

const instant = '2026-10-24T08:00:00.000Z'
async function setup() {
  const root = await createTemporaryTestRoot()
  const path = join(root.database, 'stages.sqlite3')
  const connection = SqliteConnection.open(path)
  let sequence = 0
  const dependencies = {
    repository: connection.repository,
    unitOfWork: connection,
    clock: new FakeClock({ instant, localDate: '2026-10-24', timeZone: 'UTC' }),
    generateId: () => `id-${++sequence}`
  }
  const goals = new GoalService(dependencies)
  const data = new DataControlService(dependencies)
  const old = goals.createGoal({
    name: '旧照片',
    description: '旧说明',
    initialNextAction: { title: '旧下一步' }
  })
  connection.repository.createTodaySelection({
    actionId: old.currentNextActionId!,
    selectedFor: '2026-10-24',
    kind: 'focus',
    selectedBy: 'user',
    createdAt: instant
  })
  data.backfillActionRecord({
    actionId: old.currentNextActionId!,
    occurredOn: '2026-10-01',
    durationMinutes: 4,
    outcome: 'partial',
    summary: null,
    note: '旧事实'
  })
  goals.endGoal(old.id)
  const stage = (id: string, predecessorGoalId = old.id) =>
    goals.createStage({ goalId: id, predecessorGoalId, name: `新相册 ${id}` })
  const remove = (id: string) => {
    const target = { type: 'goal' as const, id }
    return data.confirmDelete(target, data.previewDelete(target).fingerprint)
  }
  return {
    root,
    path,
    connection,
    dependencies,
    goals,
    data,
    old,
    stage,
    remove,
    close: async () => {
      connection.close()
      await removeTemporaryTestRoot(root)
    }
  }
}

describe('independent linked goal stages', () => {
  it('creates multiple successors, retries one draft exactly once, preserves history and never revives Today', async () => {
    const s = await setup()
    try {
      const before = s.connection.repository.readSnapshot()
      const first = s.stage('stage-a')
      expect(first).toMatchObject({
        id: 'stage-a',
        status: 'active',
        currentNextActionId: null,
        actions: [],
        records: [],
        previousStage: { id: s.old.id },
        subsequentStages: []
      })
      expect(s.stage('stage-a')).toEqual(first)
      s.stage('stage-b')
      expect(s.goals.getGoalDetail(s.old.id).subsequentStages.map((g) => g.id)).toEqual([
        'stage-a',
        'stage-b'
      ])
      s.goals.updateGoalDetails({ goalId: first.id, name: '独立改名', description: '新说明' })
      expect(s.goals.getGoalDetail(s.old.id)).toMatchObject({
        name: '旧照片',
        status: 'ended',
        description: '旧说明',
        currentNextActionId: s.old.currentNextActionId
      })
      expect(s.stage('stage-a').name).toBe('独立改名')
      const after = s.connection.repository.readSnapshot()
      expect(after.goals).toHaveLength(before.goals.length + 2)
      expect(after.goals.find((g) => g.id === s.old.id)).toEqual(before.goals[0])
      expect({ ...after, goals: [] }).toEqual({ ...before, goals: [] })
      expect(new TodayService(s.dependencies).getToday().focuses).toEqual([
        expect.objectContaining({
          id: s.old.currentNextActionId,
          canStart: false,
          canSelectForToday: false,
          unavailableReason: 'goal-ended'
        })
      ])
      expect(() => s.stage('bad', first.id)).toThrowError(
        expect.objectContaining({ code: 'invalid-transition' })
      )
      expect(() => s.stage(s.old.id)).toThrow()
      const ordinary = s.goals.createGoal({
        name: '普通目标',
        initialNextAction: { title: '普通下一步' }
      })
      expect(ordinary).toMatchObject({
        previousStage: null,
        currentNextAction: { title: '普通下一步' }
      })
      const reopened = SqliteConnection.open(s.path)
      try {
        expect(reopened.repository.readSnapshot()).toEqual(s.connection.repository.readSnapshot())
      } finally {
        reopened.close()
      }
    } finally {
      await s.close()
    }
  })

  it('counts both incident links and deletes only the middle stage without reparenting', async () => {
    const s = await setup()
    try {
      s.stage('middle')
      s.goals.endGoal('middle')
      s.stage('child', 'middle')
      s.stage('sibling')
      s.goals.createAndSetGoalCurrentNextAction({ goalId: 'child', title: '后续自己的行动' })
      const childActionId = s.goals.getGoalDetail('child').currentNextActionId!
      s.data.backfillActionRecord({
        actionId: childActionId,
        occurredOn: '2026-10-24',
        durationMinutes: 2,
        outcome: 'partial',
        summary: null,
        note: '后续自己的事实'
      })
      const childBefore = s.goals.getGoalDetail('child')
      const before = s.connection.repository.readSnapshot()
      const preview = s.data.previewDelete({ type: 'goal', id: 'middle' })
      expect(preview.counts.detachedGoalStages).toBe(2)
      expect(JSON.parse(preview.fingerprint).detachedGoalStages).toEqual([
        'child|middle',
        `middle|${s.old.id}`
      ])
      s.data.confirmDelete(preview.target, preview.fingerprint)
      expect(s.connection.repository.findGoalById('child')?.predecessorGoalId).toBeNull()
      expect(s.connection.repository.findGoalById('sibling')?.predecessorGoalId).toBe(s.old.id)
      expect(s.connection.repository.findGoalById(s.old.id)).toEqual(
        before.goals.find((g) => g.id === s.old.id)
      )
      expect(s.connection.repository.readSnapshot().actionRecords).toEqual(before.actionRecords)
      expect(s.goals.getGoalDetail('child').previousStage).toBeNull()
      expect(s.remove(s.old.id).detachedGoalStages).toBe(1)
      expect(s.connection.repository.findGoalById('sibling')?.predecessorGoalId).toBeNull()
      expect(s.goals.getGoalDetail('child')).toEqual({ ...childBefore, previousStage: null })
    } finally {
      await s.close()
    }
  })

  it('revalidates links after preview and predecessor existence at the create transaction boundary', async () => {
    const s = await setup()
    try {
      const target = { type: 'goal' as const, id: s.old.id }
      const before = s.data.previewDelete(target)
      s.stage('new-link')
      expect(() => s.data.confirmDelete(target, before.fingerprint)).toThrowError(
        expect.objectContaining({ code: 'delete-preview-stale' })
      )
      const stale = s.data.previewDelete(target)
      s.remove('new-link')
      expect(() => s.data.confirmDelete(target, stale.fingerprint)).toThrowError(
        expect.objectContaining({ code: 'delete-preview-stale' })
      )
      const race: UnitOfWorkPort = {
        transaction: (work) => {
          s.remove(s.old.id)
          return s.connection.transaction(work)
        }
      }
      const goals = new GoalService({ ...s.dependencies, unitOfWork: race })
      expect(() =>
        goals.createStage({ goalId: 'race', predecessorGoalId: s.old.id, name: '新阶段' })
      ).toThrowError(expect.objectContaining({ code: 'not-found' }))
      expect(s.connection.repository.findGoalById('race')).toBeNull()
      expect(() => s.data.previewDelete(target)).toThrowError(
        expect.objectContaining({ code: 'not-found' })
      )
      expect(() => s.stage('retry')).toThrow()
    } finally {
      await s.close()
    }
  })

  it('rejects a concurrent deletion committed after the predecessor read, then retries without an orphan', async () => {
    const s = await setup()
    const other = SqliteConnection.open(s.path)
    try {
      const data = new DataControlService({
        ...s.dependencies,
        repository: other.repository,
        unitOfWork: other
      })
      const target = { type: 'goal' as const, id: s.old.id }
      const preview = data.previewDelete(target)
      let injected = false
      const race: UnitOfWorkPort = {
        transaction: (work) =>
          s.connection.transaction((repository) =>
            work(
              new Proxy(repository, {
                get(base, key) {
                  if (key === 'findGoalById')
                    return (id: string) => {
                      const found = base.findGoalById(id)
                      if (id === s.old.id && !injected) {
                        injected = true
                        data.confirmDelete(target, preview.fingerprint)
                      }
                      return found
                    }
                  const value = Reflect.get(base, key)
                  return typeof value === 'function' ? value.bind(base) : value
                }
              })
            )
          )
      }
      const goals = new GoalService({ ...s.dependencies, unitOfWork: race })
      expect(() =>
        goals.createStage({ goalId: 'race', predecessorGoalId: s.old.id, name: '新阶段' })
      ).toThrow()
      expect(injected).toBe(true)
      expect(s.connection.repository.findGoalById(s.old.id)).toBeNull()
      expect(s.connection.repository.findGoalById('race')).toBeNull()
      expect(() => s.stage('race')).toThrowError(expect.objectContaining({ code: 'not-found' }))
    } finally {
      other.close()
      await s.close()
    }
  })

  it('rolls back deletion when an unexpected stage relationship is detached', async () => {
    const s = await setup()
    try {
      s.stage('first')
      s.stage('second')
      s.goals.endGoal('second')
      s.stage('grandchild', 'second')
      const repository = asDataControlRepository(s.connection.repository)
      const db = new Database(s.path)
      db.exec(
        "CREATE TRIGGER extra_detach AFTER DELETE ON goals WHEN OLD.id = 'first' BEGIN UPDATE goals SET predecessor_goal_id = NULL WHERE id = 'grandchild'; END"
      )
      db.close()
      const before = s.connection.repository.readSnapshot()
      expect(() => s.remove('first')).toThrowError(
        expect.objectContaining({ code: 'invariant-violation' })
      )
      expect(s.connection.repository.readSnapshot()).toEqual(before)
      expect(repository.deleteRoot).toBeDefined()
    } finally {
      await s.close()
    }
  })

  it('exports v5 strict fields/relations and retains all four old format validators', async () => {
    const s = await setup()
    try {
      s.stage('next')
      const document = buildCompleteExport(
        asCompleteExportRepository(s.connection.repository).readCompleteCoreSnapshot(),
        s.dependencies.clock
      )
      expect(document).toMatchObject({ exportVersion: 7, sourceDataVersion: 9 })
      expect(() => validateCompleteExport(JSON.parse(JSON.stringify(document)))).not.toThrow()
      for (const predecessorGoalId of ['missing', 'next', undefined, 123]) {
        const bad = structuredClone(document)
        Object.assign(
          bad.data.goals.find((g) => g.id === 'next')!,
          { predecessorGoalId }
        )
        expect(() => validateCompleteExport(bad)).toThrow()
      }
      const activePrevious = structuredClone(document)
      Object.assign(
        activePrevious.data.goals.find((g) => g.id === s.old.id)!,
        { status: 'active' }
      )
      expect(() => validateCompleteExport(activePrevious)).toThrow()
      const missingField = JSON.parse(JSON.stringify(document))
      delete missingField.data.goals[0].predecessorGoalId
      expect(() => validateCompleteExport(missingField)).toThrow()
      const cycle = structuredClone(document)
      for (const goal of cycle.data.goals)
        Object.assign(goal, {
          status: 'ended',
          predecessorGoalId: goal.id === 'next' ? s.old.id : 'next'
        })
      expect(() => validateCompleteExport(cycle)).toThrow()
      expect(() => validateCompleteExport({ ...document, sourceDataVersion: 5 })).toThrow()
      const goals = document.data.goals.map(({ predecessorGoalId, ...goal }) => {
        expect(predecessorGoalId === null || predecessorGoalId === s.old.id).toBe(true)
        return goal
      })
      const { thoughts, ...preThoughtData } = document.data
      expect(thoughts).toEqual([])
      for (const exportVersion of [1, 2, 3, 4]) {
        const legacy = {
          ...document,
          exportVersion,
          sourceDataVersion: exportVersion + 1,
          data: {
            ...preThoughtData,
            goals,
            actionRecords: document.data.actionRecords.map(({ summary, ...record }) => {
              expect(summary).toBeNull()
              return record
            }),
            routineRecords: []
          }
        }
        expect(() => validateCompleteExport(legacy)).not.toThrow()
        expect(() => validateCompleteExport({ ...legacy, data: document.data })).toThrow()
      }
    } finally {
      await s.close()
    }
  })
})

it('migrates v5 preserving every old field and fact, and rolls back a failed v6 migration', () => {
  for (const fail of [false, true]) {
    const db = new Database(':memory:')
    try {
      db.pragma('foreign_keys = ON')
      for (const sql of [initial, second, third, fourth, fifth]) db.exec(sql)
      db.prepare("INSERT INTO metadata VALUES ('schemaVersion', '5')").run()
      db.prepare(
        "INSERT INTO goals (id,title,description,status,current_next_action_id,created_at,updated_at) VALUES ('old','旧标题','说明','ended',NULL,?,?)"
      ).run(instant, instant)
      db.prepare("INSERT INTO actions VALUES ('action','old','旧行动',NULL,'pending',?,?)").run(
        instant,
        instant
      )
      db.prepare("UPDATE goals SET current_next_action_id = 'action' WHERE id = 'old'").run()
      db.prepare(
        "INSERT INTO action_records (id,action_id,occurred_on,duration_minutes,outcome,next_step,note,created_at,updated_at) VALUES ('record','action','2026-10-01',NULL,'partial','旧下一步','旧事实',?,?)"
      ).run(instant, instant)
      const tables = (
        db
          .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
          .all() as { name: string }[]
      ).map((row) => row.name)
      const before = Object.fromEntries(
        tables.map((name) => [name, db.prepare(`SELECT * FROM ${name}`).all()])
      )
      if (fail)
        db.exec(
          "CREATE TRIGGER stop_v6 BEFORE UPDATE ON metadata WHEN NEW.value='6' BEGIN SELECT RAISE(ABORT,'injected failure'); END"
        )
      if (fail) {
        expect(() => migrateToCurrentSchema(db)).toThrow(/injected failure/)
        for (const name of tables)
          expect(db.prepare(`SELECT * FROM ${name}`).all()).toEqual(before[name])
        expect(
          db
            .prepare("SELECT name FROM pragma_table_info('goals') WHERE name='predecessor_goal_id'")
            .all()
        ).toEqual([])
      } else {
        migrateToCurrentSchema(db)
        for (const name of tables.filter((name) => name !== 'metadata' && name !== 'goals'))
          expect(db.prepare(`SELECT * FROM ${name}`).all()).toEqual(
            ['action_records', 'routine_records'].includes(name)
              ? (before[name] as object[]).map((row) => ({ ...row, summary: null }))
              : before[name]
          )
        expect(db.prepare('SELECT * FROM goals').all()).toEqual(
          (before.goals as object[]).map((g) => ({ ...g, predecessor_goal_id: null }))
        )
        expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
        expect(() =>
          db
            .prepare(
              "INSERT INTO goals (id,title,status,created_at,updated_at,predecessor_goal_id) VALUES ('self','self','ended',?,?,'self')"
            )
            .run(instant, instant)
        ).toThrow()
        migrateToCurrentSchema(db)
      }
    } finally {
      db.close()
    }
  }
})
