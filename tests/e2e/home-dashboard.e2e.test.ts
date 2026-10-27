import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

test('home reads real records, routes without mutations and remembers both calendar preferences after restart', async () => {
  const root = await createTemporaryTestRoot()
  let app: Awaited<ReturnType<typeof electron.launch>> | undefined
  const launch = () =>
    electron.launch({
      cwd: root.root,
      args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
      env: minimalElectronEnvironment(root)
    })
  try {
    app = await launch()
    let page = await app.firstWindow()
    await expect(page.getByRole('heading', { name: '看看最近走到了哪里。' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '给想做的事留一页。' })).toBeVisible()
    await expect(page.getByRole('button', { name: '12 周', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await page.getByRole('navigation').getByRole('button', { name: '目标', exact: true }).click()
    const seeded = await page.evaluate(async () => {
      const goal = await window.myTracer.goals.create({
        name: '首页真实目标',
        initialNextAction: { title: '从首页继续行动' }
      })
      const today = await window.myTracer.today.get({})
      if (!goal.ok || !goal.value.currentNextActionId || !today.ok)
        throw new Error('seed goal failed')
      const record = await window.myTracer.dataControl.backfillActionRecord({
        actionId: goal.value.currentNextActionId,
        occurredOn: today.value.localDate,
        durationMinutes: 12,
        outcome: 'partial',
        summary: null,
        note: '真实记录片段，不是生成的摘要'
      })
      const routine = await window.myTracer.routines.create({
        arrangementMode: 'weekly' as const,
        name: '首页例行',
        minimumAction: '做一点',
        weekdays: [1, 2, 3, 4, 5, 6, 7]
      })
      if (!record.ok || !routine.ok) throw new Error('seed record failed')
      const rest = await window.myTracer.dataControl.backfillRoutineRecord({
        routineId: routine.value.id,
        occurredOn: today.value.localDate,
        outcome: 'intentional_rest',
        plannedForDate: true,
        summary: null,
        note: '今天主动休息'
      })
      if (!rest.ok) throw new Error('seed rest failed')
      return {
        goalId: goal.value.id,
        actionId: goal.value.currentNextActionId,
        today: today.value.localDate
      }
    })
    await page.getByRole('navigation').getByRole('button', { name: '首页', exact: true }).click()
    const card = page.getByRole('article', { name: '首页真实目标 概览' })
    await expect(card).toContainText('从首页继续行动')
    await expect(card).not.toContainText('真实记录片段，不是生成的摘要')
    await expect(
      page.getByRole('button', { name: `${seeded.today} · 2 条记录`, exact: true })
    ).toBeVisible()
    await page.getByRole('button', { name: `${seeded.today} · 2 条记录`, exact: true }).click()
    const day = page.getByRole('region', { name: `${seeded.today} 的记录`, exact: true })
    await expect(day.getByRole('button', { name: '行动记录 · 从首页继续行动' })).toBeVisible()
    await expect(day.getByRole('button', { name: '例行记录 · 首页例行' })).toBeVisible()
    await day.getByRole('button', { name: '行动记录 · 从首页继续行动' }).click()
    await expect(page.getByRole('heading', { name: '数据', exact: true })).toBeVisible()
    await expect(
      page
        .getByRole('region', { name: '所选记录', exact: true })
        .getByText('真实记录片段，不是生成的摘要', { exact: false })
    ).toBeVisible()
    await page.getByRole('navigation').getByRole('button', { name: '首页', exact: true }).click()
    await card.getByRole('button', { name: '去今天继续 →' }).click()
    await expect(page.getByLabel('从首页继续行动 行动详情')).toBeVisible()
    expect(
      await page.evaluate(async (id) => {
        const r = await window.myTracer.actions.getDetail({ actionId: id })
        return r.ok ? r.value.todayCommitment : 'error'
      }, seeded.actionId)
    ).toBeNull()
    await page.getByRole('navigation').getByRole('button', { name: '首页', exact: true }).click()
    await page.getByRole('button', { name: '半年', exact: true }).click()
    await page.getByRole('button', { name: '按条数', exact: true }).click()
    await page.getByRole('navigation').getByRole('button', { name: '今天', exact: true }).click()
    await page.getByRole('navigation').getByRole('button', { name: '首页', exact: true }).click()
    await expect(page.getByRole('button', { name: '半年', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await expect(page.getByRole('button', { name: '按条数', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await app.close()
    app = undefined
    app = await launch()
    page = await app.firstWindow()
    await expect(page.getByRole('heading', { name: '看看最近走到了哪里。' })).toBeVisible()
    await expect(page.getByRole('button', { name: '半年', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await expect(page.getByRole('button', { name: '按条数', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await expect(
      page.getByRole('button', { name: `${seeded.today} · 2 条记录`, exact: true })
    ).toBeVisible()
  } finally {
    try {
      await app?.close()
    } finally {
      await removeTemporaryTestRoot(root)
    }
  }
})

test('home calendar keeps stable square cells and usable navigation across window sizes and zoom', async () => {
  const root = await createTemporaryTestRoot()
  let app: Awaited<ReturnType<typeof electron.launch>> | undefined
  try {
    app = await electron.launch({
      cwd: root.root,
      args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
      env: minimalElectronEnvironment(root)
    })
    const page = await app.firstWindow()
    await expect(page.getByRole('heading', { name: '看看最近走到了哪里。' })).toBeVisible()
    for (const width of [820, 1024, 1440, 1920])
      for (const zoom of [1, 1.25, 1.5]) {
        await app.evaluate(
          ({ BrowserWindow }, { width, zoom }) => {
            const w = BrowserWindow.getAllWindows()[0]
            w.setContentSize(width, width === 820 ? 600 : 900)
            w.webContents.setZoomFactor(zoom)
          },
          { width, zoom }
        )
        let priorHeight: number | null = null
        for (const name of ['12 周', '半年']) {
          await page.getByRole('button', { name, exact: true }).click()
          const metrics = await page.locator('.home-record-calendar').evaluate((el) => {
            const cell = el.querySelector('.hrc-cell')!.getBoundingClientRect()
            const grid = getComputedStyle(el.querySelector('.hrc-grid')!)
            return {
              width: cell.width,
              height: cell.height,
              rowGap: grid.rowGap,
              columnGap: grid.columnGap,
              outerHeight: el.getBoundingClientRect().height,
              overflow: document.documentElement.scrollWidth > window.innerWidth
            }
          })
          expect(Math.abs(metrics.width - metrics.height)).toBeLessThan(1)
          expect(metrics.rowGap).toBe(metrics.columnGap)
          expect(metrics.overflow).toBe(false)
          if (priorHeight !== null)
            expect(Math.abs(metrics.outerHeight - priorHeight)).toBeLessThan(2)
          priorHeight = metrics.outerHeight
        }
        await page
          .getByRole('navigation')
          .getByRole('button', { name: '今天', exact: true })
          .click()
        await expect(page.getByRole('heading', { name: '今天', exact: true })).toBeVisible()
        await page
          .getByRole('navigation')
          .getByRole('button', { name: '首页', exact: true })
          .click()
      }
  } finally {
    try {
      await app?.close()
    } finally {
      await removeTemporaryTestRoot(root)
    }
  }
})

test('home distinguishes failed reads from empty records and safely recovers invalid calendar preferences', async () => {
  const root = await createTemporaryTestRoot()
  let app: Awaited<ReturnType<typeof electron.launch>> | undefined
  try {
    app = await electron.launch({
      cwd: root.root,
      args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
      env: minimalElectronEnvironment(root)
    })
    const page = await app.firstWindow()
    await expect(page.getByRole('button', { name: '12 周', exact: true })).toBeVisible()
    await page.evaluate(() =>
      localStorage.setItem('mytracer.home.calendar.v1', '{"weeks":999,"intensity":"yes"}')
    )
    await page.reload()
    await expect(page.getByRole('button', { name: '12 周', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await expect(page.getByRole('button', { name: '有记录', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('home:get')
      ipcMain.handle('home:get', () => ({
        ok: false,
        error: { code: 'persistence-failed', message: 'isolated fixture error' }
      }))
    })
    await page.getByRole('navigation').getByRole('button', { name: '目标', exact: true }).click()
    await page.getByRole('navigation').getByRole('button', { name: '首页', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('历史记录暂时无法读取')
    await expect(page.locator('.hrc-cell')).toHaveCount(0)
    await expect(page.getByText('这里按日期留下最近的记录。')).toHaveCount(0)
    await expect(page.getByText('目标概览暂时不可用。', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '重新读取', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('历史记录暂时无法读取')
    await page.getByRole('navigation').getByRole('button', { name: '今天', exact: true }).click()
    await expect(page.getByRole('heading', { name: '今天', exact: true })).toBeVisible()
  } finally {
    try {
      await app?.close()
    } finally {
      await removeTemporaryTestRoot(root)
    }
  }
})

test('Home calendar requests bounded day pages and reports day-query failure without an empty-state lie', async () => {
  const root = await createTemporaryTestRoot()
  let app: Awaited<ReturnType<typeof electron.launch>> | undefined
  try {
    app = await electron.launch({
      cwd: root.root,
      args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
      env: minimalElectronEnvironment(root)
    })
    const page = await app.firstWindow()
    const today = await page.evaluate(async () => {
      const date = await window.myTracer.today.get({})
      const goal = await window.myTracer.goals.create({
        name: '分页验证',
        initialNextAction: { title: '实际记录' }
      })
      if (!date.ok || !goal.ok || !goal.value.currentNextActionId) throw new Error('seed failed')
      for (let index = 0; index < 11; index++) {
        const result = await window.myTracer.dataControl.backfillActionRecord({
          actionId: goal.value.currentNextActionId,
          occurredOn: date.value.localDate,
          outcome: 'partial',
          durationMinutes: 0,
          summary: null,
          note: `记录 ${index}`
        })
        if (!result.ok) throw new Error('record failed')
      }
      return date.value.localDate
    })
    await page.reload()
    await page.getByRole('button', { name: `${today} · 11 条记录`, exact: true }).click()
    const day = page.getByRole('region', { name: `${today} 的记录`, exact: true })
    await expect(day.locator('li')).toHaveCount(10)
    await day.getByRole('button', { name: '下一页', exact: true }).click()
    await expect(day.locator('li')).toHaveCount(1)
    await expect(day).toContainText('第 2 / 2 页')
    await app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('home:day')
      ipcMain.handle('home:day', () => ({
        ok: false,
        error: { code: 'persistence-failed', message: 'isolated test' }
      }))
    })
    await day.getByRole('button', { name: '上一页', exact: true }).click()
    await expect(day.getByRole('alert')).toContainText('当日记录暂时无法读取')
    await expect(day).not.toContainText('这一天暂时没有留下记录')
  } finally {
    await app?.close()
    await removeTemporaryTestRoot(root)
  }
})
