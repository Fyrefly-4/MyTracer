import Database from 'better-sqlite3'
import { join } from 'node:path'
import { expect, test, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import {
  createTemporaryTestRoot,
  removeTemporaryTestRoot,
  type TemporaryTestRoot
} from '../support/temporary-test-root'

async function launchApplication(root: TemporaryTestRoot): Promise<ElectronApplication> {
  return electron.launch({
    cwd: root.root,
    args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
    env: minimalElectronEnvironment(root)
  })
}

async function setMainProcessDate(
  application: ElectronApplication,
  instant: string
): Promise<void> {
  await application.firstWindow()
  const appliedInstant = await application.evaluate((_electron, controlledInstant) => {
    let realDate = Reflect.get(globalThis, '__myTracerRealDate') as DateConstructor | undefined
    if (!realDate) {
      realDate = Date
      Reflect.set(globalThis, '__myTracerRealDate', realDate)
    }
    Reflect.set(
      globalThis,
      'Date',
      new Proxy(realDate, {
        construct(target, argumentsList) {
          return Reflect.construct(
            target,
            argumentsList.length ? argumentsList : [controlledInstant]
          )
        }
      })
    )
    return new Date().toISOString()
  }, instant)
  expect(appliedInstant).toBe(instant)
}

test('shows the current-week ReviewSummary from Progress facts without turning unknown into not_done', async () => {
  test.slow()
  const root = await createTemporaryTestRoot()
  const databasePath = join(root.electronUserData, 'data', 'mytracer.sqlite3')
  let application: ElectronApplication | undefined

  try {
    application = await launchApplication(root)
    await setMainProcessDate(application, new Date(2026, 7, 12, 12).toISOString())
    let page = await application.firstWindow()

    await page.evaluate(async () => {
      const goal = await window.myTracer.goals.create({
        name: '周期事实目标',
        description: null,
        initialNextAction: { title: '读取一个例子' }
      })
      if (!goal.ok || !goal.value.currentNextAction) throw new Error('Goal setup failed.')
      const actionRecord = await window.myTracer.dataControl.backfillActionRecord({
        actionId: goal.value.currentNextAction.id,
        occurredOn: '2026-08-10',
        durationMinutes: 11,
        outcome: 'partial',
        understanding: '状态更新会进入队列',
        confusion: '批处理何时结束'
      })
      const routine = await window.myTracer.routines.create({
        goalId: goal.value.id,
        name: '工作日练习',
        minimumAction: '打开编辑器',
        weekdays: [1, 2, 3, 4, 5]
      })
      if (!actionRecord.ok || !routine.ok) throw new Error('Fact setup failed.')
      const outcomes = [
        { occurredOn: '2026-08-10', outcome: 'target_met' as const, durationMinutes: 5 },
        { occurredOn: '2026-08-11', outcome: 'acted' as const, durationMinutes: 2 },
        {
          occurredOn: '2026-08-12',
          outcome: 'intentional_rest' as const,
          durationMinutes: null
        },
        { occurredOn: '2026-08-13', outcome: 'not_done' as const, durationMinutes: null }
      ]
      for (const fact of outcomes) {
        const result = await window.myTracer.dataControl.backfillRoutineRecord({
          routineId: routine.value.id,
          occurredOn: fact.occurredOn,
          outcome: fact.outcome,
          plannedForDate: true,
          durationMinutes: fact.durationMinutes
        })
        if (!result.ok) throw new Error(result.error.message)
      }
    })

    const filter = { goalId: null, from: '2026-08-10', through: '2026-08-16' }
    const progress = await page.evaluate((input) => window.myTracer.progress.get(input), filter)
    const before = await page.evaluate(() => window.myTracer.dataControl.list())
    if (!progress.ok || !before.ok) throw new Error('Expected factual setup queries to pass.')

    await page.getByRole('button', { name: '复盘', exact: true }).click()
    await expect(page.getByRole('heading', { name: '2026-08-10 至 2026-08-16' })).toBeVisible()
    await expect(page.getByLabel('周期汇总')).toContainText('投入时间18 分钟')
    await expect(page.getByLabel('周期汇总')).toContainText('真实行动次数3')
    await expect(page.getByLabel('周期汇总')).toContainText('已确认的理解1')
    await expect(page.getByLabel('周期汇总')).toContainText('尚未解决的困惑1')
    await expect(page.getByLabel('达到目标 1 条')).toContainText('2026-08-10')
    await expect(page.getByLabel('有所行动 1 条')).toContainText('2026-08-11')
    await expect(page.getByLabel('主动休息 1 条')).toContainText('2026-08-12')
    await expect(page.getByLabel('未进行 1 条')).toContainText('2026-08-13')
    await expect(page.getByText('状态更新会进入队列')).toBeVisible()
    await expect(page.getByText('批处理何时结束')).toBeVisible()
    await expect(page.getByLabel('周期复盘')).not.toContainText(
      /失败率|完成率|评分|掌握度|连续天数|人格|AI 周计划/
    )
    const actionFacts = page.getByLabel('周期行动记录')
    await expect(actionFacts).toContainText('读取一个例子')
    await expect(actionFacts).toContainText('2026-08-10 · 11 分钟')

    const apiFacts = await page.evaluate(async () => {
      const begun = await window.myTracer.review.begin({})
      if (!begun.ok) throw new Error(begun.error.message)
      const first = await window.myTracer.review.getSummary({
        reviewContextId: begun.value.reviewContextId
      })
      const second = await window.myTracer.review.getSummary({
        reviewContextId: begun.value.reviewContextId
      })
      return { begun, first, second, apiKeys: Object.keys(window.myTracer.review) }
    })
    expect(apiFacts.apiKeys).toEqual(['begin', 'getSummary', 'getResult', 'complete', 'cancel'])
    expect(apiFacts.first).toEqual(apiFacts.second)
    expect(apiFacts.first).toMatchObject({
      ok: true,
      value: {
        totalDurationMinutes: progress.value.totalDurationMinutes,
        realActionCount: progress.value.realActionCount,
        actionRecords: progress.value.records,
        routineRecords: progress.value.routineRecords,
        routineOutcomeCounts: { targetMet: 1, acted: 1, intentionalRest: 1, notDone: 1 },
        unknownPolicy: 'absence-is-unknown-not-counted-as-not-done'
      }
    })
    const after = await page.evaluate(() => window.myTracer.dataControl.list())
    expect(after).toEqual(before)
    await actionFacts.getByRole('button', { name: '查看完整记录或修改' }).click()
    await expect(page.getByLabel('所选记录')).toContainText('行动 · 读取一个例子')
    await page.getByRole('button', { name: '编辑记录', exact: true }).click()
    await expect(page.getByLabel('行动分钟')).toHaveValue('11')

    await application.close()
    application = undefined
    const database = new Database(databasePath, { readonly: true })
    try {
      expect(database.prepare('SELECT COUNT(*) AS count FROM review_results').get()).toEqual({
        count: 0
      })
      expect(database.prepare('SELECT COUNT(*) AS count FROM routine_records').get()).toEqual({
        count: 4
      })
    } finally {
      database.close()
    }

    application = await launchApplication(root)
    await setMainProcessDate(application, new Date(2026, 7, 12, 12).toISOString())
    page = await application.firstWindow()
    await page.getByRole('button', { name: '复盘', exact: true }).click()
    await expect(page.getByRole('heading', { name: '2026-08-10 至 2026-08-16' })).toBeVisible()
    await expect(page.getByLabel('周期汇总')).toContainText('投入时间18 分钟')
    await expect(page.getByLabel('未进行 1 条')).toBeVisible()
  } finally {
    await application?.close()
    await removeTemporaryTestRoot(root)
  }
})

test('keeps a Sunday period fixed across Monday and captures a new week only after re-entry', async () => {
  test.slow()
  const root = await createTemporaryTestRoot()
  let application: ElectronApplication | undefined

  try {
    application = await launchApplication(root)
    await setMainProcessDate(application, new Date(2026, 7, 30, 12).toISOString())
    const page = await application.firstWindow()
    await page.getByRole('button', { name: '复盘', exact: true }).click()
    await expect(page.getByRole('heading', { name: '2026-08-24 至 2026-08-30' })).toBeVisible()
    await page.getByRole('button', { name: '查看前一周记录' }).click()
    await expect(page.getByLabel('开始日期（包含）')).toHaveValue('2026-08-17')
    await expect(page.getByLabel('结束日期（包含）')).toHaveValue('2026-08-23')
    await page.getByRole('button', { name: '复盘', exact: true }).click()
    await expect(page.getByRole('heading', { name: '2026-08-24 至 2026-08-30' })).toBeVisible()

    await setMainProcessDate(application, new Date(2026, 7, 31, 12).toISOString())
    await page.getByRole('button', { name: '重新读取记录' }).click()
    await expect(page.getByRole('heading', { name: '2026-08-24 至 2026-08-30' })).toBeVisible()

    await page.getByRole('button', { name: '今天', exact: true }).click()
    await page.getByRole('button', { name: '复盘', exact: true }).click()
    await expect(page.getByRole('heading', { name: '2026-08-31 至 2026-09-06' })).toBeVisible()

    const oldContextId = await page.evaluate(async () => {
      const result = await window.myTracer.review.begin({})
      if (!result.ok) throw new Error(result.error.message)
      return result.value.reviewContextId
    })
    await page.reload()
    await expect(
      page.getByRole('heading', { name: '看看最近走到了哪里。', exact: true })
    ).toBeVisible()
    expect(
      await page.evaluate(
        (reviewContextId) => window.myTracer.review.getSummary({ reviewContextId }),
        oldContextId
      )
    ).toMatchObject({ ok: false, error: { code: 'context-stale' } })
    await page.getByRole('button', { name: '复盘', exact: true }).click()
    await expect(page.getByRole('heading', { name: '2026-08-31 至 2026-09-06' })).toBeVisible()
  } finally {
    await application?.close()
    await removeTemporaryTestRoot(root)
  }
})
