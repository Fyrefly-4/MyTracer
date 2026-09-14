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
    env: minimalElectronEnvironment(root)
  })
  await application.evaluate(() => {
    const realDate = Date
    const instant = new realDate(2026, 8, 7, 12).toISOString()
    Reflect.set(
      globalThis,
      'Date',
      new Proxy(realDate, {
        construct(target, args) {
          return Reflect.construct(target, args.length ? args : [instant])
        }
      })
    )
  })
  await (await application.firstWindow()).reload()
  return application
}

async function navigate(page: Page, name: string): Promise<void> {
  await page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
}

async function expectStableWorkspace(page: Page, selector: string): Promise<void> {
  const metrics = await page.locator(selector).evaluate((workspace) => {
    const main = workspace.closest('main')
    return {
      width: workspace.getBoundingClientRect().width,
      noHorizontalOverflow: Boolean(main && main.scrollWidth <= main.clientWidth)
    }
  })
  expect(metrics.width).toBeLessThanOrEqual(1042)
  expect(metrics.noHorizontalOverflow).toBe(true)
}

async function expectReadableVisualFoundation(page: Page): Promise<void> {
  const metrics = await page.evaluate(() => {
    const rootStyle = getComputedStyle(document.documentElement)
    const content = document.querySelector<HTMLElement>('.content')
    const title = content?.querySelector<HTMLElement>('h1')
    const visibleButtons = [...document.querySelectorAll<HTMLElement>('button')].filter(
      (element) => element.getClientRects().length > 0
    )
    const visibleText = [...document.body.querySelectorAll<HTMLElement>('*')].filter((element) => {
      const hasOwnText = [...element.childNodes].some(
        (node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim())
      )
      return hasOwnText && element.getClientRects().length > 0
    })
    return {
      tokens: {
        shell: rootStyle.getPropertyValue('--color-shell').trim().toLowerCase(),
        surface: rootStyle.getPropertyValue('--color-surface').trim().toLowerCase(),
        text: rootStyle.getPropertyValue('--color-text').trim().toLowerCase(),
        muted: rootStyle.getPropertyValue('--color-muted').trim().toLowerCase(),
        action: rootStyle.getPropertyValue('--color-action').trim().toLowerCase(),
        line: rootStyle.getPropertyValue('--color-line').trim().toLowerCase()
      },
      rootFontSize: Number.parseFloat(rootStyle.fontSize),
      contentBackground: content ? getComputedStyle(content).backgroundColor : '',
      titleFontSize: title ? Number.parseFloat(getComputedStyle(title).fontSize) : 0,
      smallestButtonFontSize: Math.min(
        ...visibleButtons.map((element) => Number.parseFloat(getComputedStyle(element).fontSize))
      ),
      smallestVisibleText: Math.min(
        ...visibleText.map((element) => Number.parseFloat(getComputedStyle(element).fontSize))
      )
    }
  })
  expect(metrics.tokens).toEqual({
    shell: '#f4f2e9',
    surface: '#fffefa',
    text: '#293c38',
    muted: '#65736d',
    action: '#315e50',
    line: '#dadfd7'
  })
  expect(metrics.rootFontSize).toBe(16)
  expect(metrics.contentBackground).toBe('rgb(255, 254, 250)')
  expect(metrics.titleFontSize).toBe(34)
  expect(metrics.smallestButtonFontSize).toBeGreaterThanOrEqual(15)
  expect(metrics.smallestVisibleText).toBeGreaterThanOrEqual(13)
}

