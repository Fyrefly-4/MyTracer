import { _electron as electron, expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'
import { minimalElectronEnvironment } from '../support/electron-environment'

test('personal booklets: create, append, retain order, follow originals, export and remove without deleting sources', async () => {
  const root = await createTemporaryTestRoot()
  let app: Awaited<ReturnType<typeof electron.launch>> | undefined
  const launch = () =>
    electron.launch({
      chromiumSandbox: true,
      cwd: root.root,
      args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
      env: minimalElectronEnvironment(root)
    })
  try {
    app = await launch()
    let page = await app.firstWindow()
    const thoughts = await page.evaluate(async () => {
      const today = await window.myTracer.today.get({})
      if (!today.ok) throw new Error('date unavailable')
      const rows = []
      for (const text of [
        'First synthetic thought\n' + 'Long original text '.repeat(100),
        'Second synthetic thought'
      ]) {
        const row = await window.myTracer.thoughts.create({
          id: crypto.randomUUID(),
          occurredOn: today.value.localDate,
          text
        })
        if (!row.ok) throw new Error('synthetic source failed')
        rows.push(row.value)
      }
      return rows
    })
    await page.getByRole('button', { name: '数据', exact: true }).click()
    await page.getByRole('button', { name: '导出', exact: true }).click()
    await page.getByRole('button', { name: '阅读记录册 / 保存 HTML', exact: true }).click()
    await page.getByRole('button', { name: '编选小册子' }).click()
    await page.getByRole('button', { name: '创建小册子' }).click()
    await page.getByRole('textbox', { name: '标题（可选）' }).fill('Synthetic booklet')
    await page
      .getByRole('textbox', { name: '自己的话（可选）' })
      .fill('Just some words, no conclusion.')
    await page.getByRole('button', { name: '保存小册子', exact: true }).evaluate((button) => {
      ;(button as HTMLButtonElement).click()
      ;(button as HTMLButtonElement).click()
    })
    await expect(
      page.getByRole('heading', { name: 'Synthetic booklet', exact: true })
    ).toBeVisible()
    console.info('booklet workflow: created; adding sources')
    await page.getByRole('button', { name: '加入内容' }).click()
    await page.getByRole('searchbox', { name: '查找日期或文字' }).fill('First synthetic')
    await page.getByRole('button', { name: '加入', exact: true }).click()
    await expect(page.getByRole('heading', { name: '加入行动记录或独立想法' })).toBeVisible()
    await page.getByRole('searchbox', { name: '查找日期或文字' }).fill('Second synthetic')
    await page.getByRole('button', { name: '加入', exact: true }).click()
    await page.getByRole('button', { name: '返回阅读' }).click()
    await expect(page.getByRole('article', { name: '第 1 条' })).toContainText(
      'First synthetic thought'
    )
    await page
      .getByRole('article', { name: '第 2 条' })
      .getByRole('button', { name: '上移' })
      .click()
    await expect(page.getByRole('article', { name: '第 1 条' })).toContainText(
      'Second synthetic thought'
    )
    await page
      .getByRole('article', { name: '第 1 条' })
      .getByRole('button', { name: '回到来源' })
      .click()
    await expect(page.getByRole('article', { name: '已保存的独立想法' })).toHaveCount(1)
    console.info('booklet workflow: ordered; editing source')
    await page.getByRole('button', { name: '修改想法' }).click()
    await page.getByRole('textbox', { name: '想法正文' }).fill('Revised synthetic source')
    await page.getByRole('button', { name: '保存想法', exact: true }).click()
    await expect(page.getByRole('article', { name: '已保存的独立想法' })).toContainText(
      'Revised synthetic source'
    )
    await page.getByRole('button', { name: '返回小册子', exact: true }).click()
    await expect(page.getByRole('article', { name: '第 1 条' })).toContainText(
      'Revised synthetic source'
    )
    await page.setViewportSize({ width: 620, height: 760 })
    expect(
      await page
        .locator('.personal-booklets')
        .evaluate((element) => element.scrollWidth <= element.clientWidth)
    ).toBe(true)
    console.info('booklet workflow: source revised; exporting')
    const destination = join(root.exports, 'booklet.html')
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath })
    }, destination)
    await page.getByRole('button', { name: '保存小册子 HTML' }).click()
    await expect(
      page.getByRole('region', { name: '小册子', exact: true }).getByRole('status')
    ).toContainText('内容已定格')
    console.info('booklet workflow: exported; deleting source')
    const frozen = await readFile(destination, 'utf8')
    expect(frozen.indexOf('Revised synthetic source')).toBeLessThan(
      frozen.indexOf('First synthetic thought')
    )
    await page.evaluate(async (thought) => {
      const result = await window.myTracer.thoughts.delete({
        id: thought.id,
        expectedText: 'Revised synthetic source',
        confirmed: true
      })
      if (!result.ok) throw new Error('synthetic delete failed')
    }, thoughts[1])
    await page.getByRole('button', { name: '重新读取原文' }).click()
    await expect(page.getByRole('article', { name: '第 1 条' })).toContainText('来源已删除')
    await expect(page.getByText('Revised synthetic source', { exact: true })).toHaveCount(0)
    await page
      .getByRole('article', { name: '第 1 条' })
      .getByRole('button', { name: '移出小册子' })
      .click()
    expect(await readFile(destination, 'utf8')).toBe(frozen)
    await expect(page.locator('.booklet-reading article')).toHaveCount(1)
    await expect(page.getByRole('button', { name: '加入内容' })).toBeEnabled()
    console.info('booklet workflow: removed placeholder; closing for restart')
    await app.close()
    console.info('booklet workflow: closed; restarting')
    app = await launch()
    console.info('booklet workflow: restarted')
    page = await app.firstWindow()
    await page.getByRole('button', { name: '数据', exact: true }).click()
    await page.getByRole('button', { name: '导出', exact: true }).click()
    await page.getByRole('button', { name: '阅读记录册 / 保存 HTML', exact: true }).click()
    await page.getByRole('button', { name: '编选小册子' }).click()
    await page.getByRole('button', { name: 'Synthetic booklet · 1 条' }).click()
    await expect(page.getByRole('article', { name: '第 1 条' })).toContainText(
      'First synthetic thought'
    )
    await page.getByRole('button', { name: '删除小册子', exact: true }).click()
    await expect(page.getByRole('dialog')).toContainText('不会删除任何原记录')
    await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click()
    await expect(page.getByText('还没有小册子。', { exact: true })).toBeVisible()
    const remaining = await page.evaluate(
      async (thought) => window.myTracer.thoughts.list({ date: thought.occurredOn }),
      thoughts[0]
    )
    expect(remaining).toMatchObject({ ok: true, value: [thoughts[0]] })
    console.info('booklet workflow: all assertions complete')
  } catch (failure) {
    // Preserve the original failure if application cleanup is also blocked.
    console.error('Personal booklet workflow failed before cleanup:', failure)
    throw failure
  } finally {
    console.info('booklet workflow: final cleanup')
    await app?.close()
    await removeTemporaryTestRoot(root)
  }
})

