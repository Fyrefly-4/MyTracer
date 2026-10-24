import { join } from 'node:path'
import { expect, test, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

for (const [delayedChannel, arrangementMode] of [
  ['actions:get-detail', 'weekly'],
  ['records:list-for-action', 'weekly'],
  ['actions:get-detail', 'unscheduled'],
  ['records:list-for-action', 'unscheduled']
] as const) {
  test(`Today keeps ${arrangementMode} routine drafts and selection when ${delayedChannel} finishes late`, async () => {
    test.slow()
    const root = await createTemporaryTestRoot()
    let application: ElectronApplication | undefined
    try {
      application = await electron.launch({
        cwd: root.root,
        args: [
          join(process.cwd(), 'out/main/index.js'),
          `--user-data-dir=${root.electronUserData}`
        ],
        env: minimalElectronEnvironment(root)
      })
      const page = await application.firstWindow()
      await application.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0].setContentSize(1280, 800)
      })
      const routineId = await page.evaluate(async (arrangementMode) => {
        const action = await window.myTracer.actions.create({ title: '切换行动' })
        const routine = await window.myTracer.routines.create({
          arrangementMode,
          name: '右侧例行记录',
          minimumAction: '活动一下',
          weekdays: arrangementMode === 'weekly' ? [1, 2, 3, 4, 5, 6, 7] : []
        })
        const second = await window.myTracer.routines.create({
          arrangementMode: 'weekly' as const,
          name: '另一条例行',
          minimumAction: '喝一口水',
          weekdays: [1, 2, 3, 4, 5, 6, 7]
        })
        if (!action.ok || !routine.ok || !second.ok)
          throw new Error('Cannot create isolated fixtures')
        return routine.value.id
      }, arrangementMode)
      await page.reload()
      // Explicit navigation supports both the original shell and the Home landing page.
      await page.getByRole('navigation').getByRole('button', { name: '今天', exact: true }).click()
      const master = page.locator('.today-master')
      const workspace = page.locator('.today-detail-pane')
      if (arrangementMode === 'unscheduled')
        await master.getByText('随时可记', { exact: true }).click()
      const routineRow = master.getByRole('button', { name: /右侧例行记录/ })
      await routineRow.click()
      await expect(routineRow).toHaveAttribute('aria-pressed', 'true')
      const panel = workspace.getByLabel('右侧例行记录 例行记录', { exact: true })
      await expect(master.locator('.routine-recording-panel')).toHaveCount(0)
      const masterBox = await master.boundingBox()
      const panelBox = await panel.boundingBox()
      expect(masterBox && panelBox && panelBox.x >= masterBox.x + masterBox.width).toBe(true)
      await panel.getByRole('button', { name: '记录例行', exact: true }).click()
      await panel.getByLabel('投入时长（分钟，可选）').fill('8')
      await panel.getByLabel('备注（可选）').fill('切换选择和页面之后继续')

      // This uncommitted action is in 其它行动, not the focus/intention lists.
      const candidate = master
        .locator('.action-candidates')
        .getByRole('button', { name: /切换行动.*待行动/ })
      await candidate.click()
      await expect(candidate).toHaveAttribute('aria-pressed', 'true')
      await expect(routineRow).toHaveAttribute('aria-pressed', 'false')
      await expect(panel).toHaveCount(0)
      const actionPanel = workspace.getByLabel('切换行动 行动记录', { exact: true })
      await actionPanel.getByRole('button', { name: '开始记录', exact: true }).click()
      await actionPanel.getByLabel('投入时长（分钟，可选）').fill('3')
      await routineRow.click()
      await expect(panel.getByLabel('投入时长（分钟，可选）')).toHaveValue('8')
      await master.getByRole('button', { name: /另一条例行/ }).click()
      await expect(workspace.getByLabel('另一条例行 例行记录', { exact: true })).toBeVisible()
      await routineRow.click()
      await expect(panel.getByLabel('备注（可选）')).toHaveValue('切换选择和页面之后继续')
      await page.getByRole('navigation').getByRole('button', { name: '目标', exact: true }).click()
      await page.getByRole('navigation').getByRole('button', { name: '今天', exact: true }).click()
      await expect(panel.getByLabel('投入时长（分钟，可选）')).toHaveValue('8')
      await expect(routineRow).toHaveAttribute('aria-pressed', 'true')
      await page.getByRole('button', { name: '收起今天列表' }).click()
      await expect(panel.getByLabel('备注（可选）')).toHaveValue('切换选择和页面之后继续')
      await page.getByRole('button', { name: '展开今天列表' }).click()
      await panel.getByRole('button', { name: '放弃草稿', exact: true }).click()
      await expect(panel.getByRole('button', { name: '记录例行', exact: true })).toBeFocused()
      await panel.getByRole('button', { name: '记录例行', exact: true }).click()
      await expect(panel.getByLabel('备注（可选）')).toHaveValue('')
      await panel.getByLabel('投入时长（分钟，可选）').fill('5')
      await panel.getByRole('button', { name: '保存例行记录', exact: true }).click()
      await expect(panel.getByRole('status')).toContainText('已保存：有所行动')
      await expect(panel.getByRole('button', { name: '记录例行', exact: true })).toHaveCount(0)
      await expect(routineRow).toContainText('有所行动')
      await expect(routineRow).not.toContainText('有未保存草稿')
      await routineRow.click()
      await expect(panel.getByRole('button', { name: '保存例行记录', exact: true })).toHaveCount(0)
      await master.getByRole('button', { name: /切换行动.*待行动/ }).click()
      await expect(actionPanel.getByLabel('投入时长（分钟，可选）')).toHaveValue('3')
      const actionSnapshot = await page.evaluate(async () => {
        const today = await window.myTracer.today.get({})
        if (!today.ok) throw new Error('Cannot read fixture action')
        const action = today.value.availableActions.find((item) => item.title === '切换行动')
        if (!action) throw new Error('Missing fixture action')
        return { ok: true as const, value: action }
      })
      // Cover both asynchronous boundaries: the panel history reload and workspace detail refresh.
      await application.evaluate(
        ({ ipcMain }, { channel, snapshot }) => {
          ipcMain.removeHandler(channel)
          ipcMain.handle(channel, async () => {
            Reflect.set(globalThis, '__routineWorkspaceRefreshStarted', true)
            await new Promise<void>((resolve) =>
              Reflect.set(globalThis, '__releaseRoutineWorkspaceRefresh', resolve)
            )
            return channel === 'actions:get-detail' ? snapshot : { ok: true, value: [] }
          })
        },
        { channel: delayedChannel, snapshot: actionSnapshot }
      )
      await actionPanel.getByRole('button', { name: '保存记录', exact: true }).click()
      await expect
        .poll(() =>
          application!.evaluate(() => Reflect.get(globalThis, '__routineWorkspaceRefreshStarted'))
        )
        .toBe(true)
      await routineRow.click()
      await application.evaluate(() =>
        Reflect.get(globalThis, '__releaseRoutineWorkspaceRefresh')()
      )
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          })
      )
      await expect(panel).toBeVisible()
      await expect(routineRow).toHaveAttribute('aria-pressed', 'true')
      await expect(actionPanel).toHaveCount(0)
      const facts = await page.evaluate(() => window.myTracer.today.get({}))
      expect(
        facts.ok && facts.value.plannedRoutines.find((routine) => routine.id === routineId)
      ).toMatchObject({
        recordState: 'acted',
        record: { durationMinutes: 5 }
      })
    } finally {
      await application?.close().catch(() => undefined)
      await removeTemporaryTestRoot(root)
    }
  })
}

