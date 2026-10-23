import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { _electron as electron } from 'playwright'
import type { RecoveryContextDto } from '../../src/contracts/recovery'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

async function withApplication(
  run: (app: ElectronApplication, page: Page) => Promise<void>
): Promise<void> {
  const root = await createTemporaryTestRoot()
  let app: ElectronApplication | undefined
  try {
    app = await electron.launch({
      cwd: root.root,
      args: [
        ...(process.platform === 'linux' ? ['--headless', '--ozone-platform=headless'] : []),
        join(process.cwd(), 'out/main/index.js'),
        `--user-data-dir=${root.electronUserData}`
      ],
      env: minimalElectronEnvironment(root)
    })
    await app.evaluate(() => {
      const RealDate = Date
      const instant = new RealDate(2026, 9, 22, 12).getTime()
      let tick = 0
      Reflect.set(
        globalThis,
        'Date',
        new Proxy(RealDate, {
          construct(target, args) {
            return Reflect.construct(target, args.length ? args : [instant + tick++])
          }
        })
      )
    })
    await run(app, await app.firstWindow())
  } finally {
    await app?.close()
    await removeTemporaryTestRoot(root)
  }
}

async function navigate(page: Page, name: string): Promise<void> {
  await page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
}

async function fixtures(
  page: Page
): Promise<{ first: RecoveryContextDto; second: RecoveryContextDto }> {
  return page.evaluate(async () => {
    const first = await window.myTracer.goals.create({
      name: '继续理解状态',
      initialNextAction: { title: '读完第一节' }
    })
    const second = await window.myTracer.goals.create({
      name: '另一个方向',
      initialNextAction: { title: '另一目标的新一步' }
    })
    if (!first.ok || !first.value.currentNextActionId || !second.ok)
      throw new Error('Goal fixture failed')
    for (let day = 16; day <= 18; day++) {
      const saved = await window.myTracer.dataControl.backfillActionRecord({
        actionId: first.value.currentNextActionId,
        occurredOn: `2026-10-${day}`,
        durationMinutes: 8,
        outcome: 'partial',
        understanding: `理解 ${day}：状态需要单一来源`,
        confusion: `困惑 ${day}：如何处理晚到的结果？`,
        note: '上次读到这里。'
      })
      if (!saved.ok) throw new Error('Record fixture failed')
    }
    const next = await window.myTracer.goals.createAndSetCurrentNextAction({
      goalId: first.value.id,
      title: '写一个并发更新的小例子'
    })
    if (!next.ok) throw new Error('Next action fixture failed')
    const a = await window.myTracer.recovery.getContext({ goalId: first.value.id })
    const b = await window.myTracer.recovery.getContext({ goalId: second.value.id })
    if (!a.ok || !b.ok) throw new Error('Context fixture failed')
    return { first: a.value, second: b.value }
  })
}

async function openFirstFromHome(page: Page): Promise<void> {
  await page.reload()
  await page
    .getByLabel('继续理解状态 概览', { exact: true })
    .getByRole('button', { name: '去今天继续 →', exact: true })
    .click()
}

const summary = (page: Page) => page.locator('.today-goal-context > summary')
const contextPanel = (page: Page) => page.getByLabel('目标历史上下文', { exact: true })