test('keeps existing work reachable, restores selection, and records without implicit changes', async () => {
  test.slow()
  const root = await createTemporaryTestRoot()
  let application: ElectronApplication | undefined
  const goalName = '阅读与理解'
  const actionName = '读十页，并留下一个值得继续思考的问题'
  try {
    application = await launch(root)
    const page = await application.firstWindow()
    await application.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].setContentSize(1120, 760)
    })
    await navigate(page, '今天')
    await expectReadableVisualFoundation(page)
    const emptyDetail = page.locator('.detail-empty')
    await expect(emptyDetail).toBeVisible()
    expect(
      await emptyDetail.evaluate((empty) => {
        const grid = empty.closest('.today-grid')
        if (!grid) return false
        const emptyBox = empty.getBoundingClientRect()
        const gridBox = grid.getBoundingClientRect()
        return emptyBox.width <= 522 && emptyBox.top - gridBox.top < 90
      })
    ).toBe(true)
    await navigate(page, '目标')
    await expect(page.locator('form.goal-create')).toHaveCount(0)
    await page.getByRole('button', { name: '新建目标', exact: true }).click()
    await page.getByLabel('目标名称').fill(goalName)
    await page.getByLabel('当前下一步（可选）').fill(actionName)
    await page.getByRole('button', { name: '创建目标', exact: true }).click()
    await expect(page.getByLabel(`${goalName} 详情`)).toBeVisible()
    await expectReadableVisualFoundation(page)
    await expectStableWorkspace(page, '.goal-workspace')
    await page.getByRole('button', { name: '查看恢复与整理' }).click()
    await expect(page.locator('.recovery-resume-card')).toBeVisible()
    expect(
      await page.locator('.recovery-panel').evaluate((recovery) => {
        const resume = recovery.querySelector<HTMLElement>('.recovery-resume-card')
        const fact = recovery.querySelector<HTMLElement>('.recovery-fact')
        return Boolean(
          resume && fact && resume.getBoundingClientRect().top < fact.getBoundingClientRect().top
        )
      })
    ).toBe(true)
    await expect(page.getByRole('button', { name: '加入今天并继续' })).toBeInViewport()
    await page.getByRole('button', { name: '返回目标' }).click()
    await expect(page.getByLabel(`${goalName} 详情`)).toBeVisible()
    await page.getByRole('button', { name: '去今天处理' }).click()
    const detail = page.getByLabel(`${actionName} 行动详情`, { exact: true })
    await expect(detail).toBeVisible()

    const ids = await page.evaluate(async () => {
      const goals = await window.myTracer.goals.list({ status: null })
      if (!goals.ok) throw new Error('Cannot read goal')
      const routine = await window.myTracer.routines.create({
        name: '散步',
        minimumAction: '走一小段',
        weekdays: [1, 2, 3, 4, 5, 6, 7]
      })
      const completed = await window.myTracer.actions.create({ title: '已经完成的候选' })
      const intention = await window.myTracer.actions.create({ title: '已经加入今天的候选' })
      const pausedGoal = await window.myTracer.goals.create({
        name: '暂停目标',
        initialNextAction: { title: '当前不可行动的候选' }
      })
      if (!routine.ok || !completed.ok || !intention.ok || !pausedGoal.ok) {
        throw new Error('Cannot create isolated UX fixtures')
      }
      const completedResult = await window.myTracer.actions.complete({
        actionId: completed.value.id
      })
      const intentionResult = await window.myTracer.today.selectActionAsIntention({
        actionId: intention.value.id
      })
      const pausedResult = await window.myTracer.goals.pause({ goalId: pausedGoal.value.id })
      if (!completedResult.ok || !intentionResult.ok || !pausedResult.ok) {
        throw new Error('Cannot prepare candidate states')
      }
      return { goalId: goals.value[0].id, actionId: goals.value[0].currentNextActionId! }
    })
    await navigate(page, '目标')
    await expect(page.getByLabel(`${goalName} 详情`)).toBeVisible()
    await page.getByLabel('状态', { exact: true }).selectOption('active')
    await navigate(page, '今天')
    await expect(detail).toBeVisible()
    await expect(page.locator('form.goal-create')).toHaveCount(0)
    const candidateSection = page.locator('.action-candidates')
    await expect(candidateSection).toHaveAttribute('open', '')
    await expect(candidateSection).toContainText(actionName)
    await expect(candidateSection).not.toContainText('已经完成的候选')
    await expect(candidateSection).not.toContainText('已经加入今天的候选')
    await expect(candidateSection).not.toContainText('当前不可行动的候选')
    const candidateRow = candidateSection.locator('.candidate-row').filter({ hasText: actionName })
    expect(
      await candidateRow.evaluate((row) => {
        const action = row.querySelector<HTMLElement>('.goal-list-item')
        const controls = row.querySelector<HTMLElement>('.candidate-actions')
        if (!action || !controls) return false
        const actionBox = action.getBoundingClientRect()
        const controlsBox = controls.getBoundingClientRect()
        return actionBox.width >= 200 && controlsBox.top >= actionBox.bottom
      })
    ).toBe(true)
    expect(
      await candidateSection.evaluate((candidate) => {
        const routine = document.querySelector('.planned-routines')
        if (!routine || !candidate.parentElement) return false
        const siblings = [...candidate.parentElement.children]
        return siblings.indexOf(candidate) < siblings.indexOf(routine)
      })
    ).toBe(true)

    const panel = page.getByLabel(`${actionName} 行动记录`, { exact: true })
    for (const size of [
      { width: 1440, height: 900, layout: 'columns' },
      { width: 1106, height: 698, layout: 'columns' },
      { width: 900, height: 698, layout: 'stacked' }
    ]) {
      await application.evaluate(({ BrowserWindow }, dimensions) => {
        BrowserWindow.getAllWindows()[0].setContentSize(dimensions.width, dimensions.height)
      }, size)
      await expect
        .poll(() =>
          page.evaluate(
            ({ width, height }) =>
              Math.abs(innerWidth - width) <= 2 && Math.abs(innerHeight - height) <= 2,
            size
          )
        )
        .toBe(true)
      await page.locator('main').evaluate((main) => {
        main.scrollTop = 0
      })
      await expect(detail).toBeVisible()
      await expect(candidateRow.locator('.goal-list-item')).toHaveAttribute('aria-pressed', 'true')
      const layoutMetrics = await page.locator('.today-grid').evaluate((grid, expectedLayout) => {
        const [context, action] = Array.from(grid.children) as HTMLElement[]
        const gridBox = grid.getBoundingClientRect()
        const contextBox = context.getBoundingClientRect()
        const actionBox = action.getBoundingClientRect()
        return {
          matches:
            expectedLayout === 'columns'
              ? actionBox.left > contextBox.right && Math.abs(actionBox.top - contextBox.top) < 2
              : actionBox.top >= contextBox.bottom &&
                Math.abs(actionBox.left - contextBox.left) < 2,
          gridWidth: gridBox.width,
          contextWidth: contextBox.width,
          actionWidth: actionBox.width
        }
      }, size.layout)
      expect(layoutMetrics.matches).toBe(true)
      if (size.layout === 'columns') {
        expect(layoutMetrics.gridWidth).toBeLessThanOrEqual(1042)
        expect(layoutMetrics.contextWidth / layoutMetrics.gridWidth).toBeGreaterThanOrEqual(0.3)
        expect(layoutMetrics.contextWidth / layoutMetrics.gridWidth).toBeLessThanOrEqual(0.38)
        expect(layoutMetrics.actionWidth).toBeGreaterThan(layoutMetrics.contextWidth)
      }
      expect(
        await page.locator('main').evaluate((main) => main.scrollWidth <= main.clientWidth)
      ).toBe(true)
      await panel.getByRole('button', { name: '开始记录' }).click()
      await expect(panel.getByLabel('投入时长（分钟，必填）')).toBeInViewport()
      await expect(panel.getByLabel('投入时长（分钟，必填）')).toBeFocused()
      await expect(panel.getByRole('heading', { name: actionName })).toBeInViewport()
      await expect(panel.getByLabel('保存记录后')).toHaveCount(0)
      await expect(panel.getByText('仅保存记录，行动状态和当前下一步保持不变。')).toBeVisible()
      await panel.getByRole('button', { name: '放弃草稿' }).click()
      await expect(panel.getByRole('button', { name: '开始记录' })).toBeFocused()
      await page.locator('main').evaluate((main) => {
        main.scrollTop = main.scrollHeight
      })
      await expect(
        page.getByRole('navigation').getByRole('button', { name: '目标', exact: true })
      ).toBeInViewport()
      expect(
        await page.locator('main').evaluate((main) => main.scrollWidth <= main.clientWidth)
      ).toBe(true)
    }
    const empty = await page.evaluate(
      (actionId) => window.myTracer.records.listForAction({ actionId }),
      ids.actionId
    )
    expect(empty).toMatchObject({ ok: true, value: [] })
    await panel.getByRole('button', { name: '开始记录' }).click()
    await panel.getByLabel('投入时长（分钟，必填）').fill('7')
    await panel.getByRole('button', { name: /添加理解/ }).click()
    await panel.getByLabel('备注（可选）').fill('页面切换后仍应保留')
    await navigate(page, '目标')
    await navigate(page, '今天')
    await expect(panel.getByText('未保存的记录草稿已恢复')).toBeVisible()
    await expect(panel.getByLabel('投入时长（分钟，必填）')).toHaveValue('7')
    await expect(panel.getByLabel('备注（可选）')).toHaveValue('页面切换后仍应保留')
    await panel.getByRole('button', { name: '放弃草稿' }).click()
    await panel.getByRole('button', { name: '开始记录' }).click()
    await panel.getByLabel('投入时长（分钟，必填）').fill('12')
    await panel.getByLabel('本次结果').selectOption('partial')
    await panel.getByRole('button', { name: '保存记录', exact: true }).click()
    await expect(panel.getByRole('status')).toContainText('已保存：12 分钟')
    const facts = await page.evaluate(
      async ({ actionId, goalId }) => ({
        action: await window.myTracer.actions.getDetail({ actionId }),
        goal: await window.myTracer.goals.getDetail({ goalId }),
        records: await window.myTracer.records.listForAction({ actionId })
      }),
      ids
    )
    expect(facts.action).toMatchObject({
      ok: true,
      value: { status: 'pending', todayCommitment: null }
    })
    expect(facts.goal).toMatchObject({ ok: true, value: { currentNextActionId: ids.actionId } })
    expect(facts.records).toMatchObject({
      ok: true,
      value: [{ durationMinutes: 12, outcome: 'partial' }]
    })

    await navigate(page, '进展')
    await page.getByLabel('开始日期').fill('2026-09-07')
    await page.getByLabel('结束日期').fill('2026-09-13')
    await page.getByRole('button', { name: '查看记录' }).click()
    await expect(page.getByLabel('进展汇总')).toContainText('累计行动分钟12')
    await expect(page.getByLabel('进展汇总')).toContainText('记录到的行动次数1')
    await expectReadableVisualFoundation(page)
    await expectStableWorkspace(page, '.progress-workspace')
    await navigate(page, '复盘')
    await expect(page.getByLabel('周期汇总')).toContainText('投入时间12 分钟')
    await expect(page.getByLabel('周期汇总')).toContainText('真实行动次数1')
    await expectReadableVisualFoundation(page)
    await expectStableWorkspace(page, '.review-workspace')
    await navigate(page, '进展')
    await expect(page.getByLabel('开始日期（包含）')).toHaveValue('2026-09-07')
    await expect(page.getByLabel('结束日期（包含）')).toHaveValue('2026-09-13')
    await expect(page.getByLabel('进展汇总')).toContainText('累计行动分钟12')
    await page.getByRole('button', { name: '查看完整记录或修改' }).click()
    await expect(page.getByLabel('所选记录')).toContainText(`行动 · ${actionName}`)
    await expect(page.getByLabel('行动分钟')).toHaveValue('12')
    await expectReadableVisualFoundation(page)
    await expectStableWorkspace(page, '.data-workspace')
    await navigate(page, '目标')
    await expect(page.getByLabel(`${goalName} 详情`)).toBeVisible()
    await expect(page.getByLabel('状态', { exact: true })).toHaveValue('active')
    await navigate(page, '今天')
    await expect(detail).toBeVisible()
    await panel.getByRole('button', { name: '开始记录' }).click()
    await panel.getByRole('button', { name: /添加理解/ }).click()
    await panel.getByLabel('记录中的下一步（可选）').fill('再读一段')
    await panel.getByRole('button', { name: '调整行动状态或当前下一步（可选）' }).click()
    await panel.getByLabel('明确将记录中的下一步创建为目标当前下一步').check()
    await panel.getByLabel('记录中的下一步（可选）').fill('')
    await expect(panel.getByLabel('明确将记录中的下一步创建为目标当前下一步')).toHaveCount(0)
    await expect(panel.getByText('仅保存记录，行动状态和当前下一步保持不变。')).toBeVisible()
    await panel.getByRole('button', { name: '放弃草稿' }).click()
    const routinePanel = page.getByLabel('散步 例行记录', { exact: true })
    await routinePanel.getByRole('button', { name: '记录例行' }).click()
    await expect(routinePanel.getByLabel('本次结果')).toBeInViewport()
    await routinePanel.getByRole('button', { name: '放弃草稿', exact: true }).click()
    await expect(routinePanel.getByRole('button', { name: '记录例行' })).toBeFocused()
    await navigate(page, '例行')
    await page.locator('.goal-list-item').first().click()
    await expect(page.getByLabel('散步 例行详情', { exact: true })).toBeVisible()
    await expectReadableVisualFoundation(page)
    await expectStableWorkspace(page, '.routine-workspace')
    const afterCancel = await page.evaluate(() => window.myTracer.dataControl.list())
    expect(afterCancel).toMatchObject({
      ok: true,
      value: {
        actionRecords: [expect.objectContaining({ durationMinutes: 12 })],
        routineRecords: []
      }
    })
  } finally {
    await application?.close().catch(() => undefined)
    await removeTemporaryTestRoot(root)
  }
})

