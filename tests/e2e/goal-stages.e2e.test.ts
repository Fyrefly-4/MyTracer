import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { openManagement } from '../support/ui-disclosure'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

async function scenario(
  run: (page: Page, app: ElectronApplication, oldId: string) => Promise<void>
) {
  const root = await createTemporaryTestRoot()
  let app: ElectronApplication | undefined
  try {
    app = await electron.launch({
      cwd: root.root,
      chromiumSandbox: true,
      args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
      env: minimalElectronEnvironment(root)
    })
    const page = await app.firstWindow()
    const oldId = await page.evaluate(async () => {
      const old = await window.myTracer.goals.create({
        name: '旧照片',
        description: '旧说明',
        initialNextAction: { title: '旧下一步' }
      })
      if (!old.ok) throw new Error('Fixture failed')
      if (!(await window.myTracer.goals.end({ goalId: old.value.id })).ok)
        throw new Error('End failed')
      if (!(await window.myTracer.goals.create({ name: '普通目标' })).ok)
        throw new Error('Fixture failed')
      return old.value.id
    })
    await page.getByRole('button', { name: '目标', exact: true }).click()
    await page.getByRole('button', { name: /旧照片.*结束/ }).click()
    await run(page, app, oldId)
  } finally {
    try {
      await app?.close()
    } finally {
      await removeTemporaryTestRoot(root)
    }
  }
}

async function holdStageResponse(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ ipcMain }) => {
    const handlers = Reflect.get(ipcMain, '_invokeHandlers') as Map<
      string,
      (...args: unknown[]) => unknown
    >
    const original = handlers.get('goals:create-stage')!
    ipcMain.removeHandler('goals:create-stage')
    ipcMain.handle('goals:create-stage', async (...args) => {
      const result = await original(...args)
      return new Promise((resolve) => {
        Reflect.set(globalThis, '__releaseStage', () => resolve(result))
      })
    })
  })
}

test('stage drafts cancel without writes; independent creation, navigation and ordinary drafts survive narrow zoom and keyboard', async () => {
  await scenario(async (page, app, oldId) => {
    await app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0]!
      window.setSize(820, 600)
      window.webContents.setZoomFactor(1.5)
    })
    const count = () =>
      page.evaluate(async () => {
        const result = await window.myTracer.goals.list({})
        if (!result.ok) throw new Error('Read failed')
        return result.value.length
      })
    const start = page.getByRole('button', { name: '开始新阶段', exact: true })
    await start.click()
    const form = page.getByRole('form', { name: '开始新阶段表单' })
    await expect(form.getByLabel('新阶段名称', { exact: true })).toBeFocused()
    await form.getByLabel('新阶段名称', { exact: true }).fill('不会保存')
    await form.getByLabel('新阶段名称', { exact: true }).press('Escape')
    await expect(form).toHaveCount(0)
    await expect(start).toBeFocused()
    expect(await count()).toBe(2)
    await page.getByRole('button', { name: '新建目标', exact: true }).click()
    await page
      .getByRole('form', { name: '新建目标表单' })
      .getByLabel('目标名称', { exact: true })
      .fill('普通创建草稿')
    await page.getByRole('button', { name: '取消新建', exact: true }).click()
    await start.click()
    await expect(form.getByLabel('新阶段说明（可选）')).toHaveValue('旧说明')
    await form.getByLabel('新阶段名称', { exact: true }).fill('新的相册')
    await form.getByLabel('新阶段说明（可选）').fill('新说明')
    await form.getByRole('button', { name: '创建新阶段', exact: true }).focus()
    await page.keyboard.press('Enter')
    const next = page.getByRole('article', { name: '新的相册 详情' })
    await expect(next).toBeVisible()
    await expect(next.locator('.next-action-panel strong')).toHaveText('暂未设置')
    const result = await page.evaluate(
      (goalId) => window.myTracer.goals.getDetail({ goalId }),
      oldId
    )
    expect(result).toMatchObject({
      ok: true,
      value: { status: 'ended', name: '旧照片', subsequentStages: [{ name: '新的相册' }] }
    })
    await next.getByRole('button', { name: '上一阶段：旧照片' }).click()
    await expect(page.getByRole('article', { name: '旧照片 详情' })).toBeVisible()
    await page.getByRole('button', { name: '后续阶段：新的相册' }).click()
    await expect(next).toBeVisible()
    await page.getByRole('button', { name: '新建目标', exact: true }).click()
    await expect(
      page.getByRole('form', { name: '新建目标表单' }).getByLabel('目标名称', { exact: true })
    ).toHaveValue('普通创建草稿')
    expect(await count()).toBe(3)
  })
})

