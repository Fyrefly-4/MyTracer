import { join } from 'node:path'
import { expect, test, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

test('shell panels dismiss with Escape and restore focus without closing a nested modal', async () => {
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
    const appearance = page.getByRole('region', { name: '外观设置' })
    const appearanceTrigger = page.getByRole('button', { name: '外观', exact: true })
    await test.step('open appearance', () => appearanceTrigger.click())
    await page.keyboard.press('Escape')
    await expect(appearance).toHaveCount(0)
    await expect(appearanceTrigger).toBeFocused()
    const update = page.getByRole('complementary', { name: '关于与更新' })
    const updateTrigger = page.getByRole('button', { name: '关于与更新', exact: true })
    await updateTrigger.click()
    await page.keyboard.press('Escape')
    await expect(update).toHaveCount(0)
    await expect(updateTrigger).toBeFocused()
    await page.getByRole('navigation').getByRole('button', { name: '今天', exact: true }).click()
    await test.step('open appearance', () => appearanceTrigger.click())
    // The nonmodal appearance panel can cover the pointer target; keyboard activation remains available.
    await page.getByRole('button', { name: '新建行动', exact: true }).focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: '留下一个可以直接开始的小步骤', exact: true })
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('行动标题', { exact: true }).fill('保留嵌套输入')
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
    await expect(appearance).toBeVisible()
    await page.getByRole('button', { name: '新建行动', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(dialog.getByLabel('行动标题', { exact: true })).toHaveValue('保留嵌套输入')
    await dialog.getByLabel('行动标题', { exact: true }).fill('')
    await page.keyboard.press('Escape')
    await appearance.dispatchEvent('compositionstart')
    await page.keyboard.press('Escape')
    await expect(appearance).toBeVisible()
    await appearance.dispatchEvent('compositionend')
    await page.evaluate(() => {
      Reflect.set(window, '__underlyingEscapes', 0)
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape')
          Reflect.set(
            window,
            '__underlyingEscapes',
            Number(Reflect.get(window, '__underlyingEscapes')) + 1
          )
      })
    })
    await page.keyboard.press('Escape')
    await expect(appearance).toHaveCount(0)
    expect(await page.evaluate(() => Reflect.get(window, '__underlyingEscapes'))).toBe(0)
    await expect(appearanceTrigger).toBeFocused()
    await test.step('open appearance', () => appearanceTrigger.click())
    await appearance.getByRole('button', { name: '关闭外观设置' }).click()
    await expect(appearanceTrigger).toBeFocused()
    await updateTrigger.click()
    await update.getByRole('button', { name: '关闭更新面板' }).click()
    await expect(updateTrigger).toBeFocused()
  } finally {
    await app?.close()
    await removeTemporaryTestRoot(root)
  }
})

test('Escape respects appearance writes and installation protection without starting updates', async () => {
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
    await app.evaluate(({ ipcMain }) => {
      const handlers = Reflect.get(ipcMain, '_invokeHandlers') as Map<
        string,
        (...args: unknown[]) => unknown
      >
      const original = handlers.get('appearance:set')!
      ipcMain.removeHandler('appearance:set')
      ipcMain.handle(
        'appearance:set',
        (...args) =>
          new Promise((resolve) => {
            Reflect.set(globalThis, '__finishAppearance', () => resolve(original(...args)))
          })
      )
    })
    const trigger = page.getByRole('button', { name: '外观', exact: true })
    await trigger.click()
    const appearance = page.getByRole('region', { name: '外观设置' })
    await appearance.getByLabel('外壳材质').selectOption('solid')
    await expect(appearance.getByRole('button', { name: '关闭外观设置' })).toBeDisabled()
    await expect(trigger).toBeDisabled()
    await page.keyboard.press('Escape')
    await expect(appearance).toBeVisible()
    await expect
      .poll(() => app!.evaluate(() => typeof Reflect.get(globalThis, '__finishAppearance')))
      .toBe('function')
    await app.evaluate(() => (Reflect.get(globalThis, '__finishAppearance') as () => void)())
    await expect(appearance.getByRole('button', { name: '关闭外观设置' })).toBeEnabled()
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
    await page.getByRole('button', { name: '关于与更新', exact: true }).click()
    const update = page.getByRole('complementary', { name: '关于与更新' })
    for (const state of ['preparing', 'installing', 'restartRequired']) {
      await app.evaluate(
        ({ BrowserWindow }, state) =>
          BrowserWindow.getAllWindows()[0]!.webContents.send('updates:changed', {
            state,
            currentVersion: '1.11.1',
            operationId: 'synthetic'
          }),
        state
      )
      await expect(update.getByRole('button', { name: '关闭更新面板' })).toBeDisabled()
      await page.keyboard.press('Escape')
      await expect(update).toBeVisible()
    }
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]!.webContents.send('updates:changed', {
        state: 'idle',
        currentVersion: '1.11.1'
      })
    )
    await expect(update.getByRole('button', { name: '关闭更新面板' })).toBeEnabled()
    await page.keyboard.press('Escape')
    await expect(update).toHaveCount(0)
    await expect(page.getByRole('button', { name: '关于与更新', exact: true })).toBeFocused()
    expect(await page.evaluate(() => window.myTracer.updates.getStatus())).toMatchObject({
      state: 'idle'
    })
  } finally {
    await app?.close()
    await removeTemporaryTestRoot(root)
  }
})
