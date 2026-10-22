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

test('manages a Routine lifecycle, shows its Today plan, and preserves history on reopen', async () => {
  const root = await createTemporaryTestRoot()
  const databasePath = join(root.electronUserData, 'data', 'mytracer.sqlite3')
  let application: ElectronApplication | undefined

  try {
    application = await launchApplication(root)
    let page = await application.firstWindow()
    const goal = await page.evaluate(async () => {
      const result = await window.myTracer.goals.create({
        name: '维持身体状态',
        description: null,
        initialNextAction: null
      })
      if (!result.ok) throw new Error(result.error.message)
      return result.value
    })

    await page.getByRole('button', { name: '例行', exact: true }).click()
    await expect(page.getByRole('heading', { name: '例行', exact: true })).toBeVisible()
    const createForm = page.locator('form').filter({ hasText: '新例行' })
    await createForm.getByLabel('名称').fill('晨间伸展')
    await createForm.getByLabel('最小行动').fill('伸展 2 分钟')
    await createForm.getByLabel('说明（可选）').fill('从轻量动作开始')
    await createForm.getByLabel('关联目标（可选，创建后不可改）').selectOption(goal.id)
    await createForm.getByRole('button', { name: '每天' }).click()
    await createForm.getByRole('button', { name: '创建例行' }).click()

    let detail = page.getByLabel('晨间伸展 例行详情')
    await expect(detail).toBeVisible()
    await expect(detail.getByText('维持身体状态 · 活跃')).toBeVisible()
    await expect(detail.getByText('活跃', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: '今天', exact: true }).click()
    await page
      .getByLabel('今日例行计划', { exact: true })
      .getByRole('button', { name: /^晨间伸展 / })
      .click()
    const planned = page.getByLabel('晨间伸展 例行详情', { exact: true })
    await expect(planned.getByText('最小行动：伸展 2 分钟')).toBeVisible()
    await expect(planned.getByText('目标：维持身体状态 · 活跃')).toBeVisible()
    await expect(planned.getByText('未记录', { exact: true }).first()).toBeVisible()

    await page.evaluate(async (goalId) => {
      const result = await window.myTracer.goals.pause({ goalId })
      if (!result.ok) throw new Error(result.error.message)
    }, goal.id)
    await page.getByRole('button', { name: '例行', exact: true }).click()
    await page.getByRole('button', { name: /晨间伸展/ }).click()
    detail = page.getByLabel('晨间伸展 例行详情')
    await detail.getByText('编辑内容和每周安排', { exact: true }).click()
    await expect(detail.getByText('维持身体状态 · 暂停')).toBeVisible()
    await page.getByRole('button', { name: '今天', exact: true }).click()
    await expect(page.getByText('目标：维持身体状态 · 暂停')).toBeVisible()
    await page.evaluate(async (goalId) => {
      const result = await window.myTracer.goals.end({ goalId })
      if (!result.ok) throw new Error(result.error.message)
    }, goal.id)
    await page.getByRole('button', { name: '例行', exact: true }).click()
    await page.getByRole('button', { name: '今天', exact: true }).click()
    await expect(page.getByText('目标：维持身体状态 · 结束')).toBeVisible()

    await page.getByRole('button', { name: '例行', exact: true }).click()
    await page.getByRole('button', { name: /晨间伸展/ }).click()
    detail = page.getByLabel('晨间伸展 例行详情')
    await detail.getByText('编辑内容和每周安排', { exact: true }).click()
    await detail.getByLabel('名称').fill('晨间舒展')
    await detail.getByLabel('最小行动').fill('舒展 3 分钟')
    await detail.getByRole('button', { name: '保存内容修改' }).click()
    detail = page.getByLabel('晨间舒展 例行详情')
    await expect(detail).toBeVisible()
    await detail.getByRole('button', { name: '工作日' }).click()
    await detail.getByRole('button', { name: '保存星期安排' }).click()
    expect(
      await page.evaluate(async () => {
        const listed = await window.myTracer.routines.list({})
        if (!listed.ok || listed.value.length !== 1) throw new Error('Routine was not listed.')
        return listed.value[0].weekdays
      })
    ).toEqual([1, 2, 3, 4, 5])

    await detail.getByRole('button', { name: '暂停' }).click()
    await expect(detail.getByText('暂停', { exact: true }).last()).toBeVisible()
    await detail.getByRole('button', { name: '恢复' }).click()
    await expect(detail.getByText('活跃', { exact: true }).last()).toBeVisible()
    await detail.getByRole('button', { name: '结束例行' }).click()
    const confirmation = detail.getByRole('alertdialog')
    await expect(confirmation.getByText('结束后不能恢复；已有历史会保留。')).toBeVisible()
    await confirmation.getByRole('button', { name: '确认结束' }).click()
    await expect(
      detail.getByText('这个例行已结束且不能恢复；当前内容、节奏与历史仍会保留。')
    ).toBeVisible()
    await expect(detail.getByRole('button', { name: '恢复' })).toHaveCount(0)

    await application.close()
    application = undefined
    application = await launchApplication(root)
    page = await application.firstWindow()
    await page.getByRole('button', { name: '例行', exact: true }).click()
    await page.getByRole('button', { name: /晨间舒展/ }).click()
    detail = page.getByLabel('晨间舒展 例行详情')
    await detail.getByText('编辑内容和每周安排', { exact: true }).click()
    await expect(detail.getByText('结束', { exact: true }).last()).toBeVisible()
    await expect(detail.getByLabel('最小行动')).toHaveValue('舒展 3 分钟')

    await application.close()
    application = undefined
    const database = new Database(databasePath, { readonly: true })
    try {
      expect(
        database.prepare('SELECT name, minimum_action, status, goal_id FROM routines').get()
      ).toMatchObject({
        name: '晨间舒展',
        minimum_action: '舒展 3 分钟',
        status: 'ended',
        goal_id: goal.id
      })
      expect(
        database.prepare('SELECT weekday FROM routine_schedule_days ORDER BY weekday').all()
      ).toEqual([{ weekday: 1 }, { weekday: 2 }, { weekday: 3 }, { weekday: 4 }, { weekday: 5 }])
      expect(database.prepare('SELECT COUNT(*) AS count FROM routine_records').get()).toEqual({
        count: 0
      })
    } finally {
      database.close()
    }
  } finally {
    await application?.close()
    await removeTemporaryTestRoot(root)
  }
})
