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
    expect(await noteRow.locator('.progress-fact-group p').innerText()).toBe(seed.note)
    await nextRow.locator('summary').click()
    expect(await nextRow.locator('.progress-fact-group p').innerText()).toBe(seed.nextStep)
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
    expect(await noteRow.locator('.progress-fact-group p').innerText()).toBe(
      '修改后的原文\n仍保留换行'
    )
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
