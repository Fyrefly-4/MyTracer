import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { openManagement } from '../support/ui-disclosure'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

const raw =
  '工作台左侧盒子\n<script>不执行</script> **原文** C:\\materials\\draft.txt https://example.invalid/?a=1&b=2'
const long = `${raw}\n${'合成材料位置与说明 '.repeat(100)}\n最后一行：从这里继续`
// Printed steps remain available in job logs even when artifact download is unavailable.
async function step<T>(name: string, run: () => Promise<T>): Promise<T> {
  console.log(`[action-description] start: ${name}`)
  try {
    const result = await test.step(name, run)
    console.log(`[action-description] done: ${name}`)
    return result
  } catch (error) {
    console.log(`[action-description] failed: ${name}`)
    throw error
  }
}

async function withApplication(run: (app: ElectronApplication, page: Page) => Promise<void>) {
  const root = await createTemporaryTestRoot()
  let app: ElectronApplication | undefined
  let failed = false
  let tracing = false
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
    const page = await step('open isolated window', () => app!.firstWindow())
    // Fail the actual waiting operation before the unchanged 30s overall budget expires.
    page.setDefaultTimeout(5_000)
    await app.context().tracing.start({ screenshots: true, snapshots: true, sources: true })
    tracing = true
    await run(app, page)
  } catch (error) {
    failed = true
    throw error
  } finally {
    if (tracing) {
      await app!
        .context()
        .tracing.stop(
          failed ? { path: test.info().outputPath('action-description-trace.zip') } : {}
        )
    }
    await step('close isolated Electron', async () => {
      await app?.close()
    })
    await removeTemporaryTestRoot(root)
  }
}
const nav = (page: Page, name: string) =>
  step(`navigate to ${name}`, () =>
    page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
  )
const description = (page: Page) => page.getByLabel('当前行动说明', { exact: true })
// Label textContent includes React's initial textarea text. Match the textbox's
// accessible name instead, scoped to this action's existing editor.
const descriptionEditor = (page: Page) =>
  page.locator('.action-detail > details.disclosure > .detail-form').getByRole('textbox', {
    name: '说明（可选）',
    exact: true,
    includeHidden: true
  })
async function seed(page: Page) {
  return page.evaluate(
    async ({ raw, long }) => {
      const goal = await window.myTracer.goals.create({
        name: '继续修理',
        description: '目标简介不能充当行动说明',
        initialNextAction: { title: '检查零件' }
      })
      if (!goal.ok || !goal.value.currentNextActionId) throw Error('goal fixture')
      const id = goal.value.currentNextActionId
      const updated = await window.myTracer.actions.updateDetails({
        actionId: id,
        title: '检查零件',
        description: raw
      })
      const record = await window.myTracer.dataControl.backfillActionRecord({
        actionId: id,
        occurredOn: '2026-10-20',
        durationMinutes: 5,
        outcome: 'partial',
        note: '历史记录备注',
        nextStep: '历史下一步不是当前说明'
      })
      const second = await window.myTracer.actions.create({
        title: '阅读长说明',
        description: long
      })
      const empty = await window.myTracer.actions.create({ title: '没有说明' })
      const context = await window.myTracer.recovery.getContext({ goalId: goal.value.id })
      if (!updated.ok || !record.ok || !second.ok || !empty.ok || !context.ok)
        throw Error('fixture')
      return { id, secondId: second.value.id, context: context.value }
    },
    { raw, long }
  )
}

test('continue shows saved short/plain action text and no empty panel; delayed history cannot replace it', async () => {
  await withApplication(async (app, page) => {
    const data = await seed(page)
    await page.reload()
    await page
      .getByLabel('继续修理 概览', { exact: true })
      .getByRole('button', { name: '去今天继续 →' })
      .click()
    await expect(description(page).locator('p')).toHaveText(raw)
    expect(await description(page).locator('p').textContent()).toBe(raw)
    await expect(description(page).locator('a, script, textarea')).toHaveCount(0)
    await expect(descriptionEditor(page)).toHaveCount(1)
    await expect(descriptionEditor(page)).not.toBeVisible()
    await app.evaluate(({ ipcMain }, context) => {
      ipcMain.removeHandler('recovery:get-context')
      ipcMain.handle(
        'recovery:get-context',
        () =>
          new Promise((resolve) => {
            Reflect.set(globalThis, '__releaseDescriptionHistory', () =>
              resolve({ ok: true, value: context })
            )
          })
      )
    }, data.context)
    await page.locator('.today-goal-context > summary').click()
    await expect(page.getByText('正在读取目标历史…')).toBeVisible()
    await page.getByRole('button', { name: /阅读长说明.*待行动/ }).click()
    const toggle = description(page).locator('summary')
    await toggle.focus()
    await page.keyboard.press('Enter')
    await expect(description(page).locator('p')).toBeVisible()
    const recording = page.getByLabel('阅读长说明 行动记录', { exact: true })
    await recording.getByRole('button', { name: '开始记录', exact: true }).click()
    const duration = recording.getByLabel('投入时长（分钟，可选）')
    await duration.fill('7')
    await app.evaluate(() =>
      (Reflect.get(globalThis, '__releaseDescriptionHistory') as () => void)()
    )
    await expect(description(page).locator('p')).toHaveText(long)
    await expect(duration).toBeFocused()
    await expect(duration).toHaveValue('7')
    await page.getByRole('button', { name: /没有说明.*待行动/ }).click()
    await expect(description(page)).toHaveCount(0)
    await page.getByRole('button', { name: /检查零件.*待行动/ }).click()
    await expect(description(page).locator('p')).toHaveText(raw)
    await expect(description(page)).not.toContainText('历史下一步')
    await expect(description(page)).not.toContainText('目标简介')
  })
})

