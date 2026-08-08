import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { _electron as electron } from 'playwright'
import {
  assertExistingPathWithinRoot,
  createTemporaryTestRoot,
  removeTemporaryTestRoot
} from '../support/temporary-test-root'

test('runs the Electron shell with an isolated userData root', async () => {
  const testRoot = await createTemporaryTestRoot()
  let application: Awaited<ReturnType<typeof electron.launch>> | undefined

  try {
    application = await electron.launch({
      args: [
        join(process.cwd(), 'out/main/index.js'),
        `--user-data-dir=${testRoot.electronUserData}`
      ],
      env: {
        ...process.env,
        ELECTRON_RENDERER_URL: ''
      }
    })

    const actualUserData = await application.evaluate(({ app }) => app.getPath('userData'))
    await expect(
      assertExistingPathWithinRoot(testRoot, actualUserData),
      'Electron must use this test case temporary root'
    ).resolves.toBeDefined()

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
