import { join } from 'node:path'
import { expect, test, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { openManagement } from '../support/ui-disclosure'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

test('visible selection restores per page, survives restart, and respects filters, pages and drafts', async () => {
  test.slow()
  const root = await createTemporaryTestRoot()
  let app: ElectronApplication | undefined
  const launch = () =>
    electron.launch({
      cwd: root.root,
      args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
      env: minimalElectronEnvironment(root)
    })
  try {
    app = await launch()
    let page = await app.firstWindow()
    await page.evaluate(async () => {
      for (let index = 1; index <= 8; index++) {
        const goal = await window.myTracer.goals.create({
          name: `选择目标${index}`,
          initialNextAction: { title: `选择行动${index}` }
        })
        if (!goal.ok || !goal.value.currentNextActionId) throw Error('seed')
        const record = await window.myTracer.dataControl.backfillActionRecord({
          actionId: goal.value.currentNextActionId,
          occurredOn: `2026-08-${10 + index}`,
          durationMinutes: index,
          outcome: 'partial',
          note: `选择记录${index}`
        })
        if (!record.ok) throw Error('seed record')
        if (index === 1)
          for (const occurredOn of ['2026-08-01', '2026-08-02']) {
            const older = await window.myTracer.dataControl.backfillActionRecord({
              actionId: goal.value.currentNextActionId,
              occurredOn,
              durationMinutes: 1,
              outcome: 'partial'
            })
            if (!older.ok) throw Error('seed old record')
          }
      }
    })
    const nav = (name: string) =>
      page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
    await nav('目标')
    const goals = page.locator('.goal-workspace .goal-list-item')
    const goalTitle = page.locator('.goal-detail h2').first()
    await expect(goals.first()).toHaveClass(/selected/)
    const rememberedGoal = await goals.nth(2).locator('span').innerText()
    await goals.nth(2).click()
    await expect(goalTitle).toHaveText(rememberedGoal)
    await nav('今天')
    const todayButtons = page.locator('.candidate-row .goal-list-item')
    await expect(todayButtons.first()).toHaveAttribute('aria-pressed', 'true')
    const actionTitle = await todayButtons.nth(2).locator('span').innerText()
    await todayButtons.nth(2).click()
    await expect(page.locator('.today-detail-pane h2').first()).toHaveText(actionTitle)
    await nav('数据')
    const rows = page.locator('.data-history-row')
    await expect(rows.first()).toHaveAttribute('aria-pressed', 'true')
    await rows.nth(2).click()
    const selected = page.getByLabel('所选记录', { exact: true })
    await expect(selected).toContainText('选择记录6')
    await app.close()
    app = await launch()
    page = await app.firstWindow()
    await nav('目标')
    await expect(page.locator('.goal-detail h2').first()).toHaveText(rememberedGoal)
    await nav('今天')
    await expect(page.locator('.today-detail-pane h2').first()).toHaveText(actionTitle)
    await nav('数据')
    await expect(page.getByLabel('所选记录', { exact: true })).toContainText('选择记录6')
    await page.getByLabel('历史记录分页').getByRole('button', { name: '下一页' }).click()
    await expect(page.locator('.data-history-row').first()).toHaveAttribute('aria-pressed', 'true')
    await page.getByLabel('历史记录分页').getByRole('button', { name: '上一页' }).click()
    await page.locator('.data-history-row').nth(2).click()
    await nav('目标')
    const currentGoals = page.locator('.goal-workspace .goal-list-item')
    // Home shows the three most recently active goals; goal 6 is on the first list page.
    const firstPageName = await currentGoals.last().locator('span').innerText()
    await page
      .getByLabel('目标列表分页', { exact: true })
      .getByRole('button', { name: '下一页' })
      .click()
    await expect(currentGoals.first()).toHaveClass(/selected/)
    await nav('首页')
    await page
      .getByRole('article', { name: `${firstPageName} 概览`, exact: true })
      .getByRole('button', { name: '查看目标 ↗' })
      .evaluate((button: HTMLButtonElement) => button.click())
    await expect(page.locator('.goal-detail h2').first()).toHaveText(firstPageName)
    await expect(page.getByLabel('目标列表分页', { exact: true })).toContainText('2 / 2 · 8 项')
    await page.getByLabel('搜索目标', { exact: true }).fill('选择目标1')
    await expect(page.locator('.goal-detail h2').first()).toHaveText('选择目标1')
    await page.getByLabel('搜索目标', { exact: true }).fill('不存在')
    await expect(page.getByRole('heading', { name: '当前没有可查看的目标' })).toBeVisible()
    await page.getByRole('button', { name: '清除筛选', exact: true }).click()
    await expect(page.locator('.goal-detail h2').first()).toHaveText('选择目标1')
    await page.getByText('编辑与管理目标', { exact: true }).click()
    await page.locator('.current-action-control select').selectOption({ label: '新建下一步…' })
    await page.getByLabel('下一步名称', { exact: true }).fill('不能丢失的下一步草稿')
    await page.getByLabel('搜索目标', { exact: true }).fill('选择目标2')
    await expect(page.getByLabel('下一步名称', { exact: true })).toHaveValue('不能丢失的下一步草稿')
    await expect(page.locator('.goal-detail h2').first()).toHaveText('选择目标1')
    await page.getByLabel('下一步名称', { exact: true }).fill('')
    await expect(page.locator('.goal-detail h2').first()).toHaveText('选择目标1')
    await page.locator('.current-action-control select').selectOption({ label: '选择行动1' })
    await expect(page.locator('.goal-detail h2').first()).toHaveText('选择目标2')
    await nav('数据')
    const record = page.getByLabel('所选记录', { exact: true }).locator('.data-record-card')
    await record.getByRole('button', { name: '编辑记录', exact: true }).click()
    await page.getByLabel('行动分钟', { exact: true }).fill('42')
    await page.locator('.data-filter-panel > summary').click()
    await page.locator('.data-filter-panel input[type="date"]').fill('2026-08-18')
    await expect(page.getByLabel('行动分钟', { exact: true })).toHaveValue('42')
    await record.getByRole('button', { name: '取消编辑', exact: true }).click()
    await expect(page.getByLabel('所选记录', { exact: true })).toContainText('选择记录8')
    const facts = await page.evaluate(async () => {
      const today = await window.myTracer.today.get({})
      const data = await window.myTracer.dataControl.list()
      if (!today.ok || !data.ok) throw Error('read')
      return {
        focuses: today.value.focuses.length,
        intentions: today.value.intentions.length,
        records: data.value.actionRecords.length
      }
    })
    expect(facts).toEqual({ focuses: 0, intentions: 0, records: 10 })
  } finally {
    await app?.close()
    await removeTemporaryTestRoot(root)
  }
})

test('deleted remembered items fall back safely, and empty pages offer an action without writes', async () => {
  test.slow()
  const root = await createTemporaryTestRoot()
  let app: ElectronApplication | undefined
  try {
    app = await electron.launch({
      cwd: root.root,
      args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
      env: minimalElectronEnvironment(root)
    })
    const page = await app.firstWindow()
    const nav = (name: string) =>
      page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
    await nav('目标')
    await expect(page.getByRole('heading', { name: '当前没有可查看的目标' })).toBeVisible()
    await nav('今天')
    await expect(page.getByRole('heading', { name: '当前没有可查看的行动或例行' })).toBeVisible()
    await nav('数据')
    await expect(page.getByRole('heading', { name: '当前没有匹配的记录' })).toBeVisible()
    const ids = await page.evaluate(async () => {
      const ids: string[] = []
      for (const name of ['保留', '删除']) {
        const goal = await window.myTracer.goals.create({
          name: `${name}目标`,
          initialNextAction: { title: `${name}行动` }
        })
        if (!goal.ok || !goal.value.currentNextActionId) throw Error('seed')
        ids.push(goal.value.id)
        const record = await window.myTracer.dataControl.backfillActionRecord({
          actionId: goal.value.currentNextActionId,
          occurredOn: '2026-08-18',
          durationMinutes: 5,
          outcome: 'partial',
          note: `${name}记录`
        })
        if (!record.ok) throw Error('seed record')
      }
      return ids
    })
    await nav('目标')
    await page.locator('.goal-list-item').filter({ hasText: '删除目标' }).click()
    await nav('今天')
    await page.locator('.candidate-row .goal-list-item').filter({ hasText: '删除行动' }).click()
    await nav('数据')
    await page.locator('.data-history-row').filter({ hasText: '删除行动' }).click()
    await nav('首页')
    await page.evaluate(async (id) => {
      const preview = await window.myTracer.dataControl.previewDelete({
        target: { type: 'goal', id }
      })
      if (!preview.ok) throw Error('preview')
      const result = await window.myTracer.dataControl.confirmDelete({
        previewId: preview.value.previewId,
        target: preview.value.target,
        confirmation: 'permanently-delete'
      })
      if (!result.ok) throw Error('delete')
    }, ids[1]!)
    await nav('目标')
    await expect(page.locator('.goal-detail h2').first()).toHaveText('保留目标')
    await nav('今天')
    await expect(page.locator('.today-detail-pane h2').first()).toHaveText('保留行动')
    await nav('数据')
    await expect(page.getByLabel('所选记录', { exact: true })).toContainText('保留记录')
    await expect(
      page
        .getByLabel('所选记录', { exact: true })
        .getByRole('button', { name: '编辑记录', exact: true })
    ).toBeVisible()
  } finally {
    await app?.close()
    await removeTemporaryTestRoot(root)
  }
})

test('a late automatic goal detail cannot overwrite a newer explicit selection', async () => {
  const root = await createTemporaryTestRoot()
  let app: ElectronApplication | undefined
  try {
    app = await electron.launch({
      cwd: root.root,
      args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
      env: minimalElectronEnvironment(root)
    })
    const page = await app.firstWindow()
    const snapshots = await page.evaluate(async () => {
      for (const name of ['慢目标', '新选择目标']) {
        const goal = await window.myTracer.goals.create({ name })
        if (!goal.ok) throw Error('seed')
      }
      const goals = await window.myTracer.goals.list({ status: null })
      if (!goals.ok) throw Error('list')
      return Promise.all(
        goals.value.map((goal) => window.myTracer.goals.getDetail({ goalId: goal.id }))
      )
    })
    const first = snapshots[0]
    const second = snapshots[1]
    if (!first?.ok || !second?.ok) throw Error('details')
    await app.evaluate(
      ({ ipcMain }, { first, second }) => {
        ipcMain.removeHandler('goals:get-detail')
        ipcMain.handle('goals:get-detail', async (_event, input: { goalId: string }) => {
          if (input.goalId === first.value.id) {
            Reflect.set(globalThis, '__selectionStarted', true)
            await new Promise<void>((resolve) =>
              Reflect.set(globalThis, '__releaseSelection', resolve)
            )
            return first
          }
          return second
        })
      },
      { first, second }
    )
    await page.getByRole('navigation').getByRole('button', { name: '目标', exact: true }).click()
    await expect
      .poll(() => app!.evaluate(() => Reflect.get(globalThis, '__selectionStarted')))
      .toBe(true)
    await page.locator('.goal-list-item').filter({ hasText: second.value.name }).click()
    await expect(page.locator('.goal-detail h2').first()).toHaveText(second.value.name)
    await app.evaluate(() => Reflect.get(globalThis, '__releaseSelection')())
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        )
    )
    await expect(page.locator('.goal-detail h2').first()).toHaveText(second.value.name)
  } finally {
    await app?.close()
    await removeTemporaryTestRoot(root)
  }
})

