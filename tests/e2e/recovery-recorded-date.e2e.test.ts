import { join } from 'node:path'
import { expect, test, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

const cases = [
  { name: '当天', date: '2026-10-27', days: 0, auxiliary: '相隔 0 天' },
  { name: '两周', date: '2026-10-13', days: 14, auxiliary: '相隔 14 天' },
  { name: '跨月', date: '2026-09-30', days: 27, auxiliary: '相隔 27 天' },
  { name: '无记录', date: null, days: null, auxiliary: '' },
  { name: '晚于截至日', date: '2026-10-28', days: -1, auxiliary: '行动发生日期晚于截至日' }
] as const

test('Recovery leads with the recorded occurrence date while preserving interval and persisted facts', async () => {
  const root = await createTemporaryTestRoot()
  let app: ElectronApplication | undefined
  try {
    app = await electron.launch({
      chromiumSandbox: true,
      cwd: root.root,
      args: [
        ...(process.platform === 'linux' ? ['--headless', '--ozone-platform=headless'] : []),
        join(process.cwd(), 'out/main/index.js'),
        `--user-data-dir=${root.electronUserData}`
      ],
      env: minimalElectronEnvironment(root)
    })
    // Save normally on Oct 28, then read with the clock moved back one day.
    // A future occurrence is an existing date relation, not a fabricated outcome.
    await app.evaluate(() => {
      const RealDate = Date
      Reflect.set(globalThis, '__recordedDateInstant', new RealDate(2026, 9, 28, 12).getTime())
      Reflect.set(
        globalThis,
        'Date',
        new Proxy(RealDate, {
          construct(target, args) {
            return Reflect.construct(
              target,
              args.length ? args : [Reflect.get(globalThis, '__recordedDateInstant')]
            )
          }
        })
      )
    })
    const page = await app.firstWindow()
    const goals = await page.evaluate(async (cases) => {
      const ids: string[] = []
      for (const sample of cases) {
        const goal = await window.myTracer.goals.create({
          name: `日期对照·${sample.name}`,
          initialNextAction: { title: `阅读一页·${sample.name}` }
        })
        if (!goal.ok || !goal.value.currentNextActionId) throw Error('Synthetic goal failed')
        ids.push(goal.value.id)
        if (sample.date) {
          const record = await window.myTracer.dataControl.backfillActionRecord({
            actionId: goal.value.currentNextActionId,
            occurredOn: sample.date,
            durationMinutes: 5,
            outcome: 'partial',
            summary: '读完一页，留下一个问题。',
            note: null
          })
          if (!record.ok) throw Error('Synthetic record failed')
        }
      }
      return ids
    }, cases)
    await app.evaluate(() => {
      Reflect.set(globalThis, '__recordedDateInstant', new Date(2026, 9, 27, 12).getTime())
    })
    const before = await page.evaluate(() => window.myTracer.dataControl.list())
    expect(before.ok).toBe(true)
    await page.getByRole('navigation').getByRole('button', { name: '目标', exact: true }).click()
    for (const [index, sample] of cases.entries()) {
      await page
        .getByRole('button', { name: new RegExp(`日期对照·${sample.name}.*有下一步`) })
        .click()
      await page.getByRole('button', { name: '查看恢复与整理', exact: true }).click()
      const fact = page.getByLabel('恢复与整理页面').locator('.recovery-fact')
      await expect(fact.locator('span')).toHaveText('最近记录到的行动')
      await expect(fact.locator('strong')).toHaveText(sample.date ?? '还没有行动记录')
      await expect(fact.locator('small')).toHaveText(
        `截至 2026-10-27${sample.auxiliary ? ` · ${sample.auxiliary}` : ''}`
      )
      expect(
        await page.evaluate(
          (goalId) => window.myTracer.recovery.getContext({ goalId }),
          goals[index]!
        )
      ).toMatchObject({
        ok: true,
        value: {
          asOfLocalDate: '2026-10-27',
          lastRealActionOn: sample.date,
          daysSinceLastRealAction: sample.days
        }
      })
      for (const width of [820, 1188]) {
        await page.setViewportSize({ width, height: 700 })
        await fact.scrollIntoViewIfNeeded()
        await expect(fact).toBeVisible()
        await test.info().attach(`E5-${sample.name}-${width}`, {
          body: await page.screenshot(),
          contentType: 'image/png'
        })
      }
      await page.getByRole('button', { name: '返回目标', exact: true }).click()
    }
    expect(await page.evaluate(() => window.myTracer.dataControl.list())).toEqual(before)
  } finally {
    await app?.close()
    await removeTemporaryTestRoot(root)
  }
})
