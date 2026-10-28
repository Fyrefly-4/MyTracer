import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { expect, test, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'
import {
  observeAiDataCapabilityState,
  type AiDataCapabilityState
} from '../support/ai-data-capability-harness'
import { minimalElectronEnvironment } from '../support/electron-environment'
import {
  createTemporaryTestRoot,
  removeTemporaryTestRoot,
  type TemporaryTestRoot
} from '../support/temporary-test-root'

const states: readonly AiDataCapabilityState[] = ['disabled', 'not-configured', 'failure']

async function launch(root: TemporaryTestRoot): Promise<ElectronApplication> {
  return electron.launch({
    cwd: root.root,
    args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
    env: minimalElectronEnvironment(root)
  })
}

test('E2E-AC-07 repeats the core data program when AI is unavailable or fails', async () => {
  test.setTimeout(180_000)
  const results: unknown[] = []

  for (const state of states) {
    const root = await createTemporaryTestRoot()
    const destination = join(root.exports, `${state}.json`)
    const databasePath = join(root.electronUserData, 'data', 'mytracer.sqlite3')
    let application: ElectronApplication | undefined
    try {
      application = await launch(root)
      let page = await application.firstWindow()
      const ai = await observeAiDataCapabilityState({
        state,
        readCoreSnapshot: async () => {
          const result = await page.evaluate(() => window.myTracer.dataControl.list())
          if (!result.ok) throw new Error(result.error.message)
          return result.value
        }
      })
      expect(ai.after).toEqual(ai.before)
      expect(ai.providerCalls).toBe(state === 'failure' ? 1 : 0)
      if (state === 'not-configured') {
        expect(await page.evaluate(() => window.myTracer.shell.getStatus())).toMatchObject({
          ai: { configured: false, availability: 'not-configured' }
        })
      }

      const facts = await page.evaluate(async () => {
        const goal = await window.myTracer.goals.create({
          name: 'T033 Goal',
          initialNextAction: { title: 'T033 Initial Action' }
        })
        if (!goal.ok) throw new Error(goal.error.message)
        const goalId = goal.value.id
        const initialActionId = goal.value.currentNextActionId!
        const updatedGoal = await window.myTracer.goals.updateDetails({
          goalId,
          name: 'T033 Goal updated'
        })
        const pausedGoal = await window.myTracer.goals.pause({ goalId })
        const resumedGoal = await window.myTracer.goals.resume({ goalId })
        if (!updatedGoal.ok || !pausedGoal.ok || !resumedGoal.ok)
          throw new Error('Goal CRUD failed')

        const focus = await window.myTracer.actions.create({ goalId, title: 'T033 Focus' })
        const intention = await window.myTracer.actions.create({ title: 'T033 Intention' })
        if (!focus.ok || !intention.ok) throw new Error('Action create failed')
        const updatedAction = await window.myTracer.actions.updateDetails({
          actionId: focus.value.id,
          title: 'T033 Focus updated'
        })
        const selectedFocus = await window.myTracer.today.selectAction({ actionId: focus.value.id })
        const selectedIntention = await window.myTracer.today.selectActionAsIntention({
          actionId: intention.value.id
        })
        if (!updatedAction.ok || !selectedFocus.ok || !selectedIntention.ok) {
          throw new Error('Today selection failed')
        }

        const routine = await window.myTracer.routines.create({
          arrangementMode: 'weekly' as const,
          goalId,
          name: 'T033 Routine',
          minimumAction: 'One minute',
          weekdays: [1, 5]
        })
        if (!routine.ok) throw new Error(routine.error.message)
        const updatedRoutine = await window.myTracer.routines.updateDetails({
          routineId: routine.value.id,
          name: 'T033 Routine updated',
          minimumAction: 'Two minutes'
        })
        const scheduledRoutine = await window.myTracer.routines.replaceSchedule({
          arrangementMode: 'weekly' as const,
          routineId: routine.value.id,
          weekdays: [2, 5]
        })
        const pausedRoutine = await window.myTracer.routines.pause({ routineId: routine.value.id })
        const resumedRoutine = await window.myTracer.routines.resume({
          routineId: routine.value.id
        })
        if (!updatedRoutine.ok || !scheduledRoutine.ok || !pausedRoutine.ok || !resumedRoutine.ok) {
          throw new Error('Routine CRUD failed')
        }

        const actionRecord = await window.myTracer.dataControl.backfillActionRecord({
          actionId: focus.value.id,
          occurredOn: '2026-08-20',
          durationMinutes: 12,
          outcome: 'partial',
          understanding: 'T033 understanding',
          confusion: 'T033 confusion'
        })
        const routineRecord = await window.myTracer.dataControl.backfillRoutineRecord({
          routineId: routine.value.id,
          occurredOn: '2026-08-20',
          outcome: 'acted',
          plannedForDate: false,
          durationMinutes: 4
        })
        if (!actionRecord.ok || !routineRecord.ok) throw new Error('Record backfill failed')
        const updatedActionRecord = await window.myTracer.dataControl.updateActionRecord({
          recordId: actionRecord.value.id,
          occurredOn: '2026-08-19',
          durationMinutes: 15,
          outcome: 'partial',
          nextStep: 'Continue'
        })
        const updatedRoutineRecord = await window.myTracer.dataControl.updateRoutineRecord({
          recordId: routineRecord.value.id,
          occurredOn: '2026-08-19',
          outcome: 'target_met',
          plannedForDate: true,
          durationMinutes: 5
        })
        if (!updatedActionRecord.ok || !updatedRoutineRecord.ok)
          throw new Error('Record update failed')

        let data = await window.myTracer.dataControl.list()
        if (!data.ok) throw new Error(data.error.message)
        const understandingId = data.value.understandings[0]!.id
        const confusionId = data.value.confusions[0]!.id
        const editedUnderstanding = await window.myTracer.dataControl.updateUnderstanding({
          id: understandingId,
          text: 'T033 understanding updated'
        })
        const revoked = await window.myTracer.dataControl.revokeUnderstanding({
          id: understandingId
        })
        const editedConfusion = await window.myTracer.dataControl.updateConfusion({
          id: confusionId,
          text: 'T033 confusion updated'
        })
        const resolved = await window.myTracer.dataControl.resolveConfusion({
          id: confusionId,
          resolution: 'Resolved'
        })
        const reopened = await window.myTracer.dataControl.reopenConfusion({ id: confusionId })
        if (
          !editedUnderstanding.ok ||
          !revoked.ok ||
          !editedConfusion.ok ||
          !resolved.ok ||
          !reopened.ok
        ) {
          throw new Error('Child fact update failed')
        }

        const cancelAction = await window.myTracer.actions.create({ title: 'T033 cancel delete' })
        if (!cancelAction.ok) throw new Error(cancelAction.error.message)
        const cancelPreview = await window.myTracer.dataControl.previewDelete({
          target: { type: 'action', id: cancelAction.value.id }
        })
        if (!cancelPreview.ok) throw new Error(cancelPreview.error.message)
        const cancelled = await window.myTracer.dataControl.cancelDelete({
          previewId: cancelPreview.value.previewId
        })
        if (!cancelled.ok) throw new Error(cancelled.error.message)

        const staleAction = await window.myTracer.actions.create({ title: 'T033 stale delete' })
        if (!staleAction.ok) throw new Error(staleAction.error.message)
        const stalePreview = await window.myTracer.dataControl.previewDelete({
          target: { type: 'action', id: staleAction.value.id }
        })
        if (!stalePreview.ok) throw new Error(stalePreview.error.message)
        const lateRecord = await window.myTracer.dataControl.backfillActionRecord({
          actionId: staleAction.value.id,
          occurredOn: '2026-08-18',
          durationMinutes: 1,
          outcome: 'stopped'
        })
        if (!lateRecord.ok) throw new Error(lateRecord.error.message)
        const staleConfirmation = await window.myTracer.dataControl.confirmDelete({
          previewId: stalePreview.value.previewId,
          target: stalePreview.value.target,
          confirmation: 'permanently-delete'
        })
        if (staleConfirmation.ok || staleConfirmation.error.code !== 'delete-preview-stale') {
          throw new Error('Stale delete was not rejected')
        }

        const deleteAction = await window.myTracer.actions.create({
          title: 'T033 confirmed delete'
        })
        if (!deleteAction.ok) throw new Error(deleteAction.error.message)
        const deletePreview = await window.myTracer.dataControl.previewDelete({
          target: { type: 'action', id: deleteAction.value.id }
        })
        if (!deletePreview.ok) throw new Error(deletePreview.error.message)
        const confirmed = await window.myTracer.dataControl.confirmDelete({
          previewId: deletePreview.value.previewId,
          target: deletePreview.value.target,
          confirmation: 'permanently-delete'
        })
        if (!confirmed.ok) throw new Error(confirmed.error.message)

        data = await window.myTracer.dataControl.list()
        const today = await window.myTracer.today.get({})
        const progress = await window.myTracer.progress.get({
          goalId,
          from: '2026-08-18',
          through: '2026-08-21'
        })
        if (!data.ok || !today.ok || !progress.ok) throw new Error('Core query failed')
        return {
          goalId,
          initialActionId,
          data: data.value,
          today: today.value,
          progress: progress.value,
          deleteCounts: confirmed.value.counts
        }
      })

      await application.evaluate(({ dialog }, target) => {
        dialog.showSaveDialog = async () => ({ canceled: false, filePath: target })
      }, destination)
      const exportResult = await page.evaluate(() => window.myTracer.exports.generate())
      expect(exportResult).toMatchObject({
        ok: true,
        value: { kind: 'exported', exportVersion: 8 }
      })
      const exported = JSON.parse(await readFile(destination, 'utf8'))
      expect(JSON.stringify(exported)).not.toMatch(/credential|prompt|diagnostic|authentication/i)

      await application.close()
      application = undefined
      application = await launch(root)
      page = await application.firstWindow()
      const reopened = await page.evaluate(async () => {
        const data = await window.myTracer.dataControl.list()
        const today = await window.myTracer.today.get({})
        const progress = await window.myTracer.progress.get({})
        if (!data.ok || !today.ok || !progress.ok) throw new Error('Reopen query failed')
        return { data: data.value, today: today.value, progress: progress.value }
      })

      expect(reopened.data).toEqual(facts.data)
      expect(reopened.today).toEqual(facts.today)
      expect(reopened.progress.totalDurationMinutes).toBe(21)
      expect(reopened.progress.realActionCount).toBe(3)
      expect(reopened.progress.targetMetCount).toBe(1)
      const inspected = new Database(databasePath, { readonly: true })
      try {
        expect(inspected.prepare('PRAGMA foreign_key_check').all()).toEqual([])
      } finally {
        inspected.close()
      }

      results.push({
        goals: facts.data.goals
          .map(({ title, status }) => ({ title, status }))
          .sort((left, right) => left.title.localeCompare(right.title)),
        actions: facts.data.actions
          .map(({ title, status }) => ({ title, status }))
          .sort((left, right) => left.title.localeCompare(right.title)),
        routines: facts.data.routines.map(({ name, status }) => ({ name, status })),
        records: facts.data.actionRecords.map(({ occurredOn, durationMinutes, outcome }) => ({
          occurredOn,
          durationMinutes,
          outcome
        })),
        routineRecords: facts.data.routineRecords.map(
          ({ occurredOn, durationMinutes, outcome, plannedForDate }) => ({
            occurredOn,
            durationMinutes,
            outcome,
            plannedForDate
          })
        ),
        today: { focuses: facts.today.focuses.length, intentions: facts.today.intentions.length },
        progress: {
          totalDurationMinutes: facts.progress.totalDurationMinutes,
          realActionCount: facts.progress.realActionCount,
          targetMetCount: facts.progress.targetMetCount
        },
        deleteCounts: facts.deleteCounts,
        exportCounts: Object.fromEntries(
          Object.entries(exported.data).map(([key, value]) => [
            key,
            Array.isArray(value) ? value.length : value
          ])
        )
      })
    } finally {
      await application?.close().catch(() => undefined)
      await removeTemporaryTestRoot(root)
    }
  }

  expect(results[1]).toEqual(results[0])
  expect(results[2]).toEqual(results[0])
})
