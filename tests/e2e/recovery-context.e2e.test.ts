import { join } from 'node:path'
import { expect, test, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { startElectronDiagnostics } from '../support/electron-diagnostics'
import { minimalElectronEnvironment } from '../support/electron-environment'
import {
  createTemporaryTestRoot,
  removeTemporaryTestRoot,
  type TemporaryTestRoot
} from '../support/temporary-test-root'

// Static phase names only: no fixture contents, paths or environment dumps.
async function recoveryStep<T>(name: string, body: () => Promise<T>): Promise<T> {
  return test.step(name, async () => {
    const started = performance.now()
    console.log(`[recovery] start: ${name}`)
    try {
      const result = await body()
      console.log(`[recovery] done: ${name} (${Math.round(performance.now() - started)}ms)`)
      return result
    } catch (error) {
      console.log(`[recovery] failed: ${name} (${Math.round(performance.now() - started)}ms)`)
      throw error
    }
  })
}

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
  const root = await recoveryStep('create isolated root', createTemporaryTestRoot)
  let application: ElectronApplication | undefined
  let finishDiagnostics: ((failure?: unknown) => Promise<void>) | undefined
  let failed = false
  let cleanupFailed = false
  let cleanupFailure: unknown
  try {
    application = await recoveryStep('launch initial application', () => launchApplication(root))
    finishDiagnostics = await recoveryStep('start actual-context trace', () =>
      startElectronDiagnostics(application!, test.info())
    )
    await recoveryStep('set initial main-process date', () =>
      setMainProcessDate(application!, new Date(2026, 7, 20, 12).toISOString())
    )
    let page = await recoveryStep('open initial window', () => application!.firstWindow())
    const seeded = await recoveryStep('seed synthetic recorded facts', () =>
      page.evaluate(async () => {
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
    )

    await recoveryStep('assert initial recovery facts', async () => {
      expect(
        await page.evaluate(
          (goalId) => window.myTracer.recovery.getContext({ goalId }),
          seeded.goalId
        )
      ).toMatchObject({
        ok: true,
        value: { asOfLocalDate: '2026-08-20', daysSinceLastRealAction: 0 }
      })
    })
    await recoveryStep('finish initial trace', () => finishDiagnostics!())
    finishDiagnostics = undefined
    await recoveryStep('close before reopen', () => application!.close())
    application = undefined
    application = await recoveryStep('relaunch persisted application', () =>
      launchApplication(root)
    )
    finishDiagnostics = await recoveryStep('start actual-context trace', () =>
      startElectronDiagnostics(application!, test.info())
    )
    await recoveryStep('set reopened main-process date', () =>
      setMainProcessDate(application!, new Date(2026, 7, 23, 12).toISOString())
    )
    page = await recoveryStep('open reopened window', () => application!.firstWindow())

    await recoveryStep('navigate to persisted goal recovery', async () => {
      await page.getByRole('button', { name: '目标', exact: true }).click()
      await page.getByRole('button', { name: /恢复 React 学习.*有下一步/ }).click()
      await page.getByRole('button', { name: '查看恢复与整理' }).click()
    })
    await recoveryStep('assert reopened read-only facts', async () => {
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
    })
    await recoveryStep('return to goal detail', async () => {
      await page.getByRole('button', { name: '返回目标' }).click()
      await expect(page.getByLabel('恢复 React 学习 详情')).toBeVisible()
    })
    await recoveryStep('finish reopened trace', () => finishDiagnostics!())
    finishDiagnostics = undefined
  } catch (error) {
    failed = true
    try {
      await recoveryStep('capture original failure', async () => finishDiagnostics?.(error))
    } catch {
      console.error('[recovery] diagnostic capture failed; preserving original error')
    }
    throw error
  } finally {
    try {
      await recoveryStep('close final application', async () => application?.close())
      await recoveryStep('remove isolated root', () => removeTemporaryTestRoot(root))
    } catch (error) {
      // Cleanup must fail a passing test, but must not replace an earlier failure.
      cleanupFailed = true
      cleanupFailure = error
      if (failed) console.error('[recovery] cleanup failed after original failure')
    }
  }
  if (cleanupFailed) throw cleanupFailure
})
