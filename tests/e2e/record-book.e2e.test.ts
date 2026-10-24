import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

async function withApplication(
  run: (app: ElectronApplication, page: Page, exports: string) => Promise<void>
) {
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
    await run(app, await app.firstWindow(), root.exports)
  } finally {
    await app?.close()
    await removeTemporaryTestRoot(root)
  }
}
const navigate = (page: Page, name: string) =>
  page
    .getByRole('navigation', { name: '主要视图' })
    .getByRole('button', { name, exact: true })
    .click()
async function openBook(page: Page) {
  await page.getByRole('button', { name: '导出', exact: true }).click()
  await page.getByRole('button', { name: '阅读记录册 / 保存 HTML', exact: true }).click()
}
async function seed(page: Page) {
  await page.evaluate(async () => {
    const action = await window.myTracer.goals.create({
      name: '合成目标',
      initialNextAction: { title: '合成行动' }
    })
    if (!action.ok) throw new Error(action.error.message)
    for (const date of [
      '2024-12-31',
      '2025-01-01',
      ...Array.from({ length: 24 }, (_, index) => `2026-08-${String(index + 1).padStart(2, '0')}`)
    ]) {
      const result = await window.myTracer.dataControl.backfillActionRecord({
        actionId: action.value.currentNextActionId!,
        occurredOn: date,
        durationMinutes: date === '2024-12-31' ? 0 : null,
        outcome: 'partial',
        note:
          `合成检索原文 ${date}\n` + '</script><img src=x onerror=alert(1)> 长文字\n'.repeat(30),
        nextStep: '记录时下一步',
        understanding: '原理解',
        confusion: '原困惑'
      })
      if (!result.ok) throw new Error(result.error.message)
    }
  })
}

test('record book main scrollport exposes continuous content without an inner clipping pane', async () => {
  await withApplication(async (app, page) => {
    await seed(page)
    await navigate(page, '进展')
    await page.locator('.progress-more summary').click()
    await page.getByRole('button', { name: '阅读记录册', exact: true }).click()
    await expect(page.locator('.rb-day')).toHaveCount(24)
    for (const width of [1280, 820]) {
      await app.evaluate(
        ({ BrowserWindow }, width) => BrowserWindow.getAllWindows()[0].setSize(width, 900),
        width
      )
      const main = page.locator('main.content-book')
      await expect
        .poll(() =>
          main.evaluate((node) => ({
            mainOverflow: getComputedStyle(node).overflowY,
            innerOverflow: getComputedStyle(node.querySelector('.content-inner')!).overflowY,
            display: getComputedStyle(node.querySelector('.content-inner')!).display,
            scrollRange: node.scrollHeight - node.clientHeight > 650
          }))
        )
        .toEqual({
          mainOverflow: 'auto',
          innerOverflow: 'visible',
          display: 'block',
          scrollRange: true
        })
      await main.evaluate((node) => {
        node.scrollTop = 650
      })
      await expect.poll(() => main.evaluate((node) => node.scrollTop)).toBe(650)
      expect(
        await page.locator('.content-book .content-inner').evaluate((node) => node.scrollTop)
      ).toBe(0)
      expect(await page.evaluate(() => document.scrollingElement?.scrollTop)).toBe(0)
      // A real wheel gesture must scroll the same main container, not a nested/document pane.
      const bounds = await main.boundingBox()
      expect(bounds).not.toBeNull()
      await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height - 80)
      const beforeWheel = await main.evaluate((node) => node.scrollTop)
      await page.mouse.wheel(0, 200)
      await expect.poll(() => main.evaluate((node) => node.scrollTop)).toBeGreaterThan(beforeWheel)
    }
  })
})

