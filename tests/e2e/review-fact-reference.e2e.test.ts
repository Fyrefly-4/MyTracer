import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

async function fixture(run: (app: ElectronApplication, page: Page) => Promise<void>) {
  const root = await createTemporaryTestRoot()
  let app: ElectronApplication | undefined
  try {
    app = await electron.launch({
      cwd: root.root,
      args: [
        join(process.cwd(), 'out/main/index.js'),
        `--user-data-dir=${root.electronUserData}`,
        ...(process.platform === 'linux' ? ['--ozone-platform=headless', '--no-sandbox'] : [])
      ],
      env: minimalElectronEnvironment(root)
    })
    await run(app, await app.firstWindow())
  } finally {
    await app?.close().catch(() => undefined)
    await removeTemporaryTestRoot(root)
  }
}
const navigate = (page: Page, name: string) =>
  page
    .getByRole('navigation', { name: '主要视图' })
    .getByRole('button', { name, exact: true })
    .click()

async function seed(page: Page, count = 25) {
  await page.evaluate(async (count) => {
    const today = await window.myTracer.today.get({})
    const goal = await window.myTracer.goals.create({
      name: '复盘参考样例',
      initialNextAction: {
        title:
          '阅读一小段并留下值得继续追问的问题：保留具体情境、尚未解释的差异与下一次可以验证的例子。'.repeat(
            3
          )
      }
    })
    if (!today.ok || !goal.ok || !goal.value.currentNextActionId)
      throw new Error('Cannot seed isolated goal')
    for (let i = 0; i < count; i++) {
      const result = await window.myTracer.dataControl.backfillActionRecord({
        actionId: goal.value.currentNextActionId,
        occurredOn: today.value.localDate,
        durationMinutes: 5,
        outcome: 'partial',
        understanding: `理解样例 ${i + 1}：一个具体例子让抽象概念变得清楚。`,
        confusion: i === 0 ? '还有一个问题值得继续观察。' : null
      })
      if (!result.ok) throw new Error('Cannot seed isolated record')
    }
  }, count)
}

test('facts are explicitly cited without duplicating or replacing drafts; refresh detects changed and missing sources', async () => {
  test.slow()
  await fixture(async (app, page) => {
    await seed(page)
    await navigate(page, '复盘')
    const progress = page.getByLabel('一个真实进展', { exact: true })
    await expect(progress).toBeEnabled()
    await progress.fill('我自己写下的进展。')
    const first = page.getByLabel('周期已确认理解').locator('li').first()
    await first.getByRole('button', { name: '选择作参考' }).click()
    await expect(progress).toHaveValue('我自己写下的进展。')
    const selected = page.locator('.review-reference-selection')
    await selected.getByLabel('引用到').selectOption('obstacle')
    const obstacle = page.getByLabel('一个主要阻力', { exact: true })
    await obstacle.fill('原有阻力。')
    await selected.getByRole('button', { name: '追加引用到草稿' }).click()
    await expect(obstacle).toBeFocused()
    await expect(obstacle).toHaveValue(/原有阻力。\n\n【.*理解/)
    const cited = await obstacle.inputValue()
    await expect(selected.getByRole('button', { name: '此处已引用' })).toBeDisabled()
    await navigate(page, '今天')
    await navigate(page, '复盘')
    await expect(obstacle).toHaveValue(cited)
    await expect(progress).toHaveValue('我自己写下的进展。')
    await first.getByRole('button', { name: '选择作参考' }).click()
    await selected.getByLabel('引用到').selectOption('obstacle')
    await expect(selected.getByRole('button', { name: '此处已引用' })).toBeDisabled()

    const snapshot = await page.evaluate(async () => {
      const begin = await window.myTracer.review.begin({})
      if (!begin.ok) throw new Error('No context')
      const result = await window.myTracer.review.getSummary({
        reviewContextId: begin.value.reviewContextId
      })
      if (!result.ok) throw new Error('No summary')
      return result.value
    })
    // The replacement query is read-only and confined to this isolated Electron process.
    await app.evaluate(({ ipcMain }, summary) => {
      ipcMain.removeHandler('review:get-summary')
      ipcMain.handle('review:get-summary', () => ({
        ok: true,
        value: {
          ...summary,
          understandings: summary.understandings.map((fact, index) =>
            index === 0 ? { ...fact, text: '重新读取后的理解' } : fact
          )
        }
      }))
    }, snapshot)
    await page.getByRole('button', { name: '重新读取记录', exact: true }).click()
    await expect(selected).toContainText('此事实已变化')
    await expect(obstacle).toHaveValue(cited)
    await expect(selected.getByRole('button', { name: '此处已引用' })).toBeDisabled()
    await first.getByRole('button', { name: '选择作参考' }).click()
    await expect(selected).toContainText('重新读取后的理解')
    await app.evaluate(({ ipcMain }, summary) => {
      ipcMain.removeHandler('review:get-summary')
      ipcMain.handle('review:get-summary', () => ({
        ok: true,
        value: { ...summary, understandings: summary.understandings.slice(1) }
      }))
    }, snapshot)
    await page.getByRole('button', { name: '重新读取记录', exact: true }).click()
    await expect(selected).toContainText('此事实已不在当前摘要中')
    await expect(selected.getByRole('button', { name: '追加引用到草稿' })).toBeDisabled()
    await expect(obstacle).toHaveValue(cited)
  })
})

