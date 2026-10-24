import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ActionService } from '../../src/application/actions'
import { CompleteExportService } from '../../src/application/complete-export'
import { DataControlApplicationError, DataControlService } from '../../src/application/data-control'
import { GoalService } from '../../src/application/goals'
import type { CompleteExportDocumentPort, ExportPort } from '../../src/application/ports/export'
import {
  asCompleteExportRepository,
  type CompleteCorePersistenceSnapshot
} from '../../src/application/ports/persistence'
import { ProgressService } from '../../src/application/progress'
import { RoutineService } from '../../src/application/routines'
import { TodayService } from '../../src/application/today'
import { SqliteConnection } from '../../src/infrastructure/sqlite/sqlite-connection'
import {
  observeAiDataCapabilityState,
  type AiDataCapabilityState,
  type AiFailureScenario
} from '../support/ai-data-capability-harness'
import { FakeClock } from '../support/fake-clock'
import {
  createTemporaryTestRoot,
  removeTemporaryTestRoot,
  type TemporaryTestRoot
} from '../support/temporary-test-root'

const roots: TemporaryTestRoot[] = []
const states: readonly AiDataCapabilityState[] = ['disabled', 'not-configured', 'failure']
const clock = () =>
  new FakeClock({
    instant: '2026-08-21T08:00:00.000Z',
    localDate: '2026-08-21',
    timeZone: 'Asia/Shanghai'
  })

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => removeTemporaryTestRoot(root)))
})

class CapturingExportPort implements ExportPort {
  public document: CompleteExportDocumentPort | null = null

  public async deliverCompleteExport(document: CompleteExportDocumentPort, suggestedName: string) {
    this.document = structuredClone(document)
    return {
      kind: 'exported' as const,
      fileName: suggestedName,
      byteLength: Buffer.byteLength(JSON.stringify(document), 'utf8')
    }
  }
}

function idGenerator(): () => string {
  let next = 0
  return () => `t033-${String(++next).padStart(3, '0')}`
}

