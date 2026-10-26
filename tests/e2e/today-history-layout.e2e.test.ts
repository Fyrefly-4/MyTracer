import { join } from 'node:path'
import { expect, test, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

test('action history keeps readable content at narrow widths and zoom without collapsing the master', async () => {
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
      const action = await window.myTracer.actions.create({
        title: '合成长行动内容，保留可读宽度。'.repeat(8)
      })
      if (!action.ok) throw Error(action.error.message)
      for (let day = 1; day <= 7; day++) {
        const record = await window.myTracer.dataControl.backfillActionRecord({
          actionId: action.value.id,
          occurredOn: `2026-08-0${day}`,
          durationMinutes: day === 7 ? null : 0,
          outcome: 'partial',
          summary: `合成第${day}笔`
        })
        if (!record.ok) throw Error(record.error.message)
      }
      const selected = await window.myTracer.today.selectAction({ actionId: action.value.id })
      if (!selected.ok) throw Error(selected.error.message)
    })
    await page.getByRole('navigation').getByRole('button', { name: '今天', exact: true }).click()
    const table = page.getByRole('table', { name: '已有行动记录' })
    const rows = table.locator('tbody tr')
    const pane = page.locator('.today-detail-pane')
    const master = page.locator('.today-master-list')
    for (const [width, height, zoom] of [
      [1188, 848, 1],
      [828, 604, 1],
      [828, 604, 1.5]
    ]) {
      await app.evaluate(
        ({ BrowserWindow }, size) => {
          const win = BrowserWindow.getAllWindows()[0]!
          win.setSize(size[0], size[1])
          win.webContents.setZoomFactor(size[2])
        },
        [width, height, zoom]
      )
      await expect(rows).toHaveCount(5)
      await expect(page.getByRole('button', { name: '收起今天列表', exact: true })).toBeVisible()
      const content = rows.first().locator('td').nth(1)
      const geometry = await content.evaluate((el) => ({
        width: el.getBoundingClientRect().width,
        font: parseFloat(getComputedStyle(el).fontSize)
      }))
      expect(geometry.width).toBeGreaterThanOrEqual(geometry.font * 8)
      const layout = await table.evaluate((el) => ({
        width: el.getBoundingClientRect().width,
        display: getComputedStyle(el).display
      }))
      expect(layout.display).toBe(width === 1188 ? 'table' : 'block')
      await test.info().attach(`history-${width}-${zoom}`, {
        body: JSON.stringify({ ...geometry, ...layout }),
        contentType: 'application/json'
      })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true
      )
      expect(await pane.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
      await expect(rows.first()).toContainText('时长未记录')
      await expect(rows.nth(1)).toContainText('少于 1 分钟')
      const before = await master.evaluate((el) => el.scrollTop)
      await rows
        .first()
        .getByRole('button', { name: /查看记录/ })
        .focus()
      await page.keyboard.press('Enter')
      await expect(page.getByLabel('记录详情', { exact: true })).toContainText('合成第7笔')
      expect(await master.evaluate((el) => el.scrollTop)).toBe(before)
      const pager = page.getByLabel('行动记录分页')
      await pager.getByRole('button', { name: '下一页' }).click()
      await expect(rows).toHaveCount(2)
      await expect(pager).toContainText('2 / 2')
      await pager.getByRole('button', { name: '上一页' }).click()
    }
    const facts = await page.evaluate(() => window.myTracer.dataControl.list())
    if (!facts.ok) throw Error(facts.error.message)
    expect(facts.value.actionRecords).toHaveLength(7)
  } finally {
    await app?.close()
    await removeTemporaryTestRoot(root)
  }
})
