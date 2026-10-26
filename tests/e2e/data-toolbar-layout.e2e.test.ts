import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

async function geometry(page: Page) {
  return page.evaluate(() => {
    const workspace = document.querySelector('.data-workspace')!
    const toolbar = document.querySelector('.data-toolbar')!
    const search = document.querySelector('.data-history-search input')!
    const origin = workspace.getBoundingClientRect().top - workspace.scrollTop
    return {
      display: getComputedStyle(workspace).display,
      rows: getComputedStyle(workspace).gridTemplateRows,
      toolbarHeight: toolbar.getBoundingClientRect().height,
      searchY: search.getBoundingClientRect().top - origin
    }
  })
}

for (const [width, height, zoom] of [
  [1188, 848, 1],
  [828, 604, 1],
  [828, 604, 1.5]
]) {
  test(`data toolbar stays content-sized at ${width}x${height}, zoom ${zoom}`, async () => {
    test.slow()
    const root = await createTemporaryTestRoot()
    let app: ElectronApplication | undefined
    try {
      app = await electron.launch({
        chromiumSandbox: true,
        cwd: root.root,
        args: [
          ...(process.platform === 'linux' ? ['--headless', '--ozone-platform=headless'] : []),
          join(process.cwd(), 'out/main/index.js'),
          `--user-data-dir=${root.electronUserData}`
        ],
        env: minimalElectronEnvironment(root)
      })
      const page = await app.firstWindow()
      await app.evaluate(
        ({ BrowserWindow }, { width, height, zoom }) => {
          const window = BrowserWindow.getAllWindows()[0]!
          window.setSize(width, height)
          window.webContents.setZoomFactor(zoom)
        },
        { width, height, zoom }
      )
      const actionId = await page.evaluate(async () => {
        const goal = await window.myTracer.goals.create({
          name: '合成布局目标',
          initialNextAction: { title: '普通行动' }
        })
        if (!goal.ok) throw Error(goal.error.message)
        const actionId = goal.value.currentNextActionId!
        for (let day = 1; day <= 3; day++) {
          const record = await window.myTracer.dataControl.backfillActionRecord({
            actionId,
            occurredOn: `2026-08-0${day}`,
            durationMinutes: 5,
            outcome: 'partial',
            note: day === 1 ? '唯一短词' : '普通笔记'
          })
          if (!record.ok) throw Error(record.error.message)
        }
        return actionId
      })
      const nav = page.getByRole('navigation').getByRole('button', { name: '数据', exact: true })
      await nav.click()
      const rows = page.locator('.data-history-row')
      const query = page.getByRole('searchbox', { name: '查找保存的文字' })
      await expect(rows).toHaveCount(3)
      const baseline = await geometry(page)
      const evidence = [baseline]
      const stable = async () => {
        const actual = await geometry(page)
        evidence.push(actual)
        expect(Math.abs(actual.toolbarHeight - baseline.toolbarHeight)).toBeLessThanOrEqual(1)
        expect(Math.abs(actual.searchY - baseline.searchY)).toBeLessThanOrEqual(1)
      }
      try {
        for (const [text, count] of [
          ['唯一短词', 1],
          ['不存在的文字', 0],
          ['', 3]
        ] as const) {
          await query.fill(text)
          await expect(rows).toHaveCount(count)
          await stable()
        }
        await page.getByRole('button', { name: /筛选记录 ·/ }).click()
        const filters = page.getByRole('dialog', { name: '筛选记录', exact: true })
        await filters.getByRole('combobox', { name: /^记录类型/ }).selectOption('routine-record')
        await expect(rows).toHaveCount(0)
        await stable()
        await filters.getByRole('combobox', { name: /^记录类型/ }).selectOption('action-record')
        await filters
          .getByRole('combobox', { name: /^关联目标/ })
          .selectOption({ label: '合成布局目标' })
        await expect(rows).toHaveCount(3)
        await filters.getByRole('button', { name: '完成筛选', exact: true }).click()
        await stable()
        await page.evaluate(async (actionId) => {
          for (let day = 10; day <= 18; day++) {
            const record = await window.myTracer.dataControl.backfillActionRecord({
              actionId,
              occurredOn: `2026-08-${day}`,
              durationMinutes: 5,
              outcome: 'partial',
              note: day === 18 ? '长文标记\n' + '完整合成长笔记。\n'.repeat(80) : '新增普通笔记'
            })
            if (!record.ok) throw Error(record.error.message)
          }
        }, actionId)
        await page
          .getByRole('navigation')
          .getByRole('button', { name: '今天', exact: true })
          .click()
        await nav.click()
        await expect(rows).toHaveCount(8)
        await stable()
        await page.getByRole('button', { name: '下一页', exact: true }).click()
        await expect(rows).toHaveCount(4)
        await stable()
        await query.fill('长文标记')
        await expect(rows).toHaveCount(1)
        await stable()
        await rows.click()
        const detail = page.getByLabel('所选记录')
        await detail.getByText('展开完整笔记', { exact: true }).click()
        await expect(detail).toContainText('完整合成长笔记。')
        await stable()
        await query.fill('')
        await expect(rows).toHaveCount(8)
        await stable()
        const wide = await page.evaluate(() => innerWidth > 1000 && innerHeight > 560)
        const scroller = page.locator(wide ? '.data-history-list' : '.data-workspace')
        await expect
          .poll(() => scroller.evaluate((el) => el.scrollHeight - el.clientHeight))
          .toBeGreaterThan(80)
        await scroller.evaluate((el) => {
          el.scrollTop = 80
        })
        await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBe(80)
        if (wide) {
          await detail.evaluate((el) => {
            el.scrollTop = 80
          })
          await expect.poll(() => detail.evaluate((el) => el.scrollTop)).toBe(80)
        }
        expect(
          await page
            .locator('.data-workspace')
            .evaluate((el) => el.scrollWidth <= el.clientWidth + 1)
        ).toBe(true)
      } finally {
        await test.info().attach('toolbar-geometry', {
          body: JSON.stringify(evidence),
          contentType: 'application/json'
        })
      }
    } finally {
      await app?.close()
      await removeTemporaryTestRoot(root)
    }
  })
}
