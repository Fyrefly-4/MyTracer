import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

test('thoughts stand alone across save, conflict, cancellation, day view and restart', async () => {
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
    await page.getByRole('button', { name: '查看今天的记录与想法' }).click()
    let section = page.getByRole('region', { name: /的独立想法$/ })
    await section.getByRole('button', { name: '留个想法' }).click()
    await section.getByRole('textbox', { name: '想法正文' }).fill('  \n ')
    await expect(section.getByRole('button', { name: '保存想法' })).toBeDisabled()
    const text = '合成想法：这句话本身就成立。\n' + '长段落，不需要下一步。'.repeat(100)
    await section.getByRole('textbox', { name: '想法正文' }).fill(text)
    await section.getByRole('button', { name: '保存想法' }).evaluate((button) => {
      ;(button as HTMLButtonElement).click()
      ;(button as HTMLButtonElement).click()
    })
    await expect(section.getByRole('article', { name: '已保存的独立想法' })).toHaveCount(1)
    const initial = await page.evaluate(async () => {
      const today = await window.myTracer.today.get({})
      if (!today.ok) throw new Error('synthetic date unavailable')
      const thoughts = await window.myTracer.thoughts.list({ date: today.value.localDate })
      const overview = await window.myTracer.home.get({})
      if (!thoughts.ok || !overview.ok) throw new Error('read failed')
      return {
        thought: thoughts.value[0]!,
        date: today.value.localDate,
        calendar: overview.value.calendarCounts
      }
    })
    expect(initial.calendar).toEqual([])
    await section.getByRole('button', { name: '修改想法' }).click()
    await section.getByRole('textbox', { name: '想法正文' }).fill('未保存的取消内容')
    await section.getByRole('button', { name: '取消', exact: true }).click()
    await expect(section.getByRole('article')).toContainText(text)
    await section.getByRole('button', { name: '修改想法' }).click()
    await section.getByRole('textbox', { name: '想法正文' }).fill('过时修改不可覆盖')
    await page.evaluate(async (row) => {
      const result = await window.myTracer.thoughts.update({
        id: row.id,
        expectedText: row.text,
        text: '已在别处修改的合成想法'
      })
      if (!result.ok) throw new Error('synthetic concurrent update failed')
    }, initial.thought)
    await section.getByRole('button', { name: '保存想法' }).click()
    await expect(section.getByRole('alert')).toContainText('想法已变化')
    await expect(section.getByRole('textbox')).toHaveValue('过时修改不可覆盖')
    await section.getByRole('button', { name: '取消', exact: true }).click()
    await page.getByRole('navigation').getByRole('button', { name: '今天', exact: true }).click()
    await page.getByText('当天独立想法', { exact: true }).click()
    section = page.getByRole('region', { name: /的独立想法$/ })
    await expect(section.getByRole('article')).toContainText('已在别处修改的合成想法')
    await section.getByRole('button', { name: '修改想法' }).click()
    await section.getByRole('textbox').fill('最终保存的合成想法\n不产生行动。')
    await section.getByRole('button', { name: '保存想法' }).click()
    await expect(section.getByRole('status')).toContainText('想法已保存')
    await section.getByRole('button', { name: '留个想法' }).click()
    await section.getByRole('textbox').fill('切换日期时不自动保存')
    await page.getByLabel('回看想法日期').fill('2020-01-01')
    section = page.getByRole('region', { name: '2020-01-01 的独立想法' })
    await expect(section.getByRole('article')).toHaveCount(0)
    await expect(section.getByRole('button', { name: '留个想法' })).toBeVisible()
    await page.getByLabel('回看想法日期').fill(initial.date)
    section = page.getByRole('region', { name: /的独立想法$/ })
    await expect(section.getByRole('article')).toHaveCount(1)
    await section.getByRole('button', { name: '留个想法' }).click()
    await section.getByRole('textbox').fill('切页时不自动保存')
    await page.getByRole('navigation').getByRole('button', { name: '首页', exact: true }).click()
    await page.getByRole('button', { name: '查看今天的记录与想法' }).click()
    section = page.getByRole('region', { name: /的独立想法$/ })
    await expect(section.getByRole('article')).toHaveCount(1)
    await expect(section.getByRole('textbox')).toHaveCount(0)
    const exportPath = join(root.exports, 'synthetic-thoughts.json')
    await app.evaluate(({ dialog }, path) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: path })
    }, exportPath)
    expect(await page.evaluate(() => window.myTracer.exports.generate())).toMatchObject({
      ok: true,
      value: { exportVersion: 7 }
    })
    const exported = JSON.parse(await readFile(exportPath, 'utf8'))
    expect(exported.data.thoughts).toHaveLength(1)
    expect(exported.data.thoughts[0].text).toBe('最终保存的合成想法\n不产生行动。')
    expect(exported.data.actions).toEqual([])
    const book = await page.evaluate(() => window.myTracer.recordBook.read())
    expect(book.ok).toBe(true)
    if (book.ok)
      expect(
        book.value.book.months.flatMap((month) => month.days.flatMap((day) => day.entries))
      ).toContainEqual(
        expect.objectContaining({
          kind: 'thought',
          fields: [{ label: '正文', text: '最终保存的合成想法\n不产生行动。' }]
        })
      )
    await app.close()
    app = await launch()
    page = await app.firstWindow()
    await page.getByRole('button', { name: '查看今天的记录与想法' }).click()
    section = page.getByRole('region', { name: /的独立想法$/ })
    await expect(section.getByRole('article')).toContainText('最终保存的合成想法')
    await section.getByRole('button', { name: '删除想法' }).click()
    const dialog = page.getByRole('dialog', { name: '确认删除独立想法' })
    await expect(dialog).toContainText('永久删除 1 条独立想法')
    await dialog.getByRole('button', { name: '取消删除' }).click()
    await expect(section.getByRole('article')).toHaveCount(1)
    await section.getByRole('button', { name: '删除想法' }).click()
    await dialog.getByRole('button', { name: '确认删除想法' }).click()
    await expect(section.getByRole('article')).toHaveCount(0)
    const final = await page.evaluate(
      async (date) => ({
        thoughts: await window.myTracer.thoughts.list({ date }),
        home: await window.myTracer.home.get({})
      }),
      initial.date
    )
    expect(final.thoughts).toEqual({ ok: true, value: [] })
    expect(final.home).toMatchObject({ ok: true, value: { calendarCounts: [] } })
  } finally {
    if (app) await app.close()
    await removeTemporaryTestRoot(root)
  }
})
