import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import {
  createTemporaryTestRoot,
  removeTemporaryTestRoot,
  type TemporaryTestRoot
} from '../support/temporary-test-root'

async function launch(root: TemporaryTestRoot) {
  return electron.launch({
    chromiumSandbox: true,
    cwd: root.root,
    args: [
      join(process.cwd(), 'out/main/index.js'),
      `--user-data-dir=${root.electronUserData}`,
      ...(process.platform === 'linux' ? ['--headless'] : [])
    ],
    env: minimalElectronEnvironment(root)
  })
}
async function navigate(page: Page, name: string) {
  await page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
}
async function normalClose(app: ElectronApplication) {
  const closed = app.waitForEvent('close')
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close())
  await closed
}

test('three recording entrypoints quietly retain inputs across normal window close, then reconcile lost save replies and refresh their owners', async () => {
  test.slow()
  const root = await createTemporaryTestRoot()
  let app: ElectronApplication | undefined
  try {
    app = await launch(root)
    let page = await app.firstWindow()
    await expect(page.getByRole('navigation')).toBeVisible()
    await page.evaluate(async () => {
      const action = await window.myTracer.actions.create({ title: '合成续写行动' })
      if (!action.ok) throw Error('Synthetic action creation failed')
      const routine = await window.myTracer.routines.create({
        name: '合成续写例行',
        minimumAction: '一步',
        arrangementMode: 'unscheduled',
        weekdays: []
      })
      if (!routine.ok) throw Error('Synthetic routine creation failed')
    })
    await navigate(page, '今天')
    await page.getByRole('button', { name: /合成续写行动.*待行动/ }).click()
    let action = page.getByLabel('合成续写行动 行动记录')
    await action.getByRole('button', { name: '开始记录' }).click()
    await action.getByLabel('投入时长（分钟，可选）').fill('7')
    await navigate(page, '例行')
    await page
      .getByRole('button', { name: /合成续写例行/ })
      .first()
      .click()
    let routine = page.getByLabel('合成续写例行 例行记录')
    await routine.getByRole('button', { name: '记录例行' }).click()
    await routine.getByLabel('投入时长（分钟，可选）').fill('3')
    await navigate(page, '今天')
    await page.getByRole('button', { name: '记一笔', exact: true }).click()
    let first = page.getByRole('dialog', { name: '记一笔', exact: true })
    await first.getByLabel('刚才做了什么', { exact: true }).fill('合成未完成第一笔')
    const before = await page.evaluate(() => window.myTracer.dataControl.list())
    expect(before).toMatchObject({ ok: true, value: { actionRecords: [], routineRecords: [] } })
    // Close directly after input; no test-side flush or artificial delay.
    await normalClose(app)
    app = undefined
    app = await launch(root)
    page = await app.firstWindow()
    await navigate(page, '今天')
    await page.getByRole('button', { name: /合成续写行动.*待行动/ }).click()
    action = page.getByLabel('合成续写行动 行动记录')
    await expect(action.getByLabel('投入时长（分钟，可选）')).toHaveValue('7')
    await expect(page.getByText(/草稿已恢复|本机已保存/)).toHaveCount(0)
    await page.getByRole('button', { name: '继续记一笔', exact: true }).click()
    first = page.getByRole('dialog', { name: '记一笔', exact: true })
    await expect(first.getByLabel('刚才做了什么', { exact: true })).toHaveValue('合成未完成第一笔')
    await first.getByLabel('这次不记时长（未知）').check()
    await first.getByLabel('本次结果', { exact: true }).selectOption('partial')
    await first.getByLabel('保存后，整个行动').selectOption('keep-pending')
    // Each real commit succeeds; lose its response once, then reconcile through the UI.
    await app.evaluate(({ ipcMain }) => {
      const handlers = Reflect.get(ipcMain, '_invokeHandlers') as Map<
        string,
        (...args: unknown[]) => unknown
      >
      for (const channel of [
        'records:save-first-record',
        'records:record-action',
        'routine-records:record'
      ]) {
        const original = handlers.get(channel)!
        let loseReply = true
        ipcMain.removeHandler(channel)
        ipcMain.handle(channel, async (...args) => {
          const result = await original(...args)
          if (loseReply) {
            loseReply = false
            throw Error('Synthetic lost commit reply')
          }
          return result
        })
      }
    })
    await first.getByRole('button', { name: '保存行动和第一笔' }).click()
    await first.getByRole('button', { name: '核对上次操作' }).click()
    await expect(first).not.toBeVisible()
    await expect(page.getByRole('button', { name: /合成未完成第一笔.*待行动/ })).toBeVisible()
    await page.getByRole('button', { name: /合成续写行动.*待行动/ }).click()
    await action.getByRole('button', { name: '保存记录', exact: true }).click()
    await action.getByRole('button', { name: '核对上次操作' }).click()
    await expect(action.getByText('这笔已保存。', { exact: true })).toBeVisible()
    await expect(action.getByRole('button', { name: '开始记录' })).toBeVisible()
    await navigate(page, '例行')
    await page
      .getByRole('button', { name: /合成续写例行/ })
      .first()
      .click()
    routine = page.getByLabel('合成续写例行 例行记录')
    await expect(routine.getByLabel('投入时长（分钟，可选）')).toHaveValue('3')
    await routine.getByRole('button', { name: '保存例行记录', exact: true }).click()
    await routine.getByRole('button', { name: '核对上次操作' }).click()
    await expect(routine.locator('.routine-record-state strong')).toHaveText('有所行动')
    await expect(routine.getByRole('button', { name: '记录例行', exact: true })).toHaveCount(0)
    await normalClose(app)
    app = undefined
    app = await launch(root)
    page = await app.firstWindow()
    await navigate(page, '今天')
    await expect(page.getByRole('button', { name: '继续记一笔', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: /合成续写行动.*待行动/ }).click()
    await expect(
      page.getByLabel('合成续写行动 行动记录').getByRole('button', { name: '开始记录' })
    ).toBeVisible()
    const after = await page.evaluate(() => window.myTracer.dataControl.list())
    if (!after.ok) throw Error('Synthetic snapshot unavailable')
    expect(after.value.actionRecords).toHaveLength(2)
    expect(after.value.routineRecords).toHaveLength(1)
    await navigate(page, '例行')
    await page
      .getByRole('button', { name: /合成续写例行/ })
      .first()
      .click()
    routine = page.getByLabel('合成续写例行 例行记录')
    await expect(routine).toBeVisible()
    await expect(routine.getByLabel('投入时长（分钟，可选）')).toHaveCount(0)
    // This entry queries the current day when opened; it must discover the saved
    // fact rather than restoring the consumed inputs or offering an overwrite.
    await expect(routine.locator('.routine-record-state strong')).toHaveText('有所行动')
    await expect(routine.getByRole('button', { name: '记录例行', exact: true })).toHaveCount(0)
    await expect(routine.getByLabel('投入时长（分钟，可选）')).toHaveCount(0)
    const finalFacts = await page.evaluate(() => window.myTracer.dataControl.list())
    if (!finalFacts.ok) throw Error('Synthetic snapshot unavailable')
    expect(finalFacts.value.actionRecords).toHaveLength(2)
    expect(finalFacts.value.routineRecords).toHaveLength(1)
  } finally {
    await app?.close()
    await removeTemporaryTestRoot(root)
  }
})

test('normal close during renderer startup waits for restore without an unsafe-exit prompt', async () => {
  const root = await createTemporaryTestRoot()
  let app: ElectronApplication | undefined
  try {
    app = await launch(root)
    await app.firstWindow()
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => {
        throw Error('Unexpected unsafe-exit prompt during clean startup')
      }
    })
    await normalClose(app)
    app = undefined
  } finally {
    await app?.close()
    await removeTemporaryTestRoot(root)
  }
})
