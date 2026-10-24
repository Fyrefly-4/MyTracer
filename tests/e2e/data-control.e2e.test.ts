import Database from 'better-sqlite3'
import { join } from 'node:path'
import { expect, test, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import {
  createTemporaryTestRoot,
  removeTemporaryTestRoot,
  type TemporaryTestRoot
} from '../support/temporary-test-root'

async function launchApplication(root: TemporaryTestRoot): Promise<ElectronApplication> {
  return electron.launch({
    cwd: root.root,
    args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
    env: minimalElectronEnvironment(root)
  })
}

test('edits, backfills, previews, deletes, and reopens T031 facts through the trusted API', async () => {
  test.slow()
  const root = await createTemporaryTestRoot()
  const databasePath = join(root.electronUserData, 'data', 'mytracer.sqlite3')
  let application: ElectronApplication | undefined
  try {
    application = await launchApplication(root)
    let page = await application.firstWindow()
    const facts = await page.evaluate(async () => {
      const goal = await window.myTracer.goals.create({
        name: 'T031 Goal',
        initialNextAction: { title: 'T031 Action' }
      })
      if (!goal.ok) throw new Error(goal.error.message)
      const actionId = goal.value.currentNextActionId!
      const routine = await window.myTracer.routines.create({
        arrangementMode: 'weekly' as const,
        goalId: goal.value.id,
        name: 'T031 Routine',
        minimumAction: 'One minute',
        weekdays: [1]
      })
      if (!routine.ok) throw new Error(routine.error.message)
      const pausedGoal = await window.myTracer.goals.pause({ goalId: goal.value.id })
      const pausedRoutine = await window.myTracer.routines.pause({ routineId: routine.value.id })
      if (!pausedGoal.ok || !pausedRoutine.ok) throw new Error('Pause setup failed.')

      const actionRecord = await window.myTracer.dataControl.backfillActionRecord({
        actionId,
        occurredOn: '2026-08-12',
        durationMinutes: 7,
        outcome: 'partial',
        understanding: 'Historical understanding',
        confusion: 'Historical confusion'
      })
      const routineRecord = await window.myTracer.dataControl.backfillRoutineRecord({
        routineId: routine.value.id,
        occurredOn: '2026-08-12',
        outcome: 'acted',
        plannedForDate: false,
        durationMinutes: 3
      })
      if (!actionRecord.ok || !routineRecord.ok) throw new Error('Backfill failed.')
      const movedAction = await window.myTracer.dataControl.updateActionRecord({
        recordId: actionRecord.value.id,
        occurredOn: '2026-08-11',
        durationMinutes: 9,
        outcome: 'stopped',
        summary: null,
        note: 'Edited history'
      })
      const movedRoutine = await window.myTracer.dataControl.updateRoutineRecord({
        recordId: routineRecord.value.id,
        occurredOn: '2026-08-11',
        outcome: 'target_met',
        plannedForDate: true,
        durationMinutes: 4
      })
      if (!movedAction.ok || !movedRoutine.ok) throw new Error('Update failed.')
      const listed = await window.myTracer.dataControl.list()
      if (!listed.ok) throw new Error(listed.error.message)
      const understanding = listed.value.understandings[0]!
      const confusion = listed.value.confusions[0]!
      const editedUnderstanding = await window.myTracer.dataControl.updateUnderstanding({
        id: understanding.id,
        text: 'Edited understanding'
      })
      const revoked = await window.myTracer.dataControl.revokeUnderstanding({
        id: understanding.id
      })
      const editedConfusion = await window.myTracer.dataControl.updateConfusion({
        id: confusion.id,
        text: 'Edited confusion'
      })
      const resolved = await window.myTracer.dataControl.resolveConfusion({
        id: confusion.id,
        resolution: 'Known now'
      })
      const reopened = await window.myTracer.dataControl.reopenConfusion({ id: confusion.id })
      if (
        !editedUnderstanding.ok ||
        !revoked.ok ||
        !editedConfusion.ok ||
        !resolved.ok ||
        !reopened.ok
      ) {
        throw new Error('Child fact transition failed.')
      }
      return {
        goalId: goal.value.id,
        actionId,
        actionRecordId: actionRecord.value.id,
        routineId: routine.value.id,
        routineRecordId: routineRecord.value.id
      }
    })

    await page.getByRole('button', { name: '数据', exact: true }).click()
    await page.locator('.data-history-row').filter({ hasText: 'T031 Action' }).click()
    await expect(page.getByLabel('所选记录')).toContainText('行动 · T031 Action')
    await page.getByRole('button', { name: '编辑记录', exact: true }).click()
    await expect(page.getByLabel('行动发生日期')).toHaveValue('2026-08-11')
    await page.locator('.data-history-row').filter({ hasText: 'T031 Routine' }).click()
    await page.getByRole('button', { name: '编辑记录', exact: true }).click()
    await expect(page.getByLabel('例行发生日期')).toHaveValue('2026-08-11')
    await expect(page.getByText('历史计划由用户确认')).toBeVisible()

    await page.getByRole('button', { name: '更多', exact: true }).click()
    await page.getByLabel('内容类型').selectOption('goal')
    await page.getByLabel('选择内容').selectOption({ label: 'T031 Goal' })
    await page.getByRole('button', { name: '预览永久删除影响' }).click()
    const dialog = page.getByRole('dialog', { name: /确认永久删除目标“T031 Goal”/ })
    await expect(dialog).toContainText('行动：1')
    await expect(dialog).toContainText('解除关联的例行：1')
    await dialog.getByRole('button', { name: '取消' }).click()
    await expect(dialog).toBeHidden()

    const deleteResult = await page.evaluate(async ({ actionRecordId }) => {
      const preview = await window.myTracer.dataControl.previewDelete({
        target: { type: 'action-record', id: actionRecordId }
      })
      if (!preview.ok) throw new Error(preview.error.message)
      return window.myTracer.dataControl.confirmDelete({
        previewId: preview.value.previewId,
        target: preview.value.target,
        confirmation: 'permanently-delete'
      })
    }, facts)
    expect(deleteResult).toMatchObject({
      ok: true,
      value: { counts: { actionRecords: 1, understandings: 1, confusions: 1 } }
    })

    await application.close()
    application = await launchApplication(root)
    page = await application.firstWindow()
    const reopened = await page.evaluate(async ({ goalId, actionId, routineRecordId }) => {
      const data = await window.myTracer.dataControl.list()
      const progress = await window.myTracer.progress.get({})
      const today = await window.myTracer.today.get({})
      if (!data.ok || !progress.ok || !today.ok) throw new Error('Reopen query failed.')
      return {
        data: data.value,
        progress: progress.value,
        today: today.value,
        goalId,
        actionId,
        routineRecordId
      }
    }, facts)
    expect(reopened.data.goals).toEqual([
      expect.objectContaining({ id: facts.goalId, status: 'paused' })
    ])
    expect(reopened.data.actions).toEqual([
      expect.objectContaining({ id: facts.actionId, status: 'pending' })
    ])
    expect(reopened.data.actionRecords).toEqual([])
    expect(reopened.data.routineRecords).toEqual([
      expect.objectContaining({
        id: facts.routineRecordId,
        occurredOn: '2026-08-11',
        plannedForDate: true,
        plannedForDateBasis: 'user_confirmed_history'
      })
    ])
    expect(reopened.progress).toMatchObject({
      totalDurationMinutes: 4,
      realActionCount: 1,
      targetMetCount: 1
    })

    const inspected = new Database(databasePath, { readonly: true })
    try {
      expect(
        inspected.prepare("SELECT value FROM metadata WHERE key = 'schemaVersion'").get()
      ).toEqual({ value: '7' })
      expect(inspected.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    } finally {
      inspected.close()
    }
  } finally {
    await application?.close().catch(() => undefined)
    await removeTemporaryTestRoot(root)
  }
})
