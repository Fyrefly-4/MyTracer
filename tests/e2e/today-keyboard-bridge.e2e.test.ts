import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

// Traverse the actual tab order; never focus a locator to bypass the journey under test.
async function tabTo(page: Page, target: Locator, reverse = false, limit = 160) {
  await expect(target).toHaveCount(1)
  for (let count = 0; count <= limit; count++) {
    if (await target.evaluate((el) => el === document.activeElement)) return count
    await page.keyboard.press(reverse ? 'Shift+Tab' : 'Tab')
  }
  throw Error('Target not reached through natural tab order')
}
for (const count of [3, 20, 40]) {
  test(`explicit detail bridge preserves browsing with ${count} candidates`, async () => {
    const root = await createTemporaryTestRoot()
    let app: ElectronApplication | undefined
    try {
      app = await electron.launch({
        chromiumSandbox: true,
        cwd: root.root,
        args: [
          join(process.cwd(), 'out/main/index.js'),
          `--user-data-dir=${root.electronUserData}`,
          ...(process.platform === 'linux' ? ['--headless', '--ozone-platform=headless'] : [])
        ],
        env: minimalElectronEnvironment(root)
      })
      const page = await app.firstWindow()
      if (count === 40)
        await app.evaluate(({ BrowserWindow }) => {
          const win = BrowserWindow.getAllWindows()[0]!
          win.setSize(828, 604)
          win.webContents.setZoomFactor(1.5)
        })
      await page.evaluate(async (count) => {
        for (let i = 0; i < count; i++) {
          const r = await window.myTracer.actions.create({
            title: `键盘行动${String(i).padStart(2, '0')}`
          })
          if (!r.ok) throw Error(r.error.message)
        }
        const r = await window.myTracer.routines.create({
          name: '键盘例行',
          minimumAction: '一步',
          arrangementMode: 'weekly',
          weekdays: [1, 2, 3, 4, 5, 6, 7]
        })
        if (!r.ok) throw Error(r.error.message)
      }, count)
      const navToday = page
        .getByRole('navigation')
        .getByRole('button', { name: '今天', exact: true })
      await tabTo(page, navToday)
      await page.keyboard.press('Enter')
      const candidates = page.locator('.candidate-row > .goal-list-item')
      await expect(candidates).toHaveCount(count)
      await tabTo(page, candidates.nth(0))
      await page.keyboard.press('Enter')
      await expect(candidates.nth(0)).toBeFocused()
      // Comparing successive objects keeps the original three-button row path.
      expect(await tabTo(page, candidates.nth(1))).toBe(3)
      await page.keyboard.press('Enter')
      expect(await tabTo(page, candidates.nth(2))).toBe(3)
      await page.keyboard.press('Enter')
      const title = await candidates.nth(2).locator('span').innerText()
      const master = page.locator('.today-master-list')
      await page.keyboard.press('Shift+Tab')
      const bridge = page.getByRole('button', { name: '进入详情', exact: true })
      await expect(bridge).toBeFocused()
      const position = await master.evaluate((el) => el.scrollTop)
      await page.keyboard.press('Enter')
      const detail = page.getByRole('article', { name: `${title} 行动详情`, exact: true })
      await expect(detail).toBeFocused()
      await expect(page.getByRole('button', { name: '开始记录', exact: true })).toBeVisible()
      await expect(page.getByLabel('投入时长（分钟，可选）')).toHaveCount(0)
      const tabs = await tabTo(
        page,
        page.getByRole('button', { name: '开始记录', exact: true }),
        false,
        8
      )
      await test.info().attach(`bridge-steps-${count}`, {
        body: JSON.stringify({ toBridge: 1, detailToBegin: tabs }),
        contentType: 'application/json'
      })
      await page.keyboard.press('Enter')
      await expect(page.getByLabel('投入时长（分钟，可选）')).toBeFocused()
      await page.keyboard.type('3')
      await tabTo(page, page.getByRole('button', { name: '返回所选项', exact: true }), true, 10)
      await page.keyboard.press('Enter')
      await expect(candidates.nth(2)).toBeFocused()
      expect(await master.evaluate((el) => el.scrollTop)).toBe(position)
      await page.keyboard.press('Shift+Tab')
      await page.keyboard.press('Enter')
      await expect(detail).toBeFocused()
      await expect(page.getByLabel('投入时长（分钟，可选）')).toHaveValue('3')
      const facts = await page.evaluate(() => window.myTracer.today.get({}))
      expect(facts).toMatchObject({ ok: true, value: { focuses: [], intentions: [] } })
      if (count === 3) {
        await tabTo(page, page.getByLabel('本次结果'))
        await page.keyboard.press('Home')
        await page.keyboard.press('ArrowDown')
        await expect(page.getByLabel('本次结果')).toHaveValue('partial')
        await tabTo(page, page.getByLabel('简述（可选）', { exact: true }))
        await page.keyboard.type('自然键盘保存')
        await tabTo(page, page.getByRole('button', { name: '保存记录', exact: true }))
        await page.keyboard.press('Enter')
        await expect(page.getByRole('button', { name: '开始记录', exact: true })).toBeFocused()
        const saved = await page.evaluate(() => window.myTracer.dataControl.list())
        if (!saved.ok) throw Error(saved.error.message)
        expect(saved.value.actionRecords).toHaveLength(1)
        expect(saved.value.actionRecords[0]).toMatchObject({
          durationMinutes: 3,
          outcome: 'partial',
          summary: '自然键盘保存'
        })
        expect(saved.value.actions.every((action) => action.status === 'pending')).toBe(true)
        await tabTo(page, page.getByRole('button', { name: '返回所选项', exact: true }), true)
        await page.keyboard.press('Enter')
        await expect(candidates.nth(2)).toBeFocused()
      } else {
        await tabTo(page, page.getByRole('button', { name: '放弃草稿', exact: true }), false, 50)
        await page.keyboard.press('Enter')
      }
    } finally {
      await app?.close()
      await removeTemporaryTestRoot(root)
    }
  })
}

