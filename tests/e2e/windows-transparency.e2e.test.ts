import { join } from 'node:path'
import { release } from 'node:os'
import { expect, test } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { supportsMica } from '../../src/main/appearance'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

test('Windows preference changes update the native material and renderer without writing system settings', async () => {
  test.skip(!supportsMica(process.platform, release()), 'Requires Windows Mica support')
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
    expect(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].isWindowMessageHooked(0x001a)
      )
    ).toBe(true)
    for (const preference of ['disabled', 'enabled', 'error'] as const) {
      const reduced = await app.evaluate(async ({ nativeTheme, BrowserWindow }, preference) => {
        // Patch only this isolated Electron process, never the user's registry or OS preference.
        const childProcess = process.getBuiltinModule('child_process')
        childProcess.execFile = ((...args: unknown[]) => {
          const callback = args[3] as (error: Error | null, stdout: string, stderr: string) => void
          callback(
            preference === 'error' ? new Error('read failed') : null,
            `EnableTransparency REG_DWORD ${preference === 'enabled' ? '0x1' : '0x0'}`,
            ''
          )
          return {} as import('node:child_process').ChildProcess
        }) as typeof childProcess.execFile
        const { syncBuiltinESMExports } = process.getBuiltinModule('module')
        syncBuiltinESMExports()
        if (preference === 'enabled') BrowserWindow.getAllWindows()[0].emit('focus')
        else nativeTheme.emit('updated')
        return nativeTheme.shouldUseHighContrastColors || nativeTheme.inForcedColorsMode
      }, preference)
      const enabled = preference === 'enabled' && !reduced
      await expect
        .poll(() => page.evaluate(() => window.myTracer.shell.getAppearance()))
        .toMatchObject({ materialRequested: enabled, overlay: enabled ? 0.42 : 1 })
      await expect
        .poll(() =>
          page.evaluate(() => document.documentElement.style.getPropertyValue('--shell-alpha'))
        )
        .toBe(enabled ? '0.42' : '1')
      // Electron documents this getter as RGB only; alpha is not returned.
      expect(
        await app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].getBackgroundColor().toLowerCase()
        )
      ).toBe(enabled ? '#000000' : '#f2f4ee')
    }
  } finally {
    await app?.close()
    await removeTemporaryTestRoot(root)
  }
})
