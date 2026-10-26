import { join } from 'node:path'
import { expect, test, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

for (const [width, height] of [
  [1188, 848],
  [828, 604]
]) {
  test(`goal descriptions keep the next step reachable at ${width}x${height}`, async () => {
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
      await app.evaluate(
        ({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0]!.setSize(...size),
        [width, height] as [number, number]
      )
      const descriptions = [
        '合成多段说明。'.repeat(30) + '\n\n' + '第二段完整原文。'.repeat(40),
        'LongWord'.repeat(90),
        '短说明 **保留原文**'
      ]
      await page.evaluate(async (descriptions) => {
        for (const [i, description] of descriptions.entries()) {
          const r = await window.myTracer.goals.create({
            name: `说明测试${i}`,
            description,
            initialNextAction: { title: '做一个小步骤' }
          })
          if (!r.ok) throw Error(r.error.message)
        }
      }, descriptions)
      await page.getByRole('navigation').getByRole('button', { name: '目标', exact: true }).click()
      for (const i of [0, 1]) {
        await page
          .locator('.goal-list-item')
          .filter({ hasText: `说明测试${i}` })
          .click()
        const toggle = page.getByText('展开完整说明', { exact: true })
        await expect(toggle).toBeVisible()
        await expect(page.locator('.next-action-panel strong')).toBeInViewport({ ratio: 1 })
        await toggle.focus()
        await page.keyboard.press('Enter')
        await expect(page.getByText('收起说明', { exact: true })).toBeFocused()
        await expect(page.locator('.goal-description')).toHaveText(descriptions[i])
        expect(
          await page
            .locator('.object-detail-scroll')
            .evaluate((el) => el.scrollWidth <= el.clientWidth)
        ).toBe(true)
        await page.keyboard.press('Space')
        await expect(toggle).toBeFocused()
        await expect(page.locator('.goal-description')).not.toBeVisible()
        await toggle.click()
      }
      await page.locator('.goal-list-item').filter({ hasText: '说明测试2' }).click()
      await expect(page.locator('.goal-description')).toHaveText(descriptions[2])
      await expect(page.getByText('展开完整说明', { exact: true })).toHaveCount(0)
      await page.locator('.goal-list-item').filter({ hasText: '说明测试0' }).click()
      await expect(page.getByText('展开完整说明', { exact: true })).toBeVisible()
      await expect(page.locator('.goal-description')).not.toBeVisible()
      await page.getByText('编辑与管理目标', { exact: true }).click()
      await expect(page.getByLabel('说明（可选）', { exact: true })).toHaveValue(descriptions[0])
    } finally {
      await app?.close()
      await removeTemporaryTestRoot(root)
    }
  })
}