for (const remountSubmittedRoutine of [false, true]) {
  test(`late successful routine save clears its draft and preserves selection (remount=${remountSubmittedRoutine})`, async () => {
    const root = await createTemporaryTestRoot()
    let application: ElectronApplication | undefined
    try {
      application = await electron.launch({
        cwd: root.root,
        args: [
          join(process.cwd(), 'out/main/index.js'),
          `--user-data-dir=${root.electronUserData}`
        ],
        env: minimalElectronEnvironment(root)
      })
      const page = await application.firstWindow()
      await page.evaluate(async () => {
        for (const name of ['延迟保存例行', '继续编辑例行']) {
          const result = await window.myTracer.routines.create({
            arrangementMode: 'weekly' as const,
            name,
            minimumAction: '活动一下',
            weekdays: [1, 2, 3, 4, 5, 6, 7]
          })
          if (!result.ok) throw new Error('Cannot create isolated routine')
        }
      })
      await page.getByRole('navigation').getByRole('button', { name: '今天', exact: true }).click()
      const master = page.locator('.today-master')
      const first = master.getByRole('button', { name: /延迟保存例行/ })
      const second = master.getByRole('button', { name: /继续编辑例行/ })
      const savedPanel = page.getByLabel('延迟保存例行 例行记录', { exact: true })
      const currentPanel = page.getByLabel('继续编辑例行 例行记录', { exact: true })
      await first.click()
      await savedPanel.getByRole('button', { name: '记录例行', exact: true }).click()
      await savedPanel.getByLabel('备注（可选）').fill('提交的旧草稿')
      await application.evaluate(({ ipcMain }) => {
        const channel = 'routine-records:record'
        const handlers = (
          ipcMain as unknown as {
            _invokeHandlers: Map<string, (...args: unknown[]) => unknown>
          }
        )._invokeHandlers
        const original = handlers.get(channel)
        if (!original) throw new Error('Missing routine record handler')
        ipcMain.removeHandler(channel)
        ipcMain.handle(channel, async (...args) => {
          const result = await original(...args)
          Reflect.set(globalThis, '__routineSaveCommitted', true)
          await new Promise<void>((resolve) =>
            Reflect.set(globalThis, '__releaseRoutineSave', resolve)
          )
          return result
        })
      })
      await savedPanel.getByRole('button', { name: '保存例行记录', exact: true }).click()
      await expect
        .poll(() => application!.evaluate(() => Reflect.get(globalThis, '__routineSaveCommitted')))
        .toBe(true)
      await second.click()
      await currentPanel.getByRole('button', { name: '记录例行', exact: true }).click()
      await currentPanel.getByLabel('备注（可选）').fill('保留新选择的草稿')
      // Remount A before its old request settles: its restored draft is a new
      // object but still owns the consumed recording context.
      if (remountSubmittedRoutine) {
        await first.click()
        await expect(savedPanel.getByLabel('备注（可选）')).toHaveValue('提交的旧草稿')
      }
      await application.evaluate(() => Reflect.get(globalThis, '__releaseRoutineSave')())
      await expect(first).toContainText('有所行动')
      await expect(first).not.toContainText('有未保存草稿')
      await expect(remountSubmittedRoutine ? first : second).toHaveAttribute('aria-pressed', 'true')
      if (!remountSubmittedRoutine) await first.click()
      await expect(
        savedPanel.getByRole('button', { name: '保存例行记录', exact: true })
      ).toHaveCount(0)
      await expect(savedPanel).not.toContainText('已恢复')
      await second.click()
      await expect(currentPanel.getByLabel('备注（可选）')).toHaveValue('保留新选择的草稿')
      await currentPanel.getByRole('button', { name: '放弃草稿', exact: true }).click()
    } finally {
      await application?.close().catch(() => undefined)
      await removeTemporaryTestRoot(root)
    }
  })
}
