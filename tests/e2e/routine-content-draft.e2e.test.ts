import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

test.skip(
  process.platform !== 'win32',
  'Native acceptance runs on Windows with the sandbox enabled.'
)

async function fixture(
  run: (page: Page, app: ElectronApplication, ids: string[]) => Promise<void>
): Promise<void> {
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
    const ids = await page.evaluate(async () => {
      const ids: string[] = []
      for (let i = 1; i <= 8; i++) {
        const result = await window.myTracer.routines.create({
          arrangementMode: 'weekly' as const,
          name: `草稿例行${i}`,
          minimumAction: '做一步',
          weekdays: [1, 3]
        })
        if (!result.ok) throw new Error('Fixture failed')
        ids.push(result.value.id)
      }
      return ids
    })
    await navigate(page, '例行')
    await page
      .getByLabel('例行列表', { exact: true })
      .getByRole('button', { name: /草稿例行1 / })
      .click()
    await openEditor(page)
    await run(page, app, ids)
  } finally {
    try {
      await app?.close()
    } finally {
      await removeTemporaryTestRoot(root)
    }
  }
}
async function navigate(page: Page, name: string): Promise<void> {
  await page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
}
const detail = (page: Page) => page.locator('.routine-workspace .goal-detail')
async function openEditor(page: Page): Promise<void> {
  const disclosure = detail(page)
    .locator('details')
    .filter({ has: page.getByText('编辑内容和安排', { exact: true }) })
  await expect(disclosure).toBeVisible()
  if (!(await disclosure.evaluate((element) => (element as HTMLDetailsElement).open)))
    await disclosure.locator('summary').click()
  await expect(detail(page).getByLabel('名称', { exact: true })).toBeEditable()
}

test('content and schedule drafts survive selection, sidebar return and lifecycle refresh independently of recording drafts', async () => {
  await fixture(async (page, _app, ids) => {
    const panel = detail(page)
    await panel.getByRole('button', { name: '记录例行', exact: true }).click()
    await panel.getByLabel('投入时长（分钟，可选）').fill('11')
    const before = await page.evaluate(() => window.myTracer.dataControl.list())
    expect(before.ok).toBe(true)
    if (!before.ok) throw Error('Cannot establish the persisted-data baseline')
    const readStored = async () => {
      const result = await page.evaluate(
        (routineId) => window.myTracer.routines.getDetail({ routineId }),
        ids[0]
      )
      expect(result.ok).toBe(true)
      if (!result.ok) throw Error('Cannot verify persisted routine fields')
      return result.value
    }
    const original = await readStored()
    await panel.getByLabel('名称', { exact: true }).fill('未保存名称')
    await panel.getByLabel('最小行动', { exact: true }).fill('未保存最小行动')
    await panel.getByRole('checkbox', { name: '周日', exact: true }).check()
    const search = page.getByLabel('搜索例行', { exact: true })
    await search.fill('没有匹配')
    await search.fill('')
    await page
      .getByLabel('例行列表分页')
      .getByRole('button', { name: '下一页', exact: true })
      .click()
    await expect(panel.getByLabel('名称', { exact: true })).toHaveValue('未保存名称')
    await page
      .getByLabel('例行列表分页')
      .getByRole('button', { name: '上一页', exact: true })
      .click()
    await page
      .getByLabel('例行列表', { exact: true })
      .getByRole('button', { name: /草稿例行1 / })
      .click()
    await expect(panel.getByLabel('名称', { exact: true })).toHaveValue('未保存名称')
    await navigate(page, '首页')
    await navigate(page, '例行')
    await openEditor(page)
    await expect(panel.getByLabel('最小行动', { exact: true })).toHaveValue('未保存最小行动')
    await expect(panel.getByRole('checkbox', { name: '周日', exact: true })).toBeChecked()
    await expect(panel.getByLabel('投入时长（分钟，可选）')).toHaveValue('11')
    const after = await page.evaluate(() => window.myTracer.dataControl.list())
    expect(after.ok).toBe(true)
    if (!after.ok) throw Error('Cannot verify persisted data after navigation')
    expect(after.value).toEqual(before.value)
    expect(await readStored()).toEqual(original)
    await page
      .getByLabel('例行列表', { exact: true })
      .getByRole('button', { name: /草稿例行2 / })
      .click()
    await page.getByRole('button', { name: '继续编辑当前例行', exact: true }).click()
    await expect(panel.getByLabel('名称', { exact: true })).toHaveValue('未保存名称')
    await panel.getByRole('button', { name: '暂停', exact: true }).click()
    await expect(panel.getByRole('button', { name: '恢复', exact: true })).toBeEnabled()
    await expect(panel.getByLabel('名称', { exact: true })).toHaveValue('未保存名称')
    await panel.getByRole('button', { name: '恢复', exact: true }).click()
    await expect(panel.getByRole('button', { name: '暂停', exact: true })).toBeEnabled()
    await panel.getByRole('button', { name: '结束例行', exact: true }).click()
    await panel.getByRole('alertdialog').getByRole('button', { name: '取消', exact: true }).click()
    await expect(panel.getByLabel('名称', { exact: true })).toHaveValue('未保存名称')
    await panel.getByRole('button', { name: '保存内容修改', exact: true }).click()
    await expect(panel.getByLabel('例行安排')).toContainText('未保存最小行动')
    const afterContent = await readStored()
    expect(afterContent).toMatchObject({
      arrangementMode: 'weekly' as const,
      name: '未保存名称',
      minimumAction: '未保存最小行动',
      description: original.description,
      weekdays: original.weekdays
    })
    await expect(panel.getByRole('checkbox', { name: '周日', exact: true })).toBeChecked()
    await panel.getByLabel('说明（可选）', { exact: true }).fill('另一部分的草稿')
    await panel.getByRole('button', { name: '保存安排', exact: true }).click()
    await expect(panel.getByLabel('例行安排')).toContainText('周一、三、日')
    expect(await readStored()).toMatchObject({
      arrangementMode: 'weekly' as const,
      name: afterContent.name,
      minimumAction: afterContent.minimumAction,
      description: afterContent.description,
      weekdays: [1, 3, 7]
    })
    await expect(panel.getByLabel('说明（可选）', { exact: true })).toHaveValue('另一部分的草稿')
    await panel.getByRole('button', { name: '结束例行', exact: true }).click()
    await panel.getByRole('button', { name: '确认结束', exact: true }).click()
    await expect(
      panel.getByText('这个例行已结束且不能恢复；当前内容、节奏与历史仍会保留。')
    ).toBeVisible()
    await expect(panel.getByLabel('说明（可选）', { exact: true })).toHaveValue('另一部分的草稿')
    await page
      .getByLabel('例行列表', { exact: true })
      .getByRole('button', { name: /草稿例行2 / })
      .click()
    await page.getByRole('button', { name: '放弃修改并切换', exact: true }).click()
    await expect(panel.getByLabel('名称', { exact: true })).toHaveValue('草稿例行2')
    const snapshot = await page.evaluate(() => window.myTracer.dataControl.list())
    expect(snapshot.ok && snapshot.value.routineRecords).toEqual([])
  })
})

