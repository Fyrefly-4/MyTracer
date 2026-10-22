import { join } from 'node:path'
import { expect, test, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

test('goal search survives a record round trip, missing results and deletion; explicit navigation clears it', async () => {
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
    const seeded = await page.evaluate(async () => {
      for (let index = 1; index <= 8; index++) {
        const goal = await window.myTracer.goals.create({
          name: `搜索往返目标${index}`,
          initialNextAction: { title: `搜索往返行动${index}` }
        })
        if (!goal.ok || !goal.value.currentNextActionId) throw Error('seed goal')
        const record = await window.myTracer.dataControl.backfillActionRecord({
          actionId: goal.value.currentNextActionId,
          occurredOn: `2026-08-${10 + index}`,
          durationMinutes: index,
          outcome: 'partial',
          note: `搜索往返记录${index}`
        })
        if (!record.ok) throw Error('seed record')
      }
      const goals = await window.myTracer.goals.list({ status: null })
      if (!goals.ok || goals.value.length !== 8) throw Error('seed list')
      return { outside: goals.value[7]! }
    })
    const nav = (name: string) =>
      page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
    const search = page.getByRole('textbox', { name: '搜索目标', exact: true })
    const items = page.locator('.goal-workspace .goal-list-item')
    const title = page.locator('.goal-detail h2').first()
    await nav('目标')
    await expect(items).toHaveCount(6)
    await expect(items.filter({ hasText: seeded.outside.name })).toHaveCount(0)
    await search.fill(seeded.outside.name)
    await expect(items).toHaveCount(1)
    await items.first().click()
    await expect(title).toHaveText(seeded.outside.name)
    const before = await page.evaluate(() => window.myTracer.dataControl.list())
    const record = page.getByRole('table', { name: '已有目标记录' }).getByRole('button').first()
    await record.focus()
    await record.press('Enter')
    await expect(page.getByLabel('所选记录', { exact: true })).toContainText('搜索往返记录')
    await nav('目标')
    await expect(search).toHaveValue(seeded.outside.name)
    await expect(items).toHaveCount(1)
    await expect(title).toHaveText(seeded.outside.name)
    expect(await page.evaluate(() => window.myTracer.dataControl.list())).toEqual(before)

    await search.fill('没有匹配的合成关键词')
    await expect(items).toHaveCount(0)
    await nav('数据')
    await nav('目标')
    await expect(search).toHaveValue('没有匹配的合成关键词')
    await expect(items).toHaveCount(0)

    await nav('首页')
    const overview = page
      .getByRole('article')
      .filter({ has: page.getByRole('button', { name: '查看目标 ↗' }) })
      .first()
    const explicitName = await overview.locator('h3').innerText()
    await overview.getByRole('button', { name: '查看目标 ↗' }).click()
    await expect(search).toHaveValue('')
    await expect(title).toHaveText(explicitName)

    await search.fill(seeded.outside.name)
    await expect(items).toHaveCount(1)
    await items.first().click()
    await nav('数据')
    await page.evaluate(async (id) => {
      const preview = await window.myTracer.dataControl.previewDelete({
        target: { type: 'goal', id }
      })
      if (!preview.ok) throw Error('preview')
      const deleted = await window.myTracer.dataControl.confirmDelete({
        previewId: preview.value.previewId,
        target: preview.value.target,
        confirmation: 'permanently-delete'
      })
      if (!deleted.ok) throw Error('delete')
    }, seeded.outside.id)
    await nav('目标')
    await expect(search).toHaveValue(seeded.outside.name)
    await expect(items).toHaveCount(0)
    await expect(page.locator('.goal-detail')).toHaveCount(0)
    await search.fill('')
    await expect(items).toHaveCount(6)
    await expect(title).toBeVisible()
  } finally {
    await app?.close()
    await removeTemporaryTestRoot(root)
  }
})
