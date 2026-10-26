import { join } from 'node:path'
import { expect, test, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'
import { openRecordNote } from '../support/ui-disclosure'

for (const [width, height] of [
  [1188, 848],
  [828, 604]
]) {
  test(`backfill feedback stays by the save action at ${width}x${height}`, async () => {
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
          ...(process.platform === 'linux' ? ['--headless', '--ozone-platform=headless'] : [])
        ],
        env: minimalElectronEnvironment(root)
      })
      const page = await app.firstWindow()
      await app.evaluate(
        ({ BrowserWindow }, { width, height }) =>
          BrowserWindow.getAllWindows()[0]!.setSize(width, height),
        { width, height }
      )
      await page.evaluate(async () => {
        const action = await window.myTracer.actions.create({ title: '合成补记行动' })
        const routine = await window.myTracer.routines.create({
          name: '合成补记例行',
          minimumAction: '一步',
          arrangementMode: 'unscheduled',
          weekdays: []
        })
        if (!action.ok || !routine.ok) throw Error('Synthetic fixture failed')
      })
      await page.getByRole('navigation').getByRole('button', { name: '数据', exact: true }).click()
      await page.getByRole('button', { name: /补记记录/ }).click()
      const drawer = page.getByRole('dialog', { name: '补记历史记录', exact: true })
      for (const [kind, label] of [
        ['action', '行动'],
        ['routine', '例行']
      ] as const) {
        await drawer.getByLabel('补记类型', { exact: true }).selectOption(kind)
        await expect(drawer.getByRole('status')).toHaveCount(0)
        if (kind === 'routine') await drawer.getByLabel('例行补记结果').selectOption('acted')
        const save = drawer.getByRole('button', { name: `补记${label}记录`, exact: true })
        const date = drawer.getByLabel(`${label}补记日期`)
        const note = drawer.getByLabel(`${label}补记备注`)
        for (const day of ['10', '11']) {
          await date.fill(`2026-08-${day}`)
          await expect(drawer.getByRole('status')).toHaveCount(0)
          if (kind === 'routine') await drawer.getByLabel('例行补记结果').selectOption('acted')
          await drawer.getByLabel(`${label}补记分钟`).fill('3')
          await drawer.getByLabel('简述（可选）', { exact: true }).fill('合成长简述。'.repeat(45))
          await openRecordNote(note)
          await note.fill('合成长笔记\n'.repeat(70))
          await drawer.evaluate((el) => {
            el.scrollTop = el.scrollHeight
          })
          expect(await drawer.evaluate((el) => el.scrollTop)).toBeGreaterThan(100)
          await save.click()
          const status = drawer.getByRole('status')
          await expect(status).toContainText(`已补记：合成补记${label} · 2026-08-${day}`)
          await test.info().attach(`${kind}-${day}-feedback-geometry`, {
            body: JSON.stringify(
              await status.evaluate((el) => ({
                status: el.getBoundingClientRect().toJSON(),
                drawer: el.closest('dialog')!.getBoundingClientRect().toJSON(),
                scrollTop: el.closest('dialog')!.scrollTop
              }))
            ),
            contentType: 'application/json'
          })
          await expect(status).toBeInViewport({ ratio: 1 })
          await expect(save).toBeDisabled()
          expect(await drawer.evaluate((el) => el.scrollTop)).toBeGreaterThan(100)
          await expect(drawer).toBeVisible()
          await expect(date).toHaveValue('')
          await expect(note).toHaveValue('')
          await expect(drawer.getByRole('status')).toHaveCount(1)
          if (day === '10') {
            await drawer.getByLabel('简述（可选）', { exact: true }).fill('开始下一条补记')
            await expect(drawer.getByRole('status')).toHaveCount(0)
          }
        }
        // A definite pre-write failure must preserve inputs and never show success.
        await date.fill('2026-08-12')
        await expect(drawer.getByRole('status')).toHaveCount(0)
        if (kind === 'routine') await drawer.getByLabel('例行补记结果').selectOption('acted')
        await note.fill('失败后继续保存的合成输入')
        await app.evaluate(({ ipcMain }, kind) => {
          const channel = `data-control:backfill-${kind}-record`
          const handlers = Reflect.get(ipcMain, '_invokeHandlers') as Map<
            string,
            (...args: unknown[]) => unknown
          >
          const original = handlers.get(channel)
          if (!original) throw Error(`Missing synthetic target ${channel}`)
          let fail = true
          ipcMain.removeHandler(channel)
          ipcMain.handle(channel, (...args) => {
            if (fail) {
              fail = false
              return {
                ok: false,
                error: { code: 'persistence-failed', message: 'Synthetic pre-write failure' }
              }
            }
            return original(...args)
          })
        }, kind)
        await drawer.evaluate((el) => {
          el.scrollTop = el.scrollHeight
        })
        await save.click()
        await expect(drawer.getByRole('alert')).toContainText('本地数据操作失败')
        await expect(drawer.getByRole('alert')).toBeInViewport({ ratio: 1 })
        await expect(drawer.getByRole('status')).toHaveCount(0)
        await expect(date).toHaveValue('2026-08-12')
        await expect(note).toHaveValue('失败后继续保存的合成输入')
        await expect(save).toBeEnabled()
        await save.dblclick()
        await expect(drawer.getByRole('status')).toContainText('2026-08-12')
        await expect(drawer.getByRole('status')).toBeInViewport({ ratio: 1 })
      }
      const data = await page.evaluate(() => window.myTracer.dataControl.list())
      if (!data.ok) throw Error(data.error.message)
      expect(data.value.actionRecords).toHaveLength(3)
      expect(data.value.routineRecords).toHaveLength(3)
    } finally {
      await app?.close()
      await removeTemporaryTestRoot(root)
    }
  })
}
