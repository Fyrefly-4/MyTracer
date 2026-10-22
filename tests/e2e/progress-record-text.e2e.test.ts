import { join } from 'node:path'
import { expect, test, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

test('Progress reads original optional text without changing statistics or current plans', async () => {
  test.skip(process.platform !== 'win32', 'Requires the supported Windows Electron environment')
  const root = await createTemporaryTestRoot()
  let app: ElectronApplication | undefined
  try {
    app = await electron.launch({
      chromiumSandbox: true,
      cwd: root.root,
      args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
      env: minimalElectronEnvironment(root)
    })
    const page = await app.firstWindow()
    const seed = await page.evaluate(async () => {
      const goal = await window.myTracer.goals.create({
        name: '合成文字回看',
        initialNextAction: { title: '当下的小行动' }
      })
      if (!goal.ok || !goal.value.currentNextActionId) throw Error('goal')
      const note = Array.from(
        { length: 12 },
        (_, i) => `第${i + 1}行：换成纸笔后顺了。${'很长的连续文字'.repeat(20)}`
      ).join('\n')
      const nextStep = '下次只重做例题二\n不安排日期，也不改当前计划'
      const ids: string[] = []
      for (let day = 1; day <= 10; day++) {
        const record = await window.myTracer.dataControl.backfillActionRecord({
          actionId: goal.value.currentNextActionId,
          occurredOn: `2026-08-${String(day).padStart(2, '0')}`,
          durationMinutes: 5,
          outcome: 'partial',
          note: day === 10 ? note : null,
          nextStep: day === 9 ? nextStep : null
        })
        if (!record.ok) throw Error('record')
        ids.push(record.value.id)
      }
      return { goalId: goal.value.id, note, nextStep, recordId: ids[9]! }
    })
    const before = await page.evaluate(() => window.myTracer.dataControl.list())
    await page.getByRole('navigation').getByRole('button', { name: '进展', exact: true }).click()
    const rows = page.locator('.progress-history-table tbody > tr')
    await expect(rows).toHaveCount(8)
    const summary = await page.getByLabel('进展汇总').innerText()
    const noteRow = rows.filter({ hasText: '2026-08-10' })
    const nextRow = rows.filter({ hasText: '2026-08-09' })
    await expect(noteRow.locator('details')).not.toHaveAttribute('open')
    await expect(nextRow.locator('details')).not.toHaveAttribute('open')
    await expect(rows.filter({ hasText: '2026-08-08' }).locator('details')).toHaveCount(0)
    await noteRow.locator('summary').focus()
    await noteRow.locator('summary').press('Enter')
    await expect(noteRow.locator('.progress-fact-group p')).toHaveText(seed.note)
    await nextRow.locator('summary').click()
    await expect(nextRow.locator('.progress-fact-group p')).toHaveText(seed.nextStep)
    await expect(nextRow).toContainText('这是当时写下的内容，不代表当前计划。')
    for (const width of [1440, 820]) {
      await page.setViewportSize({ width, height: 650 })
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
      ).toBe(true)
    }
    await page.getByLabel('进展记录分页').getByRole('button', { name: '下一页' }).click()
    await expect(rows).toHaveCount(2)
    expect(await page.getByLabel('进展汇总').innerText()).toBe(summary)
    expect(await page.evaluate(() => window.myTracer.dataControl.list())).toEqual(before)
    await page.getByLabel('目标（可选）').selectOption(seed.goalId)
    await page.getByLabel('开始日期（包含）').fill('2026-08-09')
    await page.getByLabel('结束日期（包含）').fill('2026-08-10')
    await page.getByRole('button', { name: '查看记录', exact: true }).click()
    await expect(rows).toHaveCount(2)
    await expect(page.getByLabel('进展汇总')).toContainText('10')
    const edit = await page.evaluate(
      async ({ recordId }) =>
        window.myTracer.dataControl.updateActionRecord({
          recordId,
          occurredOn: '2026-08-10',
          durationMinutes: 5,
          outcome: 'partial',
          note: '修改后的原文\n仍保留换行',
          nextStep: null
        }),
      seed
    )
    expect(edit.ok).toBe(true)
    await page.getByRole('button', { name: '查看记录', exact: true }).click()
    await noteRow.locator('summary').click()
    await expect(noteRow.locator('.progress-fact-group p')).toHaveText('修改后的原文\n仍保留换行')
    await expect(page.getByLabel('进展汇总')).toContainText('10')
    const goal = await page.evaluate(
      async (goalId) => window.myTracer.goals.getDetail({ goalId }),
      seed.goalId
    )
    if (!goal.ok) throw Error('goal detail')
    expect(goal.value.actions).toHaveLength(1)
    expect(goal.value.currentNextActionId).toBe(goal.value.actions[0].id)
  } finally {
    await app?.close()
    await removeTemporaryTestRoot(root)
  }
})

