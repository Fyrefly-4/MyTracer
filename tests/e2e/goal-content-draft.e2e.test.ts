import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

test.skip(
  process.platform !== 'win32',
  'Native acceptance requires Windows with the sandbox enabled.'
)

const panel = (page: Page) => page.locator('.goal-detail')
const nav = async (page: Page, name: string): Promise<void> => {
  await page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
}
async function openEditor(page: Page): Promise<void> {
  const disclosure = panel(page).locator('details.disclosure')
  if (!(await disclosure.evaluate((node) => (node as HTMLDetailsElement).open)))
    await disclosure.locator('summary').click()
  await expect(panel(page).getByLabel('目标名称', { exact: true })).toBeVisible()
}
async function select(page: Page, name: string): Promise<void> {
  await page.locator('.goal-list-item').filter({ hasText: name }).click()
}
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
        const result = await window.myTracer.goals.create({
          name: `内容目标${i}`,
          description: '原说明',
          initialNextAction: { title: `下一步${i}` }
        })
        if (!result.ok) throw new Error('Fixture failed')
        ids.push(result.value.id)
      }
      return ids
    })
    await nav(page, '目标')
    await select(page, '内容目标1')
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

// Delay only the response after the real command/read has completed, preserving its semantics.
async function holdResponse(app: ElectronApplication, channel: string): Promise<void> {
  await app.evaluate(({ ipcMain }, channel) => {
    const handlers = Reflect.get(ipcMain, '_invokeHandlers') as Map<
      string,
      (...args: unknown[]) => unknown
    >
    const original = handlers.get(channel)!
    let once = true
    ipcMain.removeHandler(channel)
    ipcMain.handle(channel, async (...args) => {
      const result = await original(...args)
      if (!once) return result
      once = false
      return new Promise((resolve) => {
        Reflect.set(globalThis, `__releaseGoalResponse:${channel}`, () => resolve(result))
      })
    })
  }, channel)
}
async function waitHeld(app: ElectronApplication, channel = 'goals:update-details'): Promise<void> {
  await expect
    .poll(() =>
      app.evaluate(
        (_electron, channel) => typeof Reflect.get(globalThis, `__releaseGoalResponse:${channel}`),
        channel
      )
    )
    .toBe('function')
}
async function release(app: ElectronApplication, channel = 'goals:update-details'): Promise<void> {
  await app.evaluate((_electron, channel) => {
    Reflect.get(globalThis, `__releaseGoalResponse:${channel}`)()
    Reflect.deleteProperty(globalThis, `__releaseGoalResponse:${channel}`)
  }, channel)
}

test('goal content survives filtering, same selection, sidebar and independent status/next-step refreshes', async () => {
  await fixture(async (page) => {
    const p = panel(page)
    await p.getByLabel('目标名称', { exact: true }).fill('未保存名称')
    await p.getByLabel('说明（可选）').fill('保留的说明\n第二行')
    const before = await page.evaluate(() => window.myTracer.dataControl.list())
    await page.getByLabel('搜索目标', { exact: true }).fill('不存在')
    await expect(p.getByLabel('目标名称', { exact: true })).toHaveValue('未保存名称')
    await page.getByLabel('搜索目标', { exact: true }).fill('')
    await page
      .getByLabel('目标列表分页', { exact: true })
      .getByRole('button', { name: '下一页' })
      .click()
    await expect(p.getByLabel('目标名称', { exact: true })).toHaveValue('未保存名称')
    await page
      .getByLabel('目标列表分页', { exact: true })
      .getByRole('button', { name: '上一页' })
      .click()
    await select(page, '内容目标1')
    await nav(page, '首页')
    await nav(page, '目标')
    await expect(p.getByLabel('说明（可选）')).toHaveValue('保留的说明\n第二行')
    expect(await page.evaluate(() => window.myTracer.dataControl.list())).toEqual(before)
    await p.getByLabel('选择当前下一步').selectOption('')
    await p.getByRole('button', { name: '保存当前下一步', exact: true }).click()
    await expect(p.locator('.next-action-panel')).toContainText('暂未设置')
    await expect(p.getByLabel('目标名称', { exact: true })).toHaveValue('未保存名称')
    await p.getByRole('button', { name: '暂停目标', exact: true }).click()
    await expect(p.getByRole('button', { name: '恢复目标', exact: true })).toBeVisible()
    await expect(p.getByLabel('说明（可选）')).toHaveValue('保留的说明\n第二行')
    await p.getByRole('button', { name: '恢复目标', exact: true }).click()
    await expect(p.getByRole('button', { name: '暂停目标', exact: true })).toBeVisible()
    await p.getByLabel('选择当前下一步').selectOption({ label: '新建下一步…' })
    await p.getByLabel('下一步名称', { exact: true }).fill('独立新下一步')
    await p.getByRole('button', { name: '创建并设为当前下一步' }).click()
    await expect(p.locator('.next-action-panel')).toContainText('独立新下一步')
    await expect(p.getByLabel('目标名称', { exact: true })).toHaveValue('未保存名称')
    await p.getByRole('button', { name: '结束目标', exact: true }).click()
    await p.getByRole('button', { name: '确认结束', exact: true }).click()
    await expect(p).toContainText('该目标已结束')
    await expect(p.getByLabel('说明（可选）')).toHaveValue('保留的说明\n第二行')
    await select(page, '内容目标2')
    const warning = page.getByRole('alertdialog', { name: '切换目标前处理内容草稿' })
    await expect(warning).toBeVisible()
    await warning.getByRole('button', { name: '继续编辑目标内容' }).click()
    await expect(p.getByLabel('目标名称', { exact: true })).toHaveValue('未保存名称')
    await select(page, '内容目标2')
    await warning.getByRole('button', { name: '放弃目标内容并切换' }).click()
    await expect(p.getByLabel('目标名称', { exact: true })).toHaveValue('内容目标2')
  })
})

