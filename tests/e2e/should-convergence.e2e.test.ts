import { join } from 'node:path'
import { expect, test, type ElectronApplication } from '@playwright/test'
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
    const OriginalDate = Date
    const instant = new OriginalDate(2026, 8, 19, 12).toISOString()
    Reflect.set(
      globalThis,
      'Date',
      new Proxy(OriginalDate, {
        construct(target, args) {
          return Reflect.construct(target, args.length ? args : [instant])
        }
      })
    )
  })
  await (await application.firstWindow()).reload()
  return application
}

test('shows factual dates, unlimited soft guidance and explicitly scoped weekly comparisons across reopen', async () => {
  test.slow()
  const root = await createTemporaryTestRoot()
  let application: ElectronApplication | undefined
  try {
    application = await launch(root)
    let page = await application.firstWindow()
    const seeded = await page.evaluate(async () => {
      const api = window.myTracer
      const goals: string[] = []
      const actions: string[] = []
      for (let index = 1; index <= 6; index += 1) {
        const goal = await api.goals.create({
          name: `SHOULD 目标 ${index}`,
          initialNextAction: { title: `SHOULD 行动 ${index}` }
        })
        if (!goal.ok || !goal.value.currentNextAction) throw new Error('Could not create fixture')
        goals.push(goal.value.id)
        actions.push(goal.value.currentNextAction.id)
      }
      for (const [occurredOn, durationMinutes, outcome] of [
        ['2026-09-08', 20, 'completed'],
        ['2026-09-14', 0, 'stopped'],
        ['2026-09-18', 8, 'partial']
      ] as const) {
        const record = await api.dataControl.backfillActionRecord({
          actionId: actions[0],
          occurredOn,
          durationMinutes,
          outcome,
          note: '可选备注'
        })
        if (!record.ok) throw new Error(JSON.stringify(record.error))
      }
      return { goals, actions }
    })
    const before = await page.evaluate(async () => ({
      data: await window.myTracer.dataControl.list(),
      today: await window.myTracer.today.get({})
    }))
    await page.getByRole('navigation').getByRole('button', { name: '目标', exact: true }).click()
    await expect(page.getByText(/可以先保留少量活跃目标/)).toBeVisible()
    await expect(page.locator('.goal-list-item')).toHaveCount(6)
    await expect(
      page.locator('.goal-list-item').filter({ hasText: 'SHOULD 目标 1' })
    ).toContainText('距上次真实行动 1 天')
    await expect(
      page.locator('.goal-list-item').filter({ hasText: 'SHOULD 目标 2' })
    ).toContainText('尚无行动记录')
    await page.getByRole('navigation').getByRole('button', { name: '今天', exact: true }).click()
    await expect(page.getByText(/先选少量重点就好/)).toBeVisible()
    await expect(page.locator('.candidate-row').filter({ hasText: 'SHOULD 行动 1' })).toContainText(
      '距上次真实行动 1 天'
    )
    expect(
      await page.evaluate(async () => ({
        data: await window.myTracer.dataControl.list(),
        today: await window.myTracer.today.get({})
      }))
    ).toEqual(before)
    for (let index = 1; index <= 6; index += 1) {
      const candidates = page.locator('details.action-candidates')
      if (!(await candidates.evaluate((element) => (element as HTMLDetailsElement).open)))
        await candidates.locator(':scope > summary').click()
      await candidates
        .locator('.candidate-row')
        .filter({ hasText: `SHOULD 行动 ${index}` })
        .getByRole('button', { name: '选为今日重点', exact: true })
        .click()
    }
    await expect(page.getByLabel('今日重点').locator('.focus-row')).toHaveCount(6)
    await page.getByRole('navigation').getByRole('button', { name: '进展', exact: true }).click()
    const weekly = page.getByLabel('本周与上周事实比较')
    await expect(weekly).toContainText('本周尚未结束')
    await expect(weekly.getByRole('row').filter({ hasText: '记录到的投入分钟' })).toHaveText(
      /记录到的投入分钟8\s*20\s*-12/
    )
    await expect(weekly.getByRole('row').filter({ hasText: '记录到的行动次数' })).toHaveText(
      /记录到的行动次数2\s*1\s*\+1/
    )
    await page.getByLabel('目标（可选）').selectOption(seeded.goals[1])
    await page.getByLabel('开始日期（包含）').fill('2099-01-01')
    await expect(weekly).toContainText('全部目标与无目标行动')
    await page.getByRole('button', { name: '查看记录', exact: true }).click()
    await expect(weekly).toContainText('SHOULD 目标 2')
    await expect(weekly).toContainText('这两个区间尚无记录')
    await page.getByLabel('目标（可选）').selectOption(seeded.goals[0])
    await page.getByRole('button', { name: '查看记录', exact: true }).click()
    await expect(page.getByRole('heading', { name: '这个范围内还没有记录' })).toBeVisible()
    await expect(weekly).toContainText('不使用历史日期范围')
    await expect(weekly.getByRole('row').filter({ hasText: '记录到的投入分钟' })).toContainText(
      '-12'
    )
    const comparison = await page.evaluate(
      (goalId) => window.myTracer.progress.compareWeeks({ goalId }),
      seeded.goals[0]
    )
    await application.close()
    application = await launch(root)
    page = await application.firstWindow()
    expect(
      await page.evaluate(
        (goalId) => window.myTracer.progress.compareWeeks({ goalId }),
        seeded.goals[0]
      )
    ).toEqual(comparison)
    await page.getByRole('navigation').getByRole('button', { name: '进展', exact: true }).click()
    await expect(page.getByLabel('本周与上周事实比较')).toContainText('-12')
    await page.setViewportSize({ width: 820, height: 700 })
    await expect(page.getByLabel('本周与上周事实比较').getByRole('table')).toBeVisible()
  } finally {
    await application?.close()
    await removeTemporaryTestRoot(root)
  }
})

