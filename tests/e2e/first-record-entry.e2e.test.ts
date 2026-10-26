import { join } from 'node:path'
import { expect, test, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

test('first record distinguishes a confirmed empty list from loading, failure and independent actions', async () => {
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
    const nav = (name: string) =>
      page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
    await nav('今天')
    await page.getByRole('button', { name: '记一笔', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '记一笔', exact: true })
    const title = dialog.getByLabel('刚才做了什么', { exact: true })
    for (const size of [
      [1188, 848],
      [828, 604]
    ] as [number, number][]) {
      await app.evaluate(
        ({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0]!.setSize(...size),
        size
      )
      await expect(dialog.getByLabel('选择已有行动')).toHaveCount(0)
      await expect(title).toBeInViewport({ ratio: 1 })
      await expect(title).toBeFocused()
      expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
    }
    await title.fill('保留的首笔输入')
    await page.keyboard.press('Escape')
    await nav('首页')
    const id = await page.evaluate(async () => {
      const r = await window.myTracer.actions.create({ title: '不关联目标的已有行动' })
      if (!r.ok) throw Error(r.error.message)
      return r.value.id
    })
    await app.evaluate(({ ipcMain }) => {
      const handlers = Reflect.get(ipcMain, '_invokeHandlers') as Map<
        string,
        (...args: unknown[]) => unknown
      >
      const original = handlers.get('today:get')!
      let first = true
      ipcMain.removeHandler('today:get')
      ipcMain.handle('today:get', (...args) => {
        if (!first) return original(...args)
        first = false
        return new Promise((resolve) => {
          Reflect.set(globalThis, '__releaseEntryRead', () =>
            resolve({
              ok: false,
              error: { code: 'persistence-failed', message: 'synthetic read failure' }
            })
          )
        })
      })
    })
    await nav('今天')
    const entry = page.getByRole('button', { name: '继续记一笔', exact: true })
    await expect(entry).toBeDisabled()
    await expect
      .poll(() => app!.evaluate(() => typeof Reflect.get(globalThis, '__releaseEntryRead')))
      .toBe('function')
    await app.evaluate(() => (Reflect.get(globalThis, '__releaseEntryRead') as () => void)())
    await expect(page.locator('.today-workspace [role="alert"]')).toBeVisible()
    await expect(entry).toBeDisabled()
    await expect(dialog).not.toBeVisible()
    await nav('首页')
    await nav('今天')
    await entry.click()
    await expect(title).toHaveValue('保留的首笔输入')
    await expect(dialog.getByLabel('选择已有行动')).toBeVisible()
    await dialog.getByLabel('选择已有行动').selectOption(id)
    await dialog.getByRole('button', { name: '打开已有行动记录' }).click()
    await expect(page.getByRole('button', { name: '开始记录', exact: true })).toBeVisible()
    const facts = await page.evaluate(() => window.myTracer.dataControl.list())
    if (!facts.ok) throw Error(facts.error.message)
    expect(facts.value.actions).toHaveLength(1)
    expect(facts.value.actionRecords).toHaveLength(0)
  } finally {
    await app?.close()
    await removeTemporaryTestRoot(root)
  }
})
