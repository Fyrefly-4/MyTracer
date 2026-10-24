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

test('AC-06 cancels cleanly, saves and edits one stable ReviewResult, resolves next steps, and reopens', async () => {
  test.slow()
  const root = await createTemporaryTestRoot()
  const databasePath = join(root.electronUserData, 'data', 'mytracer.sqlite3')
  let application: ElectronApplication | undefined
  try {
    application = await launch(root)
    await setDate(application, new Date(2026, 7, 12, 12).toISOString())
    let page = await application.firstWindow()
    const seeded = await page.evaluate(async () => {
      const goal = await window.myTracer.goals.create({
        name: '复盘目标',
        initialNextAction: { title: '已有下一步' }
      })
      if (!goal.ok || !goal.value.currentNextAction) throw new Error('Goal setup failed')
      const second = await window.myTracer.actions.create({
        goalId: goal.value.id,
        title: '第二个候选'
      })
      const record = await window.myTracer.dataControl.backfillActionRecord({
        actionId: goal.value.currentNextAction.id,
        occurredOn: '2026-08-10',
        durationMinutes: 5,
        outcome: 'partial',
        understanding: '保存用户确认文本',
        confusion: '如何保持轻量'
      })
      if (!second.ok || !record.ok) throw new Error('Review setup failed')
      return {
        goalId: goal.value.id,
        originalActionId: goal.value.currentNextAction.id,
        existingActionId: second.value.id,
        recordId: record.value.id
      }
    })

    await page.getByRole('button', { name: '复盘', exact: true }).click()
    await page.getByLabel('一个真实进展').fill('取消的进展')
    await page.getByLabel('一个主要阻力').fill('取消的阻力')
    await page.getByLabel('下一周期的一个调整').fill('取消的调整')
    await page.getByRole('button', { name: '取消' }).click()
    await expect(page.getByText('已取消，本次填写没有保存。')).toBeVisible()
    const afterCancel = new Database(databasePath, { readonly: true })
    expect(afterCancel.prepare('SELECT COUNT(*) AS count FROM review_results').get()).toEqual({
      count: 0
    })
    afterCancel.close()

    await page.getByLabel('一个真实进展').fill('完成了一个真实切片')
    await page.getByLabel('一个主要阻力').fill('上下文切换')
    await page.getByLabel('下一周期的一个调整').fill('保护一个专注时段')
    await page.getByRole('button', { name: '保存复盘' }).click()
    await expect(page.getByText('本周期复盘已保存。')).toBeVisible()
    await expect(page.getByLabel('一个真实进展')).toHaveValue('完成了一个真实切片')

    const first = new Database(databasePath, { readonly: true })
    const firstRow = first.prepare('SELECT * FROM review_results').get() as Record<string, unknown>
    first.close()
    expect(firstRow).toMatchObject({
      period_started_on: '2026-08-10',
      confirmed_progress: '完成了一个真实切片',
      goal_id: null
    })

    const selectedOriginal = await page.evaluate(
      (actionId) => window.myTracer.today.selectAction({ actionId }),
      seeded.originalActionId
    )
    expect(selectedOriginal).toMatchObject({ ok: true })

    await page.getByLabel('关联活跃目标（可选）').selectOption(seeded.goalId)
    await page.getByLabel('使用已有待行动').check()
    await page.getByLabel('选择已有下一步行动').selectOption(seeded.existingActionId)
    await page.getByLabel('一个真实进展').fill('编辑后的真实进展')
    await page.getByRole('button', { name: '保存复盘' }).click()
    await expect(page.getByText('本周期复盘已保存。')).toBeVisible()
    expect(
      await page.evaluate((goalId) => window.myTracer.goals.getDetail({ goalId }), seeded.goalId)
    ).toMatchObject({ ok: true, value: { currentNextActionId: seeded.existingActionId } })
    await expect(page.getByLabel('复盘后的下一步')).toContainText(
      '当前下一步：第二个候选 · 尚未加入今天'
    )
    expect(await page.evaluate(() => window.myTracer.today.get({}))).toMatchObject({
      ok: true,
      value: {
        focuses: [{ id: seeded.originalActionId }],
        intentions: []
      }
    })
    await page.getByRole('button', { name: '前往今天确认' }).click()
    await expect(page.getByLabel('第二个候选 行动详情')).toBeVisible()
    await expect(page.locator('.focus-row').filter({ hasText: '已有下一步' })).toBeVisible()
    await expect(page.locator('.focus-row').filter({ hasText: '第二个候选' })).toHaveCount(0)
    await page.getByRole('button', { name: '复盘', exact: true }).click()

    await expect(page.getByLabel('关联活跃目标（可选）')).toHaveValue(seeded.goalId)
    await page.getByLabel('创建并使用').check()
    await page.getByLabel('新的下一步行动').fill('新建轻量下一步')
    await page.getByRole('button', { name: '保存复盘' }).click()
    await expect(page.getByText('本周期复盘已保存。')).toBeVisible()
    const afterCreate = await page.evaluate(
      async (goalId) => ({
        goal: await window.myTracer.goals.getDetail({ goalId }),
        today: await window.myTracer.today.get({})
      }),
      seeded.goalId
    )
    expect(afterCreate).toMatchObject({
      goal: {
        ok: true,
        value: { currentNextAction: { title: '新建轻量下一步', status: 'pending' } }
      },
      today: {
        ok: true,
        value: { focuses: [{ id: seeded.originalActionId }], intentions: [] }
      }
    })

    const beforeRefreshId = firstRow.id
    const updatedRecord = await page.evaluate(
      ({ recordId }) =>
        window.myTracer.dataControl.updateActionRecord({
          recordId,
          occurredOn: '2026-08-10',
          durationMinutes: 9,
          outcome: 'partial',
          summary: null,
          note: null
        }),
      seeded
    )
    expect(updatedRecord).toMatchObject({ ok: true })
    await page.getByRole('button', { name: '重新读取记录' }).click()
    await expect(page.getByLabel('周期汇总')).toContainText('已记录时长合计9 分钟')
    await expect(page.getByLabel('一个真实进展')).toHaveValue('编辑后的真实进展')

    await application.close()
    application = undefined
    const persisted = new Database(databasePath, { readonly: true })
    const rows = persisted.prepare('SELECT * FROM review_results').all() as Record<
      string,
      unknown
    >[]
    persisted.close()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id: beforeRefreshId, confirmed_progress: '编辑后的真实进展' })

    application = await launch(root)
    await setDate(application, new Date(2026, 7, 12, 12).toISOString())
    page = await application.firstWindow()
    await page.getByRole('button', { name: '复盘', exact: true }).click()
    await expect(page.getByLabel('一个真实进展')).toHaveValue('编辑后的真实进展')
    await expect(page.getByLabel('一个主要阻力')).toHaveValue('上下文切换')
    await expect(page.getByLabel('下一周期的一个调整')).toHaveValue('保护一个专注时段')
  } finally {
    await application?.close()
    await removeTemporaryTestRoot(root)
  }
})
