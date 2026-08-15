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

test('completes AC-01 through factual Progress and recalculates after a real reopen', async () => {
  test.slow()
  const root = await createTemporaryTestRoot()
  let application: ElectronApplication | undefined

  try {
    application = await launchApplication(root)
    let page = await application.firstWindow()

    await page.getByRole('button', { name: 'Goals' }).click()
    await page.getByLabel('目标名称').fill('系统学习 React')
    await page.getByLabel('当前下一步（可选）').fill('运行一个 React 状态更新示例')
    await page.getByRole('button', { name: '创建目标' }).click()

    await page.getByRole('button', { name: 'Today' }).click()
    await page.getByRole('button', { name: /运行一个 React 状态更新示例.*待行动/ }).click()
    const detail = page.getByLabel('运行一个 React 状态更新示例 行动详情')
    await detail.getByRole('button', { name: '选入今天' }).click()
    const panel = page.getByLabel('运行一个 React 状态更新示例 行动记录')
    await panel.getByRole('button', { name: '开始记录' }).click()
    await panel.getByLabel('投入分钟').fill('25')
    await panel.getByLabel('本次结果').selectOption('partial')
    await panel.getByRole('button', { name: /添加理解/ }).click()
    await panel.getByLabel('我理解了（可选）').fill('状态更新会进入队列')
    await panel.getByLabel('我仍困惑（可选）').fill('批处理何时结束')
    await panel.getByLabel('记录中的下一步（可选）').fill('运行函数式更新示例')
    await panel.getByRole('button', { name: '保存记录' }).click()

    await page.getByRole('button', { name: 'Progress' }).click()
    await expect(page.getByRole('heading', { name: '进展会来自已经记录的事实' })).toBeVisible()
    await expect(page.getByLabel('进展汇总')).toContainText('累计行动分钟25')
    await expect(page.getByLabel('进展汇总')).toContainText('记录到的行动次数1')
    await expect(page.getByText('状态更新会进入队列')).toBeVisible()
    await expect(page.getByText('批处理何时结束')).toBeVisible()
    await expect(page.getByText('运行一个 React 状态更新示例', { exact: true })).toBeVisible()
    await expect(page.getByLabel('进展汇总').locator('article')).toHaveCount(4)
    await expect(page.getByLabel('进展汇总')).not.toContainText(/评分|掌握度|失败率|排名|自律/)

    const beforeReopen = await page.evaluate(() => window.myTracer.progress.get({}))
    expect(beforeReopen).toMatchObject({
      ok: true,
      value: {
        totalDurationMinutes: 25,
        realActionCount: 1,
        records: [
          {
            durationMinutes: 25,
            outcome: 'partial',
            understandings: [{ text: '状态更新会进入队列' }],
            openConfusions: [{ text: '批处理何时结束' }]
          }
        ]
      }
    })

    await application.close()
    application = undefined
    application = await launchApplication(root)
    page = await application.firstWindow()
    await page.getByRole('button', { name: 'Progress' }).click()
    await expect(page.getByLabel('进展汇总')).toContainText('累计行动分钟25')
    await expect(page.getByLabel('进展汇总')).toContainText('记录到的行动次数1')
    expect(await page.evaluate(() => window.myTracer.progress.get({}))).toEqual(beforeReopen)

    await page.getByLabel('目标（可选）').selectOption({ label: '系统学习 React' })
    await page.getByLabel('开始日期（包含）').fill('2099-01-01')
    await page.getByRole('button', { name: '查看事实' }).click()
    await expect(page.getByRole('heading', { name: '这个范围内还没有已记录事实' })).toBeVisible()
    await expect(page.getByText(/空白不表示失败、未坚持或未掌握/)).toBeVisible()
  } finally {
    await application?.close()
    await removeTemporaryTestRoot(root)
  }
})