test('does not relabel late weekly results and displays future dates without a negative-day label', async () => {
  const root = await createTemporaryTestRoot()
  let application: ElectronApplication | undefined
  try {
    application = await launch(root)
    const page = await application.firstWindow()
    const goals = await page.evaluate(async () => {
      const result = []
      for (const name of ['较慢目标', '当前目标']) {
        const goal = await window.myTracer.goals.create({
          name,
          initialNextAction: { title: `${name}行动` }
        })
        if (!goal.ok) throw new Error('Fixture failed')
        result.push(goal.value.id)
      }
      return result
    })
    await application.evaluate(({ ipcMain }, ids) => {
      ipcMain.removeHandler('progress:goal-activity')
      ipcMain.handle('progress:goal-activity', () => ({
        ok: true,
        value: {
          asOfLocalDate: '2026-09-19',
          goals: ids.map((goalId) => ({
            goalId,
            lastRealActionOn: '2026-09-20',
            daysSinceLastRealAction: -1
          }))
        }
      }))
      ipcMain.removeHandler('progress:compare-weeks')
      ipcMain.handle('progress:compare-weeks', (_event, input: { goalId: string | null }) => {
        const count = input.goalId === ids[0] ? 99 : 2
        const value = {
          goalId: input.goalId,
          asOfLocalDate: '2026-09-19',
          currentWeekEndedOn: '2026-09-20',
          current: {
            from: '2026-09-14',
            through: '2026-09-19',
            totalDurationMinutes: count,
            realActionCount: count,
            hasRecordedFacts: true
          },
          previous: {
            from: '2026-09-07',
            through: '2026-09-13',
            totalDurationMinutes: 0,
            realActionCount: 0,
            hasRecordedFacts: false
          },
          difference: { totalDurationMinutes: count, realActionCount: count }
        }
        if (input.goalId === ids[0])
          return new Promise((resolve) => {
            Reflect.set(globalThis, 't071Release', () => resolve({ ok: true, value }))
          })
        return { ok: true, value }
      })
    }, goals)
    await page.getByRole('navigation').getByRole('button', { name: '目标', exact: true }).click()
    await expect(page.locator('.goal-list-item').first()).toContainText('2026-09-20（晚于今天）')
    await expect(page.locator('.goal-list')).not.toContainText('-1 天')
    await page.getByRole('navigation').getByRole('button', { name: '今天', exact: true }).click()
    await expect(page.locator('.candidate-row').first()).toContainText('2026-09-20（晚于今天）')
    await page.getByRole('navigation').getByRole('button', { name: '进展', exact: true }).click()
    await page.getByLabel('目标（可选）').selectOption(goals[0])
    await page.getByRole('button', { name: '查看记录', exact: true }).click()
    await expect
      .poll(() => application!.evaluate(() => typeof Reflect.get(globalThis, 't071Release')))
      .toBe('function')
    await page.getByLabel('目标（可选）').selectOption(goals[1])
    await page.getByRole('button', { name: '查看记录', exact: true }).click()
    const comparison = page.getByLabel('本周与上周事实比较')
    await expect(comparison).toContainText('当前目标')
    await expect(comparison.getByRole('row').filter({ hasText: '记录到的行动次数' })).toContainText(
      '+2'
    )
    await application.evaluate(() => {
      const release = Reflect.get(globalThis, 't071Release') as () => void
      release()
    })
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        )
    )
    await expect(comparison).not.toContainText('99')
    await expect(comparison).toContainText('当前目标')
  } finally {
    await application?.close()
    await removeTemporaryTestRoot(root)
  }
})