test('booklet save failure retains input and read failure hides previously resolved original text', async () => {
  const root = await createTemporaryTestRoot()
  let app: Awaited<ReturnType<typeof electron.launch>> | undefined
  try {
    app = await electron.launch({
      chromiumSandbox: true,
      cwd: root.root,
      args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
      env: minimalElectronEnvironment(root)
    })
    const page = await app.firstWindow()
    await page.evaluate(async () => {
      const today = await window.myTracer.today.get({})
      if (!today.ok) throw new Error('date')
      const thought = await window.myTracer.thoughts.create({
        id: crypto.randomUUID(),
        occurredOn: today.value.localDate,
        text: 'Synthetic body must disappear on failed read'
      })
      if (!thought.ok) throw new Error('thought')
      const book = await window.myTracer.booklets.save({
        id: crypto.randomUUID(),
        expectedRevision: 0,
        title: 'Failure fixture',
        note: '',
        entries: [{ id: crypto.randomUUID(), kind: 'thought', sourceId: thought.value.id }]
      })
      if (!book.ok) throw new Error('book')
    })
    await page.getByRole('button', { name: '数据', exact: true }).click()
    await page.getByRole('button', { name: '导出', exact: true }).click()
    await page.getByRole('button', { name: '阅读记录册 / 保存 HTML', exact: true }).click()
    await page.getByRole('button', { name: '编选小册子' }).click()
    await page.getByRole('button', { name: 'Failure fixture · 1 条' }).click()
    await expect(page.getByRole('article')).toContainText('Synthetic body must disappear')
    await app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('booklets:save')
      ipcMain.handle('booklets:save', () => ({
        ok: false,
        error: { message: 'Synthetic save failure' }
      }))
    })
    await page.getByRole('button', { name: '修改标题和自己的话' }).click()
    await page
      .getByRole('textbox', { name: '自己的话（可选）' })
      .fill('Retain unsaved synthetic input')
    await page.getByRole('button', { name: '保存小册子', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Synthetic save failure')
    await expect(page.getByRole('textbox', { name: '自己的话（可选）' })).toHaveValue(
      'Retain unsaved synthetic input'
    )
    await page.getByRole('button', { name: '取消编辑' }).click()
    await expect(page.getByRole('article')).toContainText('Synthetic body must disappear')
    await app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('booklets:read')
      ipcMain.handle('booklets:read', () => ({
        ok: false,
        error: { message: 'Synthetic read failure' }
      }))
    })
    await page.getByRole('button', { name: '重新读取原文' }).click()
    await expect(page.getByRole('alert')).toContainText('Synthetic read failure')
    await expect(
      page.getByText('Synthetic body must disappear on failed read', { exact: true })
    ).toHaveCount(0)
    await expect(page.getByRole('button', { name: '回到来源' })).toHaveCount(0)
  } finally {
    await app?.close()
    await removeTemporaryTestRoot(root)
  }
})

