import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

async function withApplication(
  run: (app: ElectronApplication, page: Page) => Promise<void>
): Promise<void> {
  const root = await createTemporaryTestRoot()
  let app: ElectronApplication | undefined
  try {
    app = await electron.launch({
      cwd: root.root,
      chromiumSandbox: true,
      args: [
        ...(process.platform === 'linux' ? ['--headless', '--ozone-platform=headless'] : []),
        join(process.cwd(), 'out/main/index.js'),
        `--user-data-dir=${root.electronUserData}`
      ],
      env: minimalElectronEnvironment(root)
    })
    await run(app, await app.firstWindow())
  } finally {
    await app?.close()
    await removeTemporaryTestRoot(root)
  }
}

async function seed(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const goal = await window.myTracer.goals.create({
      name: '合成植物',
      initialNextAction: { title: 'Café 植物' }
    })
    if (!goal.ok) throw new Error(goal.error.message)
    for (let day = 1; day <= 18; day++) {
      const result = await window.myTracer.dataControl.backfillActionRecord({
        actionId: goal.value.currentNextActionId!,
        occurredOn: `2026-08-${String(day).padStart(2, '0')}`,
        durationMinutes: null,
        outcome: 'partial',
        note:
          day === 1
            ? '前文'.repeat(180) + 'Needle 靠窗 %_*.[x] <script>🌱' + '后文'.repeat(160)
            : '普通记录',
        nextStep: day === 2 ? '排水孔 NextOnly' : null,
        understanding: day === 1 ? 'Needle 旧理解' : day === 3 ? 'InsightOnly 光照' : null,
        confusion: day === 1 ? 'Needle 原疑问' : null
      })
      if (!result.ok) throw new Error(result.error.message)
    }
    const routine = await window.myTracer.routines.create({
      name: 'Piano ピアノ',
      minimumAction: '一个音',
      weekdays: [1]
    })
    if (!routine.ok) throw new Error(routine.error.message)
    const record = await window.myTracer.dataControl.backfillRoutineRecord({
      routineId: routine.value.id,
      occurredOn: '2026-08-01',
      outcome: 'intentional_rest',
      plannedForDate: false,
      note: 'Needle 节奏'
    })
    if (!record.ok) throw new Error(record.error.message)
    const data = await window.myTracer.dataControl.list()
    if (!data.ok) throw new Error(data.error.message)
    const revoked = await window.myTracer.dataControl.revokeUnderstanding({
      id: data.value.understandings.find((u) => u.text.includes('旧理解'))!.id
    })
    const resolved = await window.myTracer.dataControl.resolveConfusion({
      id: data.value.confusions[0].id,
      resolution: 'Needle ResolutionOnly 已查明'
    })
    if (!revoked.ok || !resolved.ok) throw new Error('Synthetic fact setup failed')
  })
}
const nav = (page: Page, name: string) =>
  page.getByRole('navigation').getByRole('button', { name, exact: true })