test('returning to a new next action can recall goal context without recording or losing a draft', async () => {
  await withApplication(async (_app, page) => {
    const { first } = await fixtures(page)
    expect(first.daysSinceLastRealAction).toBe(4)
    const before = await page.evaluate(() => window.myTracer.dataControl.list())
    await openFirstFromHome(page)
    const actionPanel = page.getByLabel('写一个并发更新的小例子 行动记录', { exact: true })
    await expect(actionPanel).toContainText('还没有记录；没有记录不代表没有行动。')
    await expect(contextPanel(page)).toHaveCount(0)
    await summary(page).focus()
    await page.keyboard.press('Enter')
    await expect(contextPanel(page)).toContainText(
      '来自目标「继续理解状态」的已有记录，与本次行动记录分开。'
    )
    await expect(contextPanel(page)).toContainText('2026-10-18')
    await expect(contextPanel(page)).toContainText('读完第一节')
    await expect(contextPanel(page).getByLabel('目标已有理解').locator('li')).toHaveCount(2)
    await expect(contextPanel(page)).toContainText('理解 18')
    await expect(contextPanel(page)).not.toContainText('理解 16')
    await expect(contextPanel(page)).toContainText('另有 1 条理解')
    await expect(contextPanel(page)).toContainText('困惑 18')
    // Opening a historical record routes explicitly, even if Data remembered another selection.
    await contextPanel(page)
      .getByRole('button', { name: /查看上次完整记录/ })
      .focus()
    await page.keyboard.press('Enter')
    await expect(page.getByLabel('所选记录')).toContainText('2026-10-18')
    await expect(page.getByLabel('所选记录')).toContainText('读完第一节')
    await navigate(page, '今天')
    await expect(actionPanel).toBeVisible()
    await actionPanel.getByRole('button', { name: '开始记录', exact: true }).click()
    await actionPanel.getByLabel('投入时长（分钟，必填）').fill('7')
    await summary(page).click()
    await expect(contextPanel(page)).toContainText('困惑 18')
    await summary(page).focus()
    await page.keyboard.press('Space')
    await expect(contextPanel(page)).toHaveCount(0)
    await expect(actionPanel.getByLabel('投入时长（分钟，必填）')).toHaveValue('7')
    await summary(page).click()
    await contextPanel(page)
      .getByRole('button', { name: '查看目标的恢复与整理 →', exact: true })
      .focus()
    await page.keyboard.press('Enter')
    await expect(page.getByLabel('恢复与整理页面')).toContainText('继续理解状态')
    await navigate(page, '今天')
    await expect(actionPanel.getByLabel('投入时长（分钟，必填）')).toHaveValue('7')
    expect(await page.evaluate(() => window.myTracer.dataControl.list())).toEqual(before)
    // Saving this action refreshes the expanded historical context using the real backend.
    await summary(page).click()
    await actionPanel.getByRole('button', { name: '保存记录', exact: true }).click()
    await expect(
      contextPanel(page).getByRole('button', { name: /查看上次完整记录/ })
    ).toContainText('写一个并发更新的小例子')
    await expect(contextPanel(page)).toContainText('2026-10-22')
  })
})

test('a delayed previous-goal response cannot appear under a different action or goal', async () => {
  await withApplication(async (app, page) => {
    const data = await fixtures(page)
    await app.evaluate(({ ipcMain }, data) => {
      ipcMain.removeHandler('recovery:get-context')
      ipcMain.handle('recovery:get-context', (_event, input: { goalId: string }) => {
        if (input.goalId === data.first.goal.id) {
          return new Promise((resolve) =>
            Reflect.set(globalThis, '__releaseGoalContext', () =>
              resolve({ ok: true, value: data.first })
            )
          )
        }
        return { ok: true, value: data.second }
      })
    }, data)
    await openFirstFromHome(page)
    await summary(page).click()
    await expect(contextPanel(page).getByRole('status')).toContainText('正在读取目标历史')
    await page.getByRole('button', { name: /另一目标的新一步.*待行动/ }).click()
    await expect(contextPanel(page)).toHaveCount(0)
    await summary(page).click()
    await expect(contextPanel(page)).toContainText('这个目标还没有实际行动记录')
    await app.evaluate(() => {
      const release = Reflect.get(globalThis, '__releaseGoalContext') as () => void
      release()
    })
    await page.evaluate(async (goalId) => {
      await window.myTracer.recovery.getContext({ goalId })
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    }, data.second.goal.id)
    await expect(contextPanel(page)).toContainText('来自目标「另一个方向」')
    await expect(contextPanel(page)).not.toContainText('读完第一节')
    await expect(contextPanel(page)).not.toContainText('状态需要单一来源')
  })
})