test('delayed save preserves newer typing and never steals another goal selection', async () => {
  await fixture(async (page, app) => {
    const p = panel(page)
    await p.getByLabel('目标名称', { exact: true }).fill('提交名称')
    await holdResponse(app, 'goals:update-details')
    await p.getByRole('button', { name: '保存修改', exact: true }).click()
    await waitHeld(app)
    await p.getByLabel('目标名称', { exact: true }).fill('内容目标1')
    await nav(page, '首页')
    await nav(page, '目标')
    await expect(p.getByLabel('目标名称', { exact: true })).toHaveValue('内容目标1')
    await p.getByLabel('说明（可选）').fill('提交之后继续写')
    await release(app)
    await expect(p.getByRole('button', { name: '保存修改', exact: true })).toBeEnabled()
    await expect(p.getByLabel('说明（可选）')).toHaveValue('提交之后继续写')
    await holdResponse(app, 'goals:update-details')
    await p.getByRole('button', { name: '保存修改', exact: true }).click()
    await waitHeld(app)
    await holdResponse(app, 'goals:get-detail')
    await select(page, '内容目标2')
    await page.getByRole('button', { name: '放弃目标内容并切换' }).click()
    await waitHeld(app, 'goals:get-detail')
    await release(app)
    await release(app, 'goals:get-detail')
    await expect(p.locator('h2').first()).toHaveText('内容目标2')
    await openEditor(page)
    await p.getByLabel('说明（可选）').fill('另一个目标的新草稿')
    await expect(p.getByRole('button', { name: '保存修改', exact: true })).toBeEnabled()
    await expect(p.getByLabel('目标名称', { exact: true })).toHaveValue('内容目标2')
    await expect(p.getByLabel('说明（可选）')).toHaveValue('另一个目标的新草稿')
  })
})

test('late same-goal read cannot erase typing or a later goal selection', async () => {
  await fixture(async (page, app) => {
    await holdResponse(app, 'goals:get-detail')
    await select(page, '内容目标1')
    await waitHeld(app, 'goals:get-detail')
    await panel(page).getByLabel('说明（可选）').fill('读取期间的新说明')
    await release(app, 'goals:get-detail')
    await expect(panel(page).getByRole('button', { name: '保存修改', exact: true })).toBeEnabled()
    await expect(panel(page).getByLabel('说明（可选）')).toHaveValue('读取期间的新说明')
    await panel(page).getByRole('button', { name: '放弃目标内容修改' }).click()
    await holdResponse(app, 'goals:get-detail')
    await select(page, '内容目标1')
    await waitHeld(app, 'goals:get-detail')
    await select(page, '内容目标2')
    await expect(panel(page).locator('h2').first()).toHaveText('内容目标2')
    await release(app, 'goals:get-detail')
    await expect(panel(page).locator('h2').first()).toHaveText('内容目标2')
  })
})

test('save exception retains content for retry; missing original remains readable and never recreates data', async () => {
  await fixture(async (page, app, ids) => {
    await panel(page).getByLabel('说明（可选）').fill('必须保留的草稿')
    await app.evaluate(({ ipcMain }) => {
      const handlers = Reflect.get(ipcMain, '_invokeHandlers') as Map<
        string,
        (...args: unknown[]) => unknown
      >
      const original = handlers.get('goals:update-details')!
      let once = true
      ipcMain.removeHandler('goals:update-details')
      ipcMain.handle('goals:update-details', (...args) => {
        if (once) {
          once = false
          throw new Error('Synthetic failure')
        }
        return original(...args)
      })
    })
    await panel(page).getByRole('button', { name: '保存修改', exact: true }).click()
    await expect(
      page.getByText('目标内容未能保存，草稿仍保留。请重试保存；若目标已不存在，可复制后放弃草稿。')
    ).toBeVisible()
    await expect(panel(page).getByLabel('说明（可选）')).toHaveValue('必须保留的草稿')
    await panel(page).getByRole('button', { name: '保存修改', exact: true }).click()
    await expect(panel(page).getByRole('button', { name: '放弃目标内容修改' })).toHaveCount(0)
    await panel(page).getByLabel('说明（可选）').fill('目标缺失后仍可复制')
    await nav(page, '首页')
    // Simulate the original disappearing on read, without creating/deleting real user data.
    await app.evaluate(({ ipcMain }, id) => {
      const handlers = Reflect.get(ipcMain, '_invokeHandlers') as Map<
        string,
        (...args: unknown[]) => unknown
      >
      const original = handlers.get('goals:get-detail')!
      ipcMain.removeHandler('goals:get-detail')
      ipcMain.handle('goals:get-detail', (...args) => {
        const input = args[1] as { goalId: string }
        return input.goalId === id ? { ok: false, error: { code: 'not-found' } } : original(...args)
      })
    }, ids[0])
    const before = await page.evaluate(() => window.myTracer.dataControl.list())
    await nav(page, '目标')
    const retained = page.getByRole('region', { name: '保留的目标内容草稿' })
    await expect(retained).toContainText('原目标已不存在')
    await expect(retained.getByLabel('草稿目标说明')).toHaveValue('目标缺失后仍可复制')
    await expect(retained.getByLabel('草稿目标说明')).toHaveAttribute('readonly', '')
    await retained.getByLabel('草稿目标说明').focus()
    await expect(retained.getByLabel('草稿目标说明')).toBeFocused()
    await expect(page.getByRole('button', { name: '保存修改', exact: true })).toHaveCount(0)
    expect(await page.evaluate(() => window.myTracer.dataControl.list())).toEqual(before)
  })
})
