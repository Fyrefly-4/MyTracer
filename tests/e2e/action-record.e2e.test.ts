import { openRecordNote } from '../support/ui-disclosure'
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

async function launchApplication(
  root: TemporaryTestRoot,
  environment: Record<string, string> = minimalElectronEnvironment(root)
): Promise<ElectronApplication> {
  return electron.launch({
    cwd: root.root,
    args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
    env: environment
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

test('saves quick and deep records without a Today prerequisite and preserves them on reopen', async () => {
  test.slow()
  const root = await createTemporaryTestRoot()
  const databasePath = join(root.electronUserData, 'data', 'mytracer.sqlite3')
  let application: ElectronApplication | undefined

  try {
    application = await launchApplication(root)
    let page = await application.firstWindow()
    const actionId = await page.evaluate(async () => {
      const created = await window.myTracer.goals.create({
        name: '记录真实学习',
        initialNextAction: { title: '阅读状态管理示例' }
      })
      if (!created.ok || !created.value.currentNextAction) throw new Error('Goal setup failed.')
      return created.value.currentNextAction.id
    })
    await page.reload()
    await page.getByRole('navigation').getByRole('button', { name: '今天', exact: true }).click()

    expect(await page.evaluate(() => window.myTracer.today.get({}))).toMatchObject({
      ok: true,
      value: { focuses: [] }
    })

    await page.getByRole('button', { name: /阅读状态管理示例.*待行动/ }).click()
    const panel = page.getByLabel('阅读状态管理示例 行动记录')
    await panel.getByRole('button', { name: '开始记录' }).click()
    await panel.getByLabel('投入时长（分钟，可选）').fill('0')
    await panel.getByLabel('本次结果').selectOption('partial')
    await panel.getByRole('button', { name: '保存记录' }).click()
    await expect(
      panel
        .getByRole('table', { name: '已有行动记录' })
        .getByRole('row')
        .filter({ hasText: '本次完成一部分' })
    ).toContainText('少于 1 分钟')
    await expect(panel.getByRole('button', { name: /本次完成一部分.*查看记录/ })).toBeVisible()
    await expect(page.getByText('待行动', { exact: true }).first()).toBeVisible()

    await panel.getByRole('button', { name: '开始记录' }).click()
    await panel.getByLabel('投入时长（分钟，可选）').fill('25')
    await panel.getByLabel('本次结果').selectOption('stopped')
    await panel.getByRole('button', { name: /添加理解/ }).click()
    await panel.getByLabel('我理解了（可选）').fill('状态归属应保持单一')
    await panel.getByLabel('我仍困惑（可选）').fill('错误边界如何呈现')
    await panel.getByLabel('记录中的下一步（可选）').fill('写一个边界测试')
    await openRecordNote(panel.getByLabel('备注（可选）'))
    await panel.getByLabel('备注（可选）').fill('先保存事实，再决定状态')
    await panel.getByRole('button', { name: '调整行动状态或当前下一步（可选）' }).click()
    await panel.getByLabel('保存记录后').selectOption('complete')
    await panel.getByLabel('当前下一步处理').selectOption('recorded-next')
    await panel.getByRole('button', { name: '保存记录' }).click()
    await expect(panel.getByText('状态归属应保持单一')).toBeVisible()
    await expect(panel.getByText('错误边界如何呈现')).toBeVisible()
    await expect(page.getByText('已完成', { exact: true }).first()).toBeVisible()

    const beforeReopen = await page.evaluate(async (id) => {
      const records = await window.myTracer.records.listForAction({ actionId: id })
      if (!records.ok || records.value.length !== 2) throw new Error('Records were not listed.')
      const detail = await window.myTracer.records.getDetail({ recordId: records.value[0].id })
      const goal = await window.myTracer.goals.list({ status: 'active' })
      if (!goal.ok || goal.value.length !== 1) throw new Error('Goal was not listed.')
      const goalDetail = await window.myTracer.goals.getDetail({ goalId: goal.value[0].id })
      return { records, detail, goalDetail }
    }, actionId)
    expect(beforeReopen).toMatchObject({
      records: {
        ok: true,
        value: [
          { durationMinutes: 25, outcome: 'stopped', nextStep: '写一个边界测试' },
          { durationMinutes: 0, outcome: 'partial' }
        ]
      },
      detail: {
        ok: true,
        value: {
          understandings: [{ text: '状态归属应保持单一', source: 'manual' }],
          confusions: [{ text: '错误边界如何呈现', status: 'open' }]
        }
      },
      goalDetail: {
        ok: true,
        value: { currentNextAction: { title: '写一个边界测试', status: 'pending' } }
      }
    })

    await application.close()
    application = undefined
    application = await launchApplication(root)
    page = await application.firstWindow()
    const afterReopen = await page.evaluate(async (id) => {
      const records = await window.myTracer.records.listForAction({ actionId: id })
      if (!records.ok) throw new Error('Records were not reopened.')
      return Promise.all(
        records.value.map((record) => window.myTracer.records.getDetail({ recordId: record.id }))
      )
    }, actionId)
    expect(afterReopen).toHaveLength(2)
    expect(afterReopen.every((result) => result.ok)).toBe(true)

    await application.close()
    application = undefined
    const database = new Database(databasePath, { readonly: true })
    try {
      expect(
        database
          .prepare('SELECT duration_minutes, outcome FROM action_records ORDER BY created_at, id')
          .all()
      ).toEqual([
        { duration_minutes: 0, outcome: 'partial' },
        { duration_minutes: 25, outcome: 'stopped' }
      ])
      expect(database.prepare('SELECT source FROM understandings').get()).toEqual({
        source: 'manual'
      })
      expect(database.prepare('SELECT status FROM confusions').get()).toEqual({ status: 'open' })
      expect(
        database.prepare('SELECT title, status FROM actions WHERE id = ?').get(actionId)
      ).toEqual({
        title: '阅读状态管理示例',
        status: 'completed'
      })
    } finally {
      database.close()
    }
  } finally {
    await application?.close()
    await removeTemporaryTestRoot(root)
  }
})

test('requires an explicit midnight choice and invalidates cancelled/reloaded contexts', async () => {
  const root = await createTemporaryTestRoot()
  let application: ElectronApplication | undefined

  try {
    application = await launchApplication(root)
    const page = await application.firstWindow()
    const localMidnight = new Date(2026, 7, 13, 0, 0, 0, 0).getTime()
    await setMainProcessDate(application, new Date(localMidnight - 60_000).toISOString())
    const midnightContext = await page.evaluate(async () => {
      const action = await window.myTracer.actions.create({ title: '跨午夜保存' })
      if (!action.ok) throw new Error('Midnight Action setup failed.')
      const context = await window.myTracer.records.begin({ actionId: action.value.id })
      if (!context.ok) throw new Error('Midnight context setup failed.')
      return context.value
    })
    expect(midnightContext.capturedOn).toBe('2026-08-12')
    await setMainProcessDate(application, new Date(localMidnight + 60_000).toISOString())
    const confirmation = await page.evaluate(
      ({ actionId, recordingContextId }) =>
        window.myTracer.records.record({
          actionId,
          recordingContextId,
          durationMinutes: 1,
          outcome: 'partial'
        }),
      midnightContext
    )
    expect(confirmation).toEqual({
      ok: true,
      value: {
        kind: 'date-confirmation-required',
        capturedOn: '2026-08-12',
        currentLocalDate: '2026-08-13'
      }
    })
    expect(
      await page.evaluate(
        (actionId) => window.myTracer.records.listForAction({ actionId }),
        midnightContext.actionId
      )
    ).toMatchObject({ ok: true, value: [] })
    expect(
      await page.evaluate(
        ({ actionId, recordingContextId }) =>
          window.myTracer.records.record({
            actionId,
            recordingContextId,
            dateChoice: 'use-current-on',
            durationMinutes: 1,
            outcome: 'partial'
          }),
        midnightContext
      )
    ).toMatchObject({
      ok: true,
      value: { kind: 'saved', record: { occurredOn: '2026-08-13' } }
    })

    const cancelledContext = await page.evaluate(async () => {
      const action = await window.myTracer.actions.create({ title: '取消即失效' })
      if (!action.ok) throw new Error('Cancelled Action setup failed.')
      const context = await window.myTracer.records.begin({ actionId: action.value.id })
      if (!context.ok) throw new Error('Cancelled context setup failed.')
      const cancelled = await window.myTracer.records.cancel({
        recordingContextId: context.value.recordingContextId
      })
      if (!cancelled.ok) throw new Error('Context cancellation failed.')
      return { actionId: action.value.id, recordingContextId: context.value.recordingContextId }
    })
    expect(
      await page.evaluate(
        (input) =>
          window.myTracer.records.record({ ...input, durationMinutes: 2, outcome: 'partial' }),
        cancelledContext
      )
    ).toMatchObject({ ok: false, error: { code: 'invalid-recording-context' } })

    const reloadContext = await page.evaluate(async () => {
      const action = await window.myTracer.actions.create({ title: '刷新即失效' })
      if (!action.ok) throw new Error('Reload Action setup failed.')
      const context = await window.myTracer.records.begin({ actionId: action.value.id })
      if (!context.ok) throw new Error('Reload context setup failed.')
      return { actionId: action.value.id, recordingContextId: context.value.recordingContextId }
    })
    await page.reload()
    const afterReload = await page.evaluate(
      (input) =>
        window.myTracer.records.record({ ...input, durationMinutes: 3, outcome: 'stopped' }),
      reloadContext
    )
    expect(afterReload).toMatchObject({ ok: false, error: { code: 'invalid-recording-context' } })
    expect(
      await page.evaluate(
        (actionId) => window.myTracer.records.listForAction({ actionId }),
        reloadContext.actionId
      )
    ).toMatchObject({
      ok: true,
      value: []
    })
  } finally {
    await application?.close()
    await removeTemporaryTestRoot(root)
  }
})