test('labels historical facts, explains missing objects, and clears a deleted selection', async () => {
  test.slow()
  const root = await createTemporaryTestRoot()
  let application: ElectronApplication | undefined
  try {
    application = await launch(root)
    const page = await application.firstWindow()
    await navigate(page, '数据')
    await expectStableWorkspace(page, '.data-workspace')
    await page.getByText('补记历史记录', { exact: true }).click()
    await expect(page.getByText('还没有可补记的行动，请先在今天或目标页创建行动。')).toBeVisible()
    await expect(page.getByRole('button', { name: '补记行动记录', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: '补记例行记录', exact: true })).toBeDisabled()
    const ids = await page.evaluate(async () => {
      const goal = await window.myTracer.goals.create({
        name: '历史阅读',
        initialNextAction: { title: '历史行动' }
      })
      const routine = await window.myTracer.routines.create({
        name: '历史散步',
        minimumAction: '走一段',
        weekdays: [1]
      })
      if (!goal.ok || !routine.ok) throw new Error('Cannot create isolated history fixtures')
      return {
        goalId: goal.value.id,
        actionId: goal.value.currentNextActionId!,
        routineId: routine.value.id
      }
    })
    await navigate(page, '目标')
    await page.getByRole('button', { name: /历史阅读.*有下一步/ }).click()
    await page.getByRole('button', { name: '去今天处理' }).click()
    await expect(page.getByLabel('历史行动 行动详情')).toBeVisible()
    await navigate(page, '数据')
    await page.getByText('补记历史记录', { exact: true }).click()
    await page.getByLabel('行动补记日期', { exact: true }).fill('2026-09-01')
    await page.getByLabel('行动补记分钟', { exact: true }).fill('9')
    const dateField = page.getByLabel('行动补记日期', { exact: true }).locator('..')
    await expect(dateField.getByText('发生日期（必填）', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '补记行动记录', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: '已补记' })).toContainText(
      '历史行动 · 2026-09-01'
    )
    await page.getByLabel('例行补记日期', { exact: true }).fill('2026-09-02')
    await page.getByLabel('例行补记结果', { exact: true }).selectOption('acted')
    await page.getByLabel('例行补记分钟', { exact: true }).fill('3')
    await page.getByRole('button', { name: '补记例行记录', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: '已补记' })).toContainText(
      '历史散步 · 2026-09-02'
    )
    await page.getByLabel('行动补记日期', { exact: true }).fill('2026-08-31')
    await page.getByRole('button', { name: '取消行动补记' }).click()
    await page.getByLabel('例行补记日期', { exact: true }).fill('2026-08-31')
    await page.getByRole('button', { name: '取消例行补记' }).click()
    const facts = await page.evaluate(() => window.myTracer.dataControl.list())
    expect(facts).toMatchObject({
      ok: true,
      value: {
        actionRecords: [
          expect.objectContaining({
            actionId: ids.actionId,
            occurredOn: '2026-09-01',
            durationMinutes: 9
          })
        ],
        routineRecords: [
          expect.objectContaining({
            routineId: ids.routineId,
            occurredOn: '2026-09-02',
            durationMinutes: 3,
            plannedForDate: false
          })
        ]
      }
    })
    await page.getByText('删除目标、行动或例行', { exact: true }).click()
    await page.getByLabel('内容类型').selectOption('action')
    await page.getByLabel('选择内容').selectOption({ label: '历史行动' })
    await page.getByRole('button', { name: '预览永久删除影响', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: /确认永久删除行动“历史行动”/ })
    await expect(dialog).toBeVisible()
    expect(
      await dialog.evaluate((element) => {
        const box = element.getBoundingClientRect()
        return box.width <= 522 && element.scrollWidth <= element.clientWidth
      })
    ).toBe(true)
    await dialog.getByRole('button', { name: '永久删除', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await navigate(page, '今天')
    await expect(page.getByRole('alert')).toContainText('已不存在')
    await expect(page.getByLabel('历史行动 行动详情')).toHaveCount(0)
  } finally {
    await application?.close().catch(() => undefined)
    await removeTemporaryTestRoot(root)
  }
})