test('repeated stage submit creates once and a delayed response never steals a later selection', async () => {
  await scenario(async (page, app, oldId) => {
    await holdStageResponse(app)
    await page.getByRole('button', { name: '开始新阶段', exact: true }).click()
    const form = page.getByRole('form', { name: '开始新阶段表单' })
    await form.getByLabel('新阶段名称', { exact: true }).fill('只创建一次')
    await form.evaluate((element) => {
      ;(element as HTMLFormElement).requestSubmit()
      ;(element as HTMLFormElement).requestSubmit()
    })
    await expect
      .poll(() => app.evaluate(() => typeof Reflect.get(globalThis, '__releaseStage')))
      .toBe('function')
    await page.getByRole('button', { name: /普通目标.*活跃/ }).click()
    await expect(page.getByRole('article', { name: '普通目标 详情' })).toBeVisible()
    await app.evaluate(() => {
      ;(Reflect.get(globalThis, '__releaseStage') as () => void)()
    })
    await expect(form).toHaveCount(0)
    await expect(page.getByRole('article', { name: '普通目标 详情' })).toBeVisible()
    expect(
      await page.evaluate((goalId) => window.myTracer.goals.getDetail({ goalId }), oldId)
    ).toMatchObject({ ok: true, value: { subsequentStages: [{ name: '只创建一次' }] } })
  })
})

test('deleted predecessor keeps the draft editable and creates nothing', async () => {
  await scenario(async (page, _app, oldId) => {
    await page.getByRole('button', { name: '开始新阶段', exact: true }).click()
    await page.evaluate(async (id) => {
      const preview = await window.myTracer.dataControl.previewDelete({
        target: { type: 'goal', id }
      })
      if (!preview.ok) throw new Error('Preview failed')
      const result = await window.myTracer.dataControl.confirmDelete({
        previewId: preview.value.previewId,
        target: { type: 'goal', id },
        confirmation: 'permanently-delete'
      })
      if (!result.ok) throw new Error('Delete failed')
    }, oldId)
    const form = page.getByRole('form', { name: '开始新阶段表单' })
    await form.getByRole('button', { name: '创建新阶段', exact: true }).click()
    await expect(form.getByRole('alert')).toContainText('已不存在')
    await expect(form.getByLabel('新阶段名称', { exact: true })).toHaveValue('旧照片')
    await form.getByRole('button', { name: '取消新阶段', exact: true }).click()
    expect(
      await page.evaluate(async () => {
        const result = await window.myTracer.goals.list({})
        return result.ok ? result.value.map((g) => g.name) : []
      })
    ).toEqual(['普通目标'])
  })
})