test('long booklets own a scrollport, keep candidate width and preserve offscreen operation focus', async () => {
  const root = await createTemporaryTestRoot()
  let app: Awaited<ReturnType<typeof electron.launch>> | undefined
  try {
    app = await electron.launch({
      chromiumSandbox: true,
      cwd: root.root,
      args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
      env: minimalElectronEnvironment(root)
    })
    const page = await app.firstWindow()
    await page.setViewportSize({ width: 1188, height: 848 })
    const ids = await page.evaluate(async () => {
      const today = await window.myTracer.today.get({})
      if (!today.ok) throw new Error('date')
      const rows = []
      for (const text of [
        Array.from(
          { length: 80 },
          (_, index) => `Synthetic long line ${index}: reading should remain reachable.`
        ).join('\n'),
        'Synthetic short second',
        'Synthetic short third'
      ]) {
        const thought = await window.myTracer.thoughts.create({
          id: crypto.randomUUID(),
          occurredOn: today.value.localDate,
          text
        })
        if (!thought.ok) throw new Error('source')
        rows.push(thought.value)
      }
      return rows.map((row) => row.id)
    })
    await page.getByRole('button', { name: '数据', exact: true }).click()
    await page.getByRole('button', { name: '导出', exact: true }).click()
    await page.getByRole('button', { name: '阅读记录册 / 保存 HTML', exact: true }).click()
    await page.getByRole('button', { name: '编选小册子' }).click()
    await page.getByRole('button', { name: '创建小册子' }).click()
    await page.getByRole('textbox', { name: '标题（可选）' }).fill('Long scrolling fixture')
    await page.getByRole('button', { name: '保存小册子', exact: true }).click()
    await page.getByRole('button', { name: '加入内容' }).click()
    const container = page.locator('.personal-booklets')
    const beforeWidth = (await container.boundingBox())!.width
    await page
      .locator('.booklet-candidates li')
      .filter({ hasText: 'Synthetic long line' })
      .getByRole('button', { name: '加入', exact: true })
      .click()
    await expect(page.locator('.booklet-candidates li')).toHaveCount(2)
    expect(Math.abs((await container.boundingBox())!.width - beforeWidth)).toBeLessThan(2)
    await page
      .locator('.booklet-candidates li')
      .filter({ hasText: 'Synthetic short second' })
      .getByRole('button', { name: '加入', exact: true })
      .click()
    await page
      .locator('.booklet-candidates li')
      .filter({ hasText: 'Synthetic short third' })
      .getByRole('button', { name: '加入', exact: true })
      .click()
    await page.getByRole('button', { name: '返回阅读' }).click()
    const main = page.locator('main.content-booklets')
    await expect(main).toHaveCSS('overflow-y', 'auto')
    expect(
      await main.evaluate((element) => element.scrollHeight > element.clientHeight + 1000)
    ).toBe(true)
    const mainBox = (await main.boundingBox())!
    await page.mouse.move(mainBox.x + mainBox.width / 2, mainBox.y + mainBox.height / 2)
    await page.mouse.wheel(0, 6000)
    await expect.poll(() => main.evaluate((element) => element.scrollTop)).toBeGreaterThan(1000)
    const last = page.getByRole('article', { name: '第 3 条' })
    await expect(last.getByRole('button', { name: '上移' })).toBeInViewport()
    const entryId = await last.getAttribute('data-booklet-entry')
    const moved = page.locator(`[data-booklet-entry="${entryId}"]`)
    const beforeY = (await last.getByRole('button', { name: '上移' }).boundingBox())!.y
    await last.getByRole('button', { name: '上移' }).click()
    await expect(moved).toHaveAttribute('aria-label', '第 2 条')
    await expect(moved.getByRole('button', { name: '上移' })).toBeFocused()
    expect(
      Math.abs((await moved.getByRole('button', { name: '上移' }).boundingBox())!.y - beforeY)
    ).toBeLessThan(20)
    await moved.getByRole('button', { name: '移出小册子' }).click()
    await expect(page.locator('.booklet-reading article')).toHaveCount(2)
    await expect(
      page.getByRole('article', { name: '第 2 条' }).getByRole('button', { name: '移出小册子' })
    ).toBeFocused()
    await expect(
      page.getByRole('article', { name: '第 2 条' }).getByRole('button', { name: '移出小册子' })
    ).toBeInViewport()
    expect(await main.evaluate((element) => element.scrollTop)).toBeGreaterThan(1000)
    await page.setViewportSize({ width: 620, height: 760 })
    await page
      .getByRole('article', { name: '第 2 条' })
      .getByRole('button', { name: '移出小册子' })
      .focus()
    await page.keyboard.press('Control+End')
    await expect(
      page.getByRole('article', { name: '第 2 条' }).getByRole('button', { name: '移出小册子' })
    ).toBeInViewport()
    expect(await container.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true
    )
    expect(await main.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
    const remaining = await page.evaluate(async () => window.myTracer.booklets.list())
    expect(remaining).toMatchObject({
      ok: true,
      value: [{ entries: [{ sourceId: ids[0] }, { sourceId: ids[1] }] }]
    })
  } finally {
    await app?.close()
    await removeTemporaryTestRoot(root)
  }
})
