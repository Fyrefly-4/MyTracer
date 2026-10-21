import { join } from 'node:path'
import { expect, test, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

test('keeps Today feedback out of flow and record controls visible while preserving a deep draft', async () => {
  test.slow()
  const root = await createTemporaryTestRoot()
  let application: ElectronApplication | undefined
  try {
    application = await electron.launch({
      cwd: root.root,
      args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
      env: minimalElectronEnvironment(root)
    })
    await application.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].setContentSize(1200, 800)
    })
    const page = await application.firstWindow()
    const actionId = await page.evaluate(async () => {
      const result = await window.myTracer.actions.create({ title: '阅读一段，留下一个自己的理解' })
      if (!result.ok) throw new Error('Cannot create isolated action fixture')
      return result.value.id
    })
    await page.reload()
    await page.getByRole('button', { name: /阅读一段，留下一个自己的理解.*待行动/ }).click()
    const detail = page.getByLabel('阅读一段，留下一个自己的理解 行动详情', { exact: true })
    const before = await page
      .locator('.today-grid')
      .evaluate((grid) => grid.getBoundingClientRect().top)
    await detail.getByRole('button', { name: '选为今日重点', exact: true }).click()
    await expect(page.locator('.today-notice')).toContainText('已设为今日重点')
    const after = await page
      .locator('.today-grid')
      .evaluate((grid) => grid.getBoundingClientRect().top)
    expect(Math.abs(after - before)).toBeLessThanOrEqual(2)
    await page.getByRole('button', { name: '关闭操作提示' }).click()
    await expect(page.locator('.today-notice')).toHaveCount(0)

    const panel = page.getByLabel('阅读一段，留下一个自己的理解 行动记录', { exact: true })
    await panel.getByRole('button', { name: '开始记录', exact: true }).click()
    await panel.getByLabel('投入时长（分钟，必填）').fill('12')
    await panel.getByRole('button', { name: /添加理解/ }).click()
    await panel.getByLabel('我理解了（可选）').fill('把理解写成自己的话，比只标记完成更有意义。')
    await panel.getByLabel('备注（可选）').fill('切换页面后继续填写，不应丢失。')
    await expect(panel.getByRole('button', { name: '保存记录', exact: true })).toBeInViewport()
    await expect(
      panel.getByRole('heading', { name: '阅读一段，留下一个自己的理解' })
    ).toBeInViewport()
    expect(
      await panel
        .locator('.today-recording-fields')
        .evaluate((fields) => fields.scrollHeight > fields.clientHeight)
    ).toBe(true)

    await page.getByRole('navigation').getByRole('button', { name: '目标', exact: true }).click()
    await page.getByRole('navigation').getByRole('button', { name: '今天', exact: true }).click()
    await expect(panel.getByText('未保存的记录草稿已恢复', { exact: false })).toBeVisible()
    await expect(panel.getByLabel('投入时长（分钟，必填）')).toHaveValue('12')
    await expect(panel.getByLabel('我理解了（可选）')).toHaveValue(
      '把理解写成自己的话，比只标记完成更有意义。'
    )
    await panel.getByRole('button', { name: '保存记录', exact: true }).click()
    await expect(panel.getByRole('status')).toContainText('记录已保存')
    const facts = await page.evaluate(
      async (id) => ({
        action: await window.myTracer.actions.getDetail({ actionId: id }),
        records: await window.myTracer.records.listForAction({ actionId: id })
      }),
      actionId
    )
    expect(facts.action).toMatchObject({
      ok: true,
      value: { status: 'pending', todayCommitment: 'focus' }
    })
    expect(facts.records).toMatchObject({
      ok: true,
      value: [{ durationMinutes: 12, outcome: 'partial' }]
    })
  } finally {
    await application?.close().catch(() => undefined)
    await removeTemporaryTestRoot(root)
  }
})
