import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

test.skip(process.platform !== 'win32', 'Native Electron acceptance runs on Windows CI.')

async function withApplication(run: (page: Page) => Promise<void>): Promise<void> {
  const root = await createTemporaryTestRoot()
  let app: ElectronApplication | undefined
  try {
    app = await electron.launch({
      chromiumSandbox: true,
      cwd: root.root,
      args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
      env: minimalElectronEnvironment(root)
    })
    await run(await app.firstWindow())
  } finally {
    await app?.close()
    await removeTemporaryTestRoot(root)
  }
}

async function openGoals(page: Page): Promise<void> {
  await page.getByRole('navigation').getByRole('button', { name: '目标', exact: true }).click()
}

test('a name-only goal offers an optional keyboard entry into the existing next-step form', async () => {
  await withApplication(async (page) => {
    await openGoals(page)
    await page.getByRole('button', { name: '创建第一个目标', exact: true }).click()
    const create = page.getByLabel('新建目标表单')
    await create.getByLabel('目标名称', { exact: true }).fill('只先留下方向')
    await create.getByRole('button', { name: '创建目标', exact: true }).click()
    const detail = page.getByLabel('只先留下方向 详情', { exact: true })
    const entry = detail.getByRole('button', { name: '新建下一步', exact: true })
    await expect(entry).toBeVisible()
    await expect(detail).toContainText('可以先保留方向')
    const before = await page.evaluate(() => window.myTracer.dataControl.list())
    await entry.focus()
    await page.keyboard.press('Enter')
    const title = detail.getByLabel('下一步名称', { exact: true })
    await expect(title).toBeFocused()
    await expect(detail.getByLabel('选择当前下一步', { exact: true })).toHaveValue(
      '__new-next-action__'
    )
    await expect(detail.locator('form').filter({ has: title })).toHaveCount(1)
    await title.fill('读一个小例子')
    await detail.getByLabel('下一步说明（选填）').fill('保留这一点上下文')
    await detail.getByLabel('目标名称', { exact: true }).fill('未保存的目标名称')
    await detail.getByText('编辑与管理目标', { exact: true }).click()
    await entry.focus()
    await page.keyboard.press('Space')
    await expect(title).toBeFocused()
    await expect(title).toHaveValue('读一个小例子')
    await expect(detail.getByLabel('下一步说明（选填）')).toHaveValue('保留这一点上下文')
    await expect(detail.getByLabel('目标名称', { exact: true })).toHaveValue('未保存的目标名称')
    expect(await page.evaluate(() => window.myTracer.dataControl.list())).toEqual(before)
    await detail.getByRole('button', { name: '创建并设为当前下一步', exact: true }).click()
    await expect(detail.locator('.next-action-panel')).toContainText('读一个小例子')
    await expect(entry).toHaveCount(0)
    const today = await page.evaluate(() => window.myTracer.today.get({}))
    expect(today.ok && today.value.focuses).toEqual([])
    expect(today.ok && today.value.intentions).toEqual([])
    const snapshot = await page.evaluate(() => window.myTracer.dataControl.list())
    expect(snapshot.ok && snapshot.value.actions).toHaveLength(1)
    expect(snapshot.ok && snapshot.value.actionRecords).toEqual([])
  })
})

test('the empty-step entry is limited to active goals and does not leak drafts between goals', async () => {
  await withApplication(async (page) => {
    await page.evaluate(async () => {
      for (const name of ['活跃空目标甲', '活跃空目标乙', '暂停空目标', '结束空目标']) {
        const goal = await window.myTracer.goals.create({ name })
        if (!goal.ok) throw new Error('Goal fixture failed')
        if (name === '暂停空目标') await window.myTracer.goals.pause({ goalId: goal.value.id })
        if (name === '结束空目标') await window.myTracer.goals.end({ goalId: goal.value.id })
      }
      const goal = await window.myTracer.goals.create({
        name: '已有下一步',
        initialNextAction: { title: '继续既有行动' }
      })
      if (!goal.ok) throw new Error('Goal fixture failed')
    })
    await openGoals(page)
    const list = page.getByLabel('目标列表', { exact: true })
    await list.getByRole('button', { name: /活跃空目标甲/ }).click()
    await page.getByRole('button', { name: '新建下一步', exact: true }).click()
    await page.getByLabel('下一步名称', { exact: true }).fill('只属于甲的输入')
    await list.getByRole('button', { name: /活跃空目标乙/ }).click()
    await page.getByRole('button', { name: '新建下一步', exact: true }).click()
    await expect(page.getByLabel('下一步名称', { exact: true })).toHaveValue('')
    for (const name of ['暂停空目标', '结束空目标', '已有下一步']) {
      await list.getByRole('button', { name: new RegExp(name) }).click()
      await expect(page.getByLabel(`${name} 详情`, { exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: '新建下一步', exact: true })).toHaveCount(0)
    }
  })
})
