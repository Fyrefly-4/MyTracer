import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import {
  createTemporaryTestRoot,
  removeTemporaryTestRoot,
  type TemporaryTestRoot
} from '../support/temporary-test-root'

async function launch(root: TemporaryTestRoot) {
  return electron.launch({
    chromiumSandbox: true,
    cwd: root.root,
    args: [
      join(process.cwd(), 'out/main/index.js'),
      `--user-data-dir=${root.electronUserData}`,
      ...(process.platform === 'linux' ? ['--headless', '--ozone-platform=headless'] : [])
    ],
    env: minimalElectronEnvironment(root)
  })
}
const navigate = (page: Page, name: string) =>
  page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
const panel = (page: Page, name: string) => page.getByLabel(`${name} 例行记录`, { exact: true })
async function select(page: Page, name: string) {
  await page.locator('.goal-list-item').filter({ hasText: name }).click()
}
async function seed(page: Page) {
  return page.evaluate(async () => {
    const ids: string[] = []
    for (const name of ['零分钟例行', '三分钟例行', '空白例行']) {
      const result = await window.myTracer.routines.create({
        name,
        minimumAction: '一步',
        arrangementMode: 'unscheduled',
        weekdays: []
      })
      if (!result.ok) throw Error(result.error.message)
      ids.push(result.value.id)
    }
    return ids
  })
}

test('routine detail reads saved zero/three minute facts on return and restart without beginning another record', async () => {
  test.slow()
  const root = await createTemporaryTestRoot()
  let app: ElectronApplication | undefined
  try {
    app = await launch(root)
    let page = await app.firstWindow()
    await seed(page)
    await navigate(page, '例行')
    for (const [name, minutes] of [
      ['零分钟例行', '0'],
      ['三分钟例行', '3']
    ]) {
      await select(page, name)
      const current = panel(page, name)
      await current.getByRole('button', { name: '记录例行', exact: true }).click()
      await current.getByLabel('投入时长（分钟，可选）').fill(minutes)
      await current.getByRole('button', { name: '保存例行记录' }).click()
      await expect(current.locator('.routine-record-state')).toContainText(`${minutes} 分钟`)
      await navigate(page, '首页')
      await navigate(page, '例行')
      await expect(current.locator('.routine-record-state')).toContainText(`${minutes} 分钟`)
      await expect(current.getByRole('button', { name: '记录例行', exact: true })).toHaveCount(0)
    }
    await app.close()
    app = await launch(root)
    page = await app.firstWindow()
    await navigate(page, '例行')
    for (const [name, minutes] of [
      ['零分钟例行', '0'],
      ['三分钟例行', '3']
    ]) {
      await select(page, name)
      await expect(panel(page, name).locator('.routine-record-state')).toContainText(
        `${minutes} 分钟`
      )
    }
    await select(page, '空白例行')
    await expect(panel(page, '空白例行').locator('.routine-record-state')).toContainText('未记录')
    const data = await page.evaluate(() => window.myTracer.dataControl.list())
    expect(data).toMatchObject({ ok: true, value: { routineRecords: expect.any(Array) } })
    if (!data.ok) throw Error(data.error.message)
    expect(data.value.routineRecords).toHaveLength(2)
  } finally {
    await app?.close()
    await removeTemporaryTestRoot(root)
  }
})

