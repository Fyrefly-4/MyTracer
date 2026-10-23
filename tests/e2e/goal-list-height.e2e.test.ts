import { join } from 'node:path'
import { expect, test, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

test('goal list remains usable at short heights and zoom without coupling detail scroll', async () => {
  test.slow()
  const root = await createTemporaryTestRoot()
  let app: ElectronApplication | undefined
  try {
    app = await electron.launch({
      cwd: root.root,
      args: [
        join(process.cwd(), 'out/main/index.js'),
        `--user-data-dir=${root.electronUserData}`,
        ...(process.platform === 'linux' ? ['--ozone-platform=headless', '--no-sandbox'] : [])
      ],
      env: minimalElectronEnvironment(root)
    })
    const page = await app.firstWindow()
    const navigate = async (name: string) => {
      await page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
    }
    await navigate('目标')
    await expect(page.locator('.workspace-count')).toHaveText('0 个目标')
    await expect(page.getByRole('button', { name: '新建目标', exact: true })).toBeVisible()
    for (const [width, height] of [
      [1440, 900],
      [1120, 760],
      [820, 650]
    ]) {
      for (const zoom of [1, 1.25, 1.5]) {
        await app.evaluate(
          ({ BrowserWindow }, dimensions) => {
            const window = BrowserWindow.getAllWindows()[0]
            window.setContentSize(dimensions.width, dimensions.height)
            window.webContents.setZoomFactor(dimensions.zoom)
          },
          { width, height, zoom }
        )
        await expect
          .poll(() =>
            page.locator('.object-master-scroll').evaluate((element) => element.clientHeight)
          )
          .toBeGreaterThan(140)
        await expect(page.locator('.goal-list-item')).toHaveCount(0)
        await expect(page.getByLabel('搜索目标')).toBeVisible()
      }
    }
    await page.evaluate(async () => {
      for (let index = 0; index < 14; index++) {
        const result = await window.myTracer.goals.create({
          name: `阅读与学习样例 ${index + 1}：让每天的一小步留下可以回顾的痕迹`,
          description: Array.from({ length: 30 }, () => '仅用于隔离测试的长说明。').join('\n'),
          initialNextAction: { title: '读一章并整理三个值得继续追问的问题' }
        })
        if (!result.ok) throw new Error('Cannot create isolated goal fixture')
      }
    })
    await navigate('首页')
    await navigate('目标')
    await expect(page.locator('.workspace-count')).toHaveText('14 个目标')
    const disclosure = page.locator('.goal-list-guidance')
    const summary = disclosure.locator('summary')
    const list = page.locator('.object-master-scroll')
    const detail = page.locator('.object-detail-scroll')
    for (const [width, height] of [
      [1440, 900],
      [1120, 760],
      [820, 650]
    ]) {
      for (const zoom of [1, 1.25, 1.5]) {
        await app.evaluate(
          ({ BrowserWindow }, dimensions) => {
            const window = BrowserWindow.getAllWindows()[0]
            window.setContentSize(dimensions.width, dimensions.height)
            window.webContents.setZoomFactor(dimensions.zoom)
          },
          { width, height, zoom }
        )
        await expect.poll(() => page.evaluate(() => innerWidth)).toBeCloseTo(width / zoom, 0)
        // Reserve enough room to read a multi-line item, even at the smallest window.
        await expect
          .poll(() => list.evaluate((element) => element.clientHeight))
          .toBeGreaterThan(140)
        await expect(page.getByLabel('搜索目标')).toBeVisible()
        await expect(page.getByLabel('状态', { exact: true })).toBeVisible()
        await summary.focus()
        await page.keyboard.press('Enter')
        await expect(disclosure).toHaveAttribute('open', '')
        await expect(summary).toBeFocused()
        await expect(disclosure).toContainText('行动日期截至')
        await page.keyboard.press('Space')
        await expect(disclosure).not.toHaveAttribute('open')
        await expect(summary).toBeFocused()
        await detail.evaluate((element) => {
          element.scrollTop = 90
        })
        await expect
          .poll(() => detail.evaluate((element) => Math.round(element.scrollTop)))
          .toBe(90)
        const detailBefore = await detail.evaluate((element) => element.scrollTop)
        await list.evaluate((element) => {
          element.scrollTop = 100
        })
        await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBe(100)
        expect(await detail.evaluate((element) => element.scrollTop)).toBe(detailBefore)
        await detail.evaluate((element) => {
          element.scrollTop = 180
        })
        await expect
          .poll(() => detail.evaluate((element) => Math.round(element.scrollTop)))
          .toBe(180)
        expect(await list.evaluate((element) => element.scrollTop)).toBe(100)
        await list.evaluate((element) => {
          element.scrollTop = 0
        })
      }
    }
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await summary.focus()
    await page.keyboard.press('Enter')
    await expect(disclosure).toHaveAttribute('open', '')
    await page.getByLabel('搜索目标').fill('样例 14：')
    await expect(page.locator('.goal-list-item')).toHaveCount(1)
    await page.getByLabel('搜索目标').fill('没有匹配的测试目标')
    await expect(page.locator('.goal-list-item')).toHaveCount(0)
    await expect(page.getByLabel('搜索目标')).toBeFocused()
  } finally {
    await app?.close().catch(() => undefined)
    await removeTemporaryTestRoot(root)
  }
})