test('context is requested only on expansion and failed or mismatched reads remain optional and retryable', async () => {
  await withApplication(async (app, page) => {
    const data = await fixtures(page)
    await app.evaluate(({ ipcMain }) => {
      Reflect.set(globalThis, '__contextReads', 0)
      ipcMain.removeHandler('recovery:get-context')
      ipcMain.handle('recovery:get-context', () => {
        Reflect.set(
          globalThis,
          '__contextReads',
          Number(Reflect.get(globalThis, '__contextReads')) + 1
        )
        return {
          ok: false,
          error: { code: 'persistence-failed', message: 'synthetic fixture failure' }
        }
      })
    })
    await openFirstFromHome(page)
    expect(await app.evaluate(() => Reflect.get(globalThis, '__contextReads'))).toBe(0)
    await summary(page).click()
    await expect(contextPanel(page).getByRole('alert')).toContainText('可以直接继续当前行动')
    expect(await app.evaluate(() => Reflect.get(globalThis, '__contextReads'))).toBe(1)
    const panel = page.getByLabel('写一个并发更新的小例子 行动记录', { exact: true })
    await panel.getByRole('button', { name: '开始记录', exact: true }).click()
    await panel.getByLabel('投入时长（分钟，必填）').fill('6')
    await app.evaluate(({ ipcMain }, wrongGoal) => {
      ipcMain.removeHandler('recovery:get-context')
      ipcMain.handle('recovery:get-context', () => ({ ok: true, value: wrongGoal }))
    }, data.second)
    const retry = contextPanel(page).getByRole('button', {
      name: '重新读取目标上下文',
      exact: true
    })
    await retry.click()
    await expect(contextPanel(page).getByRole('alert')).toBeVisible()
    await expect(contextPanel(page)).not.toContainText('来自目标「另一个方向」')
    await app.evaluate(({ ipcMain }, correctGoal) => {
      ipcMain.removeHandler('recovery:get-context')
      ipcMain.handle('recovery:get-context', () => ({ ok: true, value: correctGoal }))
    }, data.first)
    await retry.focus()
    await page.keyboard.press('Enter')
    await expect(contextPanel(page)).toContainText('理解 18')
    await expect(retry).toBeFocused()
    await expect(panel.getByLabel('投入时长（分钟，必填）')).toHaveValue('6')
    const independent = await page.evaluate(() =>
      window.myTracer.actions.create({ title: '独立行动不显示目标历史' })
    )
    expect(independent.ok).toBe(true)
    await navigate(page, '首页')
    await navigate(page, '今天')
    await page.getByRole('button', { name: /独立行动不显示目标历史.*待行动/ }).click()
    await expect(summary(page)).toHaveCount(0)
  })
})

test('the latest goal-linked routine record opens its exact data record', async () => {
  await withApplication(async (_app, page) => {
    const data = await fixtures(page)
    await page.evaluate(async (goalId) => {
      const routine = await window.myTracer.routines.create({
        goalId,
        name: '练习状态模型',
        minimumAction: '写一个例子',
        weekdays: [1, 2, 3, 4, 5]
      })
      if (!routine.ok) throw new Error('Routine fixture failed')
      const record = await window.myTracer.dataControl.backfillRoutineRecord({
        routineId: routine.value.id,
        occurredOn: '2026-10-19',
        outcome: 'acted',
        plannedForDate: false,
        durationMinutes: 5
      })
      if (!record.ok) throw new Error('Routine record fixture failed')
    }, data.first.goal.id)
    await openFirstFromHome(page)
    await summary(page).click()
    const link = contextPanel(page).getByRole('button', { name: /查看上次完整记录/ })
    await expect(link).toContainText('练习状态模型')
    await link.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByLabel('所选记录')).toContainText('练习状态模型')
    await expect(page.getByLabel('所选记录')).toContainText('2026-10-19')
  })
})