test('late save acknowledgements retain newer typing across navigation and repeated reads', async () => {
  await fixture(async (page, app, ids) => {
    await app.evaluate(({ ipcMain }) => {
      const handlers = Reflect.get(ipcMain, '_invokeHandlers') as Map<
        string,
        (...args: unknown[]) => unknown
      >
      const original = handlers.get('routines:update-details')!
      ipcMain.removeHandler('routines:update-details')
      ipcMain.handle('routines:update-details', async (...args) => {
        const result = await original(...args)
        return new Promise((resolve) =>
          Reflect.set(globalThis, '__releaseRoutineSave', () => resolve(result))
        )
      })
    })
    const panel = detail(page)
    await panel.getByLabel('名称', { exact: true }).fill('提交名称')
    await panel.getByRole('button', { name: '保存内容修改', exact: true }).click()
    await expect
      .poll(() => app.evaluate(() => typeof Reflect.get(globalThis, '__releaseRoutineSave')))
      .toBe('function')
    await panel.getByLabel('名称', { exact: true }).fill('回应前继续输入')
    await navigate(page, '首页')
    await navigate(page, '例行')
    await expect(panel.getByRole('button', { name: '放弃未保存修改', exact: true })).toBeDisabled()
    await app.evaluate(() => Reflect.get(globalThis, '__releaseRoutineSave')())
    await openEditor(page)
    await expect(panel.getByLabel('名称', { exact: true })).toHaveValue('回应前继续输入')
    const stored = await page.evaluate(
      (routineId) => window.myTracer.routines.getDetail({ routineId }),
      ids[0]
    )
    expect(stored.ok && stored.value.name).toBe('提交名称')
    await panel.getByRole('button', { name: '放弃未保存修改', exact: true }).click()
    await page.getByRole('button', { name: '继续编辑当前例行', exact: true }).click()
    await expect(panel.getByLabel('名称', { exact: true })).toHaveValue('回应前继续输入')
    await panel.getByRole('button', { name: '放弃未保存修改', exact: true }).click()
    await page.getByRole('button', { name: '放弃修改', exact: true }).click()
    await expect(panel.getByLabel('名称', { exact: true })).toHaveValue('提交名称')
  })
})

