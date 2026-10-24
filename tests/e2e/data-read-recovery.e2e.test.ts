import { openRecordNote } from '../support/ui-disclosure'
import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { _electron as electron } from 'playwright'
import type { DataControlListDto } from '../../src/contracts/data-control'
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

async function setRead(
  app: ElectronApplication,
  data: DataControlListDto | null,
  delay = false
): Promise<void> {
  await app.evaluate(
    ({ ipcMain }, { data, delay }) => {
      ipcMain.removeHandler('data-control:list')
      Reflect.set(globalThis, '__dataReadCalls', 0)
      ipcMain.handle('data-control:list', () => {
        Reflect.set(
          globalThis,
          '__dataReadCalls',
          Number(Reflect.get(globalThis, '__dataReadCalls')) + 1
        )
        const result = data
          ? { ok: true, value: data }
          : { ok: false, error: { code: 'persistence-failed', message: 'synthetic read failure' } }
        if (!delay) return result
        return new Promise((resolve) => {
          Reflect.set(globalThis, '__releaseDataRead', () => resolve(result))
        })
      })
    },
    { data, delay }
  )
}

async function releaseRead(app: ElectronApplication): Promise<void> {
  await app.evaluate(() => {
    const release = Reflect.get(globalThis, '__releaseDataRead') as (() => void) | undefined
    if (!release) throw new Error('No pending read')
    release()
    Reflect.deleteProperty(globalThis, '__releaseDataRead')
  })
}

async function snapshot(page: Page): Promise<DataControlListDto> {
  return page.evaluate(async () => {
    const result = await window.myTracer.dataControl.list()
    if (!result.ok) throw new Error('Cannot read synthetic fixture')
    return result.value
  })
}

async function openData(page: Page): Promise<void> {
  await page.getByRole('navigation').getByRole('button', { name: '数据', exact: true }).click()
}

test('failed reads stay distinct from loading and empty results, and keyboard retry recovers', async () => {
  await withApplication(async (app, page) => {
    const empty = await snapshot(page)
    await setRead(app, null, true)
    await openData(page)
    await expect(page.locator('.data-read-state').getByRole('status')).toContainText(
      '正在读取记录…'
    )
    await expect(page.locator('.data-history-count')).toHaveCount(0)
    await expect(page.getByText('当前筛选下没有记录。', { exact: true })).toHaveCount(0)
    await releaseRead(app)
    await expect(page.getByRole('alert')).toContainText('这不表示记录不存在')
    await expect(page.getByText('正在读取记录…', { exact: true })).toHaveCount(0)
    await expect(page.locator('.data-history-count')).toHaveCount(0)
    const retry = page.getByRole('button', { name: '重新读取', exact: true })
    await setRead(app, null)
    await retry.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('alert')).toContainText('这不表示记录不存在')
    await expect(retry).toBeFocused()
    // Rejected IPC promises must also leave a recoverable error rather than an endless spinner.
    await app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('data-control:list')
      ipcMain.handle('data-control:list', () => {
        throw new Error('synthetic rejected read')
      })
    })
    await retry.click()
    await expect(page.getByRole('alert')).toContainText('这不表示记录不存在')
    await setRead(app, empty)
    await retry.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(
      page.getByText('还没有保存的记录，可以先记一笔或补记。', { exact: true })
    ).toBeVisible()
    await expect(page.locator('.data-history-count')).toHaveText('0 条 · 每页 8 条')
    await expect(retry).toBeFocused()
  })
})

test('retry retains filters, page, selection and drafts; a late read cannot replace a newer mutation refresh', async () => {
  test.slow()
  await withApplication(async (app, page) => {
    await page.evaluate(async () => {
      const action = await window.myTracer.actions.create({ title: '合成阅读记录' })
      if (!action.ok) throw new Error('Fixture action failed')
      for (let day = 11; day <= 20; day++) {
        const record = await window.myTracer.dataControl.backfillActionRecord({
          actionId: action.value.id,
          occurredOn: `2026-08-${day}`,
          durationMinutes: day,
          outcome: 'partial'
        })
        if (!record.ok) throw new Error('Fixture record failed')
      }
    })
    const original = await snapshot(page)
    await openData(page)
    await page.getByRole('button', { name: /筛选记录 ·/ }).click()
    await page.getByRole('combobox', { name: /记录类型/ }).selectOption('action-record')
    await page.getByRole('button', { name: '完成筛选' }).click()
    await page.getByRole('button', { name: '下一页', exact: true }).click()
    const rows = page.locator('.data-history-row')
    await rows.last().click()
    const selected = page.getByLabel('所选记录')
    await expect(selected).toContainText('2026-08-11')
    await setRead(app, null)
    const retry = page.getByRole('button', { name: '重新读取', exact: true })
    await retry.click()
    await expect(page.getByRole('alert')).toContainText('可能不是最新结果')
    await expect(page.getByLabel('历史记录分页')).toContainText('第 2 / 2 页')
    await expect(rows.last()).toHaveAttribute('aria-pressed', 'true')
    await selected.getByRole('button', { name: '编辑记录', exact: true }).click()
    await page.getByLabel('行动分钟', { exact: true }).fill('42')
    await setRead(app, original)
    await retry.click()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(page.getByLabel('行动分钟', { exact: true })).toHaveValue('42')
    await page.getByRole('button', { name: /筛选记录 ·/ }).click()
    await expect(page.getByRole('combobox', { name: /记录类型/ })).toHaveValue('action-record')
    await page.getByRole('button', { name: '完成筛选' }).click()
    await expect(page.getByLabel('历史记录分页')).toContainText('第 2 / 2 页')
    // Hold an old failure; saving the editor starts a newer successful read.
    await setRead(app, null, true)
    await retry.click()
    await expect(retry).toHaveAttribute('aria-disabled', 'true')
    await expect.poll(() => app.evaluate(() => Reflect.get(globalThis, '__dataReadCalls'))).toBe(1)
    await retry.focus()
    await page.keyboard.press('Enter')
    expect(await app.evaluate(() => Reflect.get(globalThis, '__dataReadCalls'))).toBe(1)
    const record = original.actionRecords.find((item) => item.occurredOn === '2026-08-11')!
    const updated = {
      ...original,
      actionRecords: original.actionRecords.map((item) =>
        item.id === record.id ? { ...item, durationMinutes: 42 } : item
      )
    }
    await setRead(app, updated)
    await selected.getByRole('button', { name: '保存修改', exact: true }).click()
    await expect(selected.getByRole('button', { name: '编辑记录', exact: true })).toBeVisible()
    await expect(selected).toContainText('42 分钟')
    await releaseRead(app)
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(selected).toContainText('42 分钟')
    await expect(page.locator('.data-history-count')).not.toContainText('上次读取')
    // A changed result must not unmount the selected editor and discard its draft.
    await selected.getByRole('button', { name: '编辑记录', exact: true }).click()
    await page.getByLabel('行动分钟', { exact: true }).fill('43')
    await setRead(app, {
      ...updated,
      actionRecords: updated.actionRecords.filter((item) => item.id !== record.id)
    })
    await retry.click()
    await expect(page.getByRole('alert')).toContainText('请先保存或取消当前修改')
    await expect(page.getByLabel('行动分钟', { exact: true })).toHaveValue('43')
    await selected.getByRole('button', { name: '取消编辑', exact: true }).click()
    await retry.click()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(selected).toContainText('2026-08-12')
  })
})

