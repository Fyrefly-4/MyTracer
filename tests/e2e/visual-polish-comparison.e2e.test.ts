import { join } from 'node:path'
import { expect, test, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

// Opt-in native evidence, usable unchanged against both comparison revisions.
// Each scenario owns a fresh disposable database; no real records or AI calls.
for (const scenario of ['empty', 'ordinary', 'long'] as const) {
  test(`visual comparison: ${scenario}`, async () => {
    test.skip(process.env.MYTRACER_VISUAL_COMPARE !== '1', 'Opt-in synthetic visual comparison')
    test.setTimeout(90_000)
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
      await expect(page.getByRole('navigation')).toBeVisible()
      await page.evaluate(async (variant) => {
        if (variant === 'empty') return
        const suffix = variant === 'long' ? '，这是用于检查换行与阅读节奏的合成文字'.repeat(8) : ''
        const today = await window.myTracer.today.get({})
        const goal = await window.myTracer.goals.create({
          name: '合成目标：整理阅读笔记' + suffix,
          initialNextAction: { title: '合成行动：读一页并写下想法' + suffix }
        })
        if (!today.ok || !goal.ok || !goal.value.currentNextActionId) throw Error('seed goal')
        const actionId = goal.value.currentNextActionId
        const selected = await window.myTracer.today.selectAction({ actionId })
        const record = await window.myTracer.dataControl.backfillActionRecord({
          actionId,
          occurredOn: today.value.localDate,
          durationMinutes: null,
          outcome: 'partial',
          summary: '合成记录：读过一点，还可以接着来。' + suffix,
          note: '仅用于视觉比较，不是真实个人资料。' + suffix
        })
        const routine = await window.myTracer.routines.create({
          arrangementMode: 'weekly',
          name: '合成例行：舒展身体' + suffix,
          minimumAction: '站起来伸展一下' + suffix,
          weekdays: [1, 2, 3, 4, 5, 6, 7]
        })
        if (!selected.ok || !record.ok || !routine.ok) throw Error('seed facts')
        const rest = await window.myTracer.dataControl.backfillRoutineRecord({
          routineId: routine.value.id,
          occurredOn: today.value.localDate,
          plannedForDate: true,
          outcome: 'intentional_rest',
          summary: '合成例行记录：主动休息',
          note: null
        })
        if (!rest.ok) throw Error('seed routine record')
      }, scenario)
      for (const [width, height] of [
        [1024, 700],
        [1188, 848]
      ]) {
        await app.evaluate(
          ({ BrowserWindow }, size) => {
            BrowserWindow.getAllWindows()[0]!.setSize(size[0]!, size[1]!)
          },
          [width, height]
        )
        for (const section of ['首页', '今天', '目标', '例行', '复盘']) {
          await page
            .getByRole('navigation')
            .getByRole('button', { name: section, exact: true })
            .click()
          await page.evaluate(() => document.fonts.ready)
          await expect(page.locator('.content-inner')).toBeVisible()
          // Wait for UI reads to settle through two frames, without network/model requests.
          await page.evaluate(
            () =>
              new Promise<void>((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
              )
          )
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
          ).toBe(true)
          await test.info().attach(`${scenario}-${width}x${height}-${section}`, {
            body: await page.screenshot(),
            contentType: 'image/png'
          })
        }
      }
    } finally {
      await app?.close()
      await removeTemporaryTestRoot(root)
    }
  })
}