async function runMatrix(state: AiDataCapabilityState) {
  const root = await createTemporaryTestRoot()
  roots.push(root)
  const databasePath = join(root.database, `t033-${state}.sqlite3`)
  let connection = SqliteConnection.open(databasePath)
  const fixedClock = clock()
  const generateId = idGenerator()
  const common = {
    repository: connection.repository,
    unitOfWork: connection,
    clock: fixedClock,
    generateId
  }

  const ai = await observeAiDataCapabilityState({
    state,
    readCoreSnapshot: () =>
      asCompleteExportRepository(connection.repository).readCompleteCoreSnapshot()
  })
  expect(ai.after).toEqual(ai.before)
  expect(ai.providerCalls).toBe(state === 'failure' ? 1 : 0)

  const goals = new GoalService(common)
  const actions = new ActionService(common)
  const routines = new RoutineService(common)
  const today = new TodayService(common)
  const data = new DataControlService(common)

  const goal = goals.createGoal({
    name: 'T033 Goal',
    description: 'data remains primary',
    initialNextAction: { title: 'First action' }
  })
  goals.updateGoalDetails({ goalId: goal.id, name: 'T033 Goal updated' })
  goals.pauseGoal(goal.id)
  goals.resumeGoal(goal.id)

  const action = actions.createAction({ goalId: goal.id, title: 'Focused action' })
  actions.updateActionDetails({ actionId: action.id, title: 'Focused action updated' })
  today.selectActionForToday(action.id)
  const intention = actions.createAction({ title: 'Intentional action' })
  today.selectActionAsIntentionForToday(intention.id)

  const routine = routines.createRoutine({
    arrangementMode: 'weekly' as const,
    goalId: goal.id,
    name: 'T033 Routine',
    minimumAction: 'One minute',
    weekdays: [1, 5]
  })
  routines.updateRoutineDetails({
    routineId: routine.id,
    name: 'T033 Routine updated',
    minimumAction: 'Two minutes'
  })
  routines.replaceRoutineSchedule({
    arrangementMode: 'weekly' as const,
    routineId: routine.id,
    weekdays: [2, 5]
  })
  routines.pauseRoutine(routine.id)
  routines.resumeRoutine(routine.id)

  const actionRecord = data.backfillActionRecord({
    actionId: action.id,
    occurredOn: '2026-08-20',
    durationMinutes: 12,
    outcome: 'partial',
    understanding: 'Manual understanding',
    confusion: 'Manual confusion'
  })
  data.updateActionRecord({
    recordId: actionRecord.id,
    occurredOn: '2026-08-20',
    durationMinutes: 15,
    outcome: 'partial',
    nextStep: 'Continue tomorrow'
  })
  const routineRecord = data.backfillRoutineRecord({
    routineId: routine.id,
    occurredOn: '2026-08-20',
    outcome: 'acted',
    plannedForDate: false,
    durationMinutes: 4
  })
  data.updateRoutineRecord({
    recordId: routineRecord.id,
    occurredOn: '2026-08-19',
    outcome: 'target_met',
    plannedForDate: true,
    durationMinutes: 5
  })

  let listed = data.listData()
  const understanding = listed.understandings[0]!
  const confusion = listed.confusions[0]!
  data.updateUnderstandingText(understanding.id, 'Manual understanding updated')
  data.revokeUnderstanding(understanding.id)
  data.updateConfusionText(confusion.id, 'Manual confusion updated')
  data.resolveConfusion(confusion.id, 'Resolved manually')
  data.reopenConfusion(confusion.id)

  const cancelledDelete = actions.createAction({ title: 'Keep after cancel' })
  data.previewDelete({ type: 'action', id: cancelledDelete.id })
  expect(data.listData().actions.some((item) => item.id === cancelledDelete.id)).toBe(true)

  const staleDelete = actions.createAction({ title: 'Keep after stale preview' })
  const stalePreview = data.previewDelete({ type: 'action', id: staleDelete.id })
  data.backfillActionRecord({
    actionId: staleDelete.id,
    occurredOn: '2026-08-18',
    durationMinutes: 1,
    outcome: 'stopped'
  })
  expect(() => data.confirmDelete(stalePreview.target, stalePreview.fingerprint)).toThrowError(
    DataControlApplicationError
  )
  expect(data.listData().actions.some((item) => item.id === staleDelete.id)).toBe(true)

  const confirmedDelete = actions.createAction({ title: 'Delete after confirmation' })
  const confirmedPreview = data.previewDelete({ type: 'action', id: confirmedDelete.id })
  const deleteCounts = data.confirmDelete(confirmedPreview.target, confirmedPreview.fingerprint)
  expect(deleteCounts.actions).toBe(1)

  const progress = new ProgressService({ repository: connection.repository }).getProgress({
    goalId: goal.id,
    from: '2026-08-18',
    through: '2026-08-21'
  })
  expect(progress.records).toHaveLength(1)
  expect(progress.routineRecords).toHaveLength(1)

  const exportPort = new CapturingExportPort()
  const exported = await new CompleteExportService({
    repository: connection.repository,
    clock: fixedClock,
    exportPort
  }).generateCompleteExport()
  expect(exported.kind).toBe('exported')
  expect(exportPort.document).not.toBeNull()
  expect(JSON.stringify(exportPort.document)).not.toContain('authentication')
  expect(JSON.stringify(exportPort.document)).not.toContain('__fake_ai_request_marker__')

  const beforeReopen = asCompleteExportRepository(connection.repository).readCompleteCoreSnapshot()
  connection.close()
  connection = SqliteConnection.open(databasePath)
  const afterReopen = asCompleteExportRepository(connection.repository).readCompleteCoreSnapshot()
  expect(afterReopen).toEqual(beforeReopen)
  listed = new DataControlService({
    repository: connection.repository,
    unitOfWork: connection,
    clock: fixedClock,
    generateId
  }).listData()
  connection.close()

  return {
    snapshot: afterReopen,
    today: {
      focus: todaySafe(beforeReopen, 'focus'),
      intention: todaySafe(beforeReopen, 'intention')
    },
    progress,
    export: exportPort.document,
    deleteCounts,
    counts: {
      goals: listed.goals.length,
      actions: listed.actions.length,
      routines: listed.routines.length,
      actionRecords: listed.actionRecords.length,
      routineRecords: listed.routineRecords.length
    }
  }
}

function todaySafe(snapshot: CompleteCorePersistenceSnapshot, kind: 'focus' | 'intention'): number {
  return snapshot.coreSnapshot.todaySelections.filter((selection) => selection.kind === kind).length
}

describe('T033 data capabilities across AI states', () => {
  it('repeats the same SQLite command, query, delete, reopen, and export matrix', async () => {
    const results = []
    for (const state of states) results.push(await runMatrix(state))
    expect(results[1]).toEqual(results[0])
    expect(results[2]).toEqual(results[0])
  })

  it.each<AiFailureScenario>(['authentication-failure', 'parse-failure', 'timeout'])(
    'keeps SQLite and ExportPort usable after %s',
    async (failureScenario) => {
      const root = await createTemporaryTestRoot()
      roots.push(root)
      const databasePath = join(root.database, `t033-failure-${failureScenario}.sqlite3`)
      const connection = SqliteConnection.open(databasePath)
      const fixedClock = clock()
      const generateId = idGenerator()
      const observation = await observeAiDataCapabilityState({
        state: 'failure',
        failureScenario,
        readCoreSnapshot: () =>
          asCompleteExportRepository(connection.repository).readCompleteCoreSnapshot()
      })
      expect(observation.after).toEqual(observation.before)

      const goal = new GoalService({
        repository: connection.repository,
        unitOfWork: connection,
        clock: fixedClock,
        generateId
      }).createGoal({ name: `After ${failureScenario}` })
      expect(goal.status).toBe('active')
      const exportPort = new CapturingExportPort()
      const result = await new CompleteExportService({
        repository: connection.repository,
        clock: fixedClock,
        exportPort
      }).generateCompleteExport()
      expect(result.kind).toBe('exported')
      expect(exportPort.document?.data.goals).toHaveLength(1)
      connection.close()
    }
  )
})