test('cover drafts including empty marks block selection until save or cancel', async () => {
  const root = await createTemporaryTestRoot()
  let app: ElectronApplication | undefined
  try {
    app = await electron.launch({
      cwd: root.root,
      args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
      env: minimalElectronEnvironment(root)
    })
    const page = await app.firstWindow()
    await page.evaluate(async () => {
      for (const name of ['封面目标甲', '封面目标乙']) {
        const result = await window.myTracer.goals.create({ name })
        if (!result.ok) throw Error('seed cover goals')
      }
    })
    await page.getByRole('navigation').getByRole('button', { name: '目标', exact: true }).click()
    const title = page.locator('.goal-detail h2').first()
    const search = page.getByLabel('搜索目标', { exact: true })
    await search.fill('封面目标甲')
    await expect(title).toHaveText('封面目标甲')
    await openManagement(page.locator('.goal-detail'), '目标')
    await page.locator('.goal-detail').getByText('外观', { exact: true }).click()
    const mark = page.getByLabel('首页标记（可选）')
    await mark.fill('甲')
    await page.getByRole('button', { name: '保存外观', exact: true }).click()
    for (const finish of ['取消外观修改', '保存外观']) {
      await mark.fill('')
      await search.fill('封面目标乙')
      await expect(page.locator('.goal-workspace .goal-list-item')).toHaveCount(1)
      await expect(title).toHaveText('封面目标甲')
      await expect(mark).toHaveValue('')
      await page.getByRole('button', { name: finish, exact: true }).click()
      await expect(title).toHaveText('封面目标乙')
      await search.fill('封面目标甲')
      await expect(title).toHaveText('封面目标甲')
      await openManagement(page.locator('.goal-detail'), '目标')
      await page.locator('.goal-detail').getByText('外观', { exact: true }).click()
      await expect(mark).toHaveValue(finish === '取消外观修改' ? '甲' : '')
    }
  } finally {
    await app?.close()
    await removeTemporaryTestRoot(root)
  }
})
