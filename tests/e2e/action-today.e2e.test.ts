import Database from 'better-sqlite3'
import { join } from 'node:path'
import { expect, test, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import {
  createTemporaryTestRoot,
  removeTemporaryTestRoot,
  type TemporaryTestRoot
} from '../support/temporary-test-root'

async function launchApplication(root: TemporaryTestRoot): Promise<ElectronApplication> {
  return electron.launch({
    cwd: root.root,
    args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
    env: minimalElectronEnvironment(root)
  })
}

async function expectKeyboardInputAfterTransition(
  page: Awaited<ReturnType<ElectronApplication['firstWindow']>>,
  value: string
): Promise<void> {
  const input = page.locator('form.goal-create').getByLabel('行动标题')
  await input.fill('')
  await input.click()
  await input.pressSequentially(value)
  await expect(input).toHaveValue(value)
  await input.fill('')
}

test('runs Action and Today focus lifecycle and preserves facts through a real reopen', async () => {
  const root = await createTemporaryTestRoot()
  const databasePath = join(root.electronUserData, 'data', 'mytracer.sqlite3')
  let application: ElectronApplication | undefined

  try {
    application = await launchApplication(root)
    let page = await application.firstWindow()

    await page.getByRole('button', { name: 'Goals' }).click()
    await page.getByLabel('目标名称').fill('系统学习 React')
    await page.getByLabel('当前下一步（可选）').fill('运行一个 React 状态更新示例')
    await page.getByRole('button', { name: '创建目标' }).click()

    await page.getByRole('button', { name: 'Today' }).click()
    await expect(page.getByRole('heading', { name: '今天，从一个真实动作开始' })).toBeVisible()
    await page.getByRole('button', { name: /运行一个 React 状态更新示例.*待行动/ }).click()
    let detail = page.getByLabel('运行一个 React 状态更新示例 行动详情')
    await expect(detail).toBeVisible()
    await detail.getByRole('button', { name: '选入今天' }).click()
    await expect(page.getByText('已由你选入今天，可以从这里继续。')).toBeVisible()
    await expect(
      page.locator('.focus-row').filter({ hasText: '运行一个 React 状态更新示例' })
    ).toBeVisible()

    await detail.getByRole('button', { name: '标记完成' }).click()
    await detail.getByRole('alertdialog').getByRole('button', { name: '确认完成' }).click()
    detail = page.getByLabel('运行一个 React 状态更新示例 行动详情')
    await expect(detail.getByText('已完成', { exact: true })).toBeVisible()
    await expect(detail.getByText('行动已完成，不能再次开始。')).toBeVisible()
    await expect(
      page.locator('.focus-row').filter({ hasText: '运行一个 React 状态更新示例' })
    ).toContainText('已完成')
    await expectKeyboardInputAfterTransition(page, '完成后仍可输入')

    const createForm = page.locator('form.goal-create')
    await createForm.getByLabel('行动标题').fill('稍后继续阅读')
    await createForm.getByRole('button', { name: '创建行动' }).click()
    detail = page.getByLabel('稍后继续阅读 行动详情')
    await detail.getByRole('button', { name: '选入今天' }).click()
    await detail.getByRole('button', { name: '重新安排' }).click()
    await detail.getByRole('alertdialog').getByRole('button', { name: '确认重新安排' }).click()
    await expect(detail.getByText('已重新安排', { exact: true })).toBeVisible()
    await expect(page.locator('.focus-row').filter({ hasText: '稍后继续阅读' })).toHaveCount(0)
    await expectKeyboardInputAfterTransition(page, '重新安排后仍可输入')
    await detail.getByRole('button', { name: '选入今天' }).click()
    await expect(detail.getByText('待行动', { exact: true })).toBeVisible()
    await expect(page.locator('.focus-row').filter({ hasText: '稍后继续阅读' })).toBeVisible()

    await createForm.getByLabel('行动标题').fill('取消但保留今天')
    await createForm.getByRole('button', { name: '创建行动' }).click()
    detail = page.getByLabel('取消但保留今天 行动详情')
    await detail.getByRole('button', { name: '选入今天' }).click()
    await detail.getByRole('button', { name: '取消行动' }).click()
    await detail.getByRole('alertdialog').getByRole('button', { name: '确认取消' }).click()
    await expect(detail.getByText('已取消', { exact: true })).toBeVisible()
    await expect(page.locator('.focus-row').filter({ hasText: '取消但保留今天' })).toContainText(
      '已取消'
    )
    await expectKeyboardInputAfterTransition(page, '取消后仍可输入')

    await application.close()
    application = undefined
    application = await launchApplication(root)
    page = await application.firstWindow()
    await expect(page.locator('.focus-row')).toHaveCount(3)
    await expect(
      page.locator('.focus-row').filter({ hasText: '运行一个 React 状态更新示例' })
    ).toContainText('已完成')
    await expect(page.locator('.focus-row').filter({ hasText: '稍后继续阅读' })).toContainText(
      '待行动'
    )
    await expect(page.locator('.focus-row').filter({ hasText: '取消但保留今天' })).toContainText(
      '已取消'
    )

    await application.close()
    application = undefined
    const database = new Database(databasePath, { readonly: true })
    try {
      expect(
        database.prepare('SELECT title, status FROM actions ORDER BY created_at ASC, id ASC').all()
      ).toEqual([
        { title: '运行一个 React 状态更新示例', status: 'completed' },
        { title: '稍后继续阅读', status: 'pending' },
        { title: '取消但保留今天', status: 'cancelled' }
      ])
      expect(
        database
          .prepare('SELECT kind, selected_by FROM today_selections ORDER BY action_id ASC')
          .all()
      ).toEqual([
        { kind: 'focus', selected_by: 'user' },
        { kind: 'focus', selected_by: 'user' },
        { kind: 'focus', selected_by: 'user' }
      ])
      expect(database.prepare('SELECT current_next_action_id FROM goals').get()).toEqual({
        current_next_action_id: null
      })
    } finally {
      database.close()
    }
  } finally {
    await application?.close()
    await removeTemporaryTestRoot(root)
  }
})