test('literal saved-text retrieval covers older pages, fields, filters and current edits/deletions', async () => {
  test.slow()
  await withApplication(async (_app, page) => {
    await seed(page)
    await nav(page, '数据').click()
    const query = page.getByRole('searchbox', { name: '查找保存的文字' })
    const rows = page.locator('.data-history-row')
    await expect(rows).toHaveCount(8)
    await expect(page.locator('.data-history-list')).not.toContainText('2026-08-01')
    await page.getByRole('button', { name: '搜索范围', exact: true }).click()
    await expect(page.getByRole('dialog', { name: '搜索范围' })).toContainText('含已撤销/已解决')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: '搜索范围', exact: true })).toBeFocused()
    await query.fill('  nEeDLe  ')
    await expect(rows).toHaveCount(2)
    const action = rows.filter({ hasText: 'Café 植物' })
    await expect(action).toContainText('理解 · 已撤销')
    await expect(action).toContainText('困惑 · 已解决')
    await expect(action).toContainText('解决说明 · 已解决')
    await expect(action).toContainText('时长未记录')
    await action.click()
    await expect(page.getByLabel('所选记录')).toContainText('2026-08-01')
    for (const [value, label] of [
      ['NextOnly', '记录下一步'],
      ['InsightOnly', '理解 · 保留'],
      ['ResolutionOnly', '解决说明 · 已解决'],
      ['%_*.[x]', '备注'],
      ['<script>', '备注'],
      ['ピアノ', '例行名称（当前）']
    ]) {
      await query.fill(value)
      await expect(rows).toHaveCount(1)
      await expect(rows).toContainText(label)
    }
    await query.fill('.*')
    await expect(rows).toHaveCount(0)
    await expect(
      page.getByText('当前条件下没有匹配文字。试试其他关键词，或重置全部条件。')
    ).toBeVisible()
    await query.fill('Needle')
    await page.getByRole('button', { name: /筛选记录 ·/ }).click()
    await page.getByLabel('记录类型', { exact: true }).selectOption('action-record')
    await page.getByLabel('关联目标', { exact: true }).selectOption({ label: '合成植物' })
    await page.getByLabel('发生日期', { exact: true }).fill('2026-08-01')
    await page.getByRole('button', { name: '完成筛选' }).click()
    await expect(rows).toHaveCount(1)
    await page.getByRole('button', { name: '清除搜索', exact: true }).click()
    await expect(query).toBeFocused()
    await expect(rows).toHaveCount(1)
    await page.getByRole('button', { name: '重置全部条件' }).click()
    await expect(rows).toHaveCount(8)
    await query.fill('%_*.[x]')
    await rows.click()
    await page.getByRole('button', { name: '编辑记录', exact: true }).click()
    await page.getByLabel('行动备注', { exact: true }).fill('修改后的 SavedOnly')
    await page.getByRole('button', { name: '保存修改', exact: true }).click()
    await expect(rows).toHaveCount(0)
    await query.fill('SavedOnly')
    await expect(rows).toHaveCount(1)
    await page.evaluate(async () => {
      const data = await window.myTracer.dataControl.list()
      if (!data.ok) throw new Error(data.error.message)
      const record = data.value.actionRecords.find((r) => r.note?.includes('SavedOnly'))!
      const preview = await window.myTracer.dataControl.previewDelete({
        target: { type: 'action-record', id: record.id }
      })
      if (!preview.ok) throw new Error(preview.error.message)
      const deleted = await window.myTracer.dataControl.confirmDelete({
        previewId: preview.value.previewId,
        target: preview.value.target,
        confirmation: 'permanently-delete'
      })
      if (!deleted.ok) throw new Error(deleted.error.message)
    })
    await page.getByRole('button', { name: '重新读取' }).click()
    await expect(rows).toHaveCount(0)
    await expect(page.getByLabel('所选记录')).not.toContainText('SavedOnly')
    await query.fill('ResolutionOnly')
    await expect(rows).toHaveCount(0)
    await query.fill(' \t ')
    await expect(rows).toHaveCount(8)
  })
})

