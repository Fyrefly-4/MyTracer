import { openRecordNote } from '../support/ui-disclosure'
import { join } from 'node:path'
import { expect, test, type Page, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

test('first record preserves drafts, explicit choices, retry identity and modal reachability', async () => {
  test.slow()
  const root = await createTemporaryTestRoot()
  let app: ElectronApplication | undefined
  try {
    app = await electron.launch({
      chromiumSandbox: true,
      cwd: root.root,
      args: [
        join(process.cwd(), 'out/main/index.js'),
        `--user-data-dir=${root.electronUserData}`,
        ...(process.platform === 'linux' ? ['--headless'] : [])
      ],
      env: minimalElectronEnvironment(root)
    })
    const page = await app.firstWindow()
    const navigate = (name: string) =>
      page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
    await navigate('今天')
    await page.getByRole('button', { name: '记一笔', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '记一笔', exact: true })
    await expect(dialog.getByLabel('刚才做了什么', { exact: true })).toBeFocused()
    await expect(dialog.getByLabel('保存后，整个行动')).toHaveValue('')
    await expect(dialog.getByLabel('本次结果', { exact: true })).toHaveValue('')
    await expect(dialog).toContainText('当前没有可开始的行动')
    await dialog.getByLabel('刚才做了什么', { exact: true }).fill('合成事实：整理了一部分')
    await dialog
      .getByRole('textbox', { name: '简述（可选）', exact: true })
      .fill('合成简述\n第二行')
    await openRecordNote(dialog.getByRole('textbox', { name: '备注（可选）', exact: true }))
    await dialog
      .getByLabel('备注（可选）', { exact: true })
      .fill('合成长文字，保留事实而不自动完成。'.repeat(80))
    // An IME composition Enter must not submit a valid-looking form.
    await dialog.getByLabel('这次不记时长（未知）').check()
    await dialog.getByLabel('本次结果', { exact: true }).selectOption('completed')
    await dialog.getByLabel('保存后，整个行动').selectOption('keep-pending')
    await dialog.getByLabel('刚才做了什么', { exact: true }).dispatchEvent('compositionstart')
    await dialog.getByLabel('刚才做了什么', { exact: true }).press('Enter')
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('刚才做了什么', { exact: true }).dispatchEvent('compositionend')
    const snapshot = () => page.evaluate(() => window.myTracer.dataControl.list())
    expect(await snapshot()).toMatchObject({ ok: true, value: { actions: [], actionRecords: [] } })
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: '继续记一笔', exact: true })).toBeFocused()
    await navigate('首页')
    await navigate('今天')
    await page.getByRole('button', { name: '继续记一笔', exact: true }).click()
    await expect(dialog.getByLabel('刚才做了什么', { exact: true })).toHaveValue(
      '合成事实：整理了一部分'
    )
    await expect(dialog.getByRole('textbox', { name: '简述（可选）', exact: true })).toHaveValue(
      '合成简述\n第二行'
    )
    for (const factor of [1, 1.25, 1.5]) {
      await app.evaluate(({ BrowserWindow }, zoom) => {
        const window = BrowserWindow.getAllWindows()[0]!
        window.setContentSize(820, 600)
        window.webContents.setZoomFactor(zoom)
      }, factor)
      expect(
        await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)
      ).toBe(true)
      await dialog.evaluate((element) => {
        element.scrollTop = 0
      })
      const box = await dialog.boundingBox()
      if (!box) throw Error('dialog bounds unavailable')
      await page.mouse.move(box.x + box.width / 2, box.y + 50)
      await page.mouse.wheel(0, 10000)
      await expect(dialog.getByRole('button', { name: '收起并返回' })).toBeInViewport()
      await dialog.getByRole('button', { name: '收起并返回' }).focus()
      await page.keyboard.press('Tab')
      await expect(dialog.getByRole('button', { name: '放弃这份草稿' })).toBeFocused()
    }
    // Inject one safe failure, followed by a commit whose reply is lost.
    await app.evaluate(({ ipcMain }) => {
      const handlers = Reflect.get(ipcMain, '_invokeHandlers') as Map<
        string,
        (...args: unknown[]) => unknown
      >
      const original = handlers.get('records:save-first-record')!
      let count = 0
      ipcMain.removeHandler('records:save-first-record')
      ipcMain.handle('records:save-first-record', (...args) => {
        count++
        if (count === 1)
          return { ok: false, error: { code: 'persistence-failed', message: 'synthetic failure' } }
        const result = original(...args)
        if (count === 2) throw Error('synthetic lost acknowledgement after commit')
        return result
      })
    })
    await dialog.getByRole('button', { name: '保存行动和第一笔', exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText('未能确认保存')
    expect(await snapshot()).toMatchObject({ ok: true, value: { actions: [], actionRecords: [] } })
    await dialog.getByRole('button', { name: '保存行动和第一笔', exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText('保存结果暂未确认')
    await expect(dialog.getByRole('button', { name: '放弃这份草稿' })).toBeDisabled()
    await dialog.getByRole('button', { name: '重试确认同一笔' }).dblclick()
    await expect(dialog).not.toBeVisible()
    const saved = await snapshot()
    expect(saved).toMatchObject({
      ok: true,
      value: {
        actions: [{ status: 'pending', goalId: null }],
        actionRecords: [
          { durationMinutes: null, outcome: 'completed', summary: '合成简述\n第二行' }
        ]
      }
    })
    expect(saved.ok && saved.value.actions).toHaveLength(1)
    expect(saved.ok && saved.value.actionRecords).toHaveLength(1)
    const today = await page.evaluate(() => window.myTracer.today.get({}))
    expect(today).toMatchObject({ ok: true, value: { focuses: [], intentions: [] } })
    // Existing-action routing preserves the original deep-record path and creates no duplicate.
    await page.getByRole('button', { name: '记一笔', exact: true }).click()
    if (!saved.ok) throw Error('snapshot failed')
    await dialog.getByLabel('选择已有行动').selectOption(saved.value.actions[0]!.id)
    await dialog.getByRole('button', { name: '打开已有行动记录' }).click()
    await expect(page.getByRole('button', { name: '开始记录', exact: true })).toBeVisible()
    expect(await snapshot()).toEqual(saved)
    await page.getByRole('button', { name: '继续记一笔', exact: true }).click()
    await dialog.getByRole('button', { name: '放弃这份草稿' }).click()
    await dialog.getByRole('button', { name: '确认放弃', exact: true }).click()
    expect(await snapshot()).toEqual(saved)
    await page.getByRole('button', { name: '记一笔', exact: true }).click()
    await expect(dialog.getByLabel('刚才做了什么', { exact: true })).toHaveValue('')
    await dialog.getByLabel('刚才做了什么', { exact: true }).fill('合成事实：已结束')
    await dialog.getByLabel('真实投入（分钟）').fill('0')
    await dialog.getByLabel('本次结果', { exact: true }).selectOption('partial')
    await dialog.getByLabel('保存后，整个行动').selectOption('complete')
    await dialog.getByRole('button', { name: '保存行动和第一笔', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    const final = await snapshot()
    expect(final.ok && final.value.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: '合成事实：已结束', status: 'completed' })
      ])
    )
    expect(final.ok && final.value.actionRecords).toEqual(
      expect.arrayContaining([expect.objectContaining({ durationMinutes: 0, outcome: 'partial' })])
    )
  } finally {
    await app?.close().catch(() => undefined)
    await removeTemporaryTestRoot(root)
  }
})

