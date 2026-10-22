import { join } from 'node:path'
import { expect, test, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

async function setDate(
  app: ElectronApplication,
  year: number,
  month: number,
  day: number
): Promise<void> {
  await app.evaluate(
    (_electron, [year, month, day]) => {
      const RealDate = Date
      const instant = new RealDate(year, month - 1, day, 12).toISOString()
      Reflect.set(
        globalThis,
        'Date',
        new Proxy(RealDate, {
          construct(target, args) {
            return Reflect.construct(target, args.length ? args : [instant])
          }
        })
      )
    },
    [year, month, day]
  )
}

test('previous adjustment is optional, read-only and does not replace the current draft or context', async () => {
  test.skip(process.platform !== 'win32', 'Requires supported Windows Electron')
  const root = await createTemporaryTestRoot()
  let app: ElectronApplication | undefined
  try {
    app = await electron.launch({
      chromiumSandbox: true,
      cwd: root.root,
      args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
      env: minimalElectronEnvironment(root)
    })
    const page = await app.firstWindow()
    await setDate(app, 2025, 12, 31)
    const original = '上周写下的想法\n' + '完整原文不截断'.repeat(200) + '\n最后一行'
    await page.evaluate(async (nextAdjustment) => {
      const begin = await window.myTracer.review.begin({})
      if (!begin.ok) throw Error('begin')
      const result = await window.myTracer.review.complete({
        reviewContextId: begin.value.reviewContextId,
        confirmedProgress: '上周进展',
        mainObstacle: '上周阻力',
        nextAdjustment,
        relatedGoalId: null,
        nextStepChange: { kind: 'none' }
      })
      if (!result.ok) throw Error('seed')
    }, original)
    await setDate(app, 2026, 1, 7)
    await app.evaluate(({ ipcMain }) => {
      const handlers = Reflect.get(ipcMain, '_invokeHandlers') as Map<
        string,
        (...args: unknown[]) => unknown
      >
      const originalRead = handlers.get('review:get-previous-adjustment')!
      const state = { calls: 0, mode: 'real', pending: [] as Array<() => void> }
      Reflect.set(globalThis, '__previousRead', state)
      ipcMain.removeHandler('review:get-previous-adjustment')
      ipcMain.handle('review:get-previous-adjustment', (...args) => {
        state.calls++
        if (state.mode === 'hold')
          return new Promise((resolve) =>
            state.pending.push(() =>
              resolve({
                ok: true,
                value: {
                  periodStartedOn: '2025-12-29',
                  periodEndedOn: '2026-01-04',
                  nextAdjustment: '迟到原文'
                }
              })
            )
          )
        if (state.mode === 'fail')
          return { ok: false, error: { code: 'persistence-failed', message: 'synthetic' } }
        if (state.mode === 'stale')
          return { ok: false, error: { code: 'context-stale', message: 'synthetic' } }
        return originalRead(...args)
      })
    })
    const mode = (value: string) =>
      app!.evaluate((_electron, value) => {
        Reflect.get(globalThis, '__previousRead').mode = value
      }, value)
    await page.getByRole('navigation').getByRole('button', { name: '复盘', exact: true }).click()
    await page.getByLabel('一个真实进展', { exact: true }).fill('当前未保存进展')
    await page.getByLabel('一个主要阻力', { exact: true }).fill('当前未保存阻力')
    await page.getByLabel('下一周期的一个调整', { exact: true }).fill('当前未保存调整')
    expect(await app.evaluate(() => Reflect.get(globalThis, '__previousRead').calls)).toBe(0)
    const disclosure = page.locator('.previous-adjustment')
    const summary = disclosure.locator('summary')
    await mode('hold')
    await summary.focus()
    await summary.press('Enter')
    await expect(disclosure.getByRole('status')).toContainText('正在读取')
    await summary.click()
    await mode('real')
    await summary.click()
    await expect(disclosure).toContainText('2025-12-29 至 2026-01-04')
    await expect(disclosure.locator('.previous-adjustment-text')).not.toContainText('最后一行')
    await disclosure.getByRole('button', { name: '查看完整原文' }).click()
    await expect(disclosure.locator('.previous-adjustment-text')).toHaveText(original)
    await app.evaluate(() => {
      for (const resolve of Reflect.get(globalThis, '__previousRead').pending.splice(0)) resolve()
    })
    await expect(disclosure.locator('.previous-adjustment-text')).toHaveText(original)
    for (const width of [1440, 820, 547]) {
      await page.setViewportSize({ width, height: 650 })
      expect(await disclosure.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    }
    await summary.click()
    await mode('fail')
    await summary.click()
    await expect(disclosure.getByRole('status')).toContainText('不表示没有保存')
    await mode('real')
    await disclosure.getByRole('button', { name: '重试读取上一周' }).press('Enter')
    await expect(disclosure).toContainText('2025-12-29 至 2026-01-04')
    await summary.click()
    await mode('stale')
    await summary.click()
    await expect(disclosure.getByRole('status')).toContainText('上下文已失效')
    await expect(page.getByLabel('一个真实进展', { exact: true })).toHaveValue('当前未保存进展')
    await expect(page.getByLabel('一个主要阻力', { exact: true })).toHaveValue('当前未保存阻力')
    await expect(page.getByLabel('下一周期的一个调整', { exact: true })).toHaveValue(
      '当前未保存调整'
    )
    await mode('real')
    await page.getByRole('button', { name: '保存复盘', exact: true }).click()
    await expect(page.getByText('本周期复盘已保存。', { exact: true })).toBeVisible()
    await expect(page.getByLabel('下一周期的一个调整', { exact: true })).toHaveValue(
      '当前未保存调整'
    )
    // No saved result in the immediately previous week: older results are not substituted.
    await page.getByRole('navigation').getByRole('button', { name: '首页', exact: true }).click()
    await setDate(app, 2026, 1, 21)
    await page.getByRole('navigation').getByRole('button', { name: '复盘', exact: true }).click()
    await page.getByLabel('一个真实进展', { exact: true }).fill('没有参考也可以填写')
    await page.locator('.previous-adjustment summary').click()
    await expect(page.locator('.previous-adjustment')).toContainText('2026-01-12 至 2026-01-18')
    await expect(page.locator('.previous-adjustment')).toContainText('上一自然周没有已保存的复盘')
    await expect(page.getByLabel('一个真实进展', { exact: true })).toHaveValue('没有参考也可以填写')
  } finally {
    await app?.close()
    await removeTemporaryTestRoot(root)
  }
})
