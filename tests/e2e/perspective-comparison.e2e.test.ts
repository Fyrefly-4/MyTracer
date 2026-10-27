import { join } from 'node:path'
import { expect, test, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

// Same fixture on stage and both candidates; never substitute mocked browser evidence.
for (const scenario of ['empty', 'ordinary', 'long'] as const) {
  for (const [width, height] of [
    [1024, 700],
    [1188, 848]
  ]) {
    test(`perspective comparison: ${scenario} ${width}x${height}`, async () => {
      const testInfo = test.info()
      test.skip(process.env.MYTRACER_PERSPECTIVE_COMPARE !== '1', 'Opt-in native comparison')
      test.slow()
      const root = await createTemporaryTestRoot()
      let app: ElectronApplication | undefined
      try {
        app = await electron.launch({
          chromiumSandbox: true,
          cwd: root.root,
          args: [
            join(process.cwd(), 'out/main/index.js'),
            `--user-data-dir=${root.electronUserData}`
          ],
          env: minimalElectronEnvironment(root)
        })
        const page = await app.firstWindow()
        const navigate = (name: string) =>
          page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
        await expect(page.locator('.home-page')).toHaveAttribute('aria-busy', 'false')
        await navigate('目标')
        await page.evaluate(async (kind) => {
          if (kind === 'empty') return
          const day = await window.myTracer.today.get({})
          if (!day.ok) throw Error('synthetic date unavailable')
          for (let i = 1; i <= 3; i++) {
            const goal = await window.myTracer.goals.create({
              name: `合成目标 ${i}：${kind === 'long' ? '整理沿途观察与阅读摘记'.repeat(4) : '整理观察'}`,
              initialNextAction: { title: `合成行动 ${i}：整理一页笔记` }
            })
            if (!goal.ok || !goal.value.currentNextActionId) throw Error('synthetic goal failed')
            const record = await window.myTracer.dataControl.backfillActionRecord({
              actionId: goal.value.currentNextActionId,
              occurredOn: day.value.localDate,
              durationMinutes: i === 2 ? null : 10,
              outcome: 'partial',
              summary:
                kind === 'long' ? '对照观察，留下仍需核对的细节。'.repeat(20) : '整理了两条观察。',
              note: kind === 'long' ? '## 合成笔记\n仍待核对的材料。\n'.repeat(40) : null
            })
            if (!record.ok) throw Error('synthetic record failed')
          }
        }, scenario)
        await app.evaluate(
          ({ BrowserWindow }, size) => {
            const window = BrowserWindow.getAllWindows()[0]!
            window.setContentSize(size.width, size.height)
            window.webContents.setZoomFactor(1)
          },
          { width, height }
        )
        const shot = async (name: string) => {
          await testInfo.attach(`${scenario}-${width}x${height}-${name}`, {
            body: await page.screenshot(),
            contentType: 'image/png'
          })
        }
        await navigate('首页')
        await expect(page.locator('.home-page')).toHaveAttribute('aria-busy', 'false')
        await expect(page.locator('.home-goal')).toHaveCount(scenario === 'empty' ? 0 : 3)
        await page.locator('.home-page').evaluate((element) => {
          element.scrollTop = 0
        })
        await shot('home-top')
        await page.locator('.home-history').scrollIntoViewIfNeeded()
        await shot('home-records')
        await navigate('今天')
        await page.getByRole('button', { name: '记一笔', exact: true }).click()
        const dialog = page.getByRole('dialog', { name: '记一笔', exact: true })
        const title = dialog.getByLabel('刚才做了什么', { exact: true })
        await expect(title).toBeFocused()
        await expect(dialog.getByLabel('本次结果', { exact: true })).toHaveValue('')
        await expect(dialog.getByLabel('保存后，整个行动')).toHaveValue('')
        await shot('first-open')
        const before = await page.evaluate(() => window.myTracer.dataControl.list())
        if (!before.ok) throw Error('synthetic baseline read failed')
        await title.fill(`合成随手记 ${width}`)
        await dialog.getByLabel('这次不记时长（未知）').check()
        await dialog.getByLabel('本次结果', { exact: true }).selectOption('partial')
        await dialog.getByLabel('保存后，整个行动').selectOption('keep-pending')
        const extras = dialog.locator('.first-record-extras')
        if (scenario === 'long') {
          if (await extras.count()) await extras.locator(':scope > summary').click()
          await dialog.getByLabel('简述（可选）', { exact: true }).fill('合成长简述。'.repeat(30))
          await dialog.locator('.record-note-details > summary').click()
          await dialog.getByLabel('备注（可选）', { exact: true }).fill('合成长笔记。\n'.repeat(80))
          await shot('first-expanded')
          if (await extras.count()) await extras.locator(':scope > summary').click()
        }
        await dialog
          .getByRole('button', { name: '保存行动和第一笔', exact: true })
          .scrollIntoViewIfNeeded()
        await shot('first-save-position')
        await page.keyboard.press('Escape')
        await expect(page.getByRole('button', { name: '继续记一笔', exact: true })).toBeFocused()
        await navigate('首页')
        await navigate('今天')
        await page.getByRole('button', { name: '继续记一笔', exact: true }).click()
        await expect(title).toHaveValue(`合成随手记 ${width}`)
        if (scenario === 'long') {
          await expect(dialog.getByLabel('简述（可选）', { exact: true })).toHaveValue(
            '合成长简述。'.repeat(30)
          )
          await expect(dialog.getByLabel('备注（可选）', { exact: true })).toHaveValue(
            '合成长笔记。\n'.repeat(80)
          )
        }
        const unsaved = await page.evaluate(() => window.myTracer.dataControl.list())
        if (!unsaved.ok) throw Error('synthetic unsaved read failed')
        expect(unsaved.value.actionRecords).toHaveLength(before.value.actionRecords.length)
        await shot('first-return')
        await dialog.getByRole('button', { name: '保存行动和第一笔', exact: true }).click()
        await expect(dialog).not.toBeVisible()
        const saved = await page.evaluate(() => window.myTracer.dataControl.list())
        if (!saved.ok) throw Error('synthetic saved read failed')
        expect(saved.value.actionRecords).toHaveLength(before.value.actionRecords.length + 1)
        const action = saved.value.actions.find((item) => item.title === `合成随手记 ${width}`)
        expect(action).toMatchObject({ status: 'pending', goalId: null })
        expect(
          saved.value.actionRecords.find((item) => item.actionId === action?.id)
        ).toMatchObject({
          durationMinutes: null,
          outcome: 'partial',
          summary: scenario === 'long' ? '合成长简述。'.repeat(30) : null
        })
      } finally {
        await app?.close()
        await removeTemporaryTestRoot(root)
      }
    })
  }
}