for (const saveOrdinary of [false, true]) {
  test(`delayed stage acknowledgement preserves a newer ordinary ${saveOrdinary ? 'created goal' : 'draft'}`, async () => {
    await scenario(async (page, app, oldId) => {
      await holdStageResponse(app)
      await page.getByRole('button', { name: '开始新阶段', exact: true }).click()
      const stageForm = page.getByRole('form', { name: '开始新阶段表单' })
      await stageForm.getByLabel('新阶段名称', { exact: true }).fill('迟到的新阶段')
      await stageForm.getByRole('button', { name: '创建新阶段', exact: true }).click()
      await expect
        .poll(() => app.evaluate(() => typeof Reflect.get(globalThis, '__releaseStage')))
        .toBe('function')
      await page.getByRole('button', { name: '新建目标', exact: true }).click()
      const ordinaryForm = page.getByRole('form', { name: '新建目标表单' })
      await ordinaryForm.getByLabel('目标名称', { exact: true }).fill('更新的普通目标')
      await ordinaryForm.getByLabel('说明（可选）').fill('较新的输入必须保留')
      if (saveOrdinary) {
        await ordinaryForm.getByRole('button', { name: '创建目标', exact: true }).click()
        await expect(page.getByRole('article', { name: '更新的普通目标 详情' })).toBeVisible()
      }
      await app.evaluate(() => {
        ;(Reflect.get(globalThis, '__releaseStage') as () => void)()
      })
      await expect(stageForm).toHaveCount(0)
      if (saveOrdinary) {
        await expect(page.getByRole('article', { name: '更新的普通目标 详情' })).toBeVisible()
        await expect(page.getByRole('article', { name: '迟到的新阶段 详情' })).toHaveCount(0)
      } else {
        await expect(ordinaryForm.getByLabel('目标名称', { exact: true })).toHaveValue(
          '更新的普通目标'
        )
        await expect(ordinaryForm.getByLabel('说明（可选）')).toHaveValue('较新的输入必须保留')
        await page.getByRole('button', { name: '取消新建', exact: true }).click()
        await expect(page.getByRole('article', { name: '旧照片 详情' })).toBeVisible()
      }
      expect(
        await page.evaluate((goalId) => window.myTracer.goals.getDetail({ goalId }), oldId)
      ).toMatchObject({ ok: true, value: { subsequentStages: [{ name: '迟到的新阶段' }] } })
      const names = await page.evaluate(async () => {
        const result = await window.myTracer.goals.list({})
        if (!result.ok) throw new Error('Read failed')
        return result.value.map((goal) => goal.name)
      })
      expect(names.filter((name) => name === '迟到的新阶段')).toHaveLength(1)
      expect(names.filter((name) => name === '更新的普通目标')).toHaveLength(saveOrdinary ? 1 : 0)
    })
  })
}

for (const mutation of ['next-action', 'pause'] as const) {
  test(`linked goal stays selected outside the ended filter after ${mutation}, while ordinary list selection clears it`, async () => {
    await scenario(async (page, _app, oldId) => {
      await page.getByRole('button', { name: '开始新阶段', exact: true }).click()
      const form = page.getByRole('form', { name: '开始新阶段表单' })
      await form.getByLabel('新阶段名称', { exact: true }).fill('筛选外的新阶段')
      await form.getByRole('button', { name: '创建新阶段', exact: true }).click()
      const detail = page.getByRole('article', { name: '筛选外的新阶段 详情' })
      await expect(detail).toBeVisible()
      await detail.getByRole('button', { name: '上一阶段：旧照片' }).click()
      await page.getByLabel('状态', { exact: true }).selectOption('ended')
      const old = page.getByRole('article', { name: '旧照片 详情' })
      await expect(old).toBeVisible()
      await old.getByRole('button', { name: '后续阶段：筛选外的新阶段' }).click()
      await expect(detail).toBeVisible()
      await openManagement(detail, '目标')
      if (mutation === 'next-action') {
        await detail.getByLabel('选择当前下一步').selectOption({ label: '新建下一步…' })
        await detail.getByLabel('下一步名称', { exact: true }).fill('独立的新下一步')
        await detail.getByRole('button', { name: '创建并设为当前下一步' }).click()
        await expect(detail.locator('.next-action-panel strong')).toHaveText('独立的新下一步')
        await detail.getByRole('button', { name: '暂停目标', exact: true }).click()
      } else {
        await detail.getByRole('button', { name: '暂停目标', exact: true }).click()
      }
      await expect(detail.getByRole('button', { name: '恢复目标', exact: true })).toBeEnabled()
      await detail.getByRole('button', { name: '恢复目标', exact: true }).click()
      await expect(detail.getByRole('button', { name: '暂停目标', exact: true })).toBeEnabled()
      await expect(page.getByLabel('状态', { exact: true })).toHaveValue('ended')
      await expect(page.locator('.goal-list-item')).toHaveCount(1)
      // Explicit ordinary selection must replace the linked route, without changing the filter.
      await page.getByRole('button', { name: /旧照片.*结束.*有下一步/ }).click()
      await expect(old).toBeVisible()
      await expect(detail).toHaveCount(0)
      await expect(page.getByLabel('状态', { exact: true })).toHaveValue('ended')
      expect(
        await page.evaluate((goalId) => window.myTracer.goals.getDetail({ goalId }), oldId)
      ).toMatchObject({
        ok: true,
        value: { status: 'ended', subsequentStages: [{ name: '筛选外的新阶段' }] }
      })
    })
  })
}
