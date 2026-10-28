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
    await page.getByRole('button', { name: /记录册/ }).click()
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
    await page.getByRole('button', { name: '加入内容' }).click()
    await page.getByRole('textbox', { name: '查找日期或文字' }).fill('First synthetic')
    await page.getByRole('button', { name: '加入', exact: true }).click()
    await expect(page.getByRole('heading', { name: '加入行动记录或独立想法' })).toBeVisible()
    await page.getByRole('textbox', { name: '查找日期或文字' }).fill('Second synthetic')
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
    await page.getByRole('button', { name: '修改想法' }).click()
    await page.getByRole('textbox', { name: '想法正文' }).fill('Revised synthetic source')
    await page.getByRole('button', { name: '保存想法', exact: true }).click()
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
    const destination = join(root.exports, 'booklet.html')
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath })
    }, destination)
    await page.getByRole('button', { name: '保存小册子 HTML' }).click()
    await expect(page.getByRole('status')).toContainText('内容已定格')
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
    await app.close()
    app = await launch()
    page = await app.firstWindow()
    await page.getByRole('button', { name: '数据', exact: true }).click()
    await page.getByRole('button', { name: /记录册/ }).click()
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
  } finally {
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
    await page.getByRole('button', { name: /记录册/ }).click()
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
