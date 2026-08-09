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

test('runs the Goal lifecycle and preserves it across a complete Electron and SQLite reopen', async () => {
  const root = await createTemporaryTestRoot()
  const databasePath = join(root.electronUserData, 'data', 'mytracer.sqlite3')
  let application: ElectronApplication | undefined

  try {
    application = await launchApplication(root)
    let page = await application.firstWindow()
    await page.getByRole('button', { name: 'Goals' }).click()
    await expect(
      page.getByRole('heading', { name: '目标可以停下，也可以从一个小步骤继续' })
    ).toBeVisible()

    await page.getByLabel('目标名称').fill('系统学习 React')
    await page.getByLabel('说明（可选）').fill('建立稳定基础')
    await page.getByLabel('当前下一步（可选）').fill('运行一个 React 状态更新示例')
    await page.getByRole('button', { name: '创建目标' }).click()

    let detail = page.getByLabel('系统学习 React 详情')
    await expect(detail).toBeVisible()
    await expect(detail.locator('.next-action-panel strong')).toHaveText(
      '运行一个 React 状态更新示例'
    )
    await expect(detail.getByText('活跃', { exact: true }).first()).toBeVisible()

    await detail.getByLabel('目标名称').fill('系统学习 React（已更新）')
    await detail.getByLabel('说明（可选）').fill('从一个可执行示例开始')
    await detail.getByRole('button', { name: '保存修改' }).click()
    detail = page.getByLabel('系统学习 React（已更新） 详情')
    await expect(detail).toBeVisible()

    await detail.getByLabel('选择当前下一步').selectOption('')
    await detail.getByRole('button', { name: '保存当前下一步' }).click()
    await expect(detail.getByText('暂未设置', { exact: true })).toBeVisible()
    await detail.getByLabel('选择当前下一步').selectOption({
      label: '运行一个 React 状态更新示例'
    })
    await detail.getByRole('button', { name: '保存当前下一步' }).click()
    await expect(detail.locator('.next-action-panel strong')).toHaveText(
      '运行一个 React 状态更新示例'
    )

    await detail.getByRole('button', { name: '暂停目标' }).click()
    await expect(detail.getByText('暂停', { exact: true }).first()).toBeVisible()
    await expect(detail.locator('.next-action-panel strong')).toHaveText(
      '运行一个 React 状态更新示例'
    )
    await expect(detail.getByLabel('选择当前下一步')).toHaveCount(0)

    await detail.getByRole('button', { name: '恢复目标' }).click()
    await expect(detail.getByText('活跃', { exact: true }).first()).toBeVisible()
    page.once('dialog', (dialog) => dialog.accept())
    await detail.getByRole('button', { name: '结束目标' }).click()
    await expect(detail.getByText('该目标已结束。已有下一步、行动与记录仍然保留。')).toBeVisible()
    await expect(detail.getByRole('button', { name: '恢复目标' })).toHaveCount(0)

    const beforeReopen = await page.evaluate(async () => {
      const listed = await window.myTracer.goals.list({ status: 'ended' })
      if (!listed.ok || listed.value.length !== 1) throw new Error('Ended Goal was not listed.')
      return window.myTracer.goals.getDetail({ goalId: listed.value[0].id })
    })
    expect(beforeReopen).toMatchObject({
      ok: true,
      value: {
        name: '系统学习 React（已更新）',
        status: 'ended',
        currentNextAction: { title: '运行一个 React 状态更新示例', status: 'pending' }
      }
    })
    expect(await page.evaluate(() => window.myTracer.shell.getStatus())).toMatchObject({
      ai: { configured: false, availability: 'not-configured' }
    })

    await application.close()
    application = undefined
    application = await launchApplication(root)
    page = await application.firstWindow()
    await page.getByRole('button', { name: 'Goals' }).click()
    await page.getByRole('button', { name: /系统学习 React（已更新）/ }).click()
    detail = page.getByLabel('系统学习 React（已更新） 详情')
    await expect(detail.getByText('结束', { exact: true }).first()).toBeVisible()
    await expect(detail.locator('.next-action-panel strong')).toHaveText(
      '运行一个 React 状态更新示例'
    )

    await application.close()
    application = undefined
    const database = new Database(databasePath, { readonly: true })
    try {
      expect(
        database.prepare('SELECT title, status, current_next_action_id FROM goals').get()
      ).toMatchObject({
        title: '系统学习 React（已更新）',
        status: 'ended',
        current_next_action_id: expect.any(String)
      })
      expect(database.prepare('SELECT title, status, goal_id FROM actions').get()).toMatchObject({
        title: '运行一个 React 状态更新示例',
        status: 'pending',
        goal_id: expect.any(String)
      })
    } finally {
      database.close()
    }
  } finally {
    await application?.close()
    await removeTemporaryTestRoot(root)
  }
})
