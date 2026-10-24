import { openRecordNote } from '../support/ui-disclosure'
import { join } from 'node:path'
import { expect, test, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

test('explicit unscheduled creation, discoverable manual recording and both arrangement switches', async () => {
  const root = await createTemporaryTestRoot()
  let application: ElectronApplication | undefined
  try {
    application = await electron.launch({
      cwd: root.root,
      chromiumSandbox: true,
      args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
      env: minimalElectronEnvironment(root)
    })
    const page = await application.firstWindow()
    const navigate = async (name: string) =>
      page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
    await navigate('例行')
    const form = page.locator('form').filter({ hasText: '新例行' })
    await form.getByLabel('名称').fill('合成随时弹琴')
    await form.getByLabel('最小行动').fill('弹一小段')
    await form.getByLabel('安排方式').selectOption('unscheduled')
    await expect(form.getByRole('group', { name: '每周安排' })).toHaveCount(0)
    await form.getByRole('button', { name: '创建例行', exact: true }).click()
    const detail = page.getByLabel('合成随时弹琴 例行详情', { exact: true })
    await expect(detail.getByText('无固定安排', { exact: true }).first()).toBeVisible()
    await navigate('今天')
    const chooser = page.locator('.planned-routines details')
    await expect(chooser).not.toHaveAttribute('open')
    await chooser.locator('summary').focus()
    await page.keyboard.press('Enter')
    await chooser.getByRole('button', { name: /合成随时弹琴/ }).click()
    const panel = page.getByLabel('合成随时弹琴 例行记录', { exact: true })
    await panel.getByRole('button', { name: '记录例行', exact: true }).click()
    await openRecordNote(panel.getByLabel('备注（可选）'))
    await panel.getByLabel('备注（可选）').fill('合成未保存草稿')
    await navigate('目标')
    await navigate('今天')
    await expect(panel.getByLabel('备注（可选）')).toHaveValue('合成未保存草稿')
    await panel.getByRole('button', { name: '放弃草稿', exact: true }).click()
    await expect(panel.getByRole('button', { name: '记录例行', exact: true })).toBeFocused()
    await navigate('例行')
    await detail.getByText('编辑内容和安排', { exact: true }).click()
    await detail.getByLabel('安排方式').selectOption('weekly')
    await detail.getByRole('button', { name: '每天', exact: true }).click()
    await detail.getByRole('button', { name: '保存安排', exact: true }).click()
    await navigate('今天')
    await expect(
      page
        .locator('.planned-routine-list')
        .first()
        .getByRole('button', { name: /合成随时弹琴/ })
    ).toBeVisible()
    await navigate('例行')
    await detail.getByText('编辑内容和安排', { exact: true }).click()
    await detail.getByLabel('安排方式').selectOption('unscheduled')
    await detail.getByRole('button', { name: '保存安排', exact: true }).click()
    await navigate('今天')
    expect(
      await page.evaluate(async () => {
        const result = await window.myTracer.today.get({})
        if (!result.ok) throw new Error('Cannot read synthetic today')
        return result.value.plannedRoutines.length
      })
    ).toBe(0)
    await application.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0]
      window.setContentSize(800, 700)
      window.webContents.setZoomFactor(1.25)
    })
    await expect(chooser.locator('summary')).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
    ).toBe(true)
  } finally {
    await application?.close()
    await removeTemporaryTestRoot(root)
  }
})
