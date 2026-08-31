import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import {
  createTemporaryTestRoot,
  removeTemporaryTestRoot,
  type TemporaryTestRoot
} from '../support/temporary-test-root'

async function launch(root: TemporaryTestRoot): Promise<ElectronApplication> {
  const application = await electron.launch({
    cwd: root.root,
    args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
    env: {
      ...minimalElectronEnvironment(root),
      NODE_ENV: 'test',
      MYTRACER_E2E_AI_SCENARIO: 'success',
      MYTRACER_LITELLM_API_KEY: 'synthetic-ac02-key'
    }
  })
  return application
}

async function coreSnapshot(page: Page, goalId: string) {
  return page.evaluate(async (id) => {
    const [data, today, goal] = await Promise.all([
      window.myTracer.dataControl.list(),
      window.myTracer.today.get({}),
      window.myTracer.goals.getDetail({ goalId: id })
    ])
    if (!data.ok || !today.ok || !goal.ok) throw new Error('Core snapshot failed')
    return { data: data.value, today: today.value, goal: goal.value }
  }, goalId)
}

async function triggerDraft(page: Page, input: string): Promise<void> {
  await page.getByLabel('现在最卡住你的是什么？').fill(input)
  await page.getByRole('button', { name: '我现在不想开始' }).click()
  await expect(page.getByRole('group', { name: /选择一个临时建议/ })).toBeVisible()
}

