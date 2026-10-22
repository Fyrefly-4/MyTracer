import { join } from 'node:path'
import { expect, test, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

test('goal and routine notebooks paginate, scroll independently, and preserve create drafts', async () => {
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
      BrowserWindow.getAllWindows()[0].setContentSize(1120, 650)
    })
    await page.evaluate(async () => {
      for (let i = 1; i <= 8; i++) {
        const goal = await window.myTracer.goals.create({
          name: `笔记本目标${i}：保留一个长期方向和可以继续的小步骤`,
          description: '这是一段保留原意的长说明，用来验证详情独立滚动。\n'.repeat(18),
          initialNextAction: { title: `目标${i}的下一步` }
        })
        if (!goal.ok || !goal.value.currentNextActionId) throw new Error('Cannot seed goal')
        if (i === 1) {
          for (let day = 11; day <= 16; day++) {
            const record = await window.myTracer.dataControl.backfillActionRecord({
              actionId: goal.value.currentNextActionId,
              occurredOn: `2026-08-${day}`,
              durationMinutes: 15,
              outcome: 'partial',
              note: `目标记录 ${day}，完整内容不会因分页丢失。`
            })
            if (!record.ok) throw new Error('Cannot seed goal records')
          }
        }
        const routine = await window.myTracer.routines.create({
          name: `笔记本例行${i}`,
          minimumAction: '读两页',
          weekdays: [1, 2, 3, 4, 5],
          description: '轻量的重复行动，不强求补齐。\n'.repeat(30),
          goalId: goal.value.id
        })
        if (!routine.ok) throw new Error('Cannot seed routine')
      }
    })
    await page.getByRole('navigation').getByRole('button', { name: '目标', exact: true }).click()
    const master = page.locator('.goal-workspace .object-master-scroll')
    const detail = page.locator('.goal-workspace .object-detail-scroll')
    await expect(master.locator('.goal-list-item')).toHaveCount(6)
    const listPager = page.getByLabel('目标列表分页', { exact: true })
    await listPager.getByRole('button', { name: '下一页', exact: true }).click()
    await expect(master.locator('.goal-list-item')).toHaveCount(2)
    await listPager.getByRole('button', { name: '上一页', exact: true }).click()
    await page.getByLabel('搜索目标', { exact: true }).fill('笔记本目标1：')
    await master.locator('.goal-list-item').click()
    await page.getByLabel('搜索目标', { exact: true }).fill('')
    const beforeDetail = await detail.evaluate((element) => element.scrollTop)
    await master.hover()
    await page.mouse.wheel(0, 400)
    await expect.poll(() => master.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
    expect(await detail.evaluate((element) => element.scrollTop)).toBe(beforeDetail)
    const masterTop = await master.evaluate((element) => element.scrollTop)
    await detail.hover()
    await page.mouse.wheel(0, 550)
    await expect.poll(() => detail.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
    expect(await master.evaluate((element) => element.scrollTop)).toBe(masterTop)
    const history = page.getByRole('table', { name: '已有目标记录' })
    await expect(history.locator('tbody tr')).toHaveCount(5)
    await page
      .getByLabel('目标记录分页')
      .getByRole('button', { name: '下一页', exact: true })
      .click()
    await expect(history.locator('tbody tr')).toHaveCount(1)
    await history.getByRole('button', { name: /查看完整记录/ }).click()
    await expect(page.getByLabel('所选记录', { exact: true })).toContainText(
      '完整内容不会因分页丢失'
    )

    await page.getByRole('navigation').getByRole('button', { name: '目标', exact: true }).click()
    await expect(page.getByLabel('目标记录分页')).toContainText('2 / 2')
    const selectedGoal = page.getByLabel('笔记本目标1：保留一个长期方向和可以继续的小步骤 详情', {
      exact: true
    })
    await selectedGoal.getByText('编辑与管理目标', { exact: true }).click()
    await selectedGoal.getByLabel('选择当前下一步').selectOption({ label: '新建下一步…' })
    await selectedGoal.getByLabel('下一步名称', { exact: true }).fill('未提交的下一步草稿')
    await page.getByRole('button', { name: '新建目标', exact: true }).click()
    const goalForm = page.getByRole('form', { name: '新建目标表单' })
    await goalForm.getByLabel('目标名称').fill('只保留，不提交的目标草稿')
    await page.getByRole('button', { name: '收起目标列表' }).click()
    await expect(master).toBeHidden()
    await expect(goalForm.getByLabel('目标名称')).toHaveValue('只保留，不提交的目标草稿')
    await expect(page.getByRole('button', { name: '展开目标列表' })).toBeFocused()
    await page.getByRole('button', { name: '展开目标列表' }).click()
    await goalForm.getByRole('button', { name: '取消新建', exact: true }).click()
    await expect(selectedGoal.getByLabel('下一步名称', { exact: true })).toHaveValue(
      '未提交的下一步草稿'
    )
    await page.getByRole('button', { name: '新建目标', exact: true }).click()
    await expect(goalForm.getByLabel('目标名称')).toHaveValue('只保留，不提交的目标草稿')

    await page.getByRole('navigation').getByRole('button', { name: '例行', exact: true }).click()
    const routineMaster = page.locator('.routine-workspace .object-master-scroll')
    await expect(routineMaster.locator('.goal-list-item')).toHaveCount(6)
    await page
      .getByLabel('例行列表分页')
      .getByRole('button', { name: '下一页', exact: true })
      .click()
    await expect(routineMaster.locator('.goal-list-item')).toHaveCount(2)
    await routineMaster.locator('.goal-list-item').first().click()
    const routineDetail = page.locator('.routine-workspace .object-detail-scroll')
    await expect(routineDetail.locator('article')).toBeVisible()
    await routineDetail.evaluate((element) => {
      element.scrollTop = 180
    })
    await expect.poll(() => routineDetail.evaluate((element) => element.scrollTop)).toBe(180)
    // Test-only IPC latency: list resolves first, selected detail later. The production
    // bridge stays untouched, and every call still runs its original validated handler.
    await application.evaluate(({ ipcMain }) => {
      const handlers = (
        ipcMain as unknown as { _invokeHandlers: Map<string, (...args: unknown[]) => unknown> }
      )._invokeHandlers
      const original = handlers.get('routines:get-detail')
      if (!original) throw new Error('Routine detail IPC handler missing')
      ipcMain.removeHandler('routines:get-detail')
      ipcMain.handle('routines:get-detail', async (...args) => {
        await new Promise((resolve) => setTimeout(resolve, 250))
        return original(...args)
      })
    })
    await page.getByRole('navigation').getByRole('button', { name: '目标', exact: true }).click()
    await page.getByRole('navigation').getByRole('button', { name: '例行', exact: true }).click()
    await expect(routineDetail.locator('article')).toBeVisible()
    await expect.poll(() => routineDetail.evaluate((element) => element.scrollTop)).toBe(180)
    await expect(page.getByLabel('例行列表分页')).toContainText('2 / 2')
    await page.getByRole('button', { name: '新建例行', exact: true }).click()
    const routineForm = page.getByRole('form', { name: '新建例行表单' })
    await routineForm.getByLabel('名称', { exact: true }).fill('尚未保存的例行')
    await page.getByRole('button', { name: '收起例行列表' }).click()
    await expect(routineMaster).toBeHidden()
    await expect(routineForm.getByLabel('名称', { exact: true })).toHaveValue('尚未保存的例行')
    await page.getByRole('button', { name: '展开例行列表' }).click()
    await routineForm.getByRole('button', { name: '收起表单', exact: true }).click()
    await page.getByRole('button', { name: '新建例行', exact: true }).click()
    await expect(routineForm.getByLabel('名称', { exact: true })).toHaveValue('尚未保存的例行')
    expect(
      await page.locator('main').evaluate((element) => element.scrollWidth <= element.clientWidth)
    ).toBe(true)
  } finally {
    await application?.close().catch(() => undefined)
    await removeTemporaryTestRoot(root)
  }
})