test('focus and routine bridges preserve edits, failed reads, drafts and completed actions', async () => {
  const root = await createTemporaryTestRoot()
  let app: ElectronApplication | undefined
  try {
    app = await electron.launch({
      chromiumSandbox: true,
      cwd: root.root,
      args: [
        join(process.cwd(), 'out/main/index.js'),
        `--user-data-dir=${root.electronUserData}`,
        ...(process.platform === 'linux' ? ['--headless', '--ozone-platform=headless'] : [])
      ],
      env: minimalElectronEnvironment(root)
    })
    const page = await app.firstWindow()
    await page.evaluate(async () => {
      for (let i = 0; i < 3; i++) {
        const r = await window.myTracer.actions.create({ title: `重点${i}` })
        if (!r.ok) throw Error(r.error.message)
        const select = await window.myTracer.today.selectAction({ actionId: r.value.id })
        if (!select.ok) throw Error(select.error.message)
      }
      for (let i = 0; i < 21; i++) {
        const r = await window.myTracer.routines.create({
          name: `例行${String(i).padStart(2, '0')}`,
          minimumAction: '一步',
          arrangementMode: i < 12 ? 'weekly' : 'unscheduled',
          weekdays: i < 12 ? [1, 2, 3, 4, 5, 6, 7] : []
        })
        if (!r.ok) throw Error(r.error.message)
      }
    })
    const nav = (name: string) =>
      page.getByRole('navigation').getByRole('button', { name, exact: true })
    await tabTo(page, nav('今天'))
    await page.keyboard.press('Enter')
    const first = page.locator('.focus-row > button[aria-pressed]').first()
    await tabTo(page, first)
    await page.keyboard.press('Enter')
    const enter = async () => {
      await page.keyboard.press('Shift+Tab')
      await expect(page.getByRole('button', { name: '进入详情', exact: true })).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(page.locator('#today-selected-detail')).toBeFocused()
    }
    await enter()
    const management = page.getByText('编辑与管理行动', { exact: true })
    await tabTo(page, management)
    await page.keyboard.press('Enter')
    const titleInput = page.getByLabel('行动标题', { exact: true })
    await tabTo(page, titleInput)
    await page.keyboard.press('ControlOrMeta+A')
    await page.keyboard.type('保留的编辑标题')
    await tabTo(page, page.getByRole('button', { name: '返回所选项' }), true)
    await page.keyboard.press('Enter')
    await expect(first).toBeFocused()
    await enter()
    await expect(titleInput).toHaveValue('保留的编辑标题')
    await tabTo(page, titleInput)
    await page.keyboard.press('ControlOrMeta+A')
    await page.keyboard.type('重点0')
    await tabTo(page, page.getByRole('button', { name: '标记完成', exact: true }))
    await page.keyboard.press('Enter')
    await tabTo(page, page.getByRole('button', { name: '确认完成', exact: true }))
    await page.keyboard.press('Enter')
    await expect(page.locator('.action-detail .status-badge')).toHaveText('已完成')
    await expect(page.getByRole('button', { name: '开始记录', exact: true })).toHaveCount(0)
    await tabTo(page, page.getByRole('button', { name: '返回所选项', exact: true }), true)
    await page.keyboard.press('Enter')
    await expect(first).toBeFocused()
    const routine = page.locator('.today-routine-row').first()
    await tabTo(page, routine)
    await page.keyboard.press('Enter')
    await enter()
    await app.evaluate(({ ipcMain }) => {
      const handlers = Reflect.get(ipcMain, '_invokeHandlers') as Map<
        string,
        (...args: unknown[]) => unknown
      >
      const original = handlers.get('routine-records:begin')!
      let first = true
      ipcMain.removeHandler('routine-records:begin')
      ipcMain.handle('routine-records:begin', (...args) => {
        if (first) {
          first = false
          return {
            ok: false,
            error: { code: 'persistence-failed', message: 'synthetic pre-begin failure' }
          }
        }
        return original(...args)
      })
    })
    const begin = page.getByRole('button', { name: '记录例行', exact: true })
    await tabTo(page, begin)
    await page.keyboard.press('Enter')
    await expect(page.locator('.routine-recording-panel [role="alert"]')).toBeVisible()
    await tabTo(page, page.getByRole('button', { name: '返回所选项' }), true)
    await page.keyboard.press('Enter')
    await expect(routine).toBeFocused()
    await enter()
    await expect(page.locator('.routine-recording-panel [role="alert"]')).toBeVisible()
    await tabTo(page, begin)
    await page.keyboard.press('Enter')
    const duration = page.getByLabel('投入时长（分钟，可选）')
    await tabTo(page, duration)
    await page.keyboard.type('2')
    await tabTo(page, nav('首页'), true)
    await page.keyboard.press('Enter')
    await tabTo(page, nav('今天'))
    await page.keyboard.press('Enter')
    await expect(nav('今天')).toBeFocused()
    await expect(duration).toHaveValue('2')
    await tabTo(page, routine)
    await page.keyboard.press('Enter')
    await enter()
    await expect(duration).toHaveValue('2')
    await tabTo(page, page.getByRole('button', { name: '放弃草稿', exact: true }))
    await page.keyboard.press('Enter')
  } finally {
    await app?.close()
    await removeTemporaryTestRoot(root)
  }
})
