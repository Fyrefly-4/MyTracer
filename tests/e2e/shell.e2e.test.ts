import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { _electron as electron } from 'playwright'
import {
  assertExistingPathWithinRoot,
  createTemporaryTestRoot,
  removeTemporaryTestRoot
} from '../support/temporary-test-root'

function minimalElectronEnvironment(
  root: Awaited<ReturnType<typeof createTemporaryTestRoot>>
): Record<string, string> {
  const environment: Record<string, string> = {
    HOME: root.root,
    USERPROFILE: root.root,
    APPDATA: root.artifacts,
    LOCALAPPDATA: root.artifacts,
    TEMP: root.artifacts,
    TMP: root.artifacts,
    ELECTRON_RENDERER_URL: ''
  }

  for (const name of ['PATH', 'SystemRoot', 'WINDIR', 'ComSpec', 'PATHEXT']) {
    const value = process.env[name]
    if (value) {
      environment[name] = value
    }
  }

  return environment
}

test('runs the Electron shell with an isolated userData root', async () => {
  const testRoot = await createTemporaryTestRoot()
  let application: Awaited<ReturnType<typeof electron.launch>> | undefined

  try {
    application = await electron.launch({
      args: [
        join(process.cwd(), 'out/main/index.js'),
        `--user-data-dir=${testRoot.electronUserData}`
      ],
      env: minimalElectronEnvironment(testRoot)
    })

    const actualUserData = await application.evaluate(({ app }) => app.getPath('userData'))
    await expect(
      assertExistingPathWithinRoot(testRoot, actualUserData),
      'Electron must use this test case temporary root'
    ).resolves.toBeDefined()

    const inheritedEnvironment = await application.evaluate(() => ({
      home: process.env.HOME,
      userProfile: process.env.USERPROFILE,
      appData: process.env.APPDATA,
      localAppData: process.env.LOCALAPPDATA,
      temp: process.env.TEMP,
      tmp: process.env.TMP,
      sensitiveNames: Object.keys(process.env).filter((name) =>
        /(?:API[_-]?KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)/i.test(name)
      )
    }))
    expect(inheritedEnvironment).toEqual({
      home: testRoot.root,
      userProfile: testRoot.root,
      appData: testRoot.artifacts,
      localAppData: testRoot.artifacts,
      temp: testRoot.artifacts,
      tmp: testRoot.artifacts,
      sensitiveNames: []
    })

    const page = await application.firstWindow()
    await expect(page.getByRole('heading', { name: '今天，从一个真实动作开始' })).toBeVisible()

    const status = await page.evaluate(() => window.myTracer.shell.getStatus())
    expect(status.ai).toEqual({ configured: false, availability: 'not-configured' })
    expect(await page.evaluate(() => typeof Reflect.get(window, 'node'))).toBe('undefined')
    expect(await page.evaluate(() => typeof Reflect.get(window, 'require'))).toBe('undefined')

    await page.getByRole('button', { name: 'Progress' }).click()
    await expect(page.getByRole('heading', { name: '进展会来自已经记录的事实' })).toBeVisible()
    await page.getByRole('button', { name: 'Review' }).click()
    await expect(page.getByRole('heading', { name: '复盘将帮助你选择下一次调整' })).toBeVisible()
    await page.getByRole('button', { name: 'Today' }).click()
    await expect(page.getByRole('heading', { name: '今天，从一个真实动作开始' })).toBeVisible()
  } finally {
    try {
      await application?.close()
    } finally {
      await removeTemporaryTestRoot(testRoot)
    }
  }
})
