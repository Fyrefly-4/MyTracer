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
      ...(scenario
        ? { MYTRACER_E2E_AI_SCENARIO: scenario, MYTRACER_LITELLM_API_KEY: 'synthetic-e2e-key' }
        : {})
    }
  })
  return { application, page: await application.firstWindow() }
}

async function createFocusedAction(page: Page): Promise<string> {
  const actionId = await page.evaluate(async () => {
    const goal = await window.myTracer.goals.create({
      name: 'E2E Start Help Goal',
      initialNextAction: { title: 'E2E Start Help Action' }
    })
    if (!goal.ok || !goal.value.currentNextActionId) throw new Error('goal setup failed')
    const selected = await window.myTracer.today.selectAction({
      actionId: goal.value.currentNextActionId
    })
    if (!selected.ok) throw new Error('today setup failed')
    return goal.value.currentNextActionId
  })
  await page.reload()
  await page
    .getByRole('button', { name: /E2E Start Help Action/ })
    .first()
    .click()
  return actionId
}

test('Start Help is explicit, read-only, validated, cancellable, and degradable', async () => {
  test.setTimeout(120_000)
  for (const scenario of ['success', 'invalid-response', 'timeout'] as const) {
    const root = await createTemporaryTestRoot()
    let application: ElectronApplication | undefined
    try {
      const launched = await launch(root, scenario)
      application = launched.application
      const page = launched.page
      await createFocusedAction(page)
      await expect(page.getByText('AI 尚未配置')).toBeVisible()
      const before = await page.evaluate(() => window.myTracer.dataControl.list())
      await page.getByRole('button', { name: '从环境变量导入配置' }).click()
      await expect(page.getByLabel('现在最卡住你的是什么？')).toBeVisible()
      await page.getByLabel('现在最卡住你的是什么？').fill('我不知道从哪里开始')
      await page.getByRole('button', { name: '帮我找一个小起点' }).click()

      if (scenario === 'success') {
        await expect(page.getByText('先打开行动需要的资料，只看一眼标题。')).toBeVisible()
        await expect(page.getByText(/确认前不会保存或改变当前行动/)).toBeVisible()
      } else if (scenario === 'invalid-response') {
        await expect(page.getByText(/未通过安全检查/)).toBeVisible()
      } else {
        await expect(page.getByRole('button', { name: '取消整理' })).toBeVisible()
        await page.getByRole('button', { name: '取消整理' }).click()
        await expect(page.getByText('已取消这次整理，没有保存任何内容。')).toBeVisible()
      }

      expect(await page.evaluate(() => window.myTracer.dataControl.list())).toEqual(before)
      await expect(page.getByRole('button', { name: '开始记录' })).toBeVisible()
    } finally {
      await application?.close().catch(() => undefined)
      await removeTemporaryTestRoot(root)
    }
  }
})

test('not-configured Start Help never blocks the manual action path', async () => {
  const root = await createTemporaryTestRoot()
  let application: ElectronApplication | undefined
  try {
    const launched = await launch(root)
    application = launched.application
    const page = launched.page
    const actionId = await createFocusedAction(page)
    const result = await page.evaluate(
      (id) =>
        window.myTracer.aiStartHelp.start({ actionId: id, locale: 'zh-CN', userInput: '卡住了' }),
      actionId
    )
    expect(result).toMatchObject({ error: { code: 'not-configured', retryable: false } })
    await expect(page.getByRole('button', { name: '开始记录' })).toBeVisible()
  } finally {
    await application?.close().catch(() => undefined)
    await removeTemporaryTestRoot(root)
  }
})
