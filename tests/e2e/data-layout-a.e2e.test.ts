import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

async function withData(
  run: (app: ElectronApplication, page: Page) => Promise<void>
): Promise<void> {
  const root = await createTemporaryTestRoot()
  let app: ElectronApplication | undefined
  try {
    app = await electron.launch({
      cwd: root.root,
      args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
      env: minimalElectronEnvironment(root)
    })
    const page = await app.firstWindow()
    await page.evaluate(async () => {
      const action = await window.myTracer.actions.create({ title: '合成布局行动' })
      const routine = await window.myTracer.routines.create({
        name: '合成布局例行',
        minimumAction: '走一步',
        weekdays: [1]
      })
      if (!action.ok || !routine.ok) throw Error('fixture failed')
      for (let day = 10; day < 20; day++) {
        const record = await window.myTracer.dataControl.backfillActionRecord({
          actionId: action.value.id,
          occurredOn: `2026-08-${day}`,
          durationMinutes: 5,
          outcome: 'partial',
          note: Array.from({ length: 50 }, (_, i) => `合成笔记第 ${i} 行`).join('\n')
        })
        if (!record.ok) throw Error('record fixture failed')
      }
    })
    await page.getByRole('navigation').getByRole('button', { name: '数据', exact: true }).click()
    await expect(page.locator('.data-history-row')).toHaveCount(8)
    await run(app, page)
  } finally {
    await app?.close().catch(() => undefined)
    await removeTemporaryTestRoot(root)
  }
}

test('backfill drawer retains both drafts across close routes, traps focus and guards navigation', async () => {
  test.slow()
  await withData(async (_app, page) => {
    const trigger = page.getByRole('button', { name: /补记记录/ })
    const drawer = page.getByRole('dialog', { name: '补记历史记录', exact: true })
    const open = async (): Promise<void> => {
      await trigger.click()
      await expect(page.getByRole('button', { name: '关闭补记历史记录' })).toBeFocused()
    }
    await open()
    await expect(page.getByLabel('例行补记日期')).toHaveCount(0)
    await page.getByLabel('行动补记备注').fill('行动草稿')
    await page.getByLabel('补记类型', { exact: true }).selectOption('routine')
    await expect(page.getByLabel('行动补记备注')).toHaveCount(0)
    await page.getByLabel('例行补记备注').fill('例行草稿')
    await page.getByRole('button', { name: '取消例行补记' }).click()
    await expect(drawer).toHaveCount(0)
    await expect(trigger).toBeFocused()
    await open()
    await expect(page.getByLabel('例行补记备注')).toHaveValue('例行草稿')
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
    await open()
    await page.getByRole('button', { name: '关闭补记历史记录' }).click()
    await open()
    const box = await drawer.boundingBox()
    if (!box || box.x < 1) throw Error('Expected side drawer with backdrop')
    await page.mouse.click(box.x / 2, box.y + 10)
    await expect(drawer).toHaveCount(0)
    await open()
    await page.getByLabel('补记类型', { exact: true }).selectOption('action')
    await expect(page.getByLabel('行动补记备注')).toHaveValue('行动草稿')
    await page.getByRole('button', { name: '关闭补记历史记录' }).focus()
    await page.keyboard.press('Shift+Tab')
    await expect(page.getByRole('button', { name: '取消行动补记' })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: '关闭补记历史记录' })).toBeFocused()
    await page.getByRole('button', { name: '清空当前草稿' }).click()
    await page.keyboard.press('Escape')
    await expect(page.getByLabel('行动补记备注')).toHaveValue('行动草稿')
    await page.getByRole('button', { name: '清空当前草稿' }).click()
    await page.getByRole('button', { name: '放弃草稿', exact: true }).click()
    await expect(page.getByLabel('行动补记备注')).toHaveValue('')
    await page.getByRole('button', { name: '关闭补记历史记录' }).click()
    await page.getByRole('navigation').getByRole('button', { name: '今天', exact: true }).click()
    const leave = page.getByRole('dialog', { name: '离开数据页' })
    await expect(leave).toBeVisible()
    await page.keyboard.press('Escape')
    await open()
    await page.getByLabel('补记类型', { exact: true }).selectOption('routine')
    await expect(page.getByLabel('例行补记备注')).toHaveValue('例行草稿')
    await page.getByRole('button', { name: '关闭补记历史记录' }).click()
    await page.getByRole('navigation').getByRole('button', { name: '今天', exact: true }).click()
    await leave.getByRole('button', { name: '放弃修改并离开' }).click()
    await expect(page.locator('.data-workspace')).toHaveCount(0)
    await page.getByRole('navigation').getByRole('button', { name: '数据', exact: true }).click()
    await open()
    await expect(page.getByLabel('行动补记备注')).toHaveValue('')
    await page.getByLabel('补记类型', { exact: true }).selectOption('routine')
    await expect(page.getByLabel('例行补记备注')).toHaveValue('')
  })
})

