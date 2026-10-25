import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

const navigate = (page: Page, name: string) =>
  page
    .getByRole('navigation', { name: '主要视图' })
    .getByRole('button', { name, exact: true })
    .click()

async function fixture(run: (app: ElectronApplication, page: Page) => Promise<void>) {
  const root = await createTemporaryTestRoot()
  let app: ElectronApplication | undefined
  try {
    app = await electron.launch({
      chromiumSandbox: true,
      cwd: root.root,
      args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
      env: minimalElectronEnvironment(root)
    })
    // January 1 belongs to the preceding December's review week.
    await app.evaluate(() => {
      const RealDate = Date
      const instant = new RealDate(2026, 0, 1, 12).toISOString()
      Reflect.set(
        globalThis,
        'Date',
        new Proxy(RealDate, {
          construct(target, args) {
            return Reflect.construct(target, args.length ? args : [instant])
          }
        })
      )
    })
    await run(app, await app.firstWindow())
  } finally {
    await app?.close()
    await removeTemporaryTestRoot(root)
  }
}

test('saved review is clearly editable and its record-book link preserves newer unsaved text', async () => {
  test.skip(process.platform !== 'win32', 'Requires supported Windows Electron')
  await fixture(async (_app, page) => {
    await navigate(page, '复盘')
    const status = page.getByRole('status', { name: '复盘保存状态' })
    await expect(status).toContainText('填写后点击「保存复盘」')
    await page.getByLabel('一个真实进展').fill('已保存合成进展')
    await page.getByLabel('一个主要阻力').fill('合成阻力')
    await page.getByLabel('下一周期的一个调整').fill('合成调整')
    await expect(status).toContainText('本周期复盘尚未保存')
    await page.getByRole('button', { name: '保存复盘', exact: true }).click()
    await expect(status).toContainText('本周期复盘已保存')
    await expect(status).toContainText('不是未提交草稿')
    await expect(page.getByLabel('一个真实进展')).toHaveValue('已保存合成进展')
    await page.getByLabel('一个真实进展').fill('尚未保存的新合成进展')
    await expect(status).toContainText('有尚未保存的修改')
    await expect(page.getByText('本周期复盘已保存。', { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: '在记录册查看已保存复盘' }).click()
    await expect(page.getByLabel('跳转到月份')).toHaveValue('2025-12')
    await expect(page.locator('.rb-entry')).toContainText('已保存合成进展')
    await expect(page.locator('.rb-entry')).not.toContainText('尚未保存的新合成进展')
    await page.getByRole('button', { name: '返回来源页面' }).click()
    await expect(page.getByLabel('一个真实进展')).toHaveValue('尚未保存的新合成进展')
    await expect(status).toContainText('有尚未保存的修改')
    await page.getByRole('button', { name: '取消', exact: true }).click()
    await expect(status).toContainText('本周期复盘已保存')
    await expect(page.getByLabel('一个真实进展')).toHaveValue('已保存合成进展')
    await navigate(page, '数据')
    await navigate(page, '复盘')
    await expect(status).toContainText('本周期复盘已保存')
  })
})

test('pending and failed saves replace old success feedback without losing text or the persisted version', async () => {
  test.skip(process.platform !== 'win32', 'Requires supported Windows Electron')
  await fixture(async (app, page) => {
    await navigate(page, '复盘')
    await page.getByLabel('一个真实进展').fill('第一次保存的合成进展')
    await page.getByLabel('一个主要阻力').fill('合成阻力')
    await page.getByLabel('下一周期的一个调整').fill('合成调整')
    await page.getByRole('button', { name: '保存复盘', exact: true }).click()
    const status = page.getByRole('status', { name: '复盘保存状态' })
    await expect(status).toContainText('本周期复盘已保存')
    await app.evaluate(({ ipcMain }) => {
      const handlers = Reflect.get(ipcMain, '_invokeHandlers') as Map<
        string,
        (...args: unknown[]) => unknown
      >
      const original = handlers.get('review:complete')!
      const state = { mode: 'hold', release: null as (() => void) | null }
      Reflect.set(globalThis, '__reviewSaveFeedback', state)
      ipcMain.removeHandler('review:complete')
      ipcMain.handle('review:complete', (...args) => {
        if (state.mode === 'hold')
          return new Promise((resolve) => {
            state.release = () => resolve({ ok: false, error: { code: 'persistence-failed' } })
          })
        return original(...args)
      })
    })
    await page.getByLabel('一个真实进展').fill('第二次合成进展')
    await page.getByRole('button', { name: '保存复盘', exact: true }).click()
    await expect(status).toContainText('正在保存复盘')
    await expect(page.getByRole('button', { name: '正在保存…', exact: true })).toBeDisabled()
    await expect(page.getByLabel('一个真实进展')).toBeDisabled()
    await expect(page.getByText('本周期复盘已保存。', { exact: true })).toHaveCount(0)
    await expect
      .poll(() =>
        app.evaluate(() => typeof Reflect.get(globalThis, '__reviewSaveFeedback').release)
      )
      .toBe('function')
    await app.evaluate(() => Reflect.get(globalThis, '__reviewSaveFeedback').release())
    await expect(page.getByRole('alert')).toContainText('暂时无法确认保存结果')
    await expect(status).toContainText('本次保存尚未确认')
    await expect(page.getByLabel('一个真实进展')).toHaveValue('第二次合成进展')
    const book = await page.evaluate(() => window.myTracer.recordBook.read())
    expect(book.ok).toBe(true)
    if (!book.ok) throw new Error('Synthetic record-book read failed')
    const entries = book.value.book.months.flatMap((month) =>
      month.days.flatMap((day) => day.entries)
    )
    expect(entries).toHaveLength(1)
    expect(entries[0].fields).toContainEqual({ label: '确认的进展', text: '第一次保存的合成进展' })
    await page.getByLabel('一个真实进展').fill('重新编辑后的合成进展')
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(status).toContainText('有尚未保存的修改')
    await app.evaluate(() => {
      Reflect.get(globalThis, '__reviewSaveFeedback').mode = 'real'
    })
    await page.getByRole('button', { name: '保存复盘', exact: true }).click()
    await expect(status).toContainText('本周期复盘已保存')
    await page.getByRole('button', { name: '在记录册查看已保存复盘' }).click()
    await expect(page.locator('.rb-entry')).toHaveCount(1)
    await expect(page.locator('.rb-entry')).toContainText('重新编辑后的合成进展')
  })
})