test('explicit citations persist through the existing save and reload flow', async () => {
  await fixture(async (_app, page) => {
    await seed(page, 1)
    await navigate(page, '复盘')
    const progress = page.getByLabel('一个真实进展', { exact: true })
    await progress.fill('自己的进展')
    await page
      .getByLabel('周期行动记录')
      .locator('li')
      .first()
      .getByRole('button', { name: '选择作参考' })
      .click()
    await page.getByRole('button', { name: '追加引用到草稿' }).click()
    const quoted = await progress.inputValue()
    await page.getByLabel('一个主要阻力', { exact: true }).fill('自己的阻力')
    await page.getByLabel('下一周期的一个调整', { exact: true }).fill('自己的调整')
    await page.getByRole('button', { name: '保存复盘', exact: true }).click()
    await expect(page.locator('.review-notice[role=status]')).toContainText('本周期复盘已保存')
    await expect(progress).toBeEnabled()
    await page.reload()
    await navigate(page, '复盘')
    await expect(progress).toHaveValue(quoted)
    await expect(page.getByLabel('一个主要阻力', { exact: true })).toHaveValue('自己的阻力')
    await expect(page.getByLabel('下一周期的一个调整', { exact: true })).toHaveValue('自己的调整')
  })
})

test('composer is reachable with bounded facts at desktop, narrow and zoomed sizes', async () => {
  test.slow()
  await fixture(async (app, page) => {
    await navigate(page, '复盘')
    await expect(page.getByLabel('一个真实进展', { exact: true })).toBeEnabled()
    await expect(page.getByLabel('可选择的周期事实')).toContainText('本周期没有行动记录')
    await navigate(page, '首页')
    await seed(page, 100)
    await navigate(page, '复盘')
    await expect(page.getByLabel('周期行动记录').locator('li')).toHaveCount(100)
    for (const [width, height] of [
      [1440, 900],
      [1120, 760],
      [820, 650]
    ]) {
      for (const zoom of [1, 1.25, 1.5]) {
        await app.evaluate(
          ({ BrowserWindow }, dimensions) => {
            const window = BrowserWindow.getAllWindows()[0]
            window.setContentSize(dimensions.width, dimensions.height)
            window.webContents.setZoomFactor(dimensions.zoom)
          },
          { width, height, zoom }
        )
        await page.getByRole('button', { name: '前往填写', exact: true }).click()
        await expect(page.getByLabel('一个真实进展', { exact: true })).toBeFocused()
        const before = await page.locator('.review-form').evaluate((element) => element.scrollTop)
        const browser = page.getByLabel('可选择的周期事实')
        await browser.evaluate((element) => {
          element.scrollTop = 200
        })
        expect(await browser.evaluate((element) => element.scrollTop)).toBeGreaterThan(190)
        expect(await page.locator('.review-form').evaluate((element) => element.scrollTop)).toBe(
          before
        )
        expect(await browser.evaluate((element) => element.clientHeight)).toBeLessThan(750)
        await browser.evaluate((element) => {
          element.scrollTop = 0
        })
      }
    }
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.getByRole('button', { name: '查看参考事实', exact: true }).click()
    await expect(page.getByLabel('可选择的周期事实')).toBeFocused()
  })
})

