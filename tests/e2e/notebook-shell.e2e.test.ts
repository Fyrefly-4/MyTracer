import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

test('keeps the notebook shell reachable with native controls and enlarged interface text', async () => {
  const root = await createTemporaryTestRoot()
  let application: Awaited<ReturnType<typeof electron.launch>> | undefined
  try {
    application = await electron.launch({
      cwd: root.root,
      args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
      env: minimalElectronEnvironment(root)
    })
    const page = await application.firstWindow()
    await expect(
      page.getByRole('heading', { name: '看看最近走到了哪里。', exact: true })
    ).toBeVisible()
    await application.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].setContentSize(1280, 800)
    })
    const windowCapabilities = await application.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0]
      return {
        resizable: window.isResizable(),
        minimizable: window.isMinimizable(),
        maximizable: window.isMaximizable(),
        closable: window.isClosable(),
        autoHideMenu: window.isMenuBarAutoHide()
      }
    })
    expect(windowCapabilities).toEqual({
      resizable: true,
      minimizable: true,
      maximizable: true,
      closable: true,
      autoHideMenu: true
    })
    await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].maximize())
    await expect
      .poll(() =>
        application!.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMaximized())
      )
      .toBe(true)
    await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].unmaximize())
    await expect
      .poll(() =>
        application!.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMaximized())
      )
      .toBe(false)
    await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].minimize())
    await expect
      .poll(() =>
        application!.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMinimized())
      )
      .toBe(true)
    await application.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0]
      window.restore()
      window.focus()
      window.setContentSize(1280, 800)
    })
    await expect
      .poll(() =>
        application!.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMinimized())
      )
      .toBe(false)
    await expect(page.locator('.topbar button')).toHaveCount(0)
    expect(
      await page
        .locator('.topbar')
        .evaluate((element) => getComputedStyle(element).getPropertyValue('-webkit-app-region'))
    ).toBe('drag')
    await expect(page.locator('.nav-icon')).toHaveCount(7)
    for (const zoom of [1, 1.25, 1.5]) {
      await application.evaluate(({ BrowserWindow }, factor) => {
        BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(factor)
      }, zoom)
      for (const name of ['首页', '今天', '目标', '例行', '进展', '数据', '复盘']) {
        await page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
        await expect(
          page.getByRole('heading', {
            name: name === '首页' ? '看看最近走到了哪里。' : name,
            exact: true
          })
        ).toBeVisible()
        const metrics = await page.locator('.app-shell').evaluate((shell) => ({
          viewport: window.innerWidth,
          width: shell.getBoundingClientRect().width,
          overflow: document.documentElement.scrollWidth > window.innerWidth,
          titleHeight: document.querySelector('.topbar')?.getBoundingClientRect().height,
          iconsInSameRow: [...document.querySelectorAll('.nav-item')].every((item) => {
            const style = getComputedStyle(item)
            return style.flexDirection === 'row'
          })
        }))
        expect(metrics.overflow, `${name} at ${zoom}x`).toBe(false)
        // innerWidth is integer-valued; layout bounds retain fractional CSS pixels at zoom.
        expect(metrics.width).toBeLessThan(metrics.viewport + 1)
        expect(metrics.titleHeight).toBe(42)
        expect(metrics.iconsInSameRow).toBe(true)
      }
      await page.getByRole('button', { name: '关于与更新', exact: true }).click()
      await expect(page.locator('.update-panel')).toBeVisible()
      for (const [container, width, height] of [
        ['.topbar', 120, 39],
        ['.about-brand', 240, 78]
      ] as const) {
        const wordmark = page.locator(container).getByRole('img', { name: 'MyTracer', exact: true })
        await expect(wordmark).toBeVisible()
        const bounds = await wordmark.evaluate((image: HTMLImageElement) => {
          const box = image.getBoundingClientRect()
          const parent = image.closest('.topbar, .update-panel')!.getBoundingClientRect()
          return {
            loaded: image.complete && image.naturalWidth === 800 && image.naturalHeight === 260,
            width: box.width,
            height: box.height,
            contained:
              box.left >= parent.left &&
              box.right <= parent.right &&
              box.top >= parent.top &&
              box.bottom <= parent.bottom
          }
        })
        expect(bounds.loaded, `${container} at ${zoom}x`).toBe(true)
        expect(bounds.width).toBeCloseTo(width, 1)
        expect(bounds.height).toBeCloseTo(height, 1)
        expect(bounds.contained, `${container} at ${zoom}x`).toBe(true)
      }
      await page.locator('.update-close').click()
      await expect(page.locator('.update-panel')).toHaveCount(0)
    }
  } finally {
    try {
      await application?.close()
    } finally {
      await removeTemporaryTestRoot(root)
    }
  }
})