async function controlReads(app: ElectronApplication) {
  await app.evaluate(({ ipcMain }) => {
    const handlers = Reflect.get(ipcMain, '_invokeHandlers') as Map<
      string,
      (...args: unknown[]) => unknown
    >
    const original = handlers.get('routine-records:get-day-state')!
    const control = {
      hold: '',
      fail: '',
      reject: '',
      pending: 0,
      release: () => {},
      dates: [] as unknown[]
    }
    Reflect.set(globalThis, '__routineReads', control)
    ipcMain.removeHandler('routine-records:get-day-state')
    ipcMain.handle('routine-records:get-day-state', async (...args) => {
      const input = args[1] as { routineId: string; localDate?: string }
      control.dates.push(input.localDate)
      if (control.fail === input.routineId) {
        control.fail = ''
        return {
          ok: false,
          error: { code: 'persistence-failed', message: 'Synthetic read failure' }
        }
      }
      if (control.reject === input.routineId) {
        control.reject = ''
        throw Error('Synthetic rejected read')
      }
      const result = await original(...args)
      if (control.hold === input.routineId) {
        control.hold = ''
        control.pending++
        await new Promise<void>((resolve) => {
          control.release = resolve
        })
        control.pending--
      }
      return result
    })
  })
}
async function configureRead(
  app: ElectronApplication,
  field: 'hold' | 'fail' | 'reject',
  id: string
) {
  await app.evaluate(
    (_electron, { field, id }) => {
      Reflect.get(globalThis, '__routineReads')[field] = id
    },
    { field, id }
  )
}
async function waitForRead(app: ElectronApplication) {
  await expect
    .poll(() => app.evaluate(() => Reflect.get(globalThis, '__routineReads').pending))
    .toBe(1)
}
async function releaseRead(app: ElectronApplication) {
  await app.evaluate(() => Reflect.get(globalThis, '__routineReads').release())
  await expect
    .poll(() => app.evaluate(() => Reflect.get(globalThis, '__routineReads').pending))
    .toBe(0)
}
async function setDate(app: ElectronApplication, day: number) {
  await app.evaluate((_electron, day) => {
    const real =
      (Reflect.get(globalThis, '__routineRealDate') as DateConstructor | undefined) ?? Date
    Reflect.set(globalThis, '__routineRealDate', real)
    Reflect.set(
      globalThis,
      'Date',
      new Proxy(real, {
        construct(target, args) {
          return Reflect.construct(target, args.length ? args : [2026, 7, day, 12])
        }
      })
    )
  }, day)
}

test('routine status distinguishes loading and failure, retries, and ignores a previous selection response', async () => {
  const root = await createTemporaryTestRoot()
  let app: ElectronApplication | undefined
  try {
    app = await launch(root)
    const page = await app.firstWindow()
    await setDate(app, 10)
    const ids = await seed(page)
    await page.evaluate(async (ids) => {
      for (const [index, durationMinutes] of [0, 3].entries()) {
        const result = await window.myTracer.dataControl.backfillRoutineRecord({
          routineId: ids[index],
          occurredOn: '2026-08-10',
          outcome: 'acted',
          plannedForDate: false,
          durationMinutes
        })
        if (!result.ok) throw Error(result.error.message)
      }
    }, ids)
    await controlReads(app)
    await navigate(page, '例行')
    await select(page, '空白例行')
    await configureRead(app, 'hold', ids[0])
    await select(page, '零分钟例行')
    await waitForRead(app)
    await expect(panel(page, '零分钟例行').getByRole('button', { name: /查看记录/ })).toHaveCount(0)
    await expect(panel(page, '零分钟例行').locator('.routine-record-state strong')).toHaveText(
      '正在读取记录…'
    )
    await expect(
      panel(page, '零分钟例行').getByRole('button', { name: '记录例行', exact: true })
    ).toHaveCount(0)
    await select(page, '三分钟例行')
    await expect(panel(page, '三分钟例行').locator('.routine-record-state')).toContainText('3 分钟')
    await releaseRead(app)
    await expect(panel(page, '三分钟例行').locator('.routine-record-state')).toContainText('3 分钟')
    await configureRead(app, 'fail', ids[0])
    await select(page, '零分钟例行')
    const current = panel(page, '零分钟例行')
    await expect(current.getByRole('alert')).toContainText('无法确认这一天是否已有记录')
    await expect(current.getByRole('button', { name: /查看记录/ })).toHaveCount(0)
    await expect(current.locator('.routine-record-state strong')).toHaveText('记录状态暂时无法读取')
    await expect(current.getByRole('button', { name: '记录例行', exact: true })).toHaveCount(0)
    await configureRead(app, 'reject', ids[0])
    await current.getByRole('button', { name: '重试读取记录' }).click()
    await expect(current.getByRole('alert')).toContainText('无法确认这一天是否已有记录')
    await current.getByRole('button', { name: '重试读取记录' }).click()
    await expect(current.locator('.routine-record-state')).toContainText('0 分钟')
    await expect(current.getByRole('alert')).toHaveCount(0)
    await select(page, '空白例行')
    const blank = panel(page, '空白例行')
    await expect(blank.getByRole('button', { name: '记录例行', exact: true })).toBeEnabled()
    await configureRead(app, 'hold', ids[2])
    await blank.getByRole('button', { name: '记录例行', exact: true }).click()
    await waitForRead(app)
    await expect(blank.getByLabel('投入时长（分钟，可选）')).toHaveCount(0)
    await expect(blank.getByRole('button', { name: '记录例行', exact: true })).toBeDisabled()
    await select(page, '三分钟例行')
    await releaseRead(app)
    await expect(panel(page, '三分钟例行').locator('.routine-record-state')).toContainText('3 分钟')
    await select(page, '空白例行')
    await expect(blank.getByRole('button', { name: '记录例行', exact: true })).toBeEnabled()
    await expect(blank.getByLabel('投入时长（分钟，可选）')).toHaveCount(0)

    const data = await page.evaluate(() => window.myTracer.dataControl.list())
    if (!data.ok) throw Error(data.error.message)
    expect(data.value.routineRecords).toHaveLength(2)
  } finally {
    await app?.close()
    await removeTemporaryTestRoot(root)
  }
})

