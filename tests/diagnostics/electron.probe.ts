import { join } from 'node:path'
import { test, expect } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { startElectronDiagnostics } from '../support/electron-diagnostics'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

test('controlled Electron diagnostic failure', async () => {
  const root = await createTemporaryTestRoot()
  try {
    const app = await electron.launch({
      chromiumSandbox: true,
      cwd: root.root,
      args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
      env: minimalElectronEnvironment(root)
    })
    try {
      const finish = await startElectronDiagnostics(app, test.info())
      try {
        const page = await app.firstWindow()
        await app.evaluate(() => console.error('synthetic-main-diagnostic-error'))
        await page.evaluate(() => console.error('synthetic-diagnostic-error'))
        await test.step('Controlled assertion failure', async () => {
          expect('synthetic actual', 'diagnostic-negative-control').toBe('synthetic expected')
        })
      } catch (error) {
        await finish(error)
        throw error
      }
    } finally {
      await app.close()
    }
  } finally {
    await removeTemporaryTestRoot(root)
  }
})
