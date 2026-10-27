import { expect, test } from '@playwright/test'
const path = '/tests/renderer/assistant-harness.html'

test('inline organization compares source, preserves editor, and carries conversation without formal writes', async ({
  page
}) => {
  await page.goto(path)
  const original = '合成笔记：书桌整理了一半，其他日期没有记录。'
  await page.getByLabel('原笔记').fill(original)
  const entry = page.getByRole('button', { name: 'AI 整理笔记', exact: true })
  await entry.scrollIntoViewIfNeeded()
  const pane = page.getByTestId('underlying-pane')
  const scrollBefore = await pane.evaluate((node) => node.scrollTop)
  await entry.click()
  const inline = page.getByRole('region', { name: 'AI 整理笔记', exact: true })
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(inline.getByText(original, { exact: true })).toBeVisible()
  await inline.getByLabel('整理要求（可修改）').fill('整理一句简述')
  await inline.getByRole('button', { name: '发送', exact: true }).click()
  await expect(inline.getByRole('button', { name: '填入编辑草稿' })).toBeVisible()
  await page.screenshot({ path: '.tmp/assistant-browser-results/inline.png' })
  await inline.getByRole('button', { name: '带着内容继续对话' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('对话')).toContainText('整理一句简述')
  await dialog.getByRole('button', { name: '填入编辑草稿' }).click()
  await expect(dialog.getByRole('status')).toContainText('未保存草稿')
  await expect(dialog).not.toContainText('已填入或已过期')
  await expect(dialog).not.toContainText('候选已过期')
  await expect(dialog.getByRole('button', { name: '填入编辑草稿' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(page.getByLabel('原笔记')).toHaveValue(original)
  await expect(page.getByLabel('简述草稿')).toHaveValue(/整理了书桌左侧/)
  await expect(page.getByTestId('formal-saves')).toHaveText('0')
  await expect.poll(() => pane.evaluate((node) => node.scrollTop)).toBe(scrollBefore)
  await expect(entry).toBeFocused()
})

test('free chat has no goal prerequisite, preserves unsent input, and resumes history', async ({
  page
}) => {
  await page.goto(path)
  const entry = page.getByRole('button', { name: 'AI 助手', exact: true })
  await entry.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('参考范围 · 未选择记录')
  await dialog.getByLabel('继续聊聊').fill('今天想聊聊')
  await dialog.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(entry).toBeFocused()
  await entry.click()
  await expect(dialog.getByLabel('继续聊聊')).toHaveValue('今天想聊聊')
  await dialog.getByRole('button', { name: '发送', exact: true }).click()
  await expect(dialog.getByLabel('对话')).toContainText('当前未读取任何记录')
  await expect(dialog.getByRole('status')).toHaveText('回复完成。')
  await expect(dialog.getByRole('button', { name: '填入编辑草稿' })).toHaveCount(0)
  await expect(dialog).not.toContainText('free-chat')
  await page.screenshot({ path: '.tmp/assistant-browser-results/conversation.png' })
  await page.keyboard.press('Escape')
  await entry.click()
  await expect(dialog.getByLabel('对话')).toContainText('今天想聊聊')
})

test('goal conversation resumes and offers suggestions without creating actions', async ({
  page
}) => {
  await page.goto(path)
  await page.getByRole('button', { name: 'AI 接上上次', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('继续聊聊').fill('只有五分钟呢？')
  await dialog.getByRole('button', { name: '发送', exact: true }).click()
  await expect(dialog.getByRole('heading', { name: '下一步建议（不创建行动）' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: /确认：|预览：/ })).toHaveCount(0)
  await dialog.getByText(/参考范围 ·/).click()
  await dialog.getByLabel('允许查询这个目标下的记录').check()
  await expect(dialog.getByRole('status')).toContainText('参考范围已更新')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'AI 接上上次', exact: true }).click()
  await expect(dialog.getByLabel('对话')).toContainText('只有五分钟呢？')
})

test('review is source-backed, editable and only fills the original draft at narrow width', async ({
  page
}) => {
  await page.setViewportSize({ width: 420, height: 800 })
  await page.goto(path)
  await page.getByRole('button', { name: 'AI 回顾选定内容', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('继续聊聊').fill('回顾选定事实')
  await dialog.getByRole('button', { name: '发送', exact: true }).click()
  await expect(dialog.getByLabel('确认的进展')).toHaveValue('整理了一次书桌。')
  await dialog.getByText(/本次实际参考 ·/).click()
  await expect(dialog).toContainText('本周整理书桌一次；其他日期未记录。')
  await dialog.getByLabel('确认的进展').fill('我整理了一小角。')
  const box = await dialog.boundingBox()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(420)
  await page.screenshot({ path: '.tmp/assistant-browser-results/narrow.png' })
  await dialog.getByRole('button', { name: '填入编辑草稿' }).click()
  await expect(dialog.getByRole('status')).toContainText('未保存草稿')
  await page.keyboard.press('Escape')
  await expect(page.getByLabel('复盘进展草稿')).toHaveValue('我整理了一小角。')
})

test('editing underneath an inline candidate rejects stale fill without losing the new draft', async ({
  page
}) => {
  await page.goto(path)
  await page.getByRole('button', { name: 'AI 整理笔记', exact: true }).click()
  const inline = page.getByRole('region', { name: 'AI 整理笔记', exact: true })
  await inline.getByLabel('整理要求（可修改）').fill('整理')
  await inline.getByRole('button', { name: '发送', exact: true }).click()
  await expect(inline.getByRole('button', { name: '填入编辑草稿' })).toBeVisible()
  await page.getByLabel('简述草稿').fill('用户新写的简述')
  await inline.getByRole('button', { name: '填入编辑草稿' }).click()
  await expect(inline.getByRole('status')).toContainText('没有覆盖新输入')
  await expect(inline).toContainText('内容已变化，候选已过期')
  await expect(inline.getByRole('button', { name: '填入编辑草稿' })).toBeDisabled()
  await expect(page.getByLabel('简述草稿')).toHaveValue('用户新写的简述')
})

test('unsent inline input and hidden settings remain recoverable and block installation', async ({
  page
}) => {
  await page.goto(path)
  const probe = async (dirty: boolean) => {
    await page.getByRole('button', { name: '检查安装草稿' }).click()
    await expect(page.getByTestId('install-dirty')).toHaveText(String(dirty))
  }
  await page.getByRole('button', { name: 'AI 整理笔记', exact: true }).click()
  const inline = page.getByRole('region', { name: 'AI 整理笔记', exact: true })
  await inline.getByLabel('整理要求（可修改）').fill('尚未发送的要求')
  await inline.getByRole('button', { name: '关闭', exact: true }).click()
  await probe(true)
  await page.getByRole('button', { name: 'AI 整理笔记', exact: true }).click()
  await expect(inline.getByLabel('整理要求（可修改）')).toHaveValue('尚未发送的要求')
  await inline.getByRole('button', { name: '清空所有未发送输入' }).click()
  await inline.getByRole('button', { name: '关闭', exact: true }).click()
  await probe(false)
  await page.getByRole('button', { name: '切换设置可见' }).click()
  await page.getByLabel('模型名称').fill('synthetic-new-model')
  await page.getByRole('button', { name: '切换设置可见' }).click()
  await probe(true)
  await page.getByRole('button', { name: '切换设置可见' }).click()
  await expect(page.getByLabel('模型名称')).toHaveValue('synthetic-new-model')
  await page.getByRole('button', { name: '保存配置', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '配置已保存' })).toBeVisible()
  await probe(false)
})

test('leaving the editor cancels its inline request and preserves input for return', async ({
  page
}) => {
  await page.goto(path + '?slow=1')
  await page.getByRole('button', { name: 'AI 整理笔记', exact: true }).click()
  const inline = page.getByRole('region', { name: 'AI 整理笔记', exact: true })
  await inline.getByLabel('整理要求（可修改）').fill('离开前的输入')
  await inline.getByRole('button', { name: '发送', exact: true }).click()
  await expect(inline.getByRole('button', { name: '停止', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '切换记录编辑器' }).click()
  await expect(inline).toHaveCount(0)
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await page.getByRole('button', { name: '切换记录编辑器' }).click()
  await page.getByRole('button', { name: 'AI 整理笔记', exact: true }).click()
  await expect(inline.getByLabel('整理要求（可修改）')).toHaveValue('离开前的输入')
  await expect(inline.getByRole('status')).not.toContainText('整理完成')
})

test('spontaneous raw note uses the ordinary first-record form without precreating or inventing facts', async ({
  page
}) => {
  await page.goto(path)
  await page.getByRole('button', { name: '记一笔', exact: true }).click()
  const form = page.getByRole('dialog', { name: '记一笔', exact: true })
  const raw = '桌面好像全收好了。等等，右边一叠纸没动。大概5分钟？也可能20，没看表。'
  await expect(form.getByLabel('先随手写下来（可选）')).toBeFocused()
  await form.getByLabel('先随手写下来（可选）').fill(raw)
  await form.getByRole('button', { name: 'AI 整理这段原文' }).click()
  const inline = form.getByRole('region', { name: 'AI 整理笔记' })
  await inline.getByLabel('整理要求（可修改）').fill('提炼简述，保留不确定性')
  await inline.getByRole('button', { name: '发送', exact: true }).click()
  await expect(inline.getByRole('button', { name: '填入编辑草稿' })).toBeVisible()
  await page.screenshot({ path: '.tmp/assistant-browser-results/first-note.png' })
  await inline.getByRole('button', { name: '填入编辑草稿' }).click()
  await expect(form.getByLabel('简述（可选）')).toHaveValue(
    '整理了桌面的一部分；右侧一叠纸还没动，投入时长不确定。'
  )
  await expect(form.getByLabel('先随手写下来（可选）')).toHaveValue(raw)
  await expect(form.getByLabel('刚才做了什么')).toHaveValue('')
  await expect(form.getByLabel('真实投入（分钟）')).toHaveValue('')
  await expect(form.getByLabel('这次不记时长（未知）')).not.toBeChecked()
  await expect(form.getByLabel('本次结果', { exact: true })).toHaveValue('')
  await expect(form.getByLabel('保存后，整个行动')).toHaveValue('')
  expect(
    await page.evaluate(
      () => (window as unknown as { syntheticRecordCalls: unknown[] }).syntheticRecordCalls
    )
  ).toEqual([])
  await inline.getByRole('button', { name: '带着内容继续对话' }).click()
  const expanded = page.getByRole('dialog', { name: 'AI 助手', exact: true })
  await expect(expanded.getByLabel('对话')).toContainText('提炼简述，保留不确定性')
  await expect(expanded.getByText('历史对话与保存方式')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(form).toBeVisible()
  await form.getByRole('button', { name: '收起并返回' }).click()
  await page.getByRole('button', { name: '继续记一笔', exact: true }).click()
  await expect(form.getByLabel('先随手写下来（可选）')).toHaveValue(raw)
  await expect(form.getByLabel('简述（可选）')).not.toHaveValue('')
  await form.getByRole('button', { name: 'AI 整理这段原文' }).click()
  await inline.getByLabel('整理要求（可修改）').fill('再整理')
  await inline.getByRole('button', { name: '发送', exact: true }).click()
  await expect(inline.getByRole('button', { name: '填入编辑草稿' })).toBeVisible()
  await form.getByLabel('刚才做了什么').fill('整理桌面')
  await inline.getByRole('button', { name: '填入编辑草稿' }).click()
  await expect(inline.getByRole('status')).toContainText('没有覆盖新输入')
})

test('inline card spans an existing two-column editor and folds long original text without losing it', async ({
  page
}) => {
  await page.goto(path + '?editor-grid=1')
  const original = '合成原文：先以为整理完了，右侧仍有纸张，其他日期未知。\n'.repeat(60)
  await page.getByLabel('原笔记', { exact: true }).fill(original)
  await page.getByRole('button', { name: 'AI 整理笔记', exact: true }).click()
  const inline = page.getByRole('region', { name: 'AI 整理笔记', exact: true })
  await expect(inline.getByRole('heading', { name: 'AI 整理笔记' })).toBeInViewport()
  const editor = page.getByTestId('record-editor')
  expect((await inline.boundingBox())!.width).toBeGreaterThanOrEqual(
    (await editor.boundingBox())!.width - 2
  )
  const originalDetails = inline
    .locator('details')
    .filter({ has: page.getByText(/原笔记 · 未保存内容/) })
  await expect(originalDetails).not.toHaveAttribute('open', '')
  await originalDetails.locator('summary').click()
  await expect(originalDetails.locator('p')).toHaveText(original)
  await originalDetails.locator('summary').click()
  await inline.getByLabel('整理要求（可修改）').fill('整理一句简述')
  await inline.getByRole('button', { name: '发送', exact: true }).click()
  await expect(inline.getByRole('button', { name: '填入编辑草稿' })).toBeInViewport()
  await page.screenshot({ path: '.tmp/assistant-browser-results/inline-editor-width.png' })
  await inline.getByRole('button', { name: '填入编辑草稿' }).click()
  await expect(page.getByLabel('原笔记', { exact: true })).toHaveValue(original)
  await expect(page.getByTestId('formal-saves')).toHaveText('0')
})
