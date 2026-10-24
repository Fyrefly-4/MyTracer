import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
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

async function openRecovery(page: Page, goalName: string): Promise<void> {
  await page.getByRole('button', { name: '目标', exact: true }).click()
  await page.getByRole('button', { name: new RegExp(`${goalName}.*有下一步`) }).click()
  await page.getByRole('button', { name: '查看恢复与整理' }).click()
  await expect(page.getByLabel('恢复与整理页面')).toBeVisible()
}

test('AC-05 keeps history intact while a user confirms cleanup, chooses a new Action, and optionally adds Today', async () => {
  const root = await createTemporaryTestRoot()
  let application: ElectronApplication | undefined
  try {
    application = await launchApplication(root)
    await setMainProcessDate(application, new Date(2026, 7, 20, 12).toISOString())
    let page = await application.firstWindow()
    const seeded = await page.evaluate(async () => {
      const goal = await window.myTracer.goals.create({
        name: '继续 React 学习',
        description: null,
        initialNextAction: { title: '整理旧示例' }
      })
      if (!goal.ok || !goal.value.currentNextAction) throw new Error('Goal setup failed.')
      const recording = await window.myTracer.records.begin({
        actionId: goal.value.currentNextAction.id
      })
      if (!recording.ok) throw new Error('Action recording setup failed.')
      const record = await window.myTracer.records.record({
        actionId: recording.value.actionId,
        recordingContextId: recording.value.recordingContextId,
        durationMinutes: 12,
        outcome: 'partial',
        understanding: '小步骤更容易开始',
        confusion: '下一次从哪里继续'
      })
      if (!record.ok) throw new Error('Action record setup failed.')
      const routine = await window.myTracer.routines.create({
        arrangementMode: 'weekly' as const,
        goalId: goal.value.id,
        name: '每日旧练习',
        minimumAction: '打开旧示例',
        weekdays: [1, 2, 3, 4, 5, 6, 7]
      })
      if (!routine.ok) throw new Error('Routine setup failed.')
      return {
        goalId: goal.value.id,
        oldActionId: goal.value.currentNextAction.id,
        routineId: routine.value.id
      }
    })

    await application.close()
    application = await launchApplication(root)
    await setMainProcessDate(application, new Date(2026, 7, 25, 12).toISOString())
    page = await application.firstWindow()
    const historyBefore = await page.evaluate(async (goalId) => {
      const context = await window.myTracer.recovery.getContext({ goalId })
      if (!context.ok) throw new Error('Recovery setup failed.')
      return {
        latestRealRecord: context.value.latestRealRecord,
        confirmedUnderstandings: context.value.confirmedUnderstandings,
        openConfusions: context.value.openConfusions
      }
    }, seeded.goalId)

    await openRecovery(page, '继续 React 学习')
    await expect(page.getByLabel('恢复与整理页面')).toContainText('5 天')
    await page.getByText('整理目标、行动与例行', { exact: true }).click()
    const routineRow = page.getByText('每日旧练习').locator('..')
    await routineRow.getByRole('button', { name: '暂停' }).click()
    await expect(page.getByRole('alertdialog')).toContainText('确认暂停例行')
    await page.getByRole('button', { name: '取消草稿' }).click()
    expect(
      await page.evaluate(
        (routineId) => window.myTracer.routines.getDetail({ routineId }),
        seeded.routineId
      )
    ).toMatchObject({ ok: true, value: { status: 'active' } })

    await routineRow.getByRole('button', { name: '暂停' }).click()
    await page.getByRole('button', { name: '确认保存' }).click()
    await expect(page.getByText('已保存，并重新读取了最新内容。')).toBeVisible()
    expect(
      await page.evaluate(
        async ({ goalId, routineId }) => ({
          goal: await window.myTracer.goals.getDetail({ goalId }),
          routine: await window.myTracer.routines.getDetail({ routineId })
        }),
        seeded
      )
    ).toMatchObject({
      goal: { ok: true, value: { status: 'active' } },
      routine: { ok: true, value: { status: 'paused' } }
    })

    await page.getByLabel('新的小行动').fill('运行一个最小状态示例')
    await page.getByRole('button', { name: '创建并设为下一步' }).click()
    await expect(page.getByRole('alertdialog')).toContainText('不会自动加入今天')
    await page.getByRole('button', { name: '取消草稿' }).click()
    expect(
      await page.evaluate((goalId) => window.myTracer.goals.getDetail({ goalId }), seeded.goalId)
    ).toMatchObject({ ok: true, value: { currentNextActionId: seeded.oldActionId } })

    await page.getByRole('button', { name: '创建并设为下一步' }).click()
    await page.getByRole('button', { name: '确认保存' }).click()
    const afterCreate = await page.evaluate(
      async (goalId) => ({
        goal: await window.myTracer.goals.getDetail({ goalId }),
        today: await window.myTracer.today.get({}),
        recovery: await window.myTracer.recovery.getContext({ goalId })
      }),
      seeded.goalId
    )
    expect(afterCreate).toMatchObject({
      goal: {
        ok: true,
        value: {
          currentNextAction: {
            title: '运行一个最小状态示例',
            status: 'pending',
            selectedForToday: false
          }
        }
      },
      today: { ok: true, value: { localDate: '2026-08-25', focuses: [] } }
    })
    expect(afterCreate.recovery.ok && afterCreate.recovery.value.pendingActions).toHaveLength(2)

    await setMainProcessDate(application, new Date(2026, 7, 26, 0, 5).toISOString())
    await page.getByRole('button', { name: '加入今天并继续' }).click()
    await page.getByRole('button', { name: '确认保存' }).click()
    await expect(page.getByLabel('运行一个最小状态示例 行动详情')).toBeVisible()
    const finalFacts = await page.evaluate(
      async (goalId) => ({
        context: await window.myTracer.recovery.getContext({ goalId }),
        today: await window.myTracer.today.get({})
      }),
      seeded.goalId
    )
    expect(finalFacts.today).toMatchObject({
      ok: true,
      value: {
        localDate: '2026-08-26',
        focuses: [{ title: '运行一个最小状态示例' }]
      }
    })
    expect(
      finalFacts.context.ok && {
        latestRealRecord: finalFacts.context.value.latestRealRecord,
        confirmedUnderstandings: finalFacts.context.value.confirmedUnderstandings,
        openConfusions: finalFacts.context.value.openConfusions
      }
    ).toEqual(historyBefore)

    await application.close()
    application = await launchApplication(root)
    await setMainProcessDate(application, new Date(2026, 7, 26, 12).toISOString())
    page = await application.firstWindow()
    await openRecovery(page, '继续 React 学习')
    await expect(page.getByLabel('恢复与整理页面')).toContainText('运行一个最小状态示例')
    expect(
      await page.evaluate(
        async ({ goalId, routineId }) => ({
          goal: await window.myTracer.goals.getDetail({ goalId }),
          routine: await window.myTracer.routines.getDetail({ routineId }),
          today: await window.myTracer.today.get({})
        }),
        seeded
      )
    ).toMatchObject({
      goal: {
        ok: true,
        value: { status: 'active', currentNextAction: { title: '运行一个最小状态示例' } }
      },
      routine: { ok: true, value: { status: 'paused' } },
      today: {
        ok: true,
        value: { localDate: '2026-08-26', focuses: [{ title: '运行一个最小状态示例' }] }
      }
    })
  } finally {
    await application?.close()
    await removeTemporaryTestRoot(root)
  }
})