for (const kind of ['action', 'routine'] as const) {
  test(`rereading cannot retarget an unfinished ${kind} backfill draft`, async () => {
    await withApplication(async (app, page) => {
      const ids = await page.evaluate(async (kind) => {
        const create = async (title: string): Promise<string> => {
          const result =
            kind === 'action'
              ? await window.myTracer.actions.create({ title })
              : await window.myTracer.routines.create({
                  arrangementMode: 'weekly' as const,
                  name: title,
                  minimumAction: '做一点',
                  weekdays: [1, 2, 3, 4, 5, 6, 7]
                })
          if (!result.ok) throw new Error('Cannot create backfill fixture')
          return result.value.id
        }
        return [await create('原补记对象'), await create('另一个对象')]
      }, kind)
      const original = await snapshot(page)
      await openData(page)
      await page.getByRole('button', { name: '补记记录', exact: true }).click()
      await page.getByLabel('补记类型', { exact: true }).selectOption(kind)
      const label = kind === 'action' ? '行动' : '例行'
      const picker = page.getByLabel(`补记${label}`, { exact: true })
      await picker.selectOption(ids[0])
      await page.getByLabel(`${label}补记日期`, { exact: true }).fill('2026-08-20')
      await openRecordNote(page.getByLabel(`${label}补记备注`, { exact: true }))
      await page.getByLabel(`${label}补记备注`, { exact: true }).fill('只属于原对象的草稿')
      if (kind === 'action') {
        await page.getByLabel('行动补记分钟', { exact: true }).fill('-1')
        await page.getByRole('button', { name: '补记行动记录', exact: true }).click()
        await expect(page.locator('.form-error')).toContainText('请检查日期')
        await setRead(app, original)
        await page.getByRole('button', { name: '关闭补记历史记录' }).click()
        await page.getByRole('button', { name: '重新读取', exact: true }).click()
        await expect(page.locator('.form-error')).toContainText('请检查日期')
        await page.getByRole('button', { name: /补记记录/ }).click()
        await page.getByLabel('行动补记分钟', { exact: true }).fill('8')
      }
      await setRead(app, {
        ...original,
        actions:
          kind === 'action'
            ? original.actions.filter((item) => item.id !== ids[0])
            : original.actions,
        routines:
          kind === 'routine'
            ? original.routines.filter((item) => item.id !== ids[0])
            : original.routines
      })
      await page.getByRole('button', { name: '关闭补记历史记录' }).click()
      await page.getByRole('button', { name: '重新读取', exact: true }).click()
      await expect(page.locator('.data-read-state').getByRole('alert')).toContainText(
        '补记对象已变化'
      )
      await page.getByRole('button', { name: /补记记录/ }).click()
      await expect(picker).toHaveValue(ids[0])
      await expect(page.getByLabel(`${label}补记备注`, { exact: true })).toHaveValue(
        '只属于原对象的草稿'
      )
      await page.getByRole('button', { name: '清空当前草稿' }).click()
      await page.getByRole('button', { name: '放弃草稿', exact: true }).click()
      await page.getByRole('button', { name: '关闭补记历史记录' }).click()
      await page.getByRole('button', { name: '重新读取', exact: true }).click()
      await expect(page.locator('.data-read-state').getByRole('alert')).toHaveCount(0)
      await page.getByRole('button', { name: /补记记录/ }).click()
      await expect(picker).toHaveValue(ids[1])
      await expect(page.getByLabel(`${label}补记备注`, { exact: true })).toHaveValue('')
    })
  })
}
