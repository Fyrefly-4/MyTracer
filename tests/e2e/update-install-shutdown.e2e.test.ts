import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { expect, test, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

test('blocks installation for a Goal draft and preserves input until the user handles it', async () => {
  const root = await createTemporaryTestRoot()
  let application: ElectronApplication | undefined
  try {
    application = await electron.launch({
      cwd: root.root,
      args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
      env: {
        ...minimalElectronEnvironment(root),
        NODE_ENV: 'test',
        MYTRACER_E2E_UPDATE_SCENARIO: 'available'
      }
    })
    const page = await application.firstWindow()
    await page.getByRole('button', { name: '目标', exact: true }).click()
    await page.getByRole('button', { name: '新建目标' }).click()
    await page.getByLabel('目标名称').fill('T083 unsaved Goal')
    await page.getByRole('button', { name: '关于与更新' }).click()
    await page.getByRole('button', { name: '检查更新' }).click()
    await expect(page.getByRole('button', { name: '确认下载' })).toBeVisible()
    await page.getByRole('button', { name: '确认下载' }).click()
    await expect(page.getByRole('button', { name: '确认重启安装' })).toBeVisible()
    await page.getByRole('button', { name: '确认重启安装' }).click()
    await expect(
      page.getByText('还有未保存的输入或未确认的 AI 建议。请返回处理后再确认安装。')
    ).toBeVisible()
    await expect(page.getByLabel('目标名称')).toHaveValue('T083 unsaved Goal')
    expect(await page.evaluate(() => window.myTracer.updates.getStatus())).toMatchObject({
      state: 'downloaded'
    })
    await page.getByRole('button', { name: '稍后' }).click()
    await page.getByRole('button', { name: '创建目标', exact: true }).click()
    await expect(page.getByLabel('T083 unsaved Goal 详情')).toBeVisible()
    await page.getByRole('button', { name: '关于与更新' }).click()
    await page.getByRole('button', { name: '确认重启安装' }).click()
    await expect(
      page.getByText('安装未能启动，应用已关闭数据连接。请重新启动当前版本。')
    ).toBeVisible()
    expect(await page.evaluate(() => window.myTracer.updates.getStatus())).toMatchObject({
      state: 'restartRequired'
    })
  } finally {
    await application?.close().catch(() => undefined)
    await removeTemporaryTestRoot(root)
  }
})

test('rejects a second Electron process sharing the same temporary userData', async () => {
  const root = await createTemporaryTestRoot()
  let application: ElectronApplication | undefined
  try {
    application = await electron.launch({
      cwd: root.root,
      args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
      env: minimalElectronEnvironment(root)
    })
    const page = await application.firstWindow()
    await expect(page.getByRole('heading', { name: '今天', exact: true })).toBeVisible()
    const second = spawnSync(
      join(process.cwd(), 'node_modules/electron/dist/electron.exe'),
      [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
      { cwd: root.root, env: minimalElectronEnvironment(root), timeout: 10_000, encoding: 'utf8' }
    )
    expect(second.error).toBeUndefined()
    expect(second.status).toBe(0)
    expect(application.process().exitCode).toBeNull()
    await expect(page.getByRole('heading', { name: '今天', exact: true })).toBeVisible()
  } finally {
    await application?.close().catch(() => undefined)
    await removeTemporaryTestRoot(root)
  }
})