test('goal cover drafts do not block leaving Data while record edits still require confirmation', async () => {
  await withData(async (_app, page) => {
    const navigate = async (name: string): Promise<void> => {
      await page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
    }
    const goalName = '合成目标封面草稿'
    await page.evaluate(async (name) => {
      const goal = await window.myTracer.goals.create({ name })
      if (!goal.ok) throw Error('goal fixture failed')
    }, goalName)
    const openAppearance = async (): Promise<void> => {
      await navigate('目标')
      await page.locator('.goal-list-item').filter({ hasText: goalName }).click()
      const detail = page.getByLabel(`${goalName} 详情`, { exact: true })
      await detail.getByText('编辑与管理目标', { exact: true }).click()
      await detail.getByText('外观', { exact: true }).click()
    }
    await openAppearance()
    await page.getByLabel('首页标记（可选）', { exact: true }).fill('新')
    const leave = page.getByRole('dialog', { name: '离开数据页' })
    for (let visit = 0; visit < 2; visit++) {
      await navigate('数据')
      await expect(page.locator('.data-history-row')).toHaveCount(8)
      await expect(page.getByRole('button', { name: '编辑记录', exact: true })).toBeVisible()
      await navigate('今天')
      await expect(page.locator('.app-shell')).toHaveAttribute('data-section', 'today')
      await expect(leave).toHaveCount(0)
    }
    await navigate('数据')
    await page.getByRole('button', { name: '编辑记录', exact: true }).click()
    await page.getByLabel('行动分钟', { exact: true }).fill('42')
    await navigate('今天')
    await expect(leave).toBeVisible()
    await leave.getByRole('button', { name: '继续留在数据页' }).click()
    await expect(page.getByLabel('行动分钟', { exact: true })).toHaveValue('42')
    await navigate('今天')
    await leave.getByRole('button', { name: '放弃修改并离开' }).click()
    await navigate('数据')
    await expect(page.getByLabel('行动分钟', { exact: true })).toHaveCount(0)
    await navigate('今天')
    await expect(page.locator('.app-shell')).toHaveAttribute('data-section', 'today')
    await expect(leave).toHaveCount(0)
    await openAppearance()
    await expect(page.getByLabel('首页标记（可选）', { exact: true })).toHaveValue('新')
  })
})

