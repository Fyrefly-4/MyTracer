import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

test('Home wheel scrolling reaches recent records at a constrained size and restores its position', async () => {
  const root = await createTemporaryTestRoot()
  let app: Awaited<ReturnType<typeof electron.launch>> | undefined
  try {
    app = await electron.launch({
      cwd: root.root,
      args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
      env: minimalElectronEnvironment(root)
    })
    const page = await app.firstWindow()
    await expect(page.getByRole('heading', { name: '看看最近走到了哪里。' })).toBeVisible()
    await page.getByRole('navigation').getByRole('button', { name: '目标', exact: true }).click()
    await page.evaluate(async () => {
      const today = await window.myTracer.today.get({})
      if (!today.ok) throw new Error('seed date failed')
      for (let i = 1; i <= 3; i++) {
        const goal = await window.myTracer.goals.create({
          name: `滚动目标 ${i}`,
          initialNextAction: { title: `滚动行动 ${i}` }
        })
        if (!goal.ok || !goal.value.currentNextActionId) throw new Error('seed goal failed')
        const record = await window.myTracer.dataControl.backfillActionRecord({
          actionId: goal.value.currentNextActionId,
          occurredOn: today.value.localDate,
          outcome: 'partial',
          note: `底部记录 ${i}`,
          durationMinutes: 10
        })
        if (!record.ok) throw new Error('seed record failed')
      }
      for (let i = 1; i <= 5; i++) {
        const routine = await window.myTracer.routines.create({
          name: `滚动例行 ${i}`,
          minimumAction: '做一点',
          weekdays: [1, 2, 3, 4, 5, 6, 7]
        })
        if (!routine.ok) throw new Error('seed routine failed')
      }
    })
    for (const zoom of [1, 1.5]) {
      await app.evaluate(({ BrowserWindow }, factor) => {
        const window = BrowserWindow.getAllWindows()[0]
        window.setContentSize(820, 600)
        window.webContents.setZoomFactor(factor)
      }, zoom)
      await page.getByRole('navigation').getByRole('button', { name: '首页', exact: true }).click()
      await expect(page.locator('.home-goal')).toHaveCount(3)
      const bottomRecord = page.locator('.home-recent button').last()
      await expect(bottomRecord).not.toBeInViewport()
      const bounds = await page.locator('.home-page').boundingBox()
      if (!bounds) throw new Error('Home not laid out')
      // Real wheel input: locator.click/scrollIntoView can silently scroll overflow:hidden.
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 80)
      await page.mouse.wheel(0, 10000)
      await expect(bottomRecord).toBeInViewport({ ratio: 1 })
      await expect
        .poll(() => page.locator('.home-page').evaluate((el) => el.scrollTop))
        .toBeGreaterThan(0)
      const position = await page.locator('.home-page').evaluate((el) => el.scrollTop)
      await expect(page.locator('.topbar')).toBeInViewport({ ratio: 1 })
      await page.getByRole('navigation').getByRole('button', { name: '今天', exact: true }).click()
      await page.getByRole('navigation').getByRole('button', { name: '首页', exact: true }).click()
      await expect
        .poll(() => page.locator('.home-page').evaluate((el) => el.scrollTop))
        .toBeCloseTo(position, 0)
      await expect(bottomRecord).toBeInViewport({ ratio: 1 })
      await bottomRecord.click()
      await expect(page.getByRole('region', { name: '所选记录', exact: true })).toBeVisible()
    }
  } finally {
    await app?.close()
    await removeTemporaryTestRoot(root)
  }
})
