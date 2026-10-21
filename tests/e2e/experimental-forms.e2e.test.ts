import { join } from 'node:path'
import { expect, test, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

test('gives goal and routine creation a full workspace and preserves a collapsed draft', async () => {
  const root = await createTemporaryTestRoot()
  let application: ElectronApplication | undefined
  try {
    application = await electron.launch({
      cwd: root.root,
      args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
      env: minimalElectronEnvironment(root)
    })
    const page = await application.firstWindow()
    await application.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].setContentSize(1120, 760)
    })
    await page.getByRole('navigation').getByRole('button', { name: '目标', exact: true }).click()
    await page.getByRole('button', { name: '新建目标', exact: true }).click()
    const goalForm = page.getByRole('form', { name: '新建目标表单' })
    await expect(goalForm).toBeVisible()
    expect(await goalForm.evaluate((form) => form.getBoundingClientRect().width)).toBeGreaterThan(
      600
    )
    await goalForm.getByLabel('目标名称').fill('保留阅读的方向')
    await goalForm.getByLabel('当前下一步（可选）').fill('读两页，并记下一个问题')
    await goalForm.getByLabel('说明（可选）').fill('不追赶进度，只留下真实发生的行动。')
    await goalForm.getByRole('button', { name: '创建目标', exact: true }).click()
    const goalDetail = page.getByLabel('保留阅读的方向 详情', { exact: true })
    await expect(goalDetail).toContainText('不追赶进度，只留下真实发生的行动。')

    await page.getByRole('navigation').getByRole('button', { name: '例行', exact: true }).click()
    const routineForm = page.getByRole('form', { name: '新建例行表单' })
    await expect(routineForm).toBeVisible()
    expect(
      await routineForm.evaluate((form) => form.getBoundingClientRect().width)
    ).toBeGreaterThan(600)
    await routineForm.getByLabel('名称', { exact: true }).fill('晚间阅读')
    await routineForm.getByLabel('最小行动', { exact: true }).fill('读两页')
    await routineForm.getByRole('button', { name: '收起表单', exact: true }).click()
    await expect(routineForm).toHaveCount(0)
    await page.getByRole('button', { name: '新建例行', exact: true }).click()
    await expect(routineForm.getByLabel('名称', { exact: true })).toHaveValue('晚间阅读')
    await expect(routineForm.getByLabel('最小行动', { exact: true })).toHaveValue('读两页')
    await routineForm.getByRole('button', { name: '每天', exact: true }).click()
    await routineForm.getByRole('button', { name: '创建例行', exact: true }).click()
    await expect(routineForm).toHaveCount(0)
    const routineDetail = page.getByLabel('晚间阅读 例行详情', { exact: true })
    await expect(routineDetail.getByLabel('例行安排')).toContainText('读两页')
    await expect(routineDetail.getByLabel('例行安排')).toContainText('每天')
    // Content and schedule are separate saves: neither may discard the other's draft.
    await routineDetail.getByText('编辑内容和每周安排', { exact: true }).click()
    await routineDetail.getByLabel('最小行动', { exact: true }).fill('读三页')
    await routineDetail.getByRole('checkbox', { name: '周日', exact: true }).uncheck()
    await routineDetail.getByRole('button', { name: '保存内容修改', exact: true }).click()
    await expect(routineDetail.getByLabel('例行安排')).toContainText('读三页')
    await expect(routineDetail.getByLabel('例行安排')).toContainText('每天')
    await expect(
      routineDetail.getByRole('checkbox', { name: '周日', exact: true })
    ).not.toBeChecked()

    await routineDetail.getByLabel('最小行动', { exact: true }).fill('读四页，尚未保存')
    await routineDetail.getByLabel('说明（可选）', { exact: true }).fill('保留这段内容草稿')
    await routineDetail.getByRole('button', { name: '保存星期安排', exact: true }).click()
    await expect(routineDetail.getByLabel('例行安排')).toContainText('周一、二、三、四、五、六')
    await expect(routineDetail.getByLabel('例行安排')).toContainText('读三页')
    await expect(routineDetail.getByLabel('最小行动', { exact: true })).toHaveValue(
      '读四页，尚未保存'
    )
    await expect(routineDetail.getByLabel('说明（可选）', { exact: true })).toHaveValue(
      '保留这段内容草稿'
    )
    await routineDetail.getByRole('button', { name: '保存内容修改', exact: true }).click()
    await expect(routineDetail.getByLabel('例行安排')).toContainText('读四页，尚未保存')
    await expect(routineDetail.getByLabel('例行安排')).toContainText('保留这段内容草稿')
    await expect(
      routineDetail.getByRole('checkbox', { name: '周日', exact: true })
    ).not.toBeChecked()

    expect(
      await page.locator('main').evaluate((main) => main.scrollWidth <= main.clientWidth)
    ).toBe(true)
  } finally {
    await application?.close().catch(() => undefined)
    await removeTemporaryTestRoot(root)
  }
})
