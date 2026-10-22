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
    const page = await application.firstWindow()
    await application.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].setContentSize(1200, 800)
    })
    const actionId = await page.evaluate(async () => {
      const result = await window.myTracer.actions.create({ title: '阅读一段，留下一个自己的理解' })
      if (!result.ok) throw new Error('Cannot create isolated action fixture')
      return result.value.id
    })
    await page.reload()
    await page.getByRole('navigation').getByRole('button', { name: '今天', exact: true }).click()
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

test('Today notebook scrolls independently, collapses without losing drafts, and paginates full records', async () => {
  test.slow()
  const root = await createTemporaryTestRoot()
  let application: ElectronApplication | undefined
  try {
    application = await electron.launch({
      cwd: root.root,
      args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
      env: minimalElectronEnvironment(root)
    })
    const page = await application.firstWindow()
    await application.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].setContentSize(1280, 800)
    })
    await page.evaluate(async () => {
      for (let i = 0; i < 24; i++) {
        const action = await window.myTracer.actions.create({ title: `独立滚动行动 ${i + 1}` })
        if (!action.ok) throw new Error('Cannot create notebook fixture')
        if (i === 0) {
          const selected = await window.myTracer.today.selectAction({ actionId: action.value.id })
          if (!selected.ok) throw new Error('Cannot select notebook fixture')
          for (let day = 11; day <= 16; day++) {
            const record = await window.myTracer.dataControl.backfillActionRecord({
              actionId: action.value.id,
              occurredOn: `2026-08-${day}`,
              durationMinutes: day,
              outcome: 'partial',
              note: `第 ${day} 天的完整记录\n保留多行原文。`
            })
            if (!record.ok) throw new Error('Cannot create notebook history')
          }
        }
      }
    })
    await page.reload()
    await page.getByRole('navigation').getByRole('button', { name: '今天', exact: true }).click()
    await page
      .locator('.today-priority')
      .getByRole('button', { name: /独立滚动行动 1.*待行动/ })
      .click()
    const master = page.locator('.today-master-list')
    const detail = page.locator('.today-detail-pane')
    await page.locator('.action-candidates > summary').click()
    const before = await detail.evaluate((element) => element.scrollTop)
    await master.hover()
    await page.mouse.wheel(0, 650)
    await expect.poll(() => master.evaluate((element) => element.scrollTop)).toBeGreaterThan(100)
    expect(await detail.evaluate((element) => element.scrollTop)).toBe(before)
    await expect(page.getByRole('button', { name: '新建行动', exact: true })).toBeInViewport()
    const masterScroll = await master.evaluate((element) => element.scrollTop)
    await detail.hover()
    await page.mouse.wheel(0, 600)
    await expect.poll(() => detail.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
    expect(await master.evaluate((element) => element.scrollTop)).toBe(masterScroll)

    const table = page.getByRole('table', { name: '已有行动记录' })
    await expect(table.locator('tbody tr')).toHaveCount(5)
    await page.getByLabel('行动记录分页').getByRole('button', { name: '下一页' }).click()
    await expect(table.locator('tbody tr')).toHaveCount(1)
    await table.getByRole('button', { name: /2026-08-11/ }).click()
    await expect(page.getByLabel('记录详情', { exact: true })).toContainText('第 11 天的完整记录')
    const panel = page.getByLabel('独立滚动行动 1 行动记录', { exact: true })
    await panel.getByRole('button', { name: '开始记录', exact: true }).click()
    await panel.getByLabel('投入时长（分钟，必填）').fill('17')
    await page.getByRole('button', { name: '收起今天列表' }).click()
    await expect(master).toBeHidden()
    await expect(panel.getByLabel('投入时长（分钟，必填）')).toHaveValue('17')
    await page.getByRole('button', { name: '展开今天列表' }).click()
    await expect(master).toBeVisible()
    await expect(panel.getByLabel('投入时长（分钟，必填）')).toHaveValue('17')

    const create = page.getByRole('button', { name: '新建行动', exact: true })
    await create.click()
    const dialog = page.getByRole('dialog', { name: '留下一个可以直接开始的小步骤' })
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('行动标题', { exact: true }).fill('尚未提交的新行动草稿')
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
    await expect(create).toBeFocused()
    await create.click()
    await expect(dialog.getByLabel('行动标题', { exact: true })).toHaveValue('尚未提交的新行动草稿')
    await dialog.getByRole('button', { name: '取消新建' }).click()
    await expect(create).toBeFocused()
    const actions = await page.evaluate(() => window.myTracer.today.get({}))
    expect(
      actions.ok &&
        actions.value.availableActions.some((action) => action.title === '尚未提交的新行动草稿')
    ).toBe(false)
    await expect(panel.getByLabel('投入时长（分钟，必填）')).toHaveValue('17')
  } finally {
    await application?.close().catch(() => undefined)
    await removeTemporaryTestRoot(root)
  }
})
