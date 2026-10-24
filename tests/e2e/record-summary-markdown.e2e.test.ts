import { join } from 'node:path'
import { expect, test, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

test('summary and note stay separate through editing, keyboard collapse, safe reading and narrow zoom', async () => {
  const root = await createTemporaryTestRoot()
  let app: ElectronApplication | undefined
  try {
    app = await electron.launch({
      chromiumSandbox: true,
      cwd: root.root,
      args: [
        join(process.cwd(), 'out/main/index.js'),
        `--user-data-dir=${root.electronUserData}`,
        ...(process.platform === 'linux' ? ['--headless', '--ozone-platform=headless'] : [])
      ],
      env: minimalElectronEnvironment(root)
    })
    const page = await app.firstWindow()
    const requests: string[] = []
    page.on('request', (request) => {
      if (/^https?:/.test(request.url())) requests.push(request.url())
    })
    const ids = await page.evaluate(async () => {
      const action = await window.myTracer.actions.create({ title: '合成观察' })
      if (!action.ok) throw Error(action.error.message)
      const routine = await window.myTracer.routines.create({
        name: '合成例行',
        minimumAction: '一点',
        arrangementMode: 'unscheduled',
        weekdays: []
      })
      if (!routine.ok) throw Error(routine.error.message)
      const note =
        '# 观察\n\n**保留原文**\n\n[地址](file:///inert) ![图片文字](https://example.invalid/pixel)\n\n<img src="https://example.invalid/other">\n\n```\n' +
        'long-code'.repeat(100) +
        '\n```'
      const a = await window.myTracer.dataControl.backfillActionRecord({
        actionId: action.value.id,
        occurredOn: '2026-10-01',
        durationMinutes: null,
        outcome: 'partial',
        summary: '概要唯一词\n第二行',
        note
      })
      const r = await window.myTracer.dataControl.backfillRoutineRecord({
        routineId: routine.value.id,
        occurredOn: '2026-10-01',
        outcome: 'acted',
        plannedForDate: false,
        summary: '例行概要唯一词'
      })
      if (!a.ok || !r.ok) throw Error('synthetic records failed')
      return { action: a.value.id, routine: r.value.id, note }
    })
    const nav = (name: string) =>
      page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
    await nav('数据')
    const query = page.getByRole('searchbox', { name: '查找保存的文字' })
    await query.fill('概要唯一词')
    await expect(page.locator('.data-history-row')).toHaveCount(2)
    await page.locator('.data-history-row').filter({ hasText: '合成观察' }).click()
    const selected = page.getByLabel('所选记录', { exact: true })
    await expect(selected).toContainText('概要唯一词')
    await selected.getByText('展开完整笔记', { exact: true }).click()
    await expect(selected.locator('.record-note h1')).toHaveText('观察')
    await expect(selected.locator('.record-note strong')).toHaveText('保留原文')
    await expect(selected.locator('.record-note')).toContainText('图片文字')
    await expect(
      selected.locator('.record-note a, .record-note img, .record-note script')
    ).toHaveCount(0)
    await selected.getByRole('button', { name: '编辑记录', exact: true }).click()
    const summary = selected.getByRole('textbox', { name: '简述（可选）', exact: true })
    const note = selected.getByRole('textbox', { name: '行动备注', exact: true })
    await expect(note).toBeVisible()
    await expect(note).toHaveValue(ids.note)
    await note.fill('')
    await expect(note).toBeVisible()
    await note.fill(ids.note)
    await summary.fill('🌱'.repeat(501))
    await expect(summary).toHaveAttribute('aria-invalid', 'true')
    await expect(selected.getByRole('button', { name: '保存修改', exact: true })).toBeDisabled()
    await summary.fill('改后的概要唯一词\n第二行')
    const disclosure = selected.locator('.record-note-details > summary')
    await disclosure.focus()
    await disclosure.press('Enter')
    await expect(note).not.toBeVisible()
    await expect(note).toHaveValue(ids.note)
    await disclosure.press('Enter')
    await expect(note).toBeVisible()
    await selected.getByRole('button', { name: '保存修改', exact: true }).click()
    for (const factor of [1, 1.25, 1.5]) {
      await app.evaluate(({ BrowserWindow }, factor) => {
        const window = BrowserWindow.getAllWindows()[0]
        window.setContentSize(820, 600)
        window.webContents.setZoomFactor(factor)
      }, factor)
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
      ).toBe(true)
    }
    const after = await page.evaluate(() => window.myTracer.dataControl.list())
    if (!after.ok) throw Error(after.error.message)
    expect(after.value.actionRecords.find((r) => r.id === ids.action)).toMatchObject({
      summary: '改后的概要唯一词\n第二行',
      note: ids.note
    })
    expect(after.value.routineRecords.find((r) => r.id === ids.routine)).toMatchObject({
      summary: '例行概要唯一词',
      note: null
    })
    await nav('首页')
    await expect(page.locator('.home-recent')).toContainText('概要唯一词')
    await expect(page.locator('.home-recent')).not.toContainText('long-code')
    expect(requests).toEqual([])
  } finally {
    await app?.close()
    await removeTemporaryTestRoot(root)
  }
})
