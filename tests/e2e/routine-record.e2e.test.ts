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
  const databasePath = join(root.electronUserData, 'data', 'mytracer.sqlite3')
  const testInstant = new Date(2026, 7, 10, 12, 0, 0, 0).toISOString()
  let application: ElectronApplication | undefined

  try {
    application = await launchApplication(root)
    await setMainProcessDate(application, testInstant)
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

      const plannedTarget = await create('计划日目标达成', [1, 2, 3, 4, 5, 6, 7])
      const plannedActed = await create('计划日有所行动', [1, 2, 3, 4, 5, 6, 7])
      const plannedRest = await create('计划日主动休息', [1, 2, 3, 4, 5, 6, 7])
      const plannedNotDone = await create('计划日明确未做', [1, 2, 3, 4, 5, 6, 7])
      const unplannedTarget = await create('非计划日目标达成', [2])
      const unplannedActed = await create('非计划日有所行动', [2])
      const unplannedRest = await create('非计划日主动休息', [2])
      const unplannedNotDone = await create('非计划日明确未做', [2])
      const unknown = await create('保持未知', [1, 2, 3, 4, 5, 6, 7])
      await create('UI 行动', [1, 2, 3, 4, 5, 6, 7])
      const records = [
        await save(plannedTarget.id, 'target_met', 10),
        await save(plannedActed.id, 'acted', 0),
        await save(plannedRest.id, 'intentional_rest', null),
        await save(plannedNotDone.id, 'not_done', null),
        await save(unplannedTarget.id, 'target_met', 7),
        await save(unplannedActed.id, 'acted', 0),
        await save(unplannedRest.id, 'intentional_rest', null),
        await save(unplannedNotDone.id, 'not_done', null)
      ]

      const unknownState = await window.myTracer.routines.getDayState({
        routineId: unknown.id,
        localDate: '2026-08-10'
      })
      if (!unknownState.ok) throw new Error(unknownState.error.message)

      const duplicateContext = await window.myTracer.routines.beginRecording({
        routineId: plannedTarget.id
      })
      if (!duplicateContext.ok) throw new Error(duplicateContext.error.message)
      const duplicate = await window.myTracer.routines.record({
        routineId: plannedTarget.id,
        recordingContextId: duplicateContext.value.recordingContextId,
        outcome: 'target_met',
        durationMinutes: 99
      })

      const unplanned = [unplannedTarget, unplannedActed, unplannedRest, unplannedNotDone]
      for (const routine of unplanned) {
        const replaced = await window.myTracer.routines.replaceSchedule({
          routineId: routine.id,
          weekdays: [1]
        })
        if (!replaced.ok) throw new Error(replaced.error.message)
      }
      const reIncludedStates = []
      for (const routine of unplanned) {
        const state = await window.myTracer.routines.getDayState({
          routineId: routine.id,
          localDate: '2026-08-10'
        })
        if (!state.ok) throw new Error(state.error.message)
        reIncludedStates.push(state.value)
      }

      const excludePlanned = await window.myTracer.routines.replaceSchedule({
        routineId: plannedTarget.id,
        weekdays: [2]
      })
      if (!excludePlanned.ok) throw new Error(excludePlanned.error.message)
      const excludedState = await window.myTracer.routines.getDayState({
        routineId: plannedTarget.id,
        localDate: '2026-08-10'
      })
      if (!excludedState.ok) throw new Error(excludedState.error.message)
      const reincludePlanned = await window.myTracer.routines.replaceSchedule({
        routineId: plannedTarget.id,
        weekdays: [1]
      })
      if (!reincludePlanned.ok) throw new Error(reincludePlanned.error.message)
      const reIncludedPlannedState = await window.myTracer.routines.getDayState({
        routineId: plannedTarget.id,
        localDate: '2026-08-10'
      })
      if (!reIncludedPlannedState.ok) throw new Error(reIncludedPlannedState.error.message)

      return {
        plannedTargetId: plannedTarget.id,
        unplannedTargetId: unplannedTarget.id,
        unplannedIds: unplanned.map((routine) => routine.id),
        unknownId: unknown.id,
        records,
        duplicate,
        unknownState: unknownState.value,
        reIncludedStates,
        excludedState: excludedState.value,
        reIncludedPlannedState: reIncludedPlannedState.value
      }
    })

    expect(facts.records.map((record) => record.outcome)).toEqual([
      'target_met',
      'acted',
      'intentional_rest',
      'not_done',
      'target_met',
      'acted',
      'intentional_rest',
      'not_done'
    ])
    expect(facts.records.map((record) => record.plannedForDate)).toEqual([
      true,
      true,
      true,
      true,
      false,
      false,
      false,
      false
    ])
    expect(facts.duplicate).toMatchObject({
      ok: false,
      error: { code: 'record-already-exists' }
    })
    expect(facts.unknownState).toMatchObject({ recordState: 'unknown', record: null })
    expect(facts.reIncludedStates.map((state) => state.plannedByCurrentSchedule)).toEqual([
      true,
      true,
      true,
      true
    ])
    expect(facts.reIncludedStates.map((state) => state.recordState)).toEqual([
      'target_met',
      'acted',
      'intentional_rest',
      'not_done'
    ])
    expect(facts.reIncludedStates.map((state) => state.record)).toEqual(facts.records.slice(4))
    expect(facts.excludedState).toMatchObject({
      plannedByCurrentSchedule: false,
      recordState: 'target_met',
      record: { plannedForDate: true, durationMinutes: 10 }
    })
    expect(facts.reIncludedPlannedState).toMatchObject({
      plannedByCurrentSchedule: true,
      recordState: 'target_met',
      record: { plannedForDate: true, durationMinutes: 10 }
    })

    await page.getByRole('button', { name: '例行', exact: true }).click()
    await page.getByRole('button', { name: '今天', exact: true }).click()
    await expect(
      page
        .getByLabel('计划日主动休息 例行记录', { exact: true })
        .getByText('主动休息', { exact: true })
    ).toBeVisible()
    await expect(
      page
        .getByLabel('计划日明确未做 例行记录', { exact: true })
        .getByText('未进行', { exact: true })
    ).toBeVisible()
    await expect(
      page.getByLabel('保持未知 例行记录').getByText('未记录', { exact: true })
    ).toBeVisible()
    const uiPanel = page.getByLabel('UI 行动 例行记录')
    await uiPanel.getByRole('button', { name: '记录例行' }).click()
    await uiPanel.getByLabel('本次结果').selectOption('acted')
    await uiPanel.getByLabel('投入时长（分钟，可选）').fill('5')
    await uiPanel.getByRole('button', { name: '保存例行记录' }).click()
    await expect(uiPanel.getByText('有所行动', { exact: true }).first()).toBeVisible()

    await page.getByRole('button', { name: '进展', exact: true }).click()
    await expect(page.getByLabel('进展汇总')).toContainText('累计行动分钟22')
    await expect(page.getByLabel('进展汇总')).toContainText('记录到的行动次数5')
    await expect(page.getByLabel('进展汇总')).toContainText('例行达标次数2')
    await expect(page.getByLabel('进展汇总')).toContainText('计划日达标次数1')
    await expect(page.locator('.progress-records > li')).toHaveCount(9)

    const lifecycle = await page.evaluate(
      async ({ pauseId, endId }) => {
        const paused = await window.myTracer.routines.pause({ routineId: pauseId })
        const ended = await window.myTracer.routines.end({ routineId: endId })
        if (!paused.ok) throw new Error(paused.error.message)
        if (!ended.ok) throw new Error(ended.error.message)
        return { paused: paused.value.status, ended: ended.value.status }
      },
      { pauseId: facts.plannedTargetId, endId: facts.unplannedTargetId }
    )
    expect(lifecycle).toEqual({ paused: 'paused', ended: 'ended' })

    const beforeReopen = await page.evaluate(() => window.myTracer.progress.get({}))
    await application.close()
    application = undefined
    application = await launchApplication(root)
    await setMainProcessDate(application, testInstant)
    page = await application.firstWindow()
    await page.reload()
    expect(await page.evaluate(() => window.myTracer.progress.get({}))).toEqual(beforeReopen)
    const reopenedFacts = await page.evaluate(
      async ({ plannedTargetId, unplannedTargetId, unplannedIds, unknownId }) => ({
        routines: await window.myTracer.routines.list({}),
        today: await window.myTracer.today.get({}),
        plannedTarget: await window.myTracer.routines.getDayState({
          routineId: plannedTargetId,
          localDate: '2026-08-10'
        }),
        unplannedTarget: await window.myTracer.routines.getDayState({
          routineId: unplannedTargetId,
          localDate: '2026-08-10'
        }),
        unknown: await window.myTracer.routines.getDayState({
          routineId: unknownId,
          localDate: '2026-08-10'
        }),
        unplannedStates: await Promise.all(
          unplannedIds.map((routineId) =>
            window.myTracer.routines.getDayState({ routineId, localDate: '2026-08-10' })
          )
        )
      }),
      facts
    )
    expect(reopenedFacts.plannedTarget).toMatchObject({
      ok: true,
      value: {
        plannedByCurrentSchedule: true,
        recordState: 'target_met',
        record: { plannedForDate: true }
      }
    })
    expect(reopenedFacts.unplannedTarget).toMatchObject({
      ok: true,
      value: {
        plannedByCurrentSchedule: true,
        recordState: 'target_met',
        record: { plannedForDate: false }
      }
    })
    expect(reopenedFacts.unknown).toMatchObject({
      ok: true,
      value: { recordState: 'unknown', record: null }
    })
    expect(
      reopenedFacts.unplannedStates.map((result) => {
        if (!result.ok) throw new Error(result.error.message)
        expect(result.value.plannedByCurrentSchedule).toBe(true)
        return result.value.record
      })
    ).toEqual(facts.records.slice(4))
    expect(reopenedFacts.routines).toMatchObject({
      ok: true,
      value: expect.arrayContaining([
        expect.objectContaining({ id: facts.plannedTargetId, status: 'paused' }),
        expect.objectContaining({ id: facts.unplannedTargetId, status: 'ended' })
      ])
    })
    expect(reopenedFacts.today).toMatchObject({ ok: true })
    if (!reopenedFacts.today.ok) throw new Error(reopenedFacts.today.error.message)
    expect(reopenedFacts.today.value.plannedRoutines.map((routine) => routine.id)).not.toContain(
      facts.plannedTargetId
    )
    expect(reopenedFacts.today.value.plannedRoutines.map((routine) => routine.id)).not.toContain(
      facts.unplannedTargetId
    )

    await application.close()
    application = undefined
    const database = new Database(databasePath, { readonly: true })
    try {
      expect(database.prepare('SELECT COUNT(*) AS count FROM routine_records').get()).toEqual({
        count: 9
      })
      expect(
        database
          .prepare(
            'SELECT outcome, planned_for_date, duration_minutes FROM routine_records WHERE routine_id = ?'
          )
          .get(facts.unplannedTargetId)
      ).toEqual({ outcome: 'target_met', planned_for_date: 0, duration_minutes: 7 })
      expect(
        database
          .prepare('SELECT COUNT(*) AS count FROM routine_records WHERE routine_id = ?')
          .get(facts.unknownId)
      ).toEqual({ count: 0 })
    } finally {
      database.close()
    }
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