test('a retained draft cannot be saved into another week, even when loading the new week fails', async () => {
  await fixture(async (app, page) => {
    await navigate(page, '复盘')
    await page.getByLabel('一个真实进展', { exact: true }).fill('上一周期未保存的文字')
    await navigate(page, '今天')
    await app.evaluate(({ ipcMain }) => {
      const OriginalDate = Date
      const future = new OriginalDate()
      future.setDate(future.getDate() + 7)
      const instant = future.toISOString()
      Reflect.set(
        globalThis,
        'Date',
        new Proxy(OriginalDate, {
          construct(target, args) {
            return Reflect.construct(target, args.length ? args : [instant])
          }
        })
      )
      ipcMain.removeHandler('review:get-summary')
      ipcMain.handle('review:get-summary', () => ({
        ok: false,
        error: { code: 'persistence-failed', message: 'isolated failure' }
      }))
    })
    await navigate(page, '复盘')
    await expect(page.getByRole('alert')).toContainText('已进入新的周期')
    await expect(page.getByLabel('一个真实进展', { exact: true })).toHaveValue(
      '上一周期未保存的文字'
    )
    await expect(page.getByRole('button', { name: '保存复盘', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: '放弃草稿并进入新周期' }).click()
    await expect(page.getByRole('alert')).toContainText('本地周期记录暂时无法读取')
  })
})

for (const operation of ['complete', 'cancel'] as const) {
  test(`late ${operation} response cannot erase a newer draft after navigation`, async () => {
    await fixture(async (app, page) => {
      await navigate(page, '复盘')
      await page.getByLabel('一个真实进展', { exact: true }).fill('原先的进展')
      await page.getByLabel('一个主要阻力', { exact: true }).fill('原先的阻力')
      await page.getByLabel('下一周期的一个调整', { exact: true }).fill('原先的调整')
      await app.evaluate(({ ipcMain }, operation) => {
        let first = true
        ipcMain.removeHandler(`review:${operation === 'cancel' ? 'cancel-context' : 'complete'}`)
        ipcMain.handle(`review:${operation === 'cancel' ? 'cancel-context' : 'complete'}`, () => {
          if (!first) return { ok: true, value: { cancelled: true } }
          first = false
          return new Promise((resolve) =>
            Reflect.set(globalThis, '__resolveReviewResearch', () =>
              resolve({ ok: false, error: { code: 'persistence-failed' } })
            )
          )
        })
      }, operation)
      await page
        .getByRole('button', { name: operation === 'complete' ? '保存复盘' : '取消', exact: true })
        .click()
      await navigate(page, '今天')
      await navigate(page, '复盘')
      const progress = page.getByLabel('一个真实进展', { exact: true })
      if (operation === 'complete') {
        await expect(progress).toBeDisabled()
        await app.evaluate(() => Reflect.get(globalThis, '__resolveReviewResearch')())
      }
      await expect(progress).toBeEnabled()
      await progress.fill('重新进入后写下的新文字')
      if (operation === 'cancel')
        await app.evaluate(() => Reflect.get(globalThis, '__resolveReviewResearch')())
      await navigate(page, '今天')
      await navigate(page, '复盘')
      await expect(progress).toHaveValue('重新进入后写下的新文字')
    })
  })
}

test('a committed next-step creation is not replayed after leaving during follow-up reads', async () => {
  await fixture(async (app, page) => {
    await seed(page, 1)
    const goalId = await page.evaluate(async () => {
      const result = await window.myTracer.goals.list({ status: 'active' })
      if (!result.ok) throw new Error('No goal')
      return result.value[0].id
    })
    await navigate(page, '复盘')
    await page.getByLabel('一个真实进展', { exact: true }).fill('进展')
    await page.getByLabel('一个主要阻力', { exact: true }).fill('阻力')
    await page.getByLabel('下一周期的一个调整', { exact: true }).fill('调整')
    await page.getByLabel('关联活跃目标（可选）').selectOption(goalId)
    await page.getByLabel('创建并使用', { exact: true }).check()
    await page.getByLabel('新的下一步行动').fill('只创建一次的新行动')
    await app.evaluate(({ ipcMain }) => {
      const handlers = Reflect.get(ipcMain, '_invokeHandlers') as Map<
        string,
        (...args: unknown[]) => unknown
      >
      const original = handlers.get('goals:get-detail')!
      let delay = true
      ipcMain.removeHandler('goals:get-detail')
      ipcMain.handle('goals:get-detail', (...args) => {
        const result = original(...args)
        if (!delay) return result
        delay = false
        return new Promise((resolve) =>
          Reflect.set(globalThis, '__resolveFollowup', () => resolve(result))
        )
      })
    })
    await page.getByRole('button', { name: '保存复盘', exact: true }).click()
    await expect
      .poll(() => app.evaluate(() => typeof Reflect.get(globalThis, '__resolveFollowup')))
      .toBe('function')
    await navigate(page, '今天')
    await navigate(page, '复盘')
    await expect(page.getByLabel('不修改', { exact: true })).toBeChecked()
    await page.getByLabel('一个真实进展', { exact: true }).fill('保存后的新编辑')
    await app.evaluate(() => Reflect.get(globalThis, '__resolveFollowup')())
    await page.getByRole('button', { name: '保存复盘', exact: true }).click()
    await expect(page.locator('.review-notice[role=status]')).toContainText('本周期复盘已保存')
    const count = await page.evaluate(async (goalId) => {
      const result = await window.myTracer.goals.getDetail({ goalId })
      if (!result.ok) throw new Error('No detail')
      return result.value.actions.filter((action) => action.title === '只创建一次的新行动').length
    }, goalId)
    expect(count).toBe(1)
  })
})

test('successful late creation plus failed re-entry cannot restore a replayable command', async () => {
  await fixture(async (app, page) => {
    await seed(page, 1)
    const goalId = await page.evaluate(async () => {
      const result = await window.myTracer.goals.list({ status: 'active' })
      if (!result.ok) throw new Error('No goal')
      return result.value[0].id
    })
    await navigate(page, '复盘')
    await page.getByLabel('一个真实进展', { exact: true }).fill('进展')
    await page.getByLabel('一个主要阻力', { exact: true }).fill('阻力')
    await page.getByLabel('下一周期的一个调整', { exact: true }).fill('调整')
    await page.getByLabel('关联活跃目标（可选）').selectOption(goalId)
    await page.getByLabel('创建并使用', { exact: true }).check()
    await page.getByLabel('新的下一步行动').fill('只创建一次的新行动')
    await app.evaluate(({ ipcMain }) => {
      const handlers = Reflect.get(ipcMain, '_invokeHandlers') as Map<
        string,
        (...args: unknown[]) => unknown
      >
      const complete = handlers.get('review:complete')!
      const summary = handlers.get('review:get-summary')!
      let delay = true
      let fail = true
      ipcMain.removeHandler('review:complete')
      ipcMain.handle('review:complete', async (...args) => {
        const result = await complete(...args)
        if (!delay) return result
        delay = false
        return new Promise((resolve) =>
          Reflect.set(globalThis, '__resolveFollowup', () => resolve(result))
        )
      })
      ipcMain.removeHandler('review:get-summary')
      ipcMain.handle('review:get-summary', (...args) => {
        if (!fail) return summary(...args)
        fail = false
        return { ok: false, error: { code: 'persistence-failed' } }
      })
    })
    await page.getByRole('button', { name: '保存复盘', exact: true }).click()
    await expect
      .poll(() => app.evaluate(() => typeof Reflect.get(globalThis, '__resolveFollowup')))
      .toBe('function')
    await navigate(page, '今天')
    await navigate(page, '复盘')
    await expect(page.getByLabel('一个真实进展', { exact: true })).toBeDisabled()
    await app.evaluate(() => Reflect.get(globalThis, '__resolveFollowup')())
    await expect(page.getByRole('alert')).toContainText('本地周期记录暂时无法读取')
    await expect(page.getByLabel('一个真实进展', { exact: true })).toBeDisabled()
    await page.getByRole('button', { name: '重新进入本周复盘' }).click()
    await expect(page.getByLabel('不修改', { exact: true })).toBeChecked()
    await page.getByLabel('一个真实进展', { exact: true }).fill('保存后的新编辑')
    await page.getByRole('button', { name: '保存复盘', exact: true }).click()
    await expect(page.locator('.review-notice[role=status]')).toContainText('本周期复盘已保存')
    const count = await page.evaluate(async (goalId) => {
      const result = await window.myTracer.goals.getDetail({ goalId })
      if (!result.ok) throw new Error('No detail')
      return result.value.actions.filter((action) => action.title === '只创建一次的新行动').length
    }, goalId)
    expect(count).toBe(1)
  })
})