test('book month navigation, original visit, source filters and scroll return with fresh saved data', async () => {
  await withApplication(async (_app, page) => {
    await seed(page)
    await navigate(page, '数据')
    const query = page.getByRole('searchbox', { name: '查找保存的文字' })
    await query.fill('合成检索原文')
    await expect(page.locator('.data-history-row')).toHaveCount(8)
    await page.locator('.data-history-row').nth(2).click()
    await expect(page.getByLabel('所选记录')).toContainText('2026-08-22')
    // Match toHaveText's textContent semantics, including collapsed understanding/confusion text.
    const selected = (await page.getByLabel('所选记录').textContent())!
    await page.locator('[data-scroll-key="master"]').evaluate((node) => {
      node.scrollTop = 110
    })
    const sourceScroll = await page
      .locator('[data-scroll-key="master"]')
      .evaluate((node) => node.scrollTop)
    expect(sourceScroll).toBeGreaterThan(0)
    await openBook(page)
    const month = page.getByRole('combobox', { name: '跳转到月份' })
    await expect(month).toHaveValue('2026-08')
    await expect(page.locator('.rb-chapter')).toHaveCount(1)
    await expect(page.locator('.rb-day')).toHaveCount(24)
    await expect(page.locator('.rb-chapter img')).toHaveCount(0)
    await page.locator('main.content').evaluate((node) => {
      node.scrollTop = 650
    })
    await expect
      .poll(() => page.locator('main.content').evaluate((node) => node.scrollTop))
      .toBe(650)
    // The month control is sticky, so switching keeps the saved main-pane position.
    await month.selectOption('2024-12')
    await expect(page.locator('.rb-chapter')).toContainText('0 分钟')
    await month.selectOption('2026-08')
    await expect
      .poll(() => page.locator('main.content').evaluate((node) => node.scrollTop))
      .toBe(650)
    await page.getByRole('button', { name: '查看原记录', exact: true }).first().click()
    await expect(page.getByLabel('所选记录')).toContainText('2026-08-24')
    await page.getByRole('button', { name: '返回记录册', exact: true }).click()
    await expect(month).toHaveValue('2026-08')
    await page.getByRole('button', { name: '返回来源页面', exact: true }).click()
    await expect(query).toHaveValue('合成检索原文')
    await expect(page.getByLabel('所选记录')).toHaveText(selected)
    await expect
      .poll(() => page.locator('[data-scroll-key="master"]').evaluate((node) => node.scrollTop))
      .toBe(sourceScroll)
    await navigate(page, '进展')
    await page.locator('.progress-more summary').click()
    await page.getByRole('button', { name: '阅读记录册', exact: true }).click()
    await expect(month).toHaveValue('2026-08')
    await month.selectOption('2025-01')
    // Capture the same complete DOM text that toHaveText compares; innerText adds layout newlines.
    const before = (await page.locator('.rb-chapter').textContent())!
    await page.evaluate(async () => {
      const result = await window.myTracer.goals.create({
        name: '稍后保存',
        initialNextAction: { title: '后来保存的行动' }
      })
      if (!result.ok) throw new Error('fixture')
      const record = await window.myTracer.dataControl.backfillActionRecord({
        actionId: result.value.currentNextActionId!,
        occurredOn: '2025-01-02',
        durationMinutes: 0,
        outcome: 'partial',
        note: '新保存原文'
      })
      if (!record.ok) throw new Error(record.error.message)
    })
    await expect(page.locator('.rb-chapter')).toHaveText(before)
    await page.getByRole('button', { name: '返回来源页面', exact: true }).click()
    await page.locator('.progress-more summary').click()
    await page.getByRole('button', { name: '阅读记录册', exact: true }).click()
    await expect(month).toHaveValue('2025-01')
    await expect(page.locator('.rb-chapter')).toContainText('新保存原文')
  })
})

