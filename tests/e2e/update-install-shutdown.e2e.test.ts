import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { expect, test, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { REVIEW_CHANNELS } from '../../src/contracts/review'
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
    await page.reload()
    await expect(
      page.getByText('安装未能启动，应用已关闭数据连接。请重新启动当前版本。')
    ).toBeVisible()
    await expect(page.locator('.workspace')).toHaveAttribute('inert', '')
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
    await expect(
      page.getByRole('heading', { name: '看看最近走到了哪里。', exact: true })
    ).toBeVisible()
    const second = spawnSync(
      join(process.cwd(), 'node_modules/electron/dist/electron.exe'),
      [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
      { cwd: root.root, env: minimalElectronEnvironment(root), timeout: 10_000, encoding: 'utf8' }
    )
    expect(second.error).toBeUndefined()
    expect(second.status).toBe(0)
    expect(application.process().exitCode).toBeNull()
    await expect(
      page.getByRole('heading', { name: '看看最近走到了哪里。', exact: true })
    ).toBeVisible()
  } finally {
    await application?.close().catch(() => undefined)
    await removeTemporaryTestRoot(root)
  }
})

test('blocks Action, Routine, Review, Record, and Data drafts before installer handoff', async () => {
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
    const candidate = await page.evaluate(async () => {
      const available = await window.myTracer.updates.check()
      if (!available.operationId || !available.candidate)
        throw new Error('Expected update candidate')
      const input = { operationId: available.operationId, version: available.candidate.version }
      const downloaded = await window.myTracer.updates.download(input)
      if (downloaded.state !== 'downloaded') throw new Error('Expected downloaded update')
      return input
    })
    const expectBlocked = async (): Promise<void> => {
      const result = await page.evaluate(
        (input) => window.myTracer.updates.install(input),
        candidate
      )
      expect(result.blocker).toBe('unsaved-content')
      expect(result.status.state).toBe('downloaded')
    }

    await page.getByRole('button', { name: '今天', exact: true }).click()
    await page.getByRole('button', { name: '新建行动' }).click()
    await page.getByLabel('行动标题').fill('T083 Action draft')
    await expectBlocked()
    await expect(page.getByLabel('行动标题')).toHaveValue('T083 Action draft')
    await page.getByRole('button', { name: '创建行动' }).click()
    const action = page.getByLabel('T083 Action draft 行动记录')
    await expect(action).toBeVisible()
    await action.getByRole('button', { name: '开始记录' }).click()
    await action.getByLabel('投入时长（分钟，可选）').fill('2')
    await expectBlocked()
    await action.getByRole('button', { name: '放弃草稿' }).click()

    await page.getByRole('button', { name: '例行', exact: true }).click()
    const routineCreate = page.locator('.routine-workspace .goal-create')
    await routineCreate.getByLabel('名称', { exact: true }).fill('T083 Routine draft')
    await routineCreate.getByLabel('最小行动').fill('一步')
    await expectBlocked()
    await routineCreate.getByRole('button', { name: '创建例行' }).click()
    const routine = page.getByLabel('T083 Routine draft 例行记录')
    await routine.getByRole('button', { name: '记录例行' }).click()
    await routine.getByLabel('投入时长（分钟，可选）').fill('2')
    await expectBlocked()
    await routine.getByRole('button', { name: '放弃草稿' }).click()

    await page.getByRole('button', { name: '复盘', exact: true }).click()
    await page.getByLabel('一个真实进展').fill('T083 review draft')
    await expectBlocked()
    await expect(page.getByLabel('一个真实进展')).toHaveValue('T083 review draft')

    await application.evaluate(({ ipcMain, app }, channel) => {
      const testApp = app as typeof app & { finishReviewRefresh?: () => void }
      ipcMain.removeHandler(channel)
      ipcMain.handle(channel, async () => {
        await new Promise<void>((resolve) => (testApp.finishReviewRefresh = resolve))
        return { ok: false, error: { code: 'persistence-failed' } }
      })
    }, REVIEW_CHANNELS.getSummary)
    await page.getByRole('button', { name: '重新读取记录' }).click()
    await expect(page.getByRole('button', { name: '重新读取记录' })).toBeDisabled()
    await expectBlocked()
    await application.evaluate(({ app }) => {
      ;(app as typeof app & { finishReviewRefresh?: () => void }).finishReviewRefresh?.()
    })
    await expect(page.getByLabel('一个真实进展')).toHaveValue('T083 review draft')

    await page.getByRole('button', { name: '数据', exact: true }).click()
    await page.getByRole('button', { name: '补记记录', exact: true }).click()
    await page.getByLabel('行动补记日期').fill('2026-09-29')
    await expectBlocked()
    await expect(page.getByLabel('行动补记日期')).toHaveValue('2026-09-29')
  } finally {
    await application?.close().catch(() => undefined)
    await removeTemporaryTestRoot(root)
  }
})

test('blocks an unsubmitted AI input and an unconfirmed AI suggestion', async () => {
  const root = await createTemporaryTestRoot()
  let application: ElectronApplication | undefined
  try {
    application = await electron.launch({
      cwd: root.root,
      args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
      env: {
        ...minimalElectronEnvironment(root),
        NODE_ENV: 'test',
        MYTRACER_E2E_UPDATE_SCENARIO: 'available',
        MYTRACER_E2E_AI_SCENARIO: 'success',
        MYTRACER_LITELLM_API_KEY: 'synthetic-e2e-key'
      }
    })
    const page = await application.firstWindow()
    await page.evaluate(async () => {
      const goal = await window.myTracer.goals.create({
        name: 'T083 AI Goal',
        initialNextAction: { title: 'T083 AI Action' }
      })
      if (!goal.ok || !goal.value.currentNextActionId) throw new Error('Goal setup failed')
      const selected = await window.myTracer.today.selectAction({
        actionId: goal.value.currentNextActionId
      })
      if (!selected.ok) throw new Error('Today setup failed')
    })
    await page.reload()
    await page.getByRole('navigation').getByRole('button', { name: '今天', exact: true }).click()
    await page
      .getByRole('button', { name: /T083 AI Action/ })
      .first()
      .click()
    await page.getByRole('button', { name: '从环境变量导入配置' }).click()
    const input = page.getByLabel('现在最卡住你的是什么？')
    await expect(input).toBeVisible()
    const candidate = await page.evaluate(async () => {
      const available = await window.myTracer.updates.check()
      if (!available.operationId || !available.candidate)
        throw new Error('Expected update candidate')
      const candidate = { operationId: available.operationId, version: available.candidate.version }
      const downloaded = await window.myTracer.updates.download(candidate)
      if (downloaded.state !== 'downloaded') throw new Error('Expected downloaded update')
      return candidate
    })
    await input.fill('我不知道从哪里开始')
    expect(
      (await page.evaluate((value) => window.myTracer.updates.install(value), candidate)).blocker
    ).toBe('unsaved-content')
    await page.getByRole('button', { name: '帮我找一个小起点' }).click()
    await expect(page.getByText('先打开行动需要的资料，只看一眼标题。')).toBeVisible()
    expect(
      (await page.evaluate((value) => window.myTracer.updates.install(value), candidate)).blocker
    ).toBe('unsaved-content')
    expect(await page.evaluate(() => window.myTracer.updates.getStatus())).toMatchObject({
      state: 'downloaded'
    })
  } finally {
    await application?.close().catch(() => undefined)
    await removeTemporaryTestRoot(root)
  }
})
