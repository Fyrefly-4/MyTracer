import { openRecordNote } from '../support/ui-disclosure'
import { join } from 'node:path'
import { expect, test, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

test('unknown duration stays distinct from zero across recording, backfill, editing and summaries', async () => {
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
    const actionId = await page.evaluate(async () => {
      const goal = await window.myTracer.goals.create({
        name: 'Synthetic duration',
        initialNextAction: { title: '修理一小步' }
      })
      if (!goal.ok || !goal.value.currentNextActionId) throw Error('setup failed')
      return goal.value.currentNextActionId
    })
    await page.reload()
    const navigate = (name: string) =>
      page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
    await navigate('今天')
    await page.getByRole('button', { name: /修理一小步.*待行动/ }).click()
    const panel = page.getByLabel('修理一小步 行动记录')
    await panel.getByRole('button', { name: '开始记录' }).click()
    await expect(panel.getByLabel('投入时长（分钟，可选）')).toHaveValue('')
    await panel.getByRole('button', { name: '保存记录' }).click()
    await expect(panel.getByRole('table', { name: '已有行动记录' })).toContainText('时长未记录')
    await navigate('进展')
    await expect(page.getByLabel('进展汇总')).toContainText('时长未记录')
    await expect(page.getByLabel('进展汇总')).toContainText('1 条行动事实未记时长')
    await navigate('数据')
    const selected = page.getByLabel('所选记录', { exact: true })
    for (const duration of ['0', '12', '']) {
      await selected.getByRole('button', { name: '编辑记录', exact: true }).click()
      await selected.getByLabel('行动分钟', { exact: true }).fill(duration)
      await selected.getByRole('button', { name: '保存修改', exact: true }).click()
      await expect(selected).toContainText(
        duration === '' ? '时长未记录' : duration === '0' ? '少于 1 分钟' : '12 分钟'
      )
      await expect(selected.getByRole('button', { name: '编辑记录', exact: true })).toBeFocused()
    }
    await page.getByRole('button', { name: '补记记录', exact: true }).click()
    await page.getByLabel('行动补记日期', { exact: true }).fill('2026-08-20')
    await openRecordNote(page.getByLabel('行动补记备注', { exact: true }))
    await page.getByLabel('行动补记备注', { exact: true }).fill('未计时的历史事实')
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: /补记记录/ }).click()
    await expect(page.getByLabel('行动补记分钟', { exact: true })).toHaveValue('')
    await expect(page.getByLabel('行动补记备注', { exact: true })).toHaveValue('未计时的历史事实')
    await page.getByRole('button', { name: '补记行动记录', exact: true }).click()
    const facts = await page.evaluate(
      async (id) => window.myTracer.records.listForAction({ actionId: id }),
      actionId
    )
    expect(facts).toMatchObject({
      ok: true,
      value: [{ durationMinutes: null }, { durationMinutes: null }]
    })
    await app.close()
    app = undefined
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
    const reopened = await app.firstWindow()
    expect(
      await reopened.evaluate(
        async (id) => window.myTracer.records.listForAction({ actionId: id }),
        actionId
      )
    ).toEqual(facts)
  } finally {
    await app?.close().catch(() => undefined)
    await removeTemporaryTestRoot(root)
  }
})
