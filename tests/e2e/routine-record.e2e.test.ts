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

test('completes AC-03 with five distinct states, factual Progress, and stable reopen', async () => {
  test.slow()
  const root = await createTemporaryTestRoot()
  let application: ElectronApplication | undefined

  try {
    application = await launchApplication(root)
    await setMainProcessDate(application, '2026-08-10T08:00:00.000Z')
    let page = await application.firstWindow()

    const facts = await page.evaluate(async () => {
      const create = async (name: string, weekdays: readonly number[]) => {
        const result = await window.myTracer.routines.create({
          name,
          minimumAction: '做一个最小动作',
          weekdays
        })
        if (!result.ok) throw new Error(result.error.message)
        return result.value
      }
      const save = async (
        routineId: string,
        outcome: 'target_met' | 'acted' | 'intentional_rest' | 'not_done',
        durationMinutes: number | null
      ) => {
        const begun = await window.myTracer.routines.beginRecording({ routineId })
        if (!begun.ok) throw new Error(begun.error.message)
        const saved = await window.myTracer.routines.record({
          routineId,
          recordingContextId: begun.value.recordingContextId,
          outcome,
          durationMinutes
        })
        if (!saved.ok || saved.value.kind !== 'saved') throw new Error('Routine record failed.')
        return saved.value.record
      }

      const target = await create('每日目标达成', [1, 2, 3, 4, 5, 6, 7])
      const acted = await create('非计划行动', [2])
      const rest = await create('主动休息', [1, 2, 3, 4, 5, 6, 7])
      const notDone = await create('明确未做', [1, 2, 3, 4, 5, 6, 7])
      const unknown = await create('保持未知', [1, 2, 3, 4, 5, 6, 7])
      await create('UI 行动', [1, 2, 3, 4, 5, 6, 7])
      const records = [
        await save(target.id, 'target_met', 10),
        await save(acted.id, 'acted', 0),
        await save(rest.id, 'intentional_rest', null),
        await save(notDone.id, 'not_done', null)
      ]
      const unknownState = await window.myTracer.routines.getDayState({
        routineId: unknown.id,
        localDate: '2026-08-10'
      })
      if (!unknownState.ok) throw new Error(unknownState.error.message)
      const scheduleChanged = await window.myTracer.routines.replaceSchedule({
        routineId: target.id,
        weekdays: [2]
      })
      if (!scheduleChanged.ok) throw new Error(scheduleChanged.error.message)
      return { targetId: target.id, records, unknownState: unknownState.value }
    })

    expect(facts.records.map((record) => record.outcome)).toEqual([
      'target_met',
      'acted',
      'intentional_rest',
      'not_done'
    ])
    expect(facts.records.map((record) => record.plannedForDate)).toEqual([true, false, true, true])
    expect(facts.unknownState).toMatchObject({ recordState: 'unknown', record: null })

    await page.getByRole('button', { name: 'Routines' }).click()
    await page.getByRole('button', { name: 'Today' }).click()
    await expect(
      page.getByLabel('主动休息 Routine 记录').getByText('有意休息', { exact: true })
    ).toBeVisible()
    await expect(
      page.getByLabel('明确未做 Routine 记录').getByText('明确未做', { exact: true })
    ).toBeVisible()
    await expect(
      page.getByLabel('保持未知 Routine 记录').getByText('尚无记录', { exact: true })
    ).toBeVisible()
    const uiPanel = page.getByLabel('UI 行动 Routine 记录')
    await uiPanel.getByRole('button', { name: '记录 Routine' }).click()
    await uiPanel.getByLabel('本次结果').selectOption('acted')
    await uiPanel.getByLabel('行动分钟（可空）').fill('5')
    await uiPanel.getByRole('button', { name: '保存 Routine 记录' }).click()
    await expect(uiPanel.getByText('有真实行动', { exact: true }).first()).toBeVisible()

    await page.getByRole('button', { name: 'Progress' }).click()
    await expect(page.getByLabel('进展汇总')).toContainText('累计行动分钟15')
    await expect(page.getByLabel('进展汇总')).toContainText('记录到的行动次数3')
    await expect(page.getByLabel('进展汇总')).toContainText('Routine 达到目标次数1')
    await expect(page.getByLabel('进展汇总')).toContainText('计划日达到目标次数1')
    await expect(page.getByLabel('Routine 事实').locator('li')).toHaveCount(5)

    const beforeReopen = await page.evaluate(() => window.myTracer.progress.get({}))
    await application.close()
    application = undefined
    application = await launchApplication(root)
    page = await application.firstWindow()
    expect(await page.evaluate(() => window.myTracer.progress.get({}))).toEqual(beforeReopen)
    expect(
      await page.evaluate(
        (routineId) => window.myTracer.routines.getDayState({ routineId, localDate: '2026-08-10' }),
        facts.targetId
      )
    ).toMatchObject({
      ok: true,
      value: {
        plannedByCurrentSchedule: false,
        recordState: 'target_met',
        record: { plannedForDate: true }
      }
    })
  } finally {
    await application?.close()
    await removeTemporaryTestRoot(root)
  }
})

test('requires an explicit Routine date choice across midnight', async () => {
  const root = await createTemporaryTestRoot()
  let application: ElectronApplication | undefined
  try {
    application = await launchApplication(root)
    const page = await application.firstWindow()
    const localMidnight = new Date(2026, 7, 11, 0, 0, 0, 0).getTime()
    await setMainProcessDate(application, new Date(localMidnight - 60_000).toISOString())
    const context = await page.evaluate(async () => {
      const routine = await window.myTracer.routines.create({
        name: '跨午夜 Routine',
        minimumAction: '一步',
        weekdays: [1, 2, 3, 4, 5, 6, 7]
      })
      if (!routine.ok) throw new Error(routine.error.message)
      const begun = await window.myTracer.routines.beginRecording({ routineId: routine.value.id })
      if (!begun.ok) throw new Error(begun.error.message)
      return begun.value
    })
    expect(context.capturedOn).toBe('2026-08-10')
    await setMainProcessDate(application, new Date(localMidnight + 60_000).toISOString())
    expect(
      await page.evaluate(
        (input) =>
          window.myTracer.routines.record({
            routineId: input.routineId,
            recordingContextId: input.recordingContextId,
            outcome: 'acted'
          }),
        context
      )
    ).toMatchObject({
      ok: true,
      value: {
        kind: 'date-confirmation-required',
        capturedOn: '2026-08-10',
        currentLocalDate: '2026-08-11'
      }
    })
    expect(
      await page.evaluate(
        (input) =>
          window.myTracer.routines.record({
            routineId: input.routineId,
            recordingContextId: input.recordingContextId,
            dateChoice: 'use-current-on',
            outcome: 'acted'
          }),
        context
      )
    ).toMatchObject({
      ok: true,
      value: { kind: 'saved', record: { occurredOn: '2026-08-11' } }
    })
  } finally {
    await application?.close()
    await removeTemporaryTestRoot(root)
  }
})