test('keeps query failures recoverable without blocking core controls', async () => {
  const root = await createTemporaryTestRoot()
  let application: ElectronApplication | undefined
  try {
    application = await launch(root)
    await application.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('progress:goal-activity')
      ipcMain.handle('progress:goal-activity', () => ({
        ok: false,
        error: { code: 'persistence-failed', message: 'unavailable' }
      }))
      ipcMain.removeHandler('progress:compare-weeks')
      ipcMain.handle('progress:compare-weeks', () => ({
        ok: false,
        error: { code: 'persistence-failed', message: 'unavailable' }
      }))
    })
    const page = await application.firstWindow()
    await page.getByRole('navigation').getByRole('button', { name: '目标', exact: true }).click()
    await expect(page.getByRole('button', { name: '重试行动日期' })).toBeVisible()
    await page.getByRole('button', { name: '新建目标', exact: true }).click()
    await page.getByLabel('目标名称').fill('查询失败仍可创建')
    await page.getByRole('button', { name: '创建目标', exact: true }).click()
    await expect(page.locator('.goal-list-item')).toContainText('查询失败仍可创建')
    await application.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('progress:goal-activity')
      ipcMain.handle('progress:goal-activity', () => ({
        ok: true,
        value: { asOfLocalDate: '2026-09-19', goals: [] }
      }))
    })
    await page.getByRole('button', { name: '重试行动日期' }).click()
    await expect(page.getByRole('button', { name: '重试行动日期' })).toHaveCount(0)
    await page.getByRole('navigation').getByRole('button', { name: '进展', exact: true }).click()
    await expect(page.getByRole('button', { name: '重试周比较' })).toBeVisible()
    await expect(page.getByRole('button', { name: '查看记录', exact: true })).toBeEnabled()
    await application.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('progress:compare-weeks')
      ipcMain.handle('progress:compare-weeks', () => ({
        ok: true,
        value: {
          goalId: null,
          asOfLocalDate: '2026-09-19',
          currentWeekEndedOn: '2026-09-20',
          current: {
            from: '2026-09-14',
            through: '2026-09-19',
            totalDurationMinutes: 0,
            realActionCount: 0,
            hasRecordedFacts: false
          },
          previous: {
            from: '2026-09-07',
            through: '2026-09-13',
            totalDurationMinutes: 0,
            realActionCount: 0,
            hasRecordedFacts: false
          },
          difference: { totalDurationMinutes: 0, realActionCount: 0 }
        }
      }))
    })
    await page.getByRole('button', { name: '重试周比较' }).click()
    await expect(page.getByLabel('本周与上周事实比较')).toContainText('这两个区间尚无记录')
  } finally {
    await application?.close()
    await removeTemporaryTestRoot(root)
  }
})
