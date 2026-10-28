import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { _electron as electron } from 'playwright'
import type { DataControlListDto } from '../../src/contracts/data-control'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

async function withApplication(run: (app: ElectronApplication, page: Page) => Promise<void>) {
  const root = await createTemporaryTestRoot()
  let app: ElectronApplication | undefined
  try {
    app = await electron.launch({
      chromiumSandbox: true,
      cwd: root.root,
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

async function seed(page: Page) {
  return page.evaluate(async () => {
    const goal = await window.myTracer.goals.create({
      name: '合成对读目标',
      initialNextAction: { title: '合成阅读行动' }
    })
    if (!goal.ok) throw new Error(goal.error.message)
    const ids: string[] = []
    for (const [date, summary] of [
      ['2026-08-01', '旧记录'],
      ['2026-08-20', '同日记录'],
      ['2026-08-20', '当前记录']
    ]) {
      const record = await window.myTracer.dataControl.backfillActionRecord({
        actionId: goal.value.currentNextActionId!,
        occurredOn: date,
        durationMinutes: summary === '旧记录' ? null : 0,
        outcome: 'partial',
        summary,
        note: Array.from({ length: 40 }, (_, i) => `合成笔记第 ${i + 1} 段，完整阅读不截断。`).join(
          '\n\n'
        ),
        understanding: '原始理解',
        confusion: '尚待解答',
        nextStep: '保留下一步'
      })
      if (!record.ok) throw new Error(record.error.message)
      ids.push(record.value.id)
    }
    const list = await window.myTracer.dataControl.list()
    if (!list.ok) throw new Error(list.error.message)
    return { ids, data: list.value }
  })
}

async function openCurrent(page: Page) {
  await page.getByRole('navigation').getByRole('button', { name: '数据', exact: true }).click()
  await page.getByLabel('查找保存的文字').fill('当前记录')
  await page.locator('.data-history-row').click()
  await expect(page.getByLabel('所选记录')).toContainText('当前记录')
}

async function overrideRead(
  app: ElectronApplication,
  data: DataControlListDto | null,
  delayed = false
) {
  await app.evaluate(
    ({ ipcMain }, { data, delayed }) => {
      ipcMain.removeHandler('data-control:list')
      ipcMain.handle('data-control:list', () => {
        const value = data
          ? { ok: true, value: data }
          : { ok: false, error: { code: 'persistence-failed', message: 'synthetic failure' } }
        return delayed
          ? new Promise((resolve) =>
              Reflect.set(globalThis, '__releaseSameGoalRead', () => resolve(value))
            )
          : value
      })
    },
    { data, delayed }
  )
}

test('same-goal originals are read-only, full length, same-day aware and restore reading context', async () => {
  test.slow()
  await withApplication(async (_app, page) => {
    const { ids, data } = await seed(page)
    await openCurrent(page)
    const detail = page.getByLabel('所选记录')
    await detail.getByText('展开完整笔记', { exact: true }).click()
    const trigger = detail.getByRole('button', { name: '同目标对读', exact: true })
    await trigger.focus()
    // Keyboard activation must preserve the user's scroll even when the trigger
    // remains focused outside the viewport after scrolling a long original.
    await detail.evaluate((element) => {
      element.scrollTop = 180
    })
    await expect.poll(() => detail.evaluate((element) => element.scrollTop)).toBe(180)
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: '同目标对读' })
    await expect(dialog.getByRole('button', { name: '返回原记录' })).toBeFocused()
    await dialog.getByLabel('选择另一条记录').selectOption(ids[0])
    const other = dialog.getByRole('article', { name: '对读记录', exact: true })
    await expect(other).toContainText('2026-08-01')
    await expect(other).toContainText('时长未记录')
    await expect(dialog.getByRole('article', { name: '当前记录', exact: true })).toContainText(
      '少于 1 分钟'
    )
    await other.getByText('展开完整笔记', { exact: true }).click()
    await expect(other).toContainText('合成笔记第 40 段')
    await expect(other).toContainText('原始理解')
    await dialog.getByLabel('选择另一条记录').selectOption(ids[1])
    await expect(other).toContainText('同日记录')
    await expect(dialog.locator('option:checked')).toContainText('同日')
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
    await expect.poll(() => detail.evaluate((element) => element.scrollTop)).toBe(180)
    await expect(page.getByLabel('查找保存的文字')).toHaveValue('当前记录')
    await expect(detail.locator('.record-note-details')).toHaveAttribute('open', '')
    await page.keyboard.press('Enter')
    await expect(dialog.getByLabel('选择另一条记录')).toHaveValue('')
    await dialog.getByRole('button', { name: '返回原记录' }).click()
    expect(
      await page.evaluate(async () => {
        const value = await window.myTracer.dataControl.list()
        if (!value.ok) throw new Error('read failed')
        return value.value
      })
    ).toEqual(data)
  })
})

test('failed, late, edited and deleted reads never present stale originals as current', async () => {
  test.slow()
  await withApplication(async (app, page) => {
    const { ids, data } = await seed(page)
    await openCurrent(page)
    const trigger = page.getByRole('button', { name: '同目标对读', exact: true })
    await overrideRead(app, null)
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: '同目标对读' })
    await expect(dialog.getByRole('alert')).toContainText('这不表示记录不存在')
    await expect(dialog.getByRole('article')).toHaveCount(0)
    await overrideRead(app, data)
    await dialog.getByRole('button', { name: '重新读取对读' }).click()
    await dialog.getByLabel('选择另一条记录').selectOption(ids[0])
    await expect(dialog.getByRole('article', { name: '对读记录' })).toContainText('旧记录')
    await overrideRead(app, data, true)
    await dialog.getByRole('button', { name: '重新读取对读' }).click()
    await expect(dialog.getByRole('status')).toContainText('正在读取')
    await expect(dialog.getByRole('article')).toHaveCount(0)
    const edited = {
      ...data,
      actionRecords: data.actionRecords.map((r) =>
        r.id === ids[1] ? { ...r, summary: '修订原文' } : r
      )
    }
    await overrideRead(app, edited)
    await dialog.getByLabel('选择另一条记录').selectOption(ids[1])
    await expect(dialog.getByRole('article', { name: '对读记录' })).toContainText('修订原文')
    await app.evaluate(() => (Reflect.get(globalThis, '__releaseSameGoalRead') as () => void)())
    await expect(dialog.getByRole('article', { name: '对读记录' })).toContainText('修订原文')
    await overrideRead(app, {
      ...edited,
      actionRecords: edited.actionRecords.filter((r) => r.id !== ids[1])
    })
    await dialog.getByRole('button', { name: '重新读取对读' }).click()
    await expect(dialog.getByRole('status')).toContainText('已不在当前对读范围')
    await expect(dialog.getByRole('article', { name: '对读记录' })).toHaveCount(0)
    await overrideRead(app, {
      ...data,
      actionRecords: data.actionRecords.filter((r) => r.id !== ids[2])
    })
    await dialog.getByRole('button', { name: '重新读取对读' }).click()
    await expect(dialog.getByRole('status')).toContainText('当前记录或来源行动已不存在')
    await expect(dialog.getByRole('article')).toHaveCount(0)
    await overrideRead(app, data, true)
    await dialog.getByRole('button', { name: '重新读取对读' }).click()
    await expect(dialog.getByRole('status')).toContainText('正在读取')
    await page.keyboard.press('Escape')
    await overrideRead(app, edited)
    await trigger.click()
    await expect(dialog.getByLabel('选择另一条记录')).toBeVisible()
    await app.evaluate(() => (Reflect.get(globalThis, '__releaseSameGoalRead') as () => void)())
    await expect(dialog.getByLabel('选择另一条记录')).toHaveValue('')
    await dialog.getByLabel('选择另一条记录').selectOption(ids[1])
    await expect(dialog.getByRole('article', { name: '对读记录' })).toContainText('修订原文')
  })
})

test('no goal, empty candidates, changed goal and narrow layout remain explicit', async () => {
  await withApplication(async (app, page) => {
    const { data } = await seed(page)
    await openCurrent(page)
    const trigger = page.getByRole('button', { name: '同目标对读', exact: true })
    await overrideRead(app, { ...data, actions: data.actions.map((a) => ({ ...a, goalId: null })) })
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: '同目标对读' })
    await expect(dialog.getByRole('status')).toContainText('未关联可用目标')
    await expect(dialog.getByRole('article', { name: '当前记录' })).toBeVisible()
    await dialog.getByRole('button', { name: '返回原记录' }).click()
    const goal = { id: 'new-goal', title: '另一个合成目标', status: 'active' as const }
    const changed = {
      ...data,
      goals: [goal],
      actions: data.actions.map((a) => ({ ...a, goalId: goal.id })),
      actionRecords: data.actionRecords.filter((r) => r.summary === '当前记录')
    }
    await overrideRead(app, changed)
    await trigger.click()
    await expect(dialog).toContainText('目标：另一个合成目标')
    await expect(dialog.getByRole('status')).toContainText('没有符合日期范围的其他行动记录')
    await page.setViewportSize({ width: 700, height: 700 })
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true
    )
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
  })
})