test('deleted routines retain copyable input without an invalid save or recreation', async () => {
  await fixture(async (page, _app, ids) => {
    await detail(page).getByLabel('名称', { exact: true }).fill('删除后仍可复制')
    await detail(page).getByLabel('最小行动', { exact: true }).fill('保留我的输入')
    await navigate(page, '数据')
    await page.evaluate(async (id) => {
      const target = { type: 'routine' as const, id }
      const preview = await window.myTracer.dataControl.previewDelete({ target })
      if (!preview.ok) throw new Error('Preview failed')
      const result = await window.myTracer.dataControl.confirmDelete({
        target,
        previewId: preview.value.previewId,
        confirmation: 'permanently-delete'
      })
      if (!result.ok) throw new Error('Delete failed')
    }, ids[0])
    await navigate(page, '例行')
    const panel = detail(page)
    await expect(panel).toContainText('例行已不存在')
    await panel.getByText('编辑内容和安排', { exact: true }).click()
    const name = panel.getByLabel('名称', { exact: true })
    await expect(name).toHaveValue('删除后仍可复制')
    await expect(name).toHaveAttribute('readonly', '')
    await name.focus()
    await page.keyboard.press('Control+A')
    expect(await name.evaluate((element) => (element as HTMLInputElement).selectionEnd)).toBe(
      '删除后仍可复制'.length
    )
    await expect(panel.getByRole('button', { name: '保存内容修改', exact: true })).toBeDisabled()
    await expect(panel.getByRole('button', { name: '保存安排', exact: true })).toBeDisabled()
    await panel.getByRole('button', { name: '放弃未保存修改', exact: true }).click()
    const warning = page.getByRole('alert', { name: '未保存的例行修改' })
    await expect(warning).toContainText(
      '例行已不存在，不能保存。请先复制需要保留的文字，再决定是否放弃。'
    )
    await expect(
      warning.getByRole('button', { name: '继续编辑当前例行', exact: true })
    ).toHaveCount(0)
    await warning.getByRole('button', { name: '返回查看或复制', exact: true }).click()
    await expect(name).toHaveValue('删除后仍可复制')
    await expect(name).toHaveAttribute('readonly', '')
    await panel.getByRole('button', { name: '放弃未保存修改', exact: true }).click()
    await page.getByRole('button', { name: '放弃修改', exact: true }).click()
    await expect(panel).toHaveCount(0)
    const stored = await page.evaluate(
      (routineId) => window.myTracer.routines.getDetail({ routineId }),
      ids[0]
    )
    expect(stored.ok).toBe(false)
  })
})

test('failed revalidation keeps a retry after discard, and late reads cannot change the selected routine', async () => {
  await fixture(async (page, app) => {
    await detail(page).getByLabel('名称', { exact: true }).fill('失败前输入')
    await navigate(page, '首页')
    await app.evaluate(({ ipcMain }) => {
      const handlers = Reflect.get(ipcMain, '_invokeHandlers') as Map<
        string,
        (...args: unknown[]) => unknown
      >
      const original = handlers.get('routines:get-detail')!
      let first = true
      ipcMain.removeHandler('routines:get-detail')
      ipcMain.handle('routines:get-detail', (...args) => {
        if (first) {
          first = false
          return { ok: false, error: { code: 'persistence-failed' } }
        }
        return original(...args)
      })
    })
    await navigate(page, '例行')
    const panel = detail(page)
    await expect(panel.getByRole('button', { name: '重新读取例行', exact: true })).toBeVisible()
    await panel.getByRole('button', { name: '放弃未保存修改', exact: true }).click()
    await page.getByRole('button', { name: '放弃修改', exact: true }).click()
    await expect(panel.getByText('编辑内容和安排', { exact: true })).toBeFocused()
    await panel.getByRole('button', { name: '重新读取例行', exact: true }).click()
    await openEditor(page)
    await expect(panel.getByLabel('名称', { exact: true })).toHaveValue('草稿例行1')
    await app.evaluate(({ ipcMain }) => {
      const handlers = Reflect.get(ipcMain, '_invokeHandlers') as Map<
        string,
        (...args: unknown[]) => unknown
      >
      const original = handlers.get('routines:get-detail')!
      let first = true
      ipcMain.removeHandler('routines:get-detail')
      ipcMain.handle('routines:get-detail', async (...args) => {
        const result = await original(...args)
        if (!first) return result
        first = false
        return new Promise((resolve) =>
          Reflect.set(globalThis, '__releaseRoutineRead', () => resolve(result))
        )
      })
    })
    const list = page.getByLabel('例行列表', { exact: true })
    await list.getByRole('button', { name: /草稿例行1 / }).click()
    await expect
      .poll(() => app.evaluate(() => typeof Reflect.get(globalThis, '__releaseRoutineRead')))
      .toBe('function')
    await list.getByRole('button', { name: /草稿例行2 / }).click()
    await expect(panel.getByLabel('名称', { exact: true })).toHaveValue('草稿例行2')
    await panel.getByLabel('名称', { exact: true }).fill('属于第二个例行')
    await app.evaluate(() => Reflect.get(globalThis, '__releaseRoutineRead')())
    await navigate(page, '首页')
    await navigate(page, '例行')
    await openEditor(page)
    await expect(panel.getByLabel('名称', { exact: true })).toHaveValue('属于第二个例行')
  })
})

