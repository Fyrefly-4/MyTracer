import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

test('discard acknowledges both active and expired drafts without changing saved records', async () => {
  const root = await createTemporaryTestRoot()
  const application = await electron.launch({
    cwd: root.root,
    args: [
      ...(process.platform === 'linux' ? ['--headless', '--ozone-platform=headless'] : []),
      join(process.cwd(), 'out/main/index.js'),
      `--user-data-dir=${root.electronUserData}`
    ],
    env: minimalElectronEnvironment(root)
  })
  try {
    const page = await application.firstWindow()
    const actionId = await page.evaluate(async () => {
      const result = await window.myTracer.goals.create({
        name: '合成记录反馈测试',
        initialNextAction: { title: '读两页书' }
      })
      if (!result.ok || !result.value.currentNextAction) throw new Error('Setup failed')
      return result.value.currentNextAction.id
    })
    await page.reload()
    const navigate = async (name: string): Promise<void> => {
      await page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
    }
    await navigate('今天')
    await page.getByRole('button', { name: /读两页书.*待行动/ }).click()
    const panel = page.getByLabel('读两页书 行动记录')
    const begin = panel.getByRole('button', { name: '开始记录', exact: true })
    await begin.click()
    await panel.getByLabel('投入时长（分钟，可选）').fill('8')
    await panel.getByRole('button', { name: '保存记录', exact: true }).click()
    await expect(panel.getByRole('status')).toContainText('已保存：8 分钟')
    const saved = await page.evaluate(
      (id) => window.myTracer.records.listForAction({ actionId: id }),
      actionId
    )

    for (const expired of [false, true]) {
      await begin.click()
      await expect(panel.getByText('已放弃未保存草稿，已有记录保持不变。')).toHaveCount(0)
      await panel.getByLabel('投入时长（分钟，可选）').fill('12')
      await navigate('目标')
      await navigate('今天')
      await expect(panel.getByLabel('投入时长（分钟，可选）')).toHaveValue('12')
      if (expired) {
        // Beginning another context for this same action invalidates the restored one.
        const replacement = await page.evaluate(
          (id) => window.myTracer.records.begin({ actionId: id }),
          actionId
        )
        expect(replacement.ok).toBe(true)
        if (replacement.ok) {
          await page.evaluate(
            (recordingContextId) => window.myTracer.records.cancel({ recordingContextId }),
            replacement.value.recordingContextId
          )
        }
      }
      await panel.getByRole('button', { name: '放弃草稿', exact: true }).click()
      await expect(panel.getByRole('status')).toHaveText('已放弃未保存草稿，已有记录保持不变。')
      await expect(begin).toBeFocused()
      expect(
        await page.evaluate(
          (id) => window.myTracer.records.listForAction({ actionId: id }),
          actionId
        )
      ).toEqual(saved)
    }
  } finally {
    await application.close()
    await removeTemporaryTestRoot(root)
  }
})