test('day changes refresh idle facts while delayed reads preserve restored and actively edited inputs and their captured date', async () => {
  const root = await createTemporaryTestRoot()
  let app: ElectronApplication | undefined
  try {
    app = await launch(root)
    const page = await app.firstWindow()
    await setDate(app, 10)
    const ids = await seed(page)
    await page.evaluate(async (routineId) => {
      const result = await window.myTracer.dataControl.backfillRoutineRecord({
        routineId,
        occurredOn: '2026-08-10',
        outcome: 'acted',
        plannedForDate: false,
        durationMinutes: 0
      })
      if (!result.ok) throw Error(result.error.message)
    }, ids[0])
    await controlReads(app)
    await page.clock.install()
    await navigate(page, '例行')
    await select(page, '零分钟例行')
    const current = panel(page, '零分钟例行')
    await expect(current.locator('.routine-record-state')).toContainText('2026-08-10')
    await setDate(app, 11)
    await page.clock.fastForward(60_000)
    await expect(current.getByRole('button', { name: '记录例行', exact: true })).toBeVisible()
    await expect(current.locator('.routine-record-state strong')).toHaveText('未记录')
    await current.getByRole('button', { name: '记录例行', exact: true }).click()
    await current.getByLabel('投入时长（分钟，可选）').fill('7')
    await expect(current).toContainText('记录日期： 2026-08-11')
    await navigate(page, '首页')
    await configureRead(app, 'hold', ids[0])
    await navigate(page, '例行')
    await waitForRead(app)
    await expect(current.getByLabel('投入时长（分钟，可选）')).toHaveValue('7')
    await current.getByLabel('投入时长（分钟，可选）').fill('8')
    await current.getByLabel('本次结果').selectOption('target_met')
    await setDate(app, 12)
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await releaseRead(app)
    await expect(current.locator('.routine-record-state strong')).toHaveText('未记录')
    await expect(current.getByLabel('投入时长（分钟，可选）')).toHaveValue('8')
    await expect(current.getByLabel('本次结果')).toHaveValue('target_met')
    await expect(current).toContainText('记录日期： 2026-08-11')
    await current.getByRole('button', { name: '保存例行记录' }).click()
    await expect(current).toContainText('2026-08-12')
    // Cross-midnight handling still requires the existing explicit date choice.
    const data = await page.evaluate(() => window.myTracer.dataControl.list())
    if (!data.ok) throw Error(data.error.message)
    expect(data.value.routineRecords).toHaveLength(1)
  } finally {
    await app?.close()
    await removeTemporaryTestRoot(root)
  }
})