test('export opens an explanatory dialog and remains usable after rejected export', async () => {
  await withData(async (app, page) => {
    await app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('exports:generate')
      ipcMain.handle('exports:generate', () => {
        throw Error('synthetic export rejection')
      })
    })
    await page.getByRole('button', { name: '导出', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '导出数据' })
    await expect(dialog).toContainText('尚不支持自动导入或一键恢复')
    await expect(dialog.getByRole('status')).toHaveCount(0)
    const exportButton = dialog.getByRole('button', { name: '导出完整数据' })
    await exportButton.click()
    await expect(dialog.getByRole('status')).toContainText('导出暂时失败')
    await expect(exportButton).toBeEnabled()
    await app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('exports:generate')
      ipcMain.handle('exports:generate', () => ({ ok: false, error: { code: 'write-failed' } }))
    })
    await exportButton.click()
    await expect(dialog.getByRole('status')).toContainText('文件未能安全写入')
    await app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('exports:generate')
      ipcMain.handle('exports:generate', () => ({ ok: true, value: { kind: 'cancelled' } }))
    })
    await exportButton.click()
    await expect(dialog.getByRole('status')).toContainText('已取消导出，未创建文件')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: '导出', exact: true })).toBeFocused()
  })
})

test('reading panes and modal forms remain usable at small windows and 100/125/150 percent zoom', async () => {
  test.slow()
  await withData(async (app, page) => {
    for (const width of [1280, 1040]) {
      for (const zoom of [1, 1.25, 1.5]) {
        await app.evaluate(
          ({ BrowserWindow }, { width, zoom }) => {
            const window = BrowserWindow.getAllWindows()[0]!
            window.setSize(width, 800)
            window.webContents.setZoomFactor(zoom)
          },
          { width, zoom }
        )
        await expect
          .poll(() =>
            page.evaluate(() => {
              const workspace = document.querySelector('.data-workspace')!
              return workspace.scrollWidth <= workspace.clientWidth + 1
            })
          )
          .toBe(true)
        const layout = await page.evaluate(() => {
          const workspace = document.querySelector('.data-workspace')!
          const history = document.querySelector('.data-history')!
          const list = document.querySelector('.data-history-list')!
          const detail = document.querySelector('.selected-data-record')!
          return {
            wide: innerWidth > 1000 && innerHeight > 560,
            workspace: getComputedStyle(workspace).overflowY,
            history: getComputedStyle(history).overflowY,
            list: getComputedStyle(list).overflowY,
            detail: getComputedStyle(detail).overflowY,
            stacked:
              detail.getBoundingClientRect().top >= history.getBoundingClientRect().bottom - 1
          }
        })
        if (layout.wide) {
          expect(layout).toMatchObject({
            workspace: 'hidden',
            history: 'hidden',
            list: 'auto',
            detail: 'auto'
          })
          await page.locator('.data-history-list').evaluate((el) => {
            el.scrollTop = 80
          })
          await page.locator('.selected-data-record').evaluate((el) => {
            el.scrollTop = 100
          })
          await expect
            .poll(() => page.locator('.data-history-list').evaluate((el) => el.scrollTop))
            .toBe(80)
          await expect
            .poll(() => page.locator('.selected-data-record').evaluate((el) => el.scrollTop))
            .toBe(100)
        } else {
          expect(layout).toMatchObject({
            stacked: true,
            history: 'visible',
            list: 'visible',
            detail: 'visible'
          })
        }
        if (!layout.wide) {
          const row = page.locator('.data-history-row[aria-pressed="false"]').first()
          await row.click()
          await expect
            .poll(() =>
              page.locator('.selected-data-record').evaluate((el) => {
                const workspace = el.closest('.data-workspace')!.getBoundingClientRect()
                const detail = el.getBoundingClientRect()
                return detail.top >= workspace.top - 1 && detail.top < workspace.bottom
              })
            )
            .toBe(true)
        }
        await page.getByRole('button', { name: '补记记录', exact: true }).click()
        const drawer = page.getByRole('dialog', { name: '补记历史记录', exact: true })
        expect(await drawer.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
        await page.getByRole('button', { name: '取消行动补记' }).click()
        await page.getByRole('button', { name: /筛选记录 ·/ }).click()
        const filters = page.getByRole('dialog', { name: '筛选记录', exact: true })
        expect(await filters.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
        await page.getByRole('button', { name: '完成筛选' }).click()
      }
    }
  })
})
