import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import {
  createTemporaryTestRoot,
  removeTemporaryTestRoot,
  type TemporaryTestRoot
} from '../support/temporary-test-root'

async function launch(
  root: TemporaryTestRoot,
  scenario?: string
): Promise<{ application: ElectronApplication; page: Page }> {
  const application = await electron.launch({
    cwd: root.root,
    args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
    env: {
      ...minimalElectronEnvironment(root),
      NODE_ENV: 'test',
      ...(scenario ? { MYTRACER_E2E_UPDATE_SCENARIO: scenario } : {})
    }
  })
  return { application, page: await application.firstWindow() }
}

test('explicit check and confirmation download only, with plain text notes and no install', async () => {
  const root = await createTemporaryTestRoot()
  let application: ElectronApplication | undefined
  try {
    const launched = await launch(root, 'available')
    application = launched.application
    const page = launched.page
    const initial = await page.evaluate(() => window.myTracer.updates.getStatus())
    const parts = /^(\d+)\.(\d+)\.(\d+)$/.exec(initial.currentVersion)
    expect(parts).not.toBeNull()
    const nextVersion = `${parts![1]}.${parts![2]}.${Number(parts![3]) + 1}`
    expect(initial.state).toBe('idle')
    await page.getByRole('button', { name: '关于与更新' }).click()
    await expect(page.getByText('如需检查新版本，请手动开始。')).toBeVisible()
    await expect(page.getByText(`当前版本 ${initial.currentVersion}`)).toBeVisible()
    expect(await page.evaluate(() => window.myTracer.updates.getStatus())).toMatchObject({
      state: 'idle'
    })
    await page.getByRole('button', { name: '检查更新' }).click()
    await expect(page.getByText(`发现可用版本 ${nextVersion}。`)).toBeVisible()
    await expect(
      page.getByText('<script>window.__updateAttack = true</script>更新说明')
    ).toBeVisible()
    expect(await page.evaluate(() => Reflect.get(window, '__updateAttack'))).toBeUndefined()
    expect(await page.evaluate(() => window.myTracer.updates.getStatus())).toMatchObject({
      state: 'available'
    })
    await page.getByRole('button', { name: '确认下载' }).click()
    await expect(
      page.getByText(`版本 ${nextVersion} 已下载并校验。稍后可继续使用当前版本。`)
    ).toBeVisible()
    await page.getByRole('button', { name: '稍后' }).click()
    await expect(
      page.getByRole('heading', { name: '看看最近走到了哪里。', exact: true })
    ).toBeVisible()
    expect(await page.evaluate(() => window.myTracer.updates.getStatus())).toMatchObject({
      state: 'downloaded'
    })
    expect(await page.evaluate(() => Object.keys(window.myTracer.updates))).toEqual([
      'getStatus',
      'check',
      'download',
      'cancel',
      'install',
      'cancelPreparation',
      'replyToDraftRequest',
      'subscribe',
      'subscribeDraftRequests'
    ])
    expect(await page.evaluate(() => typeof Reflect.get(window, 'require'))).toBe('undefined')
  } finally {
    await application?.close().catch(() => undefined)
    await removeTemporaryTestRoot(root)
  }
})

test('unavailable, access-rejected and offline source leave the core UI usable', async () => {
  for (const scenario of [undefined, 'authentication', 'network'] as const) {
    const root = await createTemporaryTestRoot()
    let application: ElectronApplication | undefined
    try {
      const launched = await launch(root, scenario)
      application = launched.application
      const page = launched.page
      await page.getByRole('button', { name: '关于与更新' }).click()
      await page.getByRole('button', { name: '检查更新' }).click()
      const expected =
        scenario === 'authentication'
          ? 'authentication'
          : scenario === 'network'
            ? 'network'
            : 'unavailable'
      await expect
        .poll(
          async () => (await page.evaluate(() => window.myTracer.updates.getStatus())).error?.code
        )
        .toBe(expected)
      await page.getByRole('button', { name: '稍后' }).click()
      await expect(
        page.getByRole('heading', { name: '看看最近走到了哪里。', exact: true })
      ).toBeVisible()
      await page.getByRole('button', { name: '进展', exact: true }).click()
      await expect(page.getByRole('heading', { name: '进展', exact: true })).toBeVisible()
    } finally {
      await application?.close().catch(() => undefined)
      await removeTemporaryTestRoot(root)
    }
  }
})