for (const newerCreationInput of [false, true]) {
  test(`late creation acknowledges success without losing selection or newer form input (${newerCreationInput})`, async () => {
    await fixture(async (page, app) => {
      await app.evaluate(({ ipcMain }) => {
        const handlers = Reflect.get(ipcMain, '_invokeHandlers') as Map<
          string,
          (...args: unknown[]) => unknown
        >
        const original = handlers.get('routines:create')!
        ipcMain.removeHandler('routines:create')
        ipcMain.handle('routines:create', async (...args) => {
          const result = await original(...args)
          return new Promise((resolve) =>
            Reflect.set(globalThis, '__releaseRoutineCreate', () => resolve(result))
          )
        })
      })
      await page.getByRole('button', { name: '新建例行', exact: true }).click()
      const create = page.getByRole('form', { name: '新建例行表单' })
      await create.getByLabel('名称', { exact: true }).fill('已提交的新例行')
      await create.getByLabel('最小行动', { exact: true }).fill('新的一步')
      await create.getByRole('button', { name: '创建例行', exact: true }).click()
      await expect
        .poll(() => app.evaluate(() => typeof Reflect.get(globalThis, '__releaseRoutineCreate')))
        .toBe('function')
      if (newerCreationInput) {
        await create.getByLabel('名称', { exact: true }).fill('下一份新建输入')
        await create.getByLabel('最小行动', { exact: true }).fill('尚未提交的一步')
      }
      await page
        .getByLabel('例行列表', { exact: true })
        .getByRole('button', { name: /草稿例行2 / })
        .click()
      await openEditor(page)
      await detail(page).getByLabel('名称', { exact: true }).fill('新建期间切换后的输入')
      await app.evaluate(() => Reflect.get(globalThis, '__releaseRoutineCreate')())
      await expect(detail(page).getByLabel('名称', { exact: true })).toHaveValue(
        '新建期间切换后的输入'
      )
      const list = page.getByLabel('例行列表', { exact: true })
      await expect(list.locator('.workspace-count')).toContainText('9 个例行')
      const search = page.getByPlaceholder('搜索例行…')
      await search.fill('已提交的新例行')
      await expect(list.getByRole('button', { name: /已提交的新例行 / })).toBeVisible()
      await expect(detail(page)).toHaveAttribute('aria-label', '草稿例行2 例行详情')
      await expect(detail(page).getByLabel('名称', { exact: true })).toHaveValue(
        '新建期间切换后的输入'
      )
      // Finish this content edit explicitly so reopening creation does not discard it.
      await detail(page).getByRole('button', { name: '保存内容修改', exact: true }).click()
      await expect(detail(page)).toHaveAttribute('aria-label', '新建期间切换后的输入 例行详情')
      await page.getByRole('button', { name: '新建例行', exact: true }).click()
      await expect(create.getByLabel('名称', { exact: true })).toHaveValue(
        newerCreationInput ? '下一份新建输入' : ''
      )
      await expect(create.getByLabel('最小行动', { exact: true })).toHaveValue(
        newerCreationInput ? '尚未提交的一步' : ''
      )
      const persisted = await page.evaluate(() => window.myTracer.routines.list({}))
      expect(
        persisted.ok && persisted.value.filter((item) => item.name === '已提交的新例行')
      ).toHaveLength(1)
      expect(persisted.ok && persisted.value.some((item) => item.name === '下一份新建输入')).toBe(
        false
      )
    })
  })
}