test('Progress fetches text only on demand and isolates retry, collapse and refresh responses', async () => {
  test.skip(process.platform !== 'win32', 'Requires the supported Windows Electron environment')
  const root = await createTemporaryTestRoot()
  let app: ElectronApplication | undefined
  try {
    app = await electron.launch({
      chromiumSandbox: true,
      cwd: root.root,
      args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
      env: minimalElectronEnvironment(root)
    })
    const page = await app.firstWindow()
    const detail = await page.evaluate(async () => {
      const action = await window.myTracer.actions.create({ title: '按需读取样例' })
      if (!action.ok) throw Error('action')
      let id = ''
      for (const day of [1, 2]) {
        const record = await window.myTracer.dataControl.backfillActionRecord({
          actionId: action.value.id,
          occurredOn: `2026-08-0${day}`,
          durationMinutes: 5,
          outcome: 'partial',
          note: day === 2 ? '原始备注' : null,
          understanding: '已有理解不等待原文'
        })
        if (!record.ok) throw Error('record')
        if (day === 2) id = record.value.id
      }
      const result = await window.myTracer.records.getDetail({ recordId: id })
      if (!result.ok) throw Error('detail')
      return result.value
    })
    await app.evaluate(({ ipcMain }, detail) => {
      const state = { calls: 0, mode: 'hold', pending: [] as Array<() => void> }
      Reflect.set(globalThis, '__progressTextRead', state)
      ipcMain.removeHandler('records:get-detail')
      ipcMain.handle('records:get-detail', () => {
        state.calls++
        if (state.mode === 'hold')
          return new Promise((resolve) =>
            state.pending.push(() =>
              resolve({ ok: true, value: { ...detail, note: '迟到旧原文' } })
            )
          )
        if (state.mode === 'fail')
          return { ok: false, error: { code: 'persistence-failed', message: 'synthetic' } }
        if (state.mode === 'reject') throw Error('synthetic rejection')
        if (state.mode === 'missing')
          return { ok: false, error: { code: 'not-found', message: 'synthetic' } }
        return {
          ok: true,
          value: {
            ...detail,
            id: state.mode === 'wrong' ? 'another-record' : detail.id,
            note: state.mode === 'empty' ? null : '新读取原文'
          }
        }
      })
    }, detail)
    const mode = (value: string) =>
      app!.evaluate((_electron, value) => {
        Reflect.get(globalThis, '__progressTextRead').mode = value
      }, value)
    const calls = () =>
      app!.evaluate(() => Reflect.get(globalThis, '__progressTextRead').calls as number)
    const release = async () => {
      await app!.evaluate(() => {
        for (const resolve of Reflect.get(globalThis, '__progressTextRead').pending.splice(0))
          resolve()
      })
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
      )
    }
    await page.getByRole('navigation').getByRole('button', { name: '进展', exact: true }).click()
    const rows = page.locator('.progress-history-table tbody > tr')
    await expect(rows).toHaveCount(2)
    expect(await calls()).toBe(0)
    const insights = rows.filter({ hasText: '2026-08-01' })
    await insights.locator('summary').click()
    await expect(insights).toContainText('已有理解不等待原文')
    expect(await calls()).toBe(0)
    const row = rows.filter({ hasText: '2026-08-02' })
    await row.locator('summary').click()
    await expect(row.getByRole('status')).toContainText('正在读取原文')
    await expect(row).toContainText('已有理解不等待原文')
    await expect.poll(calls).toBe(1)
    await row.locator('summary').click()
    await mode('ready')
    await row.locator('summary').click()
    await expect(row.getByLabel('行动补充原文').locator('.progress-fact-group p')).toHaveText(
      '新读取原文'
    )
    await release()
    await expect(row).not.toContainText('迟到旧原文')
    await row.locator('summary').click()
    await mode('hold')
    await row.locator('summary').click()
    await expect.poll(calls).toBe(3)
    await page.getByRole('button', { name: '查看记录', exact: true }).click()
    await expect(row.locator('details')).not.toHaveAttribute('open')
    await release()
    await expect(row).not.toContainText('迟到旧原文')
    expect(await calls()).toBe(3)
    await mode('fail')
    await row.locator('summary').click()
    await expect(row.getByRole('status')).toContainText('不表示没有补充文字')
    await mode('hold')
    const retry = row.getByRole('button', { name: '重新读取原文' })
    await retry.focus()
    await retry.press('Enter')
    await expect(retry).toHaveAttribute('aria-disabled', 'true')
    await expect.poll(calls).toBe(5)
    const pendingCount = await calls()
    await retry.press('Enter')
    expect(await calls()).toBe(pendingCount)
    await row.locator('summary').click()
    await release()
    for (const [value, message] of [
      ['reject', '不表示没有补充文字'],
      ['missing', '这条记录已不存在'],
      ['wrong', '记录内容已变化或不匹配'],
      ['empty', '当前没有补充文字']
    ]) {
      await mode(value)
      await row.locator('summary').click()
      await expect(row).toContainText(message)
      await expect(row.getByLabel('行动补充原文').locator('.progress-fact-group')).toHaveCount(0)
      await row.locator('summary').click()
    }
    await mode('ready')
    await row.locator('summary').click()
    await expect(row.getByLabel('行动补充原文').locator('.progress-fact-group p')).toHaveText(
      '新读取原文'
    )
  } finally {
    await app?.close()
    await removeTemporaryTestRoot(root)
  }
})