test('query/filter/page/scroll return, IME and unsaved editors retain existing navigation protection', async () => {
  test.slow()
  await withApplication(async (app, page) => {
    await seed(page)
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1360, 900))
    await nav(page, '数据').click()
    const query = page.getByRole('searchbox', { name: '查找保存的文字' })
    const rows = page.locator('.data-history-row')
    await query.fill('café')
    await page.getByRole('button', { name: /筛选记录 ·/ }).click()
    await page.getByLabel('记录类型', { exact: true }).selectOption('action-record')
    await page.getByRole('button', { name: '完成筛选' }).click()
    await page.getByRole('button', { name: '下一页', exact: true }).click()
    await rows.nth(2).click()
    const selectedDate = await page
      .getByLabel('所选记录')
      .locator('.data-record-summary dd')
      .first()
      .innerText()
    await page.locator('.data-history-list').evaluate((el) => {
      el.scrollTop = 120
    })
    const scroll = await page.locator('.data-history-list').evaluate((el) => el.scrollTop)
    expect(scroll).toBeGreaterThan(0)
    await nav(page, '进展').click()
    await nav(page, '数据').click()
    await expect(query).toHaveValue('café')
    await expect(page.getByLabel('历史记录分页')).toContainText('第 2 / 3 页')
    await expect(page.getByLabel('所选记录').locator('.data-record-summary dd').first()).toHaveText(
      selectedDate
    )
    await expect
      .poll(() => page.locator('.data-history-list').evaluate((el) => el.scrollTop))
      .toBe(scroll)
    await query.focus()
    await query.dispatchEvent('compositionstart')
    await query.fill('尚未完成的输入')
    await expect(rows).toHaveCount(8)
    await query.dispatchEvent('compositionend', { data: '尚未完成的输入' })
    await expect(rows).toHaveCount(0)
    await expect(query).toBeFocused()
    await query.fill('NextOnly')
    await rows.click()
    await page.getByRole('button', { name: '编辑记录', exact: true }).click()
    await page.getByLabel('行动备注').fill('未保存草稿')
    await query.fill('InsightOnly')
    await expect(page.getByLabel('行动备注')).toHaveValue('未保存草稿')
    await rows.click()
    await expect(page.getByLabel('所选记录').getByRole('alert')).toContainText('未保存的修改')
    await page.getByRole('button', { name: '继续编辑当前记录' }).click()
    await nav(page, '进展').click()
    await page.getByRole('button', { name: '继续留在数据页' }).click()
    await expect(page.getByLabel('行动备注')).toHaveValue('未保存草稿')
    await page.getByRole('button', { name: '取消编辑', exact: true }).click()
    await expect(page.getByLabel('所选记录')).toContainText('2026-08-03')
  })
})

test('empty data, read failure, safe long text and narrow zoom layouts stay distinct and usable', async () => {
  test.slow()
  await withApplication(async (app, page) => {
    await nav(page, '数据').click()
    await expect(page.getByText('还没有保存的记录，可以先记一笔或补记。')).toBeVisible()
    await seed(page)
    await page.getByRole('button', { name: '重新读取' }).click()
    const query = page.getByRole('searchbox', { name: '查找保存的文字' })
    await query.fill('<script>')
    await expect(page.locator('.data-search-match')).toContainText('<script>')
    expect(await page.locator('.data-search-match script').count()).toBe(0)
    for (const zoom of [1, 1.25, 1.5]) {
      await app.evaluate(({ BrowserWindow }, zoom) => {
        const window = BrowserWindow.getAllWindows()[0]
        window.setSize(820, 650)
        window.webContents.setZoomFactor(zoom)
      }, zoom)
      await query.focus()
      await expect(query).toBeFocused()
      await expect
        .poll(() =>
          page.locator('.data-workspace').evaluate((el) => el.scrollWidth <= el.clientWidth + 1)
        )
        .toBe(true)
      await page.locator('.data-history-row').click()
      await expect(page.getByLabel('所选记录')).toContainText('2026-08-01')
      await page.getByRole('button', { name: '清除搜索', exact: true }).click()
      await expect(query).toBeFocused()
      await query.fill('<script>')
    }
    await app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('data-control:list')
      ipcMain.handle('data-control:list', () => ({
        ok: false,
        error: { code: 'persistence-failed', message: 'synthetic failure' }
      }))
    })
    await page.getByRole('button', { name: '重新读取' }).click()
    await expect(page.getByRole('alert')).toContainText('这不表示记录不存在')
    await expect(page.locator('.data-history-row')).toHaveCount(1)
    await expect(query).toHaveValue('<script>')
    await query.fill('不存在')
    await expect(page.getByText('上次读取时没有匹配记录，当前结果尚未确认。')).toBeVisible()
  })
})
