import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

async function navigate(page: Page, name: string): Promise<void> {
  await page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
}

async function openAppearance(page: Page, name: string) {
  await navigate(page, '目标')
  await page.locator('.goal-list-item').filter({ hasText: name }).click()
  const detail = page.getByLabel(`${name} 详情`, { exact: true })
  await detail.getByText('编辑与管理目标', { exact: true }).click()
  await detail.getByText('外观', { exact: true }).click()
  return detail
}

function cover(page: Page, name: string) {
  return page
    .getByRole('article', { name: `${name} 概览`, exact: true })
    .locator('.home-goal-cover > span')
}

test('goal cover defaults follow visible order while custom marks stay with their goal through rename and restart', async () => {
  test.slow()
  const root = await createTemporaryTestRoot()
  let app: ElectronApplication | undefined
  const launch = () =>
    electron.launch({
      cwd: root.root,
      args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
      env: minimalElectronEnvironment(root)
    })
  try {
    app = await launch()
    let page = await app.firstWindow()
    await navigate(page, '目标')
    const seeded = await page.evaluate(async () => {
      const today = await window.myTracer.today.get({})
      if (!today.ok) throw new Error('Cannot read isolated fixture date')
      const result: { name: string; goalId: string; actionId: string }[] = []
      for (const [index, name] of ['晨读目标', '运动目标', '写作目标'].entries()) {
        const goal = await window.myTracer.goals.create({
          name,
          initialNextAction: { title: `${name}下一步` }
        })
        if (!goal.ok || !goal.value.currentNextActionId)
          throw new Error('Cannot create isolated goal')
        const date = new Date(`${today.value.localDate}T12:00:00.000Z`)
        date.setUTCDate(date.getUTCDate() - (3 - index))
        const record = await window.myTracer.dataControl.backfillActionRecord({
          actionId: goal.value.currentNextActionId,
          occurredOn: date.toISOString().slice(0, 10),
          durationMinutes: 1,
          outcome: 'partial'
        })
        if (!record.ok) throw new Error('Cannot create isolated historical fact')
        result.push({ name, goalId: goal.value.id, actionId: goal.value.currentNextActionId })
      }
      return { goals: result, today: today.value.localDate }
    })
    await navigate(page, '首页')
    await expect(cover(page, '写作目标')).toHaveText('I')
    await expect(cover(page, '运动目标')).toHaveText('II')
    await expect(cover(page, '晨读目标')).toHaveText('III')
    await navigate(page, '目标')
    await page.evaluate(
      async ({ actionId, today }) => {
        const result = await window.myTracer.dataControl.backfillActionRecord({
          actionId,
          occurredOn: today,
          durationMinutes: 2,
          outcome: 'partial'
        })
        if (!result.ok) throw new Error('Cannot reorder isolated goals')
      },
      { actionId: seeded.goals[0].actionId, today: seeded.today }
    )
    await navigate(page, '首页')
    await expect(cover(page, '晨读目标')).toHaveText('I')
    await expect(cover(page, '写作目标')).toHaveText('II')
    await expect(cover(page, '运动目标')).toHaveText('III')

    const beforeAppearance = await page.evaluate(() => window.myTracer.dataControl.list())
    let detail = await openAppearance(page, '运动目标')
    await detail.getByLabel('首页标记（可选）', { exact: true }).fill('👩🏽‍💻书')
    await page.evaluate(() => {
      const original = Storage.prototype.setItem
      ;(window as Window & { restoreCoverStorage?: () => void }).restoreCoverStorage = () => {
        Storage.prototype.setItem = original
      }
      Storage.prototype.setItem = function (key, value) {
        if (key.startsWith('mytracer.goal-cover.v1:')) throw new Error('Isolated storage failure')
        original.call(this, key, value)
      }
    })
    await detail.getByRole('button', { name: '保存外观', exact: true }).click()
    await expect(detail.getByRole('alert')).toContainText('无法保存')
    await expect(detail.getByLabel('首页标记（可选）', { exact: true })).toHaveValue('👩🏽‍💻书')
    await navigate(page, '首页')
    await expect(cover(page, '运动目标')).toHaveText('III')
    expect(await page.evaluate(() => window.myTracer.dataControl.list())).toEqual(beforeAppearance)
    await page.evaluate(() => {
      const fixture = window as Window & { restoreCoverStorage?: () => void }
      fixture.restoreCoverStorage?.()
      delete fixture.restoreCoverStorage
    })
    detail = await openAppearance(page, '运动目标')
    await expect(detail.getByLabel('首页标记（可选）', { exact: true })).toHaveValue('👩🏽‍💻书')
    await detail.getByRole('button', { name: '保存外观', exact: true }).click()
    await navigate(page, '首页')
    await expect(cover(page, '运动目标')).toHaveText('👩🏽‍💻书')
    expect(await page.evaluate(() => window.myTracer.dataControl.list())).toEqual(beforeAppearance)

    detail = await openAppearance(page, '运动目标')
    await detail.getByLabel('首页标记（可选）', { exact: true }).fill('甲乙丙')
    await detail.getByRole('button', { name: '保存外观', exact: true }).click()
    await expect(detail.getByRole('alert')).toBeVisible()
    await detail.getByRole('button', { name: '取消外观修改', exact: true }).click()
    await navigate(page, '首页')
    await expect(cover(page, '运动目标')).toHaveText('👩🏽‍💻书')
    expect(await page.evaluate(() => window.myTracer.dataControl.list())).toEqual(beforeAppearance)

    detail = await openAppearance(page, '运动目标')
    await detail.getByLabel('首页标记（可选）', { exact: true }).fill('新')
    await navigate(page, '首页')
    await expect(cover(page, '运动目标')).toHaveText('👩🏽‍💻书')
    detail = await openAppearance(page, '运动目标')
    await expect(detail.getByLabel('首页标记（可选）', { exact: true })).toHaveValue('新')
    await detail.getByRole('button', { name: '取消外观修改', exact: true }).click()
    await detail.getByLabel('目标名称', { exact: true }).fill('运动目标改名')
    await detail.getByRole('button', { name: '保存修改', exact: true }).click()
    await navigate(page, '首页')
    await expect(cover(page, '运动目标改名')).toHaveText('👩🏽‍💻书')
    await app.close()
    app = undefined
    app = await launch()
    page = await app.firstWindow()
    await expect(cover(page, '运动目标改名')).toHaveText('👩🏽‍💻书')

    // A fresh fact moves the renamed/customized goal to the first visible position.
    // The rename above also gives it the newest updatedAt for the same-day tie.
    await navigate(page, '目标')
    await page.evaluate(
      async ({ actionId, today }) => {
        const result = await window.myTracer.dataControl.backfillActionRecord({
          actionId,
          occurredOn: today,
          durationMinutes: 3,
          outcome: 'partial'
        })
        if (!result.ok) throw new Error('Cannot reorder customized fixture goal')
      },
      { actionId: seeded.goals[1].actionId, today: seeded.today }
    )
    await navigate(page, '首页')
    await expect(page.locator('.home-goal').first()).toHaveAttribute(
      'aria-label',
      '运动目标改名 概览'
    )
    await expect(cover(page, '运动目标改名')).toHaveText('👩🏽‍💻书')
    await expect(cover(page, '晨读目标')).toHaveText('II')
    await expect(cover(page, '写作目标')).toHaveText('III')

    const beforeClear = await page.evaluate(() => window.myTracer.dataControl.list())
    detail = await openAppearance(page, '运动目标改名')
    await detail.getByLabel('首页标记（可选）', { exact: true }).fill('')
    await detail.getByRole('button', { name: '保存外观', exact: true }).click()
    await navigate(page, '首页')
    await expect(cover(page, '运动目标改名')).toHaveText('I')
    expect(
      await page.evaluate(
        (id) => localStorage.getItem(`mytracer.goal-cover.v1:${encodeURIComponent(id)}`),
        seeded.goals[1].goalId
      )
    ).toBeNull()
    expect(await page.evaluate(() => window.myTracer.dataControl.list())).toEqual(beforeClear)
    await page.reload()
    await expect(cover(page, '运动目标改名')).toHaveText('I')
  } finally {
    await app?.close().catch(() => undefined)
    await removeTemporaryTestRoot(root)
  }
})