test('book preserves data drafts, exports the full offline book and retains keyboard/narrow layout', async () => {
  await withApplication(async (app, page, exports) => {
    await seed(page)
    await navigate(page, '数据')
    await page.locator('.data-history-row').first().click()
    await page.getByRole('button', { name: '编辑记录', exact: true }).click()
    await page.getByLabel('行动备注', { exact: true }).fill('尚未保存的合成草稿')
    await openBook(page)
    const guard = page.getByRole('dialog', { name: '离开数据页' })
    await expect(guard).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByLabel('行动备注', { exact: true })).toHaveValue('尚未保存的合成草稿')
    await openBook(page)
    await guard.getByRole('button', { name: '放弃修改并离开' }).click()
    await expect(page.locator('.rb-chapter')).not.toContainText('尚未保存的合成草稿')
    await page.getByRole('combobox', { name: '跳转到月份' }).selectOption('2024-12')
    const destination = join(exports, 'full-book.html')
    await app.evaluate(({ dialog }, destination) => {
      let count = 0
      dialog.showSaveDialog = async () =>
        ++count <= 2 ? { canceled: true, filePath: '' } : { canceled: false, filePath: destination }
    }, destination)
    const save = page.getByRole('button', { name: '保存全书 HTML ↓' })
    for (let count = 0; count < 2; count++) {
      await save.click()
      await expect(page.locator('.rb-export-status')).toHaveText('已取消保存。')
    }
    await save.click()
    await expect(page.locator('.rb-export-status')).toContainText('已保存全书')
    const html = await readFile(destination, 'utf8')
    expect(html).toContain('2026年8月')
    expect(html).toContain('2024年12月')
    expect(html).not.toContain('尚未保存的合成草稿')
    // A fresh sandboxed, isolated window reads only the exported local file.
    const nextWindow = app.waitForEvent('window')
    await app.evaluate(async ({ BrowserWindow }, destination) => {
      const window = new BrowserWindow({
        show: false,
        webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
      })
      await window.loadFile(destination)
      window.show()
    }, destination)
    const offline = await nextWindow
    await expect(offline.locator('[data-book-month]:visible')).toHaveCount(1)
    await offline.getByRole('combobox', { name: '跳转到月份' }).selectOption('2024-12')
    await expect(offline.locator('[data-book-month]:visible')).toContainText('0 分钟')
    expect(await offline.evaluate(() => typeof (globalThis as { attack?: unknown }).attack)).toBe(
      'undefined'
    )
    await offline.close()
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(820, 900))
    for (const zoom of [1, 1.25, 1.5]) {
      await app.evaluate(
        ({ BrowserWindow }, factor) =>
          BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(factor),
        zoom
      )
      await expect(page.locator('.rb-toc')).toBeHidden()
      expect(
        await page
          .locator('main.content')
          .evaluate((node) => node.scrollWidth <= node.clientWidth + 1)
      ).toBe(true)
      const month = page.getByRole('combobox', { name: '跳转到月份' })
      await month.focus()
      await expect(month).toBeFocused()
      await page.keyboard.press('Tab')
      await expect(save).toBeFocused()
    }
  })
})

test('empty and read-error states are honest; a stale response cannot reopen the book', async () => {
  await withApplication(async (app, page) => {
    await navigate(page, '数据')
    await openBook(page)
    await expect(
      page.getByText('还没有可按日期阅读的记录。未收录的对象请见范围说明。')
    ).toBeVisible()
    await page.getByRole('button', { name: '返回来源页面' }).click()
    await app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('record-book:read')
      ipcMain.handle('record-book:read', () => ({ ok: false, error: { code: 'read-failed' } }))
    })
    await openBook(page)
    await expect(page.getByRole('alert')).toContainText('记录暂时无法读取')
    await app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('record-book:read')
      ipcMain.handle(
        'record-book:read',
        () =>
          new Promise((resolve) => {
            Object.assign(globalThis, {
              releaseBookRead: () =>
                resolve({
                  ok: true,
                  value: {
                    readAt: '2026-01-01T00:00:00.000Z',
                    book: { months: [], exclusions: [] }
                  }
                })
            })
          })
      )
    })
    await page.getByRole('button', { name: '重新读取' }).click()
    await expect(
      page.getByRole('status', { name: '' }).filter({ hasText: '正在读取记录' })
    ).toBeVisible()
    await page.getByRole('button', { name: '返回来源页面' }).click()
    await app.evaluate(() =>
      (globalThis as unknown as { releaseBookRead: () => void }).releaseBookRead()
    )
    await expect(page.getByRole('searchbox', { name: '查找保存的文字' })).toBeVisible()
    await expect(page.getByRole('region', { name: '记录册', exact: true })).toHaveCount(0)
  })
})
