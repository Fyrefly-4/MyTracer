import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import {
  createTemporaryTestRoot,
  removeTemporaryTestRoot,
  type TemporaryTestRoot
} from '../support/temporary-test-root'
import { openRecordNote } from '../support/ui-disclosure'

async function launch(root: TemporaryTestRoot) {
  return electron.launch({
    chromiumSandbox: true,
    cwd: root.root,
    args: [
      join(process.cwd(), 'out/main/index.js'),
      `--user-data-dir=${root.electronUserData}`,
      ...(process.platform === 'linux' ? ['--headless', '--ozone-platform=headless'] : [])
    ],
    env: minimalElectronEnvironment(root)
  })
}
const nav = (page: Page, name: string) =>
  page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
async function date(app: ElectronApplication, day: number) {
  await app.evaluate((_electron, day) => {
    const real = (Reflect.get(globalThis, '__viewRealDate') as DateConstructor | undefined) ?? Date
    Reflect.set(globalThis, '__viewRealDate', real)
    Reflect.set(
      globalThis,
      'Date',
      new Proxy(real, {
        construct(target, args) {
          return Reflect.construct(target, args.length ? args : [2026, 7, day, 12])
        }
      })
    )
  }, day)
}
async function seed(page: Page, name: string) {
  return page.evaluate(async (name) => {
    const r = await window.myTracer.routines.create({
      name,
      minimumAction: '一步',
      arrangementMode: 'weekly',
      weekdays: [1, 2, 3, 4, 5, 6, 7]
    })
    if (!r.ok) throw Error(r.error.message)
    return r.value.id
  }, name)
}

for (const [source, minutes] of [
  ['例行', '0'],
  ['今天', '']
] as const) {
  test(`${source} opens the exact saved routine text and returns without losing source input`, async () => {
    const root = await createTemporaryTestRoot()
    let app: ElectronApplication | undefined
    try {
      app = await launch(root)
      const page = await app.firstWindow()
      await date(app, 10)
      const name = `${source}合成例行`
      await seed(page, name)
      // An unrelated Data query must not hide the explicit target.
      await nav(page, '数据')
      await page.getByRole('searchbox', { name: '查找保存的文字' }).fill('不匹配的旧条件')
      await nav(page, source)
      if (source === '例行') await page.locator('.goal-list-item').filter({ hasText: name }).click()
      else
        await page
          .getByLabel('今日例行计划', { exact: true })
          .getByRole('button', { name: new RegExp(name) })
          .click()
      const panel = page.getByLabel(`${name} 例行记录`, { exact: true })
      await expect(panel.getByRole('button', { name: /查看记录/ })).toHaveCount(0)
      await panel.getByRole('button', { name: '记录例行', exact: true }).click()
      await panel.getByLabel('投入时长（分钟，可选）').fill(minutes)
      await panel.getByLabel('简述（可选）', { exact: true }).fill(`${source}保存的简述`)
      await openRecordNote(panel.getByLabel('备注（可选）'))
      await panel
        .getByLabel('备注（可选）')
        .fill(`${source}保存的完整笔记\n` + '合成正文。\n'.repeat(90))
      await expect(panel.getByRole('button', { name: /查看记录/ })).toHaveCount(0)
      await panel.getByRole('button', { name: '保存例行记录', exact: true }).click()
      await expect(panel.locator('.routine-record-state strong')).toHaveText('有所行动')
      await expect(panel.getByRole('button', { name: /查看记录/ })).toBeVisible()
      await panel.getByRole('button', { name: /查看记录/ }).click()
      const selected = page.getByLabel('所选记录')
      await expect(selected).toContainText(name)
      await expect(selected).toContainText('2026-08-10')
      await expect(selected).toContainText(`${source}保存的简述`)
      await expect(selected).toContainText(minutes === '0' ? '少于 1 分钟' : '时长未记录')
      await selected.getByText('展开完整笔记', { exact: true }).click()
      await expect(selected).toContainText(`${source}保存的完整笔记`)
      await selected.getByRole('button', { name: '编辑记录', exact: true }).click()
      await selected.getByLabel('例行分钟').fill('9')
      await nav(page, source)
      await expect(page.getByRole('dialog', { name: '离开数据页' })).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(selected.getByLabel('例行分钟')).toHaveValue('9')
      await selected.getByRole('button', { name: '取消编辑', exact: true }).click()
      await nav(page, source)
      await expect(panel).toBeVisible()
      await expect(panel.getByRole('button', { name: /查看记录/ })).toBeVisible()
      if (source === '例行') {
        const detail = page.locator('.routine-workspace .goal-detail')
        await detail.getByText('编辑内容和安排', { exact: true }).click()
        await detail.getByLabel('名称', { exact: true }).fill('尚未保存的例行名称')
        await panel.getByRole('button', { name: /查看记录/ }).click()
        await expect(selected).toContainText(name)
        await nav(page, source)
        await expect(detail.getByLabel('名称', { exact: true })).toHaveValue('尚未保存的例行名称')
      }
      const facts = await page.evaluate(() => window.myTracer.dataControl.list())
      if (!facts.ok) throw Error(facts.error.message)
      expect(facts.value.routineRecords).toHaveLength(1)
      expect(facts.value.routineRecords[0].durationMinutes).toBe(minutes === '0' ? 0 : null)
    } finally {
      await app?.close()
      await removeTemporaryTestRoot(root)
    }
  })
}

test('a record saved for the captured day opens that record after midnight', async () => {
  const root = await createTemporaryTestRoot()
  let app: ElectronApplication | undefined
  try {
    app = await launch(root)
    const page = await app.firstWindow()
    await date(app, 10)
    await seed(page, '跨日合成例行')
    await nav(page, '例行')
    await page.locator('.goal-list-item').filter({ hasText: '跨日合成例行' }).click()
    const panel = page.getByLabel('跨日合成例行 例行记录', { exact: true })
    await expect(panel).toBeVisible()
    await panel.getByRole('button', { name: '记录例行', exact: true }).click()
    await panel.getByLabel('简述（可选）', { exact: true }).fill('属于开始日的文字')
    await date(app, 11)
    await panel.getByRole('button', { name: '保存例行记录', exact: true }).click()
    await expect(panel.getByRole('button', { name: '保留开始日', exact: true })).toBeVisible()
    await test.step('confirm captured date', () =>
      panel.getByRole('button', { name: '保留开始日', exact: true }).click())
    await expect(panel.getByRole('status')).toContainText('2026-08-10')
    await expect(panel.getByRole('button', { name: /查看记录/ })).toBeVisible()
    await test.step('open captured record', () =>
      panel.getByRole('button', { name: /查看记录/ }).click())
    const selected = page.getByLabel('所选记录')
    await expect(selected).toContainText('2026-08-10')
    await expect(selected).toContainText('属于开始日的文字')
    await nav(page, '例行')
    await expect(panel.locator('.routine-record-state strong')).toHaveText('未记录')
    await expect(panel.getByRole('button', { name: /查看记录/ })).toHaveCount(0)
  } finally {
    await test.step('close isolated app', async () => {
      await app?.close()
    })
    await removeTemporaryTestRoot(root)
  }
})