test('late begin cannot replace a newer draft; an authoritative rejection releases an uncertain save', async () => {
  const root = await createTemporaryTestRoot()
  let app: ElectronApplication | undefined
  let diagnosticPage: Page | undefined
  try {
    app = await test.step('launch isolated first-record application', () =>
      electron.launch({
        chromiumSandbox: true,
        cwd: root.root,
        args: [
          join(process.cwd(), 'out/main/index.js'),
          `--user-data-dir=${root.electronUserData}`,
          ...(process.platform === 'linux' ? ['--headless'] : [])
        ],
        env: minimalElectronEnvironment(root)
      }))
    const page = await test.step('wait for first renderer', () => app!.firstWindow())
    diagnosticPage = page
    await page.context().tracing.start({ snapshots: true, screenshots: false })
    const goalId = await test.step('create synthetic goal', () =>
      page.evaluate(async () => {
        const goal = await window.myTracer.goals.create({ name: '合成目标：随后暂停' })
        if (!goal.ok) throw Error('fixture failed')
        return goal.value.id
      }))
    const navigate = (name: string) =>
      test.step(`navigate to ${name}`, () =>
        page.getByRole('navigation').getByRole('button', { name, exact: true }).click())
    await navigate('今天')
    await test.step('install synthetic IPC interceptor', () =>
      app!.evaluate(({ ipcMain }) => {
        const handlers = Reflect.get(ipcMain, '_invokeHandlers') as Map<
          string,
          (...args: unknown[]) => unknown
        >
        const original = handlers.get('records:begin-first-record')!
        const cancel = handlers.get('records:cancel-action-recording')!
        Reflect.set(globalThis, 'syntheticBeginCancelCount', 0)
        ipcMain.removeHandler('records:cancel-action-recording')
        ipcMain.handle('records:cancel-action-recording', (...args) => {
          const result = cancel(...args)
          Reflect.set(globalThis, 'syntheticBeginCancelCount', 1)
          return result
        })
        let first = true
        ipcMain.removeHandler('records:begin-first-record')
        ipcMain.handle('records:begin-first-record', (...args) => {
          const result = original(...args)
          if (!first) return result
          first = false
          return new Promise((resolve) => {
            Reflect.set(globalThis, 'releaseSyntheticFirstBegin', () => resolve(result))
          })
        })
      }))
    await test.step('open first-record entry', () =>
      page.getByRole('button', { name: '记一笔', exact: true }).click())
    await test.step('confirm begin A is held before navigation', async () => {
      await expect
        .poll(() =>
          app!.evaluate(() => typeof Reflect.get(globalThis, 'releaseSyntheticFirstBegin'))
        )
        .toBe('function')
    })
    await navigate('首页')
    await navigate('今天')
    await test.step('open first-record entry', () =>
      page.getByRole('button', { name: '记一笔', exact: true }).click())
    const dialog = page.getByRole('dialog', { name: '记一笔', exact: true })
    await test.step('type newer draft B after remount', () =>
      dialog.getByLabel('刚才做了什么', { exact: true }).fill('新草稿 B：不要覆盖'))
    await test.step('release old begin A after B was typed', () =>
      app!.evaluate(() => {
        const release = Reflect.get(globalThis, 'releaseSyntheticFirstBegin') as () => void
        release()
        Reflect.deleteProperty(globalThis, 'releaseSyntheticFirstBegin')
      }))
    await test.step('require stale A context cancellation', async () => {
      await expect
        .poll(() => app!.evaluate(() => Reflect.get(globalThis, 'syntheticBeginCancelCount')))
        .toBe(1)
    })
    await dialog.getByRole('button', { name: '收起并返回' }).click()
    await navigate('首页')
    await navigate('今天')
    await page.getByRole('button', { name: '继续记一笔', exact: true }).click()
    await expect(dialog.getByLabel('刚才做了什么', { exact: true })).toHaveValue(
      '新草稿 B：不要覆盖'
    )
    await dialog.getByLabel('真实投入（分钟）').fill('4')
    await test.step('choose explicit outcome for restored draft B', async () => {
      await expect(dialog.getByLabel('本次结果', { exact: true })).toHaveValue('')
      await dialog.getByLabel('本次结果', { exact: true }).selectOption('partial')
    })
    await dialog.getByLabel('保存后，整个行动').selectOption('keep-pending')
    await dialog.getByLabel('关联目标（可选）', { exact: true }).selectOption(goalId)
    await test.step('install synthetic IPC interceptor', () =>
      app!.evaluate(({ ipcMain }) => {
        const handlers = Reflect.get(ipcMain, '_invokeHandlers') as Map<
          string,
          (...args: unknown[]) => unknown
        >
        const original = handlers.get('records:save-first-record')!
        let first = true
        ipcMain.removeHandler('records:save-first-record')
        ipcMain.handle('records:save-first-record', (...args) => {
          if (first) {
            first = false
            throw Error('synthetic transport rejection before commit')
          }
          return original(...args)
        })
      }))
    await test.step('submit first-record draft', () =>
      dialog.getByRole('button', { name: '保存行动和第一笔' }).click())
    await expect(dialog.getByRole('alert')).toContainText('保存结果暂未确认')
    expect(
      await page.evaluate((id) => window.myTracer.goals.pause({ goalId: id }), goalId)
    ).toMatchObject({ ok: true })
    await test.step('retry after goal pause and require authoritative rejection', async () => {
      await dialog.getByRole('button', { name: '重试确认同一笔' }).click()
      await expect(dialog.getByRole('alert')).toContainText('本次未保存')
    })
    await expect(dialog.getByRole('alert')).toContainText('本次未保存')
    await expect(dialog.getByLabel('关联目标（可选）', { exact: true })).toBeEnabled()
    await expect(dialog.getByRole('button', { name: '放弃这份草稿' })).toBeEnabled()
    expect(await page.evaluate(() => window.myTracer.dataControl.list())).toMatchObject({
      ok: true,
      value: { actions: [], actionRecords: [] }
    })
    await dialog.getByLabel('关联目标（可选）', { exact: true }).selectOption('')
    await test.step('submit first-record draft', () =>
      dialog.getByRole('button', { name: '保存行动和第一笔' }).click())
    await expect(dialog).not.toBeVisible()
    const facts = await page.evaluate(() => window.myTracer.dataControl.list())
    expect(facts.ok && facts.value.actions).toHaveLength(1)
    expect(facts.ok && facts.value.actionRecords).toHaveLength(1)
  } finally {
    await diagnosticPage
      ?.context()
      .tracing.stop({ path: test.info().outputPath('first-record-race-trace.zip') })
      .catch(() => undefined)
    await test.step('close isolated first-record application', async () => {
      await app?.close().catch(() => undefined)
    })
    await removeTemporaryTestRoot(root)
  }
})
