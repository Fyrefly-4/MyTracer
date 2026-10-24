import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import {
  createTemporaryTestRoot,
  removeTemporaryTestRoot,
  type TemporaryTestRoot
} from '../support/temporary-test-root'

async function launch(root: TemporaryTestRoot): Promise<ElectronApplication> {
  return electron.launch({
    cwd: root.root,
    args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
    env: minimalElectronEnvironment(root)
  })
}

test('exports complete retained facts through the UI without exposing a destination path', async () => {
  test.slow()
  const root = await createTemporaryTestRoot()
  const destination = join(root.exports, 'complete.json')
  let application: ElectronApplication | undefined
  try {
    application = await launch(root)
    const page = await application.firstWindow()
    await page.evaluate(async () => {
      const goal = await window.myTracer.goals.create({
        name: 'Export goal',
        initialNextAction: { title: 'Export action' }
      })
      if (!goal.ok) throw new Error(goal.error.message)
      const routine = await window.myTracer.routines.create({
        arrangementMode: 'weekly' as const,
        goalId: goal.value.id,
        name: 'Export routine',
        minimumAction: 'One minute',
        weekdays: [1]
      })
      if (!routine.ok) throw new Error(routine.error.message)
      const action = await window.myTracer.dataControl.backfillActionRecord({
        actionId: goal.value.currentNextActionId!,
        occurredOn: '2026-08-20',
        durationMinutes: 3,
        outcome: 'partial',
        understanding: 'Confirmed',
        confusion: 'Open question'
      })
      const routineRecord = await window.myTracer.dataControl.backfillRoutineRecord({
        routineId: routine.value.id,
        occurredOn: '2026-08-20',
        outcome: 'acted',
        plannedForDate: false,
        durationMinutes: 2
      })
      if (!action.ok || !routineRecord.ok) throw new Error('record setup failed')
    })
    await application.evaluate(({ dialog }, target) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: target })
    }, destination)
    await page.getByRole('button', { name: '数据', exact: true }).click()
    await page.getByRole('button', { name: '导出', exact: true }).click()
    await expect(page.getByText('目前只支持导出；尚不支持自动导入或一键恢复。')).toBeVisible()
    await page.getByRole('button', { name: '导出完整数据' }).click()
    await expect(page.getByText(/已导出 complete\.json/)).toBeVisible()
    const exported = JSON.parse(await readFile(destination, 'utf8'))
    expect(exported).toMatchObject({
      format: 'mytracer-core-export',
      exportVersion: 6,
      sourceDataVersion: 7
    })
    expect(exported.data).toMatchObject({
      goals: [{ title: 'Export goal' }],
      routines: [{ name: 'Export routine' }],
      actionRecords: [{ outcome: 'partial' }],
      routineRecords: [{ outcome: 'acted' }],
      understandings: [{ text: 'Confirmed' }],
      confusions: [{ text: 'Open question' }]
    })
    expect(JSON.stringify(exported)).not.toMatch(/userData|credential|prompt|diagnostic/i)
    await application.close()
    application = undefined
    application = await launch(root)
    const secondPage = await application.firstWindow()
    await application.evaluate(
      ({ dialog }, target) => {
        dialog.showSaveDialog = async () => ({ canceled: false, filePath: target })
      },
      join(root.exports, 'again.json')
    )
    await secondPage.getByRole('button', { name: '数据', exact: true }).click()
    await secondPage.getByRole('button', { name: '导出', exact: true }).click()
    await secondPage.getByRole('button', { name: '导出完整数据' }).click()
    await expect(secondPage.getByText(/已导出 again\.json/)).toBeVisible()
  } finally {
    await application?.close()
    await removeTemporaryTestRoot(root)
  }
})