test('continuous E2E-AC-02 keeps drafts temporary and persists only explicit final confirmations', async () => {
  test.setTimeout(180_000)
  const root = await createTemporaryTestRoot()
  const destination = join(root.exports, 'ac02-export.json')
  let application: ElectronApplication | undefined
  try {
    application = await launch(root)
    let page = await application.firstWindow()
    const setup = await page.evaluate(async () => {
      const goal = await window.myTracer.goals.create({
        name: '系统学习 React',
        initialNextAction: { title: '运行状态更新示例' }
      })
      if (!goal.ok || !goal.value.currentNextActionId) throw new Error('Goal setup failed')
      const selected = await window.myTracer.today.selectAction({
        actionId: goal.value.currentNextActionId
      })
      const record = await window.myTracer.dataControl.backfillActionRecord({
        actionId: goal.value.currentNextActionId,
        occurredOn: '2026-08-31',
        durationMinutes: 8,
        outcome: 'partial',
        understanding: '手工确认事实',
        confusion: '仍需理解批处理'
      })
      if (!selected.ok || !record.ok) throw new Error('AC-02 setup failed')
      return {
        goalId: goal.value.id,
        originalActionId: goal.value.currentNextActionId,
        recordId: record.value.id
      }
    })
    await page.reload()
    await page
      .getByRole('button', { name: /运行状态更新示例/ })
      .first()
      .click()
    await page.getByRole('button', { name: '从环境变量导入配置' }).click()
    await expect(page.getByLabel('现在最卡住你的是什么？')).toBeVisible()

    const initial = await coreSnapshot(page, setup.goalId)
    await triggerDraft(page, '先看看但不保存')
    expect(await coreSnapshot(page, setup.goalId)).toEqual(initial)
    await page.getByRole('button', { name: '关闭', exact: true }).click()
    await expect(page.getByText(/未确认内容已丢弃/)).toBeVisible()
    expect(await coreSnapshot(page, setup.goalId)).toEqual(initial)

    await triggerDraft(page, '这次明确拒绝')
    await page.getByRole('button', { name: '拒绝全部建议' }).click()
    await expect(page.getByText(/建议已拒绝，没有保存任何内容/)).toBeVisible()
    expect(await coreSnapshot(page, setup.goalId)).toEqual(initial)

    await triggerDraft(page, '先制造 stale 再重试')
    await page.evaluate(async (goalId) => {
      const result = await window.myTracer.goals.updateDetails({
        goalId,
        name: '系统学习 React（已刷新）'
      })
      if (!result.ok) throw new Error(result.error.message)
    }, setup.goalId)
    const beforeStaleConfirm = await coreSnapshot(page, setup.goalId)
    const suggestionGroup = page.getByRole('group', { name: /选择一个临时建议/ })
    await suggestionGroup.getByRole('textbox').first().fill('stale 时不能保存')
    await page.getByRole('button', { name: '确认并设为新的下一步' }).click()
    await expect(page.getByText(/上下文已经变化/)).toBeVisible()
    expect(await coreSnapshot(page, setup.goalId)).toEqual(beforeStaleConfirm)

    await page.getByRole('button', { name: '主动重试' }).click()
    await expect(page.getByRole('group', { name: /选择一个临时建议/ })).toBeVisible()
    await page
      .getByRole('group', { name: /选择一个临时建议/ })
      .getByRole('textbox')
      .first()
      .fill('只打开 React 示例文件')
    await page.getByRole('button', { name: '确认并设为新的下一步' }).click()
    await expect(page.getByText(/新的 pending Action 已保存/)).toBeVisible()

    const afterAction = await coreSnapshot(page, setup.goalId)
    expect(afterAction.data.actions).toHaveLength(initial.data.actions.length + 1)
    expect(afterAction.data.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          goalId: setup.goalId,
          title: '只打开 React 示例文件',
          status: 'pending'
        })
      ])
    )
    expect(afterAction.today.focuses.map(({ id, commitment }) => ({ id, commitment }))).toEqual(
      initial.today.focuses.map(({ id, commitment }) => ({ id, commitment }))
    )
    expect(afterAction.today.intentions.map(({ id, commitment }) => ({ id, commitment }))).toEqual(
      initial.today.intentions.map(({ id, commitment }) => ({ id, commitment }))
    )
    expect(afterAction.data.actionRecords).toEqual(initial.data.actionRecords)
    expect(afterAction.data.understandings).toEqual(initial.data.understandings)
    expect(afterAction.data.confusions).toEqual(initial.data.confusions)
    expect(afterAction.goal.currentNextActionId).not.toBe(setup.originalActionId)

    await triggerDraft(page, '逐项保存理解候选')
    const understandingGroup = page.getByRole('group', { name: /理解候选/ })
    const candidateBlocks = understandingGroup.locator('.ai-start-help-candidate')
    await expect(candidateBlocks).toHaveCount(2)

    await candidateBlocks.nth(0).getByRole('textbox').fill('第一条最终理解')
    await candidateBlocks.nth(0).getByRole('combobox').selectOption({ index: 1 })
    await candidateBlocks.nth(0).getByRole('button', { name: '确认这一项' }).click()
    await expect(candidateBlocks.nth(0).getByRole('button', { name: '已保存' })).toBeVisible()
    const afterFirstUnderstanding = await coreSnapshot(page, setup.goalId)
    expect(afterFirstUnderstanding.data.understandings).toHaveLength(
      initial.data.understandings.length + 1
    )

    await candidateBlocks.nth(1).getByRole('textbox').fill('第二条修改后的最终理解')
    await candidateBlocks.nth(1).getByRole('combobox').selectOption({ index: 1 })
    await candidateBlocks.nth(1).getByRole('button', { name: '确认这一项' }).click()
    await expect(candidateBlocks.nth(1).getByRole('button', { name: '已保存' })).toBeVisible()
    const afterUnderstandings = await coreSnapshot(page, setup.goalId)
    expect(afterUnderstandings.data.understandings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionRecordId: setup.recordId,
          text: '第一条最终理解',
          source: 'ai_candidate_confirmed'
        }),
        expect.objectContaining({
          actionRecordId: setup.recordId,
          text: '第二条修改后的最终理解',
          source: 'ai_candidate_confirmed'
        })
      ])
    )
    expect(afterUnderstandings.data.actions).toEqual(afterAction.data.actions)
    expect(afterUnderstandings.data.actionRecords).toEqual(afterAction.data.actionRecords)
    expect(afterUnderstandings.today).toEqual(afterAction.today)

    await page.getByRole('button', { name: '拒绝全部建议' }).click()
    await expect(page.getByText(/建议已拒绝/)).toBeVisible()
    expect(await coreSnapshot(page, setup.goalId)).toEqual(afterUnderstandings)

    await application.evaluate(({ dialog }, target) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: target })
    }, destination)
    const exportResult = await page.evaluate(() => window.myTracer.exports.generate())
    expect(exportResult).toMatchObject({ ok: true, value: { exportVersion: 2 } })
    const exported = JSON.parse(await readFile(destination, 'utf8'))
    expect(exported.data.understandings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: '第一条最终理解', source: 'ai_candidate_confirmed' }),
        expect.objectContaining({
          text: '第二条修改后的最终理解',
          source: 'ai_candidate_confirmed'
        })
      ])
    )
    expect(JSON.stringify(exported)).not.toMatch(
      /synthetic-ac02-key|providerRequestId|sessionId|targetRef|先看看但不保存|stale 时不能保存/
    )

    await application.close()
    application = undefined
    application = await launch(root)
    page = await application.firstWindow()
    expect(await page.evaluate(() => window.myTracer.aiStartHelp.status())).toEqual({
      state: 'idle',
      generation: 0
    })
    expect(await coreSnapshot(page, setup.goalId)).toEqual(afterUnderstandings)
  } finally {
    await application?.close().catch(() => undefined)
    await removeTemporaryTestRoot(root)
  }
})
