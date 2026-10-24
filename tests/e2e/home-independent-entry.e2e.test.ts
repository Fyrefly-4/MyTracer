import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

test.skip(process.platform !== 'win32', 'Native Electron acceptance runs on Windows CI.')

async function withApplication(
  run: (page: Page, app: ElectronApplication) => Promise<void>
): Promise<void> {
  const root = await createTemporaryTestRoot()
  let app: ElectronApplication | undefined
  try {
    app = await electron.launch({
      chromiumSandbox: true,
      cwd: root.root,
      args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
      env: minimalElectronEnvironment(root)
    })
    await run(await app.firstWindow(), app)
  } finally {
    try {
      await app?.close()
    } finally {
      await removeTemporaryTestRoot(root)
    }
  }
}

async function navigate(page: Page, name: string): Promise<void> {
  await page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
}

test('Home offers an optional goal-free route and preserves a recording draft on return', async () => {
  await withApplication(async (page) => {
    const entry = page.getByRole('button', { name: '去今天', exact: true })
    await expect(entry).toBeVisible()
    await expect(page.getByRole('button', { name: '＋ 留下一个目标', exact: true })).toBeVisible()
    await expect(
      page.getByText('也可以不建目标。在“今天”新建一个行动，之后记录做过的一点。')
    ).toBeVisible()
    const before = await page.evaluate(() => window.myTracer.dataControl.list())
    await entry.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: '留下一个可以直接开始的小步骤' })
    await expect(dialog).not.toBeVisible()
    const create = page.getByRole('button', { name: '新建行动', exact: true })
    await create.click()
    await dialog.getByLabel('行动标题', { exact: true }).fill('独立的一小步')
    await dialog.getByRole('button', { name: '取消新建', exact: true }).click()
    await expect(create).toBeFocused()
    expect(await page.evaluate(() => window.myTracer.dataControl.list())).toEqual(before)
    await create.click()
    await expect(dialog.getByLabel('行动标题', { exact: true })).toHaveValue('独立的一小步')
    await expect(dialog.getByLabel('关联目标（可选）')).toHaveValue('')
    await dialog.getByRole('button', { name: '创建行动', exact: true }).click()
    const panel = page.getByLabel('独立的一小步 行动记录', { exact: true })
    await panel.getByRole('button', { name: '开始记录', exact: true }).click()
    await panel.getByLabel('投入时长（分钟，可选）').fill('7')
    await navigate(page, '首页')
    await entry.focus()
    await page.keyboard.press('Space')
    await expect(dialog).not.toBeVisible()
    await expect(panel.getByLabel('投入时长（分钟，可选）')).toHaveValue('7')
    await panel.getByRole('button', { name: '保存记录', exact: true }).click()
    await expect(panel.getByRole('status')).toContainText('记录已保存')
    const snapshot = await page.evaluate(() => window.myTracer.dataControl.list())
    if (!snapshot.ok) throw new Error('Snapshot failed')
    expect(snapshot.value.goals).toEqual([])
    expect(snapshot.value.actions).toHaveLength(1)
    expect(snapshot.value.actions[0].goalId).toBeNull()
    expect(snapshot.value.actionRecords).toHaveLength(1)
    expect(snapshot.value.actionRecords[0].durationMinutes).toBe(7)
    const today = await page.evaluate(() => window.myTracer.today.get({}))
    expect(today.ok && today.value.focuses).toEqual([])
    expect(today.ok && today.value.intentions).toEqual([])
  })
})

test('Home does not offer zero-goal guidance for paused goals or failed reads', async () => {
  await withApplication(async (page, app) => {
    await expect(page.getByRole('button', { name: '去今天', exact: true })).toBeVisible()
    await page.evaluate(async () => {
      const goal = await window.myTracer.goals.create({ name: '已暂停的方向' })
      if (!goal.ok) throw new Error('Goal fixture failed')
      const paused = await window.myTracer.goals.pause({ goalId: goal.value.id })
      if (!paused.ok) throw new Error('Pause fixture failed')
    })
    await navigate(page, '今天')
    await navigate(page, '首页')
    await expect(page.getByRole('button', { name: '查看已有目标', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '去今天', exact: true })).toHaveCount(0)
    await app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('home:get')
      ipcMain.handle('home:get', () => ({
        ok: false,
        error: { code: 'persistence-failed', message: 'isolated fixture error' }
      }))
    })
    await navigate(page, '今天')
    await navigate(page, '首页')
    await expect(page.getByText('目标概览暂时不可用。', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '去今天', exact: true })).toHaveCount(0)
  })
})
