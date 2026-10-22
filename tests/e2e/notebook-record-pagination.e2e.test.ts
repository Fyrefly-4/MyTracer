import { join } from 'node:path'
import { expect, test, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

test('notebook history paginates without changing full-range facts and retains return page', async () => {
  const root = await createTemporaryTestRoot()
  let application: ElectronApplication | undefined
  try {
    application = await electron.launch({
      cwd: root.root,
      args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
      env: minimalElectronEnvironment(root)
    })
    const page = await application.firstWindow()
    await page.evaluate(async () => {
      const action = await window.myTracer.actions.create({ title: '分页时不截断统计范围' })
      if (!action.ok) throw new Error(action.error.message)
      for (let day = 1; day <= 20; day++) {
        const result = await window.myTracer.dataControl.backfillActionRecord({
          actionId: action.value.id,
          occurredOn: `2026-08-${String(day).padStart(2, '0')}`,
          durationMinutes: 5,
          outcome: 'partial',
          understanding: `第 ${day} 次独立观察，不应因分页消失。`
        })
        if (!result.ok) throw new Error(result.error.message)
      }
    })
    await page.getByRole('button', { name: '进展', exact: true }).click()
    const rows = page.locator('.progress-history-table tbody > tr')
    const pager = page.getByLabel('进展记录分页')
    await expect(rows).toHaveCount(8)
    const summary = await page.getByLabel('进展汇总').innerText()
    await expect(page.getByLabel('进展汇总')).toContainText('100')
    await pager.getByRole('button', { name: '下一页' }).click()
    await expect(pager).toContainText('第 2 / 3 页')
    expect(await page.getByLabel('进展汇总').innerText()).toBe(summary)
    await rows.first().locator('summary').click()
    await expect(rows.first()).toContainText('第 12 次独立观察')
    await rows.first().getByRole('button', { name: '查看完整记录或修改' }).click()
    await expect(page.getByLabel('所选记录')).toContainText('2026-08-12')
    await page.getByRole('button', { name: '进展', exact: true }).click()
    await expect(pager).toContainText('第 2 / 3 页')
    await page.getByLabel('开始日期（包含）').fill('2026-08-19')
    await page.getByRole('button', { name: '查看记录', exact: true }).click()
    await expect(rows).toHaveCount(2)
    await expect(pager).toContainText('第 1 / 1 页')
    await expect(page.getByLabel('进展汇总')).toContainText('10')
  } finally {
    await application?.close().catch(() => undefined)
    await removeTemporaryTestRoot(root)
  }
})
