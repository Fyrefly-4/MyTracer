import { openManagement, openActionCreate } from '../support/ui-disclosure'
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
  controlledInstant: string
): Promise<void> {
  await application.evaluate((_electron, instant) => {
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
          return Reflect.construct(target, argumentsList.length ? argumentsList : [instant])
        }
      })
    )
  }, controlledInstant)
}

test('completes AC-04 with a generic intention, explicit conversion, and no silent facts', async () => {
  test.slow()
  const root = await createTemporaryTestRoot()
  const databasePath = join(root.electronUserData, 'data', 'mytracer.sqlite3')
  const firstDayInstant = new Date(2026, 7, 16, 12, 0, 0, 0).toISOString()
  const nextDayInstant = new Date(2026, 7, 17, 12, 0, 0, 0).toISOString()
  const title = '今晚看一集动画（如果想看）'
  let application: ElectronApplication | undefined

  try {
    application = await launchApplication(root)
    await setMainProcessDate(application, firstDayInstant)
    let page = await application.firstWindow()
    await page.reload()
    await page.getByRole('button', { name: '今天', exact: true }).click()

    await openActionCreate(page)
    const createForm = page.locator('form.goal-create')
    await createForm.getByLabel('行动标题').fill(title)
    await createForm.getByRole('button', { name: '创建行动' }).click()
    const detail = page.getByLabel(`${title} 行动详情`)
    await expect(detail).toBeVisible()
    await openManagement(detail, '行动')
    await detail.getByRole('button', { name: '加入今日意向' }).click()

    await expect(page.getByRole('heading', { name: '今天也想做，但不构成承诺' })).toBeVisible()
    await expect(page.locator('.intention-row').filter({ hasText: title })).toBeVisible()
    await expect(
      page.locator('.focus-row:not(.intention-row)').filter({ hasText: title })
    ).toHaveCount(0)
    await expect(detail).toContainText('未发生不会产生失败或记录')

    const firstDayFacts = await page.evaluate(async () => {
      const today = await window.myTracer.today.get({})
      if (!today.ok) throw new Error(today.error.message)
      const intention = today.value.intentions[0]
      const conflict = await window.myTracer.today.selectAction({ actionId: intention.id })
      const afterConflict = await window.myTracer.today.get({})
      const progress = await window.myTracer.progress.get({})
      return { actionId: intention.id, conflict, afterConflict, progress }
    })
    expect(firstDayFacts.conflict).toMatchObject({
      ok: false,
      error: { code: 'selection-conflict' }
    })
    expect(firstDayFacts.afterConflict).toMatchObject({
      ok: true,
      value: {
        focuses: [],
        intentions: [
          expect.objectContaining({
            id: firstDayFacts.actionId,
            commitment: 'intention',
            selectedForToday: false,
            todayCommitment: 'intention'
          })
        ]
      }
    })
    expect(firstDayFacts.progress).toMatchObject({
      ok: true,
      value: { totalDurationMinutes: 0, realActionCount: 0, records: [] }
    })

    await detail.getByRole('button', { name: '改为今日重点' }).click()
    await expect(
      page.locator('.focus-row:not(.intention-row)').filter({ hasText: title })
    ).toBeVisible()
    await detail.getByRole('button', { name: '改为今日意向' }).click()
    await expect(page.locator('.intention-row').filter({ hasText: title })).toBeVisible()

    await application.close()
    application = undefined
    const firstDatabase = new Database(databasePath, { readonly: true })
    try {
      expect(firstDatabase.prepare('SELECT goal_id, status FROM actions').get()).toEqual({
        goal_id: null,
        status: 'pending'
      })
      expect(
        firstDatabase.prepare('SELECT selected_for, kind FROM today_selections').all()
      ).toEqual([{ selected_for: '2026-08-16', kind: 'intention' }])
      expect(firstDatabase.prepare('SELECT COUNT(*) AS count FROM action_records').get()).toEqual({
        count: 0
      })
    } finally {
      firstDatabase.close()
    }

    application = await launchApplication(root)
    await setMainProcessDate(application, nextDayInstant)
    page = await application.firstWindow()
    await page.reload()
    await page.getByRole('button', { name: '今天', exact: true }).click()
    await expect(page.locator('.intention-row').filter({ hasText: title })).toHaveCount(0)
    await expect(page.locator('.intention-card')).toHaveCount(0)

    const nextDayFacts = await page.evaluate(async () => ({
      today: await window.myTracer.today.get({}),
      progress: await window.myTracer.progress.get({})
    }))
    expect(nextDayFacts.today).toMatchObject({
      ok: true,
      value: { localDate: '2026-08-17', focuses: [], intentions: [] }
    })
    expect(nextDayFacts.progress).toMatchObject({
      ok: true,
      value: { totalDurationMinutes: 0, realActionCount: 0, records: [] }
    })

    await page.getByRole('button', { name: new RegExp(title) }).click()
    const reopenedDetail = page.getByLabel(`${title} 行动详情`)
    await openManagement(reopenedDetail, '行动')
    await reopenedDetail.getByRole('button', { name: '加入今日意向' }).click()
    await reopenedDetail.getByRole('button', { name: '开始记录' }).click()
    await reopenedDetail.getByLabel('投入时长（分钟，必填）').fill('5')
    await reopenedDetail.getByRole('button', { name: '保存记录' }).click()
    const recordList = reopenedDetail.getByLabel('行动记录列表')
    await expect(recordList.getByRole('button')).toHaveCount(1)
    await expect(recordList).toContainText('2026-08-17')
    await expect(recordList).toContainText('5 分钟')

    expect(await page.evaluate(() => window.myTracer.progress.get({}))).toMatchObject({
      ok: true,
      value: { totalDurationMinutes: 5, realActionCount: 1, records: [expect.any(Object)] }
    })

    await application.close()
    application = undefined
    const finalDatabase = new Database(databasePath, { readonly: true })
    try {
      expect(
        finalDatabase
          .prepare('SELECT selected_for, kind FROM today_selections ORDER BY selected_for')
          .all()
      ).toEqual([
        { selected_for: '2026-08-16', kind: 'intention' },
        { selected_for: '2026-08-17', kind: 'intention' }
      ])
      expect(
        finalDatabase.prepare('SELECT occurred_on, duration_minutes FROM action_records').all()
      ).toEqual([{ occurred_on: '2026-08-17', duration_minutes: 5 }])
    } finally {
      finalDatabase.close()
    }
  } finally {
    await application?.close()
    await removeTemporaryTestRoot(root)
  }
})
