import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

async function withApplication(
  run: (app: ElectronApplication, page: Page) => Promise<void>
): Promise<void> {
  const root = await createTemporaryTestRoot()
  let app: ElectronApplication | undefined
  try {
    app = await electron.launch({
      cwd: root.root,
      args: [
        ...(process.platform === 'linux' ? ['--headless', '--ozone-platform=headless'] : []),
        join(process.cwd(), 'out/main/index.js'),
        `--user-data-dir=${root.electronUserData}`
      ],
      env: minimalElectronEnvironment(root)
    })
    await app.evaluate(() => {
      const RealDate = Date
      const instant = new RealDate(2026, 9, 22, 12).getTime()
      let tick = 0
      Reflect.set(
        globalThis,
        'Date',
        new Proxy(RealDate, {
          construct(target, args) {
            return Reflect.construct(target, args.length ? args : [instant + tick++])
          }
        })
      )
    })
    await run(app, await app.firstWindow())
  } finally {
    await app?.close()
    await removeTemporaryTestRoot(root)
  }
}

async function navigate(page: Page, name: string): Promise<void> {
  await page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
}

test('empty database and unmatched search are distinct; clearing is keyboard accessible', async () => {
  await withApplication(async (app, page) => {
    await navigate(page, '例行')
    const list = page.getByLabel('例行列表', { exact: true })
    await expect(list).toContainText('还没有例行。')
    await page.evaluate(async () => {
      const result = await window.myTracer.routines.create({
        arrangementMode: 'weekly' as const,
        name: '合成例行',
        minimumAction: '读一行',
        weekdays: [1, 2, 3, 4, 5, 6, 7]
      })
      if (!result.ok) throw new Error('Fixture failed')
    })
    await page.reload()
    await navigate(page, '例行')
    await list.getByRole('button', { name: /合成例行.*活跃/ }).click()
    const search = page.getByLabel('搜索例行', { exact: true })
    await search.fill('不存在的词')
    await expect(list).toContainText('没有匹配的例行。')
    await expect(list).not.toContainText('还没有例行。')
    await expect(page.locator('.routine-detail-context')).toContainText('当前详情不在搜索结果中')
    await page.getByRole('button', { name: '清除例行搜索', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(search).toBeFocused()
    await expect(search).toHaveValue('')
    await expect(list.getByRole('button', { name: /合成例行.*活跃/ })).toBeVisible()
    await expect(page.locator('.routine-detail-context')).toHaveCount(0)
    await app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0]
      window.setContentSize(820, 650)
      window.webContents.setZoomFactor(1.5)
    })
    // Native resize/zoom reaches the renderer asynchronously. Compare both layouts only
    // after the requested CSS viewport is visible, not across two different window sizes.
    await expect.poll(() => page.evaluate(() => innerWidth)).toBeCloseTo(820 / 1.5, 0)
    await expect.poll(() => page.evaluate(() => innerHeight)).toBeCloseTo(650 / 1.5, 0)
    const scroll = list.locator('.object-master-scroll')
    const before = await scroll.boundingBox()
    await search.fill('合成')
    const after = await scroll.boundingBox()
    expect(before).not.toBeNull()
    expect(after).not.toBeNull()
    expect(Math.abs(before!.height - after!.height)).toBeLessThan(1)
    const inputBox = await search.boundingBox()
    const clearBox = await page
      .getByRole('button', { name: '清除例行搜索', exact: true })
      .boundingBox()
    expect(clearBox).not.toBeNull()
    expect(inputBox).not.toBeNull()
    expect(clearBox!.x).toBeGreaterThan(inputBox!.x)
    expect(clearBox!.x + clearBox!.width).toBeLessThanOrEqual(inputBox!.x + inputBox!.width)
    expect(clearBox!.y + clearBox!.height).toBeLessThanOrEqual(inputBox!.y + inputBox!.height)
  })
})

test('filtering and paging explain retained detail without switching or discarding drafts', async () => {
  await withApplication(async (_app, page) => {
    await page.evaluate(async () => {
      for (let i = 1; i <= 8; i++) {
        const result = await window.myTracer.routines.create({
          arrangementMode: 'weekly' as const,
          name: `例行${i}`,
          minimumAction: '读一行',
          weekdays: [1, 2, 3, 4, 5, 6, 7]
        })
        if (!result.ok) throw new Error('Fixture failed')
      }
    })
    await page.reload()
    await navigate(page, '例行')
    const list = page.getByLabel('例行列表', { exact: true })
    await list.getByRole('button', { name: /例行1.*活跃/ }).click()
    const detail = page.locator('.routine-workspace .goal-detail')
    await expect(detail).toHaveAttribute('aria-label', '例行1 例行详情')
    await detail.getByRole('button', { name: '记录例行', exact: true }).click()
    const duration = detail.getByLabel('投入时长（分钟，可选）')
    await duration.fill('11')
    await detail.getByText('编辑内容和安排', { exact: true }).click()
    await detail.getByLabel('名称', { exact: true }).fill('尚未保存的名称')
    const search = page.getByLabel('搜索例行', { exact: true })
    await search.fill('例行2')
    await expect(list).toContainText('例行2')
    await expect(page.locator('.routine-detail-context')).toContainText('当前详情不在搜索结果中')
    await expect(duration).toHaveValue('11')
    await expect(detail.getByLabel('名称', { exact: true })).toHaveValue('尚未保存的名称')
    await search.fill('无匹配')
    await expect(list).toContainText('没有匹配的例行。')
    await page.getByRole('button', { name: '清除例行搜索', exact: true }).click()
    await page
      .getByLabel('例行列表分页')
      .getByRole('button', { name: '下一页', exact: true })
      .click()
    await expect(page.locator('.routine-detail-context')).toContainText('当前详情不在这一列表页中')
    await expect(duration).toHaveValue('11')
    await expect(detail.getByLabel('名称', { exact: true })).toHaveValue('尚未保存的名称')
    // Finish the content-edit scenario before testing the independent recording-draft lifecycle.
    // Saving uses baseline controls and leaves no dirty content for an object-switch guard.
    await detail.getByRole('button', { name: '保存内容修改', exact: true }).click()
    await expect(detail).toHaveAttribute('aria-label', '尚未保存的名称 例行详情')
    await expect(duration).toHaveValue('11')
    // Explicit selection may switch the detail; recording drafts keep their existing session scope.
    await list.getByRole('button', { name: /例行7.*活跃/ }).click()
    await expect(page.locator('.routine-detail-context')).toHaveCount(0)
    await page
      .getByLabel('例行列表分页')
      .getByRole('button', { name: '上一页', exact: true })
      .click()
    await list.getByRole('button', { name: /尚未保存的名称.*活跃/ }).click()
    await expect(duration).toHaveValue('11')
    await navigate(page, '今天')
    await navigate(page, '例行')
    await expect(duration).toHaveValue('11')
    const records = await page.evaluate(() => window.myTracer.dataControl.list())
    expect(records.ok && records.value.routineRecords).toEqual([])
  })
})
