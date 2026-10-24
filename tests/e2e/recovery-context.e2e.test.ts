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
  await application.evaluate((_electron, controlledInstant) => {
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
  }, instant)
}

test('opens a Goal Recovery page explicitly and shows read-only recorded facts after reopen', async () => {
  const root = await createTemporaryTestRoot()
  let application: ElectronApplication | undefined
  try {
    application = await launchApplication(root)
    await setMainProcessDate(application, new Date(2026, 7, 20, 12).toISOString())
    let page = await application.firstWindow()
    const seeded = await page.evaluate(async () => {
      const goal = await window.myTracer.goals.create({
        name: '恢复 React 学习',
        description: null,
        initialNextAction: { title: '运行状态示例' }
      })
      if (!goal.ok || !goal.value.currentNextAction) throw new Error('Goal setup failed.')
      const context = await window.myTracer.records.begin({
        actionId: goal.value.currentNextAction.id
      })
      if (!context.ok) throw new Error('Recording setup failed.')
      const record = await window.myTracer.records.record({
        actionId: context.value.actionId,
        recordingContextId: context.value.recordingContextId,
        durationMinutes: 0,
        outcome: 'partial',
        understanding: '状态更新会排队',
        confusion: '批处理何时结束'
      })
      if (!record.ok) throw new Error('Record setup failed.')
      const routine = await window.myTracer.routines.create({
        arrangementMode: 'weekly' as const,
        goalId: goal.value.id,
        name: '每日练习',
        minimumAction: '打开编辑器',
        weekdays: [1, 2, 3, 4, 5, 6, 7]
      })
      if (!routine.ok) throw new Error('Routine setup failed.')
      const routineContext = await window.myTracer.routines.beginRecording({
        routineId: routine.value.id
      })
      if (!routineContext.ok) throw new Error('Routine context setup failed.')
      const routineRecord = await window.myTracer.routines.record({
        routineId: routine.value.id,
        recordingContextId: routineContext.value.recordingContextId,
        outcome: 'acted',
        durationMinutes: 0
      })
      if (!routineRecord.ok) throw new Error('Routine record setup failed.')
      return { goalId: goal.value.id }
    })

    expect(
      await page.evaluate(
        (goalId) => window.myTracer.recovery.getContext({ goalId }),
        seeded.goalId
      )
    ).toMatchObject({
      ok: true,
      value: { asOfLocalDate: '2026-08-20', daysSinceLastRealAction: 0 }
    })
    await application.close()
    application = await launchApplication(root)
    await setMainProcessDate(application, new Date(2026, 7, 23, 12).toISOString())
    page = await application.firstWindow()

    await page.getByRole('button', { name: '目标', exact: true }).click()
    await page.getByRole('button', { name: /恢复 React 学习.*有下一步/ }).click()
    await page.getByRole('button', { name: '查看恢复与整理' }).click()
    await expect(page.getByRole('heading', { name: '恢复 React 学习' })).toBeVisible()
    await expect(page.getByLabel('恢复与整理页面')).toContainText('3 天')
    await expect(page.getByLabel('恢复与整理页面')).toContainText('少于 1 分钟')
    await expect(page.getByLabel('恢复与整理页面')).toContainText('状态更新会排队')
    await expect(page.getByLabel('恢复与整理页面')).toContainText('批处理何时结束')
    await expect(page.getByLabel('恢复与整理页面')).toContainText('运行状态示例')
    expect(
      await page.evaluate(
        (goalId) => window.myTracer.recovery.getContext({ goalId }),
        seeded.goalId
      )
    ).toMatchObject({
      ok: true,
      value: {
        goal: { name: '恢复 React 学习' },
        daysSinceLastRealAction: 3,
        latestRealRecord: { durationMinutes: 0 }
      }
    })
    await page.getByRole('button', { name: '返回目标' }).click()
    await expect(page.getByLabel('恢复 React 学习 详情')).toBeVisible()
  } finally {
    await application?.close()
    await removeTemporaryTestRoot(root)
  }
})
