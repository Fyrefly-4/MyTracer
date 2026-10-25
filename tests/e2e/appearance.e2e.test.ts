import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

test('appearance is narrow, validated, opaque in content, and survives restart', async () => {
  const root = await createTemporaryTestRoot()
  let application: Awaited<ReturnType<typeof electron.launch>> | undefined
  const launch = () =>
    electron.launch({
      cwd: root.root,
      args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
      env: minimalElectronEnvironment(root)
    })
  try {
    application = await launch()
    let page = await application.firstWindow()
    await expect(
      page.getByRole('heading', { name: '看看最近走到了哪里。', exact: true })
    ).toBeVisible()
    expect(await page.evaluate(() => window.myTracer.shell.getAppearance())).toMatchObject({
      mode: 'mica',
      intensity: 'strong'
    })
    expect(await page.evaluate(() => Object.isFrozen(window.myTracer.shell))).toBe(true)
    expect(
      await page.evaluate(async () => {
        try {
          await window.myTracer.shell.setAppearance({
            mode: 'acrylic',
            intensity: 'strong'
          } as never)
          return false
        } catch {
          return true
        }
      })
    ).toBe(true)
    await page.getByRole('button', { name: '外观', exact: true }).click()
    await page.getByLabel('壁纸色强度').selectOption('subtle')
    await expect(page.getByLabel('壁纸色强度')).toBeEnabled()
    await page.getByLabel('外壳材质').selectOption('solid')
    await expect
      .poll(() => page.evaluate(() => window.myTracer.shell.getAppearance()))
      .toEqual({ mode: 'solid', intensity: 'subtle', overlay: 1, materialRequested: false })
    const main = page.getByRole('main')
    await expect(main).toHaveCount(1)
    await expect(main.getByRole('region', { name: '外观设置', exact: true })).toBeVisible()
    const surface = main.locator(':scope > .content-inner')
    await expect(surface).toHaveCount(1)
    await expect(surface).toBeVisible()
    // Settings retain unsaved local inputs while hidden; they are not this page's surface.
    const assistantSettings = page.locator('section[aria-label="Assistant 服务设置"]')
    await expect(assistantSettings).toHaveCount(1)
    await expect(assistantSettings).toBeHidden()
    expect(await surface.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
      'rgb(250, 249, 245)'
    )
    expect(
      await page
        .locator('.app-shell')
        .evaluate((element) => getComputedStyle(element).backgroundColor)
    ).toBe('rgb(242, 244, 238)')
    expect(
      await page.locator('.topbar').evaluate((element) => getComputedStyle(element).backgroundColor)
    ).toBe('rgba(0, 0, 0, 0)')
    // Unsubscription must remove the listener; callbacks receive only state, never IPC events.
    expect(
      await page.evaluate(async () => {
        let calls = 0
        const stop = window.myTracer.shell.subscribeAppearance(() => {
          calls += 1
        })
        stop()
        await window.myTracer.shell.setAppearance({ mode: 'solid', intensity: 'subtle' })
        return calls
      })
    ).toBe(0)
    await page.getByRole('button', { name: '关于与更新', exact: true }).click()
    await expect(page.getByRole('region', { name: '外观设置' })).toHaveCount(0)
    await expect(page.getByRole('complementary', { name: '关于与更新' })).toBeVisible()
    await page.getByRole('button', { name: '外观', exact: true }).click()
    await expect(page.getByRole('complementary', { name: '关于与更新' })).toHaveCount(0)
    await expect(page.getByRole('region', { name: '外观设置' })).toBeVisible()
    await application.close()
    application = await launch()
    page = await application.firstWindow()
    await expect(
      page.getByRole('heading', { name: '看看最近走到了哪里。', exact: true })
    ).toBeVisible()
    expect(await page.evaluate(() => window.myTracer.shell.getAppearance())).toEqual({
      mode: 'solid',
      intensity: 'subtle',
      overlay: 1,
      materialRequested: false
    })
  } finally {
    await application?.close()
    await removeTemporaryTestRoot(root)
  }
})
