import { join } from 'node:path'
import { expect, test, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

test('history is readable, paginated, and separates reading from protected local edits', async () => {
  test.slow()
  const root = await createTemporaryTestRoot()
  let application: ElectronApplication | undefined
  try {
    application = await electron.launch({
      cwd: root.root,
      args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
      env: minimalElectronEnvironment(root)
    })
    const page = await application.firstWindow()
    const title = '阅读一段足够长的中文材料，并记录值得继续追问的问题'
    const understanding =
      '这是一条包含多行内容的理解。\n它应该完整显示，而不是被一个很窄的单行输入框截断。'
    await page.evaluate(
      async ({ title, understanding }) => {
        const goal = await window.myTracer.goals.create({
          name: '数据页阅读与编辑体验',
          initialNextAction: { title }
        })
        if (!goal.ok) throw new Error(goal.error.message)
        for (let day = 11; day <= 20; day++) {
          const result = await window.myTracer.dataControl.backfillActionRecord({
            actionId: goal.value.currentNextActionId!,
            occurredOn: `2026-08-${day}`,
            durationMinutes: day,
            outcome: 'partial',
            understanding: day === 20 ? understanding : null,
            note: `第 ${day} 天的记录`
          })
          if (!result.ok) throw new Error(result.error.message)
        }
      },
      { title, understanding }
    )
    await page.getByRole('button', { name: '数据', exact: true }).click()
    const rows = page.locator('.data-history-row')
    await expect(rows).toHaveCount(8)
    await expect(page.getByLabel('历史记录分页')).toContainText('第 1 / 2 页')
    expect(
      await rows.evaluateAll((elements) =>
        elements.every((element, index) => {
          const box = element.getBoundingClientRect()
          const previous = elements[index - 1]?.getBoundingClientRect()
          return box.height >= 70 && (!previous || box.top >= previous.bottom - 1)
        })
      )
    ).toBe(true)
    await rows.first().click()
    const selected = page.getByLabel('所选记录')
    const record = selected.locator('.data-record-card')
    await expect(record).toContainText('2026-08-20')
    await expect(page.getByLabel('行动分钟')).toHaveCount(0)
    await expect(selected.locator('.data-fact-text')).toContainText(understanding)
    await record.getByRole('button', { name: '编辑记录', exact: true }).click()
    await expect(page.getByLabel('行动发生日期')).toBeFocused()
    await page.getByLabel('行动分钟').fill('42')
    await rows.nth(1).click()
    await expect(selected.getByRole('alert')).toContainText('未保存的修改')
    await selected.getByRole('button', { name: '继续编辑当前记录' }).click()
    await expect(page.getByLabel('行动分钟')).toHaveValue('42')
    await record.getByRole('button', { name: '取消编辑' }).click()
    await expect(record.getByRole('button', { name: '编辑记录', exact: true })).toBeFocused()
    await expect(record).toContainText('20 分钟')
    await rows.nth(1).click()
    await record.getByRole('button', { name: '编辑记录', exact: true }).click()
    await expect(page.getByLabel('行动发生日期')).toHaveValue('2026-08-19')
    await page.getByLabel('行动分钟').fill('23')
    await record.getByRole('button', { name: '保存修改', exact: true }).click()
    await expect(page.getByLabel('行动分钟')).toHaveCount(0)
    await expect(record.getByRole('button', { name: '编辑记录', exact: true })).toBeFocused()
    await expect(record).toContainText('23 分钟')
    await rows.first().click()
    await selected.getByRole('button', { name: '编辑理解', exact: true }).click()
    await expect(page.getByLabel('理解成果内容')).toBeFocused()
    await expect(selected.locator('textarea[aria-label="理解成果内容"]')).toHaveValue(understanding)
    await page.getByLabel('理解成果内容').fill(`${understanding}\n新增的一点体会。`)
    await selected.getByRole('button', { name: '保存理解', exact: true }).click()
    await expect(selected.getByRole('button', { name: '编辑理解', exact: true })).toBeFocused()
    await expect(selected.locator('.data-fact-text')).toContainText('新增的一点体会。')
    await selected.getByRole('button', { name: '编辑理解', exact: true }).click()
    await page.getByLabel('理解成果内容').fill('这条未保存的改动应在明确放弃后丢弃。')
    await rows.nth(1).click()
    await expect(selected.getByRole('alert')).toContainText('未保存的修改')
    await selected.getByRole('button', { name: '放弃修改并切换' }).click()
    await expect(record).toContainText('2026-08-19')
    await rows.first().click()
    await expect(selected.locator('.data-fact-text')).toContainText('新增的一点体会。')
    await expect(selected.locator('.data-fact-text')).not.toContainText('这条未保存的改动')
    await page.getByRole('button', { name: '下一页', exact: true }).click()
    await expect(rows).toHaveCount(2)
    await page.getByLabel('发生日期', { exact: true }).fill('2026-08-20')
    await expect(rows).toHaveCount(1)
    await expect(page.getByLabel('历史记录分页')).toHaveCount(0)
    await page.getByRole('button', { name: '清除筛选', exact: true }).click()
    await expect(rows).toHaveCount(8)
    await expect(page.getByLabel('历史记录分页')).toContainText('第 1 / 2 页')
  } finally {
    await application?.close().catch(() => undefined)
    await removeTemporaryTestRoot(root)
  }
})

test('routine and confusion editors preserve keyboard focus through edit, cancel, and save', async () => {
  const root = await createTemporaryTestRoot()
  let application: ElectronApplication | undefined
  try {
    application = await electron.launch({
      cwd: root.root,
      args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
      env: minimalElectronEnvironment(root)
    })
    const page = await application.firstWindow()
    await page.evaluate(async () => {
      const action = await window.myTracer.actions.create({ title: '键盘检查行动' })
      const routine = await window.myTracer.routines.create({
        name: '键盘检查例行',
        minimumAction: '走一小段',
        weekdays: [1, 2, 3, 4, 5, 6, 7]
      })
      if (!action.ok || !routine.ok) throw new Error('Cannot create keyboard fixtures')
      const actionRecord = await window.myTracer.dataControl.backfillActionRecord({
        actionId: action.value.id,
        occurredOn: '2026-08-20',
        durationMinutes: 5,
        outcome: 'partial',
        confusion: '一个待理解的问题'
      })
      const routineRecord = await window.myTracer.dataControl.backfillRoutineRecord({
        routineId: routine.value.id,
        occurredOn: '2026-08-20',
        outcome: 'acted',
        plannedForDate: true,
        durationMinutes: 5
      })
      if (!actionRecord.ok || !routineRecord.ok) throw new Error('Cannot create keyboard records')
    })
    await page.getByRole('button', { name: '数据', exact: true }).click()
    await page.locator('.data-history-row').filter({ hasText: '键盘检查例行' }).click()
    const editRecord = page.getByRole('button', { name: '编辑记录', exact: true })
    await editRecord.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByLabel('例行发生日期')).toBeFocused()
    await page.getByRole('button', { name: '取消编辑', exact: true }).click()
    await expect(editRecord).toBeFocused()
    await page.keyboard.press('Enter')
    await page.getByLabel('例行分钟').fill('-1')
    await page.getByRole('button', { name: '保存修改', exact: true }).click()
    await expect(page.getByLabel('所选记录').getByRole('alert')).toBeVisible()
    await expect(page.getByLabel('例行发生日期')).toBeFocused()
    await expect(page.getByLabel('例行分钟')).toHaveValue('-1')
    await page.getByLabel('例行分钟').fill('6')
    await page.getByRole('button', { name: '保存修改', exact: true }).click()
    await expect(editRecord).toBeFocused()
    await page.locator('.data-history-row').filter({ hasText: '键盘检查行动' }).click()
    const editConfusion = page.getByRole('button', { name: '编辑困惑', exact: true })
    await editConfusion.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByLabel('困惑内容')).toBeFocused()
    await page.getByRole('button', { name: '取消编辑', exact: true }).click()
    await expect(editConfusion).toBeFocused()
    await page.keyboard.press('Enter')
    await page.getByLabel('困惑内容').fill('进一步澄清的问题')
    await page.getByRole('button', { name: '保存困惑', exact: true }).click()
    await expect(editConfusion).toBeFocused()
  } finally {
    await application?.close().catch(() => undefined)
    await removeTemporaryTestRoot(root)
  }
})
