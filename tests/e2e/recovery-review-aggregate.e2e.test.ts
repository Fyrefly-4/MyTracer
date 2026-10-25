import { join } from 'node:path'
import { expect, test, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import {
  createTemporaryTestRoot,
  removeTemporaryTestRoot,
  type TemporaryTestRoot
} from '../support/temporary-test-root'

// Static stages only; preserve the original timeout, assertions and synthetic data isolation.
async function aggregateStep<T>(name: string, body: () => Promise<T>): Promise<T> {
  return test.step(name, async () => {
    const started = performance.now()
    console.log(`[recovery-review] start: ${name}`)
    try {
      const result = await body()
      console.log(`[recovery-review] done: ${name} (${Math.round(performance.now() - started)}ms)`)
      return result
    } catch (error) {
      console.log(
        `[recovery-review] failed: ${name} (${Math.round(performance.now() - started)}ms)`
      )
      throw error
    }
  })
}

async function launch(root: TemporaryTestRoot): Promise<ElectronApplication> {
  return electron.launch({
    cwd: root.root,
    args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
    env: minimalElectronEnvironment(root)
  })
}

async function setDate(application: ElectronApplication, instant: string): Promise<void> {
  await application.evaluate((_electron, controlledInstant) => {
    const RealDate = Date
    Reflect.set(
      globalThis,
      'Date',
      new Proxy(RealDate, {
        construct(target, argumentsList) {
          return Reflect.construct(
            target,
            argumentsList.length ? argumentsList : [controlledInstant]
          )
        }
      })
    )
  }, instant)
}

test('aggregate AC-05 to AC-06 keeps pre-recovery and post-recovery records in one ReviewSummary', async () => {
  test.slow()
  const root = await aggregateStep('create isolated root', createTemporaryTestRoot)
  let application: ElectronApplication | undefined
  try {
    application = await aggregateStep('launch initial application', () => launch(root))
    await aggregateStep('set initial date', () =>
      setDate(application!, new Date(2026, 7, 24, 12).toISOString())
    )
    let page = await aggregateStep('open initial window', () => application!.firstWindow())
    const seeded = await aggregateStep('seed pre-recovery facts', () =>
      page.evaluate(async () => {
        const goal = await window.myTracer.goals.create({
          name: '连续恢复复盘目标',
          initialNextAction: { title: '恢复前行动' }
        })
        if (!goal.ok || !goal.value.currentNextAction) throw new Error('Goal setup failed')
        const before = await window.myTracer.dataControl.backfillActionRecord({
          actionId: goal.value.currentNextAction.id,
          occurredOn: '2026-08-24',
          durationMinutes: 4,
          outcome: 'partial',
          understanding: '恢复前事实',
          confusion: '恢复前困惑'
        })
        if (!before.ok) throw new Error(before.error.message)
        return { goalId: goal.value.id }
      })
    )

    await aggregateStep('close before reopen', () => application!.close())
    application = undefined
    application = await aggregateStep('relaunch persisted application', () => launch(root))
    await aggregateStep('set reopened date', () =>
      setDate(application!, new Date(2026, 7, 27, 12).toISOString())
    )
    page = await aggregateStep('open reopened window', () => application!.firstWindow())

    await aggregateStep('navigate and confirm recovery action', async () => {
      await page.getByRole('button', { name: '目标', exact: true }).click()
      await page.getByRole('button', { name: /连续恢复复盘目标.*有下一步/ }).click()
      await page.getByRole('button', { name: '查看恢复与整理' }).click()
      await expect(page.getByLabel('恢复与整理页面')).toContainText('恢复前事实')
      await page.getByLabel('新的小行动').fill('恢复后的真实行动')
      await page.getByRole('button', { name: '创建并设为下一步' }).click()
      await page.getByRole('button', { name: '确认保存' }).click()
    })

    const afterRecord = await aggregateStep('record post-recovery facts', () =>
      page.evaluate(async (goalId) => {
        const goal = await window.myTracer.goals.getDetail({ goalId })
        if (!goal.ok || !goal.value.currentNextAction) throw new Error('Current next missing')
        const context = await window.myTracer.records.begin({
          actionId: goal.value.currentNextAction.id
        })
        if (!context.ok) throw new Error(context.error.message)
        const saved = await window.myTracer.records.record({
          actionId: context.value.actionId,
          recordingContextId: context.value.recordingContextId,
          durationMinutes: 6,
          outcome: 'partial',
          understanding: '恢复后事实'
        })
        if (!saved.ok) throw new Error(saved.error.message)
        return goal.value.currentNextAction.title
      }, seeded.goalId)
    )
    expect(afterRecord).toBe('恢复后的真实行动')

    await aggregateStep('assert combined review summary', async () => {
      await page.getByRole('button', { name: '复盘', exact: true }).click()
      await expect(page.getByRole('heading', { name: '2026-08-24 至 2026-08-30' })).toBeVisible()
      await expect(page.getByLabel('周期汇总')).toContainText('已记录时长合计10 分钟')
      await expect(page.getByLabel('周期汇总')).toContainText('真实行动次数2')
      await expect(
        page.getByLabel('周期已确认理解').getByText('恢复前事实', { exact: true })
      ).toBeVisible()
      await expect(
        page.getByLabel('周期已确认理解').getByText('恢复后事实', { exact: true })
      ).toBeVisible()
    })
    await aggregateStep('save review and confirm feedback', async () => {
      await page.getByLabel('一个真实进展').fill('完成恢复并继续行动')
      await page.getByLabel('一个主要阻力').fill('重新进入上下文需要时间')
      await page.getByLabel('下一周期的一个调整').fill('保留一个更小的下一步')
      await page.getByRole('button', { name: '保存复盘', exact: true }).click()
      await expect(page.getByText('本周期复盘已保存。')).toBeVisible()
    })
  } finally {
    await aggregateStep('close final application', async () => application?.close())
    await aggregateStep('remove isolated root', () => removeTemporaryTestRoot(root))
  }
})