test('long text retains reading context, editor and record drafts with keyboard and narrow zoom layouts', async () => {
  await withApplication(async (app, page) => {
    const data = await step('seed synthetic actions', () => seed(page))
    await nav(page, '今天')
    await step('select long action', () =>
      page.getByRole('button', { name: /阅读长说明.*待行动/ }).click()
    )
    const panel = description(page)
    const toggle = panel.locator('summary')
    await step('expand long text and return with reading context', async () => {
      await expect(panel.locator('p')).not.toBeVisible()
      await toggle.focus()
      await page.keyboard.press('Space')
      await expect(panel.locator('p')).toBeVisible()
      expect(await panel.locator('p').textContent()).toBe(long)
      await nav(page, '目标')
      await nav(page, '今天')
      await expect(panel.locator('p')).toBeVisible()
      await expect(page.locator('.action-detail h2')).toHaveText('阅读长说明')
    })
    await step('toggle description while editing without replacing the draft', async () => {
      await openManagement(page.locator('.action-detail'), '行动')
      const editor = descriptionEditor(page)
      await expect(editor).toHaveAccessibleName('说明（可选）')
      await editor.fill('未保存的编辑草稿')
      await toggle.click()
      await toggle.click()
      await expect(editor).toHaveValue('未保存的编辑草稿')
      expect(await panel.locator('p').textContent()).toBe(long)
      await editor.fill(long)
    })
    const recording = page.getByLabel('阅读长说明 行动记录', { exact: true })
    await step(
      'start record and retain draft across description toggles and navigation',
      async () => {
        await recording.getByRole('button', { name: '开始记录', exact: true }).click()
        await expect(recording.getByLabel('投入时长（分钟，可选）')).toBeFocused()
        await recording.getByLabel('投入时长（分钟，可选）').fill('7')
        await toggle.click()
        await toggle.click()
        await expect(recording.getByLabel('投入时长（分钟，可选）')).toHaveValue('7')
        await nav(page, '目标')
        await nav(page, '今天')
        await expect(recording.getByLabel('投入时长（分钟，可选）')).toHaveValue('7')
        await expect(panel.locator('p')).toBeVisible()
      }
    )
    for (const zoom of [1, 1.25, 1.5]) {
      await step(`keyboard, wheel and return at zoom ${zoom}`, async () => {
        await app.evaluate(({ BrowserWindow }, zoom) => {
          const win = BrowserWindow.getAllWindows()[0]
          win.setContentSize(820, 600)
          win.webContents.setZoomFactor(zoom)
        }, zoom)
        await toggle.focus()
        await page.keyboard.press('Space')
        await expect(panel.locator('p')).not.toBeVisible()
        await page.keyboard.press('Enter')
        await expect(panel.locator('p')).toBeVisible()
        const layout = await panel.locator('p').evaluate((element) => ({
          overflow: getComputedStyle(element).overflowY,
          width: element.scrollWidth - element.clientWidth,
          height: element.scrollHeight - element.clientHeight
        }))
        expect(layout.overflow).toBe('visible')
        expect(layout.width).toBeLessThanOrEqual(1)
        expect(layout.height).toBeLessThanOrEqual(1)
        const pane = page.locator('.today-detail-pane')
        const bounds = await pane.boundingBox()
        if (!bounds) throw Error('detail pane not laid out')
        await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
        await page.mouse.wheel(0, 10000)
        await expect.poll(() => pane.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
        await recording.getByRole('button', { name: '保存记录', exact: true }).focus()
        await expect(
          recording.getByRole('button', { name: '保存记录', exact: true })
        ).toBeInViewport()
        console.log(
          `[action-description] zoom ${zoom}: save control reachable; checking return position`
        )
        const position = await pane.evaluate((element) => element.scrollTop)
        await nav(page, '目标')
        await nav(page, '今天')
        await expect(panel.locator('p')).toBeVisible()
        await expect
          .poll(() => pane.evaluate((element) => element.scrollTop))
          .toBeCloseTo(position, 0)
        await expect(
          page.getByRole('navigation').getByRole('button', { name: '今天', exact: true })
        ).toBeFocused()
        await expect(recording.getByLabel('投入时长（分钟，可选）')).toHaveValue('7')
      })
    }
    const saved = await page.evaluate(
      (actionId) => window.myTracer.actions.getDetail({ actionId }),
      data.secondId
    )
    expect(saved.ok && saved.value.description).toBe(long)
  })
})

test('saving short and long descriptions updates the reader without truncating the stored text', async () => {
  await withApplication(async (_app, page) => {
    const data = await seed(page)
    await nav(page, '今天')
    await page.getByRole('button', { name: /阅读长说明.*待行动/ }).click()
    const panel = description(page)
    await panel.locator('summary').click()
    await expect(panel.locator('p')).toHaveText(long)
    await openManagement(page.locator('.action-detail'), '行动')
    const editor = descriptionEditor(page)
    await expect(editor).toHaveAccessibleName('说明（可选）')
    for (const text of [raw, long]) {
      await step(`save ${text === raw ? 'short' : 'long'} description`, async () => {
        await editor.fill(text)
        await page.getByRole('button', { name: '保存行动修改', exact: true }).click()
        await expect(panel.locator('p')).toHaveText(text)
        await expect(panel.locator('p')).toBeVisible()
        await expect(panel.locator('summary')).toHaveCount(text === raw ? 0 : 1)
        const saved = await page.evaluate(
          (actionId) => window.myTracer.actions.getDetail({ actionId }),
          data.secondId
        )
        expect(saved.ok && saved.value.description).toBe(text)
      })
    }
    await nav(page, '目标')
    await nav(page, '今天')
    await expect(panel.locator('p')).toHaveText(long)
    await expect(panel.locator('p')).toBeVisible()
  })
})
