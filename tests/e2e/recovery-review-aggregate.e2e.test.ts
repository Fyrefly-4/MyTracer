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
  const root = await createTemporaryTestRoot()
  let application: ElectronApplication | undefined
  try {
    application = await launch(root)
    await setDate(application, new Date(2026, 7, 24, 12).toISOString())
    let page = await application.firstWindow()
    const seeded = await page.evaluate(async () => {
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

    await application.close()
    application = undefined
    application = await launch(root)
    await setDate(application, new Date(2026, 7, 27, 12).toISOString())
    page = await application.firstWindow()

    await page.getByRole('button', { name: '目标', exact: true }).click()
    await page.getByRole('button', { name: /连续恢复复盘目标.*有下一步/ }).click()
    await page.getByRole('button', { name: '查看恢复与整理' }).click()
    await expect(page.getByLabel('恢复与整理页面')).toContainText('恢复前事实')
    await page.getByLabel('新的小行动').fill('恢复后的真实行动')
    await page.getByRole('button', { name: '创建并设为下一步' }).click()
    await page.getByRole('button', { name: '确认保存' }).click()

    const afterRecord = await page.evaluate(async (goalId) => {
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
    expect(afterRecord).toBe('恢复后的真实行动')

    await page.getByRole('button', { name: '复盘', exact: true }).click()
    await expect(page.getByRole('heading', { name: '2026-08-24 至 2026-08-30' })).toBeVisible()
    await expect(page.getByLabel('周期汇总')).toContainText('投入时间10 分钟')
    await expect(page.getByLabel('周期汇总')).toContainText('真实行动次数2')
    await expect(page.getByText('恢复前事实')).toBeVisible()
    await expect(page.getByText('恢复后事实')).toBeVisible()
    await page.getByLabel('一个真实进展').fill('完成恢复并继续行动')
    await page.getByLabel('一个主要阻力').fill('重新进入上下文需要时间')
    await page.getByLabel('下一周期的一个调整').fill('保留一个更小的下一步')
    await page.getByRole('button', { name: '保存复盘' }).click()
    await expect(page.getByText('本周期复盘已保存。')).toBeVisible()
  } finally {
    await application?.close()
    await removeTemporaryTestRoot(root)
  }
})
