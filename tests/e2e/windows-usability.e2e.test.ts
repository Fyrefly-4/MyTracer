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

test('keeps deletion keyboard-contained, cancellation read-only, and deletion explicit', async () => {
  const root = await createTemporaryTestRoot()
  let application: ElectronApplication | undefined
  try {
    application = await launch(root)
    const page = await application.firstWindow()
    const before = await page.evaluate(async () => {
      const goal = await window.myTracer.goals.create({
        name: '键盘确认保留的目标',
        initialNextAction: { title: '保留的下一步' }
      })
      if (!goal.ok) throw new Error('Goal setup failed')
      return window.myTracer.dataControl.list()
    })
    await page.getByRole('navigation').getByRole('button', { name: '数据', exact: true }).click()
    await page.getByRole('button', { name: '更多', exact: true }).click()
    const trigger = page.getByRole('button', { name: '预览永久删除影响' })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: '确认永久删除目标“键盘确认保留的目标”' })
    const cancel = dialog.getByRole('button', { name: '取消', exact: true })
    const confirm = dialog.getByRole('button', { name: '永久删除', exact: true })
    await expect(cancel).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(confirm).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(cancel).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(confirm).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
    expect(await page.evaluate(() => window.myTracer.dataControl.list())).toEqual(before)
    await page.keyboard.press('Enter')
    await expect(cancel).toBeFocused()
    await page.keyboard.press('Space')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
    expect(await page.evaluate(() => window.myTracer.dataControl.list())).toEqual(before)
    await page.keyboard.press('Enter')
    await expect(cancel).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(confirm).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(dialog).toBeHidden()
    expect(await page.evaluate(() => window.myTracer.dataControl.list())).toMatchObject({
      ok: true,
      value: { goals: [], actions: [] }
    })
  } finally {
    await application?.close()
    await removeTemporaryTestRoot(root)
  }
})

test('does not claim rollback after a rendered failure following a successful save', async () => {
  const root = await createTemporaryTestRoot()
  let application: ElectronApplication | undefined
  try {
    application = await launch(root)
    let page = await application.firstWindow()
    const saved = await page.evaluate(() =>
      window.myTracer.goals.create({ name: '界面异常前已保存的目标' })
    )
    expect(saved.ok).toBe(true)
    // Leave Home and finish Today's initial queries before injecting the Goals failure.
    // Otherwise Home's pending/focus refresh can consume the malformed response first.
    await page.getByRole('navigation').getByRole('button', { name: '今天', exact: true }).click()
    await expect(page.locator('.today-date-label strong')).toHaveText(/^\d{4}-\d{2}-\d{2}$/)
    await application.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('goals:list')
      ipcMain.handle('goals:list', () => ({ ok: true, value: [null] }))
    })
    await page.getByRole('navigation').getByRole('button', { name: '目标', exact: true }).click()
    await expect(page.locator('.fatal-state')).toBeVisible()
    await expect(page.locator('.fatal-state')).not.toContainText('没有修改任何数据')
    await expect(page.locator('.fatal-state')).toContainText('确认最近操作的保存结果')
    await application.close()
    application = await launch(root)
    page = await application.firstWindow()
    await page.getByRole('navigation').getByRole('button', { name: '目标', exact: true }).click()
    await expect(page.locator('.goal-list-item')).toContainText('界面异常前已保存的目标')
  } finally {
    await application?.close()
    await removeTemporaryTestRoot(root)
  }
})

test('supports keyboard Goal creation and optional quick recording at the minimum window size', async () => {
  const root = await createTemporaryTestRoot()
  let application: ElectronApplication | undefined
  try {
    application = await launch(root)
    const page = await application.firstWindow()
    await application.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]!.setSize(820, 600)
    })
    const goalsNavigation = page.getByRole('navigation').getByRole('button', {
      name: '目标',
      exact: true
    })
    await goalsNavigation.focus()
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: '新建目标', exact: true }).focus()
    await page.keyboard.press('Space')
    await expect(page.getByLabel('目标名称', { exact: true })).toBeFocused()
    await page.keyboard.type('Keyboard Goal')
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('当前下一步（可选）')).toBeFocused()
    await page.keyboard.type('Keyboard Action')
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('说明（可选）', { exact: true })).toBeFocused()
    await page.keyboard.type('Keyboard description')
    await expect(page.getByLabel('说明（可选）', { exact: true })).toHaveValue(
      'Keyboard description'
    )
    await page.keyboard.press('Tab')
    const create = page.getByRole('button', { name: '创建目标', exact: true })
    await expect(create).toBeFocused()
    expect(await create.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe(
      'none'
    )
    await page.keyboard.press('Enter')
    await expect(page.locator('.goal-list-item')).toContainText('Keyboard Goal')
    await page.getByRole('navigation').getByRole('button', { name: '今天', exact: true }).click()
    await page.getByRole('button', { name: /Keyboard Action.*待行动/ }).click()
    const panel = page.getByLabel('Keyboard Action 行动记录')
    await panel.getByRole('button', { name: '开始记录' }).focus()
    await page.keyboard.press('Enter')
    await expect(panel.getByLabel('投入时长（分钟，可选）')).toBeFocused()
    await page.keyboard.type('0')
    await panel.getByLabel('本次结果').selectOption('partial')
    await expect(panel.getByLabel('我理解了（可选）')).toHaveCount(0)
    await panel.getByRole('button', { name: '保存记录' }).focus()
    await page.keyboard.press('Enter')
    await expect(panel.getByRole('button', { name: '开始记录' })).toBeFocused()
    expect(await page.evaluate(() => window.myTracer.progress.get({}))).toMatchObject({
      ok: true,
      value: { totalDurationMinutes: 0, realActionCount: 1 }
    })
    for (const section of ['进展', '复盘', '数据', '例行']) {
      await page.getByRole('navigation').getByRole('button', { name: section, exact: true }).click()
      await expect(page.getByRole('heading', { name: section, exact: true })).toBeVisible()
      expect(
        await page.evaluate(() => {
          const content = document.querySelector('.content')!
          return content.scrollWidth <= content.clientWidth + 1
        })
      ).toBe(true)
    }
  } finally {
    await application?.close()
    await removeTemporaryTestRoot(root)
  }
})
