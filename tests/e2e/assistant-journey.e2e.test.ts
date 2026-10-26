import { join } from 'node:path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { expect, test, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'
import { seedAssistantJourney } from '../support/assistant-journey-fixture'
import { reviewReferences } from '../../src/renderer/src/features/review/review-reference'

test('Assistant uses real preload/Main/SQLite for scoped tools, confirmation and restart', async () => {
  test.setTimeout(90000)
  const root = await createTemporaryTestRoot()
  let application: ElectronApplication | undefined
  const launch = () =>
    electron.launch({
      cwd: root.root,
      chromiumSandbox: true,
      args: [
        join(process.cwd(), 'out/main/index.js'),
        `--user-data-dir=${root.electronUserData}`,
        `--mytracer-assistant-test-root=${root.root}`
      ],
      env: {
        ...minimalElectronEnvironment(root),
        NODE_ENV: 'test',
        MYTRACER_E2E_ASSISTANT: 'journey'
      }
    })
  try {
    await writeFile(join(root.root, '.assistant-synthetic-test'), 'isolated-synthetic-only', {
      flag: 'wx'
    })
    application = await launch()
    expect(await application.evaluate(({ app }) => app.commandLine.hasSwitch('no-sandbox'))).toBe(
      false
    )
    let page = await application.firstWindow()
    await expect(
      page.getByRole('button', { name: 'Assistant 服务设置', exact: true })
    ).toBeVisible()
    const ids = await page.evaluate<Awaited<ReturnType<typeof seedAssistantJourney>>>(
      `(${seedAssistantJourney.toString()})(window.myTracer)`
    )
    const result = await page.evaluate(async (ids) => {
      const api = window.myTracer
      function value<T>(r: { ok: true; value: T } | { ok: false; error: { code: string } }): T {
        if (!r.ok) throw new Error(r.error.code)
        return r.value
      }
      const settings = value(
        await api.assistantService.saveConfiguration({
          endpoint: 'https://example.invalid/v1',
          model: 'synthetic',
          enabled: true,
          apiKey: 'synthetic-fixture-key'
        })
      )
      const connection = value(await api.assistantService.testConnection())
      const record = value(
        await api.assistant.createSession({
          entry: { object: { kind: 'action-record', id: ids.recordIds[0] }, intent: 'organize' },
          mode: 'persistent'
        })
      )
      const run = value(
        await api.assistant.sendTurn({
          sessionId: record.id,
          expectedRevision: record.revision,
          requestId: crypto.randomUUID(),
          text: '整理这条记录'
        })
      )
      const candidate = run.candidates[0]
      const preview = value(
        await api.assistant.previewWrite({
          sessionId: record.id,
          candidateId: candidate.id,
          payload: candidate.payload,
          expectedTargetRevision: candidate.expectedTargetRevision
        })
      )
      const before = value(await api.dataControl.list()).actionRecords.find(
        (r) => r.id === ids.recordIds[0]
      )!
      const input = {
        sessionId: record.id,
        previewId: preview.previewId,
        operationId: crypto.randomUUID()
      }
      const receipt = await api.assistant.confirmWrite(input)
      const repeated = await api.assistant.confirmWrite(input)
      const after = value(await api.dataControl.list()).actionRecords.find(
        (r) => r.id === ids.recordIds[0]
      )!
      const goal = value(
        await api.assistant.createSession({
          entry: { object: { kind: 'goal', id: ids.goalId }, intent: 'resume' },
          mode: 'persistent'
        })
      )
      const scoped = value(
        await api.assistant.setScope({
          sessionId: goal.id,
          expectedRevision: goal.revision,
          scope: { ...goal.scope, goalId: ids.goalId }
        })
      )
      const statistics = value(
        await api.assistant.sendTurn({
          sessionId: goal.id,
          expectedRevision: scoped.revision,
          requestId: crypto.randomUUID(),
          text: '统计后帮我接上上次'
        })
      )
      const continued = value(await api.assistant.getSession({ sessionId: goal.id }))
      const followup = value(
        await api.assistant.sendTurn({
          sessionId: goal.id,
          expectedRevision: continued.revision,
          requestId: crypto.randomUUID(),
          text: '今天只有五分钟呢？'
        })
      )
      const temporary = value(
        await api.assistant.createSession({
          entry: { object: { kind: 'goal', id: ids.goalId }, intent: 'clarify' },
          mode: 'temporary'
        })
      )
      const waiting = api.assistant.sendTurn({
        sessionId: temporary.id,
        expectedRevision: temporary.revision,
        requestId: 'cancel-fixture',
        text: '等待取消'
      })
      value(
        await api.assistant.cancelTurn({ sessionId: temporary.id, requestId: 'cancel-fixture' })
      )
      const cancelled = value(await waiting)
      const refreshed = value(await api.assistant.getSession({ sessionId: temporary.id }))
      const cancelledBySettings = api.assistant.sendTurn({
        sessionId: temporary.id,
        expectedRevision: refreshed.revision,
        requestId: 'configuration-cancel',
        text: '等待取消'
      })
      value(
        await api.assistantService.saveConfiguration({
          endpoint: 'https://example.invalid/v1',
          model: 'synthetic',
          enabled: true
        })
      )
      const configurationCancelled = value(await cancelledBySettings)
      return {
        configurationCancelled,
        settings,
        connection,
        recordId: record.id,
        temporaryId: temporary.id,
        run,
        before,
        after,
        receipt,
        repeated,
        statistics,
        followup,
        cancelled,
        goalSessionId: goal.id
      }
    }, ids)
    expect(result.settings.credentialPresent).toBe(true)
    expect(JSON.stringify(result.settings)).not.toContain('synthetic-fixture-key')
    expect(result.connection).toEqual({
      connection: 'connected',
      tools: 'unknown',
      streaming: 'unknown'
    })
    expect(result.run.state).toBe('completed')
    expect(result.before.summary).toBeNull()
    expect(result.after).toEqual(result.before)
    expect(result.receipt).toEqual({ ok: false, error: { code: 'unsupported' } })
    expect(result.after.note).toBe(result.before.note)
    expect(result.repeated).toEqual(result.receipt)
    expect(result.statistics.steps[0].statistics).toMatchObject({
      recordCount: 2,
      totalDurationMinutes: 15
    })
    expect(JSON.stringify(result.statistics)).not.toContain('__assistant_out_of_scope')
    expect(result.followup.state).toBe('completed')
    expect(result.cancelled.state).toBe('cancelled')
    expect(result.configurationCancelled.state).toBe('cancelled')

    // Optional isolated native exploration, using the exact same guarded synthetic fixture.
    // This is an explicit local opt-in, never enabled in CI and never reads a normal profile.
    if (process.env.MYTRACER_ASSISTANT_EXPLORE === '1' && !process.env.CI) {
      test.setTimeout(0)
      await page.reload()
      await page.evaluate(() => {
        document.title = 'MyTracer · 合成数据 / 模拟模型 · 隔离探索'
        const label = document.createElement('p')
        label.textContent = '隔离合成预览 · 响应为固定模拟，不代表真实模型质量 · 关闭后清理资料'
        label.style.cssText =
          'position:fixed;top:0;left:240px;z-index:9999;font-size:12px;pointer-events:none'
        document.body.append(label)
      })
      await page.pause()
      return // Manual exploration is not an automated journey result; finally still cleans up.
    }
    // Spontaneous capture starts in the normal unsaved editor, without an existing record.
    await page.getByRole('navigation').getByRole('button', { name: '今天', exact: true }).click()
    const beforeFirst = await page.evaluate(() => window.myTracer.dataControl.list())
    await page.getByRole('button', { name: '记一笔', exact: true }).click()
    const firstForm = page.getByRole('dialog', { name: '记一笔', exact: true })
    const rawFirst = '桌面好像全收好了。等等，右边一叠纸没动。大概5分钟？也可能20，没看表。'
    await firstForm.getByLabel('先随手写下来（可选）').fill(rawFirst)
    await firstForm.getByRole('button', { name: 'AI 整理这段原文' }).click()
    const firstAssistant = firstForm.getByRole('region', { name: 'AI 整理笔记' })
    await firstAssistant.getByLabel('整理要求（可修改）').fill('提炼简述，保留不确定性')
    await firstAssistant.getByRole('button', { name: '发送', exact: true }).click()
    await firstAssistant.getByRole('button', { name: '填入编辑草稿' }).click()
    await expect(firstForm.getByLabel('简述（可选）')).toHaveValue(
      '整理了桌面的一部分；右侧一叠纸还没动，投入时长不确定。'
    )
    await expect(firstForm.getByLabel('先随手写下来（可选）')).toHaveValue(rawFirst)
    await expect(firstForm.getByLabel('刚才做了什么')).toHaveValue('')
    await expect(firstForm.getByLabel('真实投入（分钟）')).toHaveValue('')
    await expect(firstForm.getByLabel('本次结果', { exact: true })).toHaveValue('')
    await expect(firstForm.getByLabel('保存后，整个行动')).toHaveValue('')
    expect(await page.evaluate(() => window.myTracer.dataControl.list())).toEqual(beforeFirst)
    await firstAssistant.getByRole('button', { name: '关闭', exact: true }).click()
    await firstForm.getByRole('button', { name: '收起并返回' }).click()
    await page.getByRole('button', { name: '继续记一笔', exact: true }).click()
    await expect(firstForm.getByLabel('先随手写下来（可选）')).toHaveValue(rawFirst)
    await firstForm.getByLabel('刚才做了什么').fill('合成随手记录：整理桌面')
    await firstForm.getByLabel('这次不记时长（未知）').check()
    await firstForm.getByLabel('本次结果', { exact: true }).selectOption('partial')
    await firstForm.getByLabel('保存后，整个行动').selectOption('keep-pending')
    await firstForm.getByRole('button', { name: '保存行动和第一笔', exact: true }).click()
    await expect(firstForm).not.toBeVisible()
    const afterFirst = await page.evaluate(() => window.myTracer.dataControl.list())
    if (!afterFirst.ok || !beforeFirst.ok) throw Error('synthetic data snapshot failed')
    expect(afterFirst.value.actions).toHaveLength(beforeFirst.value.actions.length + 1)
    expect(afterFirst.value.actionRecords).toHaveLength(beforeFirst.value.actionRecords.length + 1)
    const firstAction = afterFirst.value.actions.find((a) => a.title === '合成随手记录：整理桌面')!
    expect(firstAction).toMatchObject({ status: 'pending', goalId: null })
    expect(afterFirst.value.actionRecords.find((r) => r.actionId === firstAction.id)).toMatchObject(
      {
        durationMinutes: null,
        outcome: 'partial',
        note: rawFirst,
        summary: '整理了桌面的一部分；右侧一叠纸还没动，投入时长不确定。'
      }
    )

    // Free conversation works before selecting any business object.
    const free = await page.evaluate(async () => {
      const api = window.myTracer.assistant
      const session = await api.createSession({
        entry: { object: { kind: 'conversation', id: 'free-chat' }, intent: 'chat' },
        mode: 'temporary'
      })
      if (!session.ok) throw new Error(session.error.code)
      const run = await api.sendTurn({
        sessionId: session.value.id,
        expectedRevision: session.value.revision,
        requestId: crypto.randomUUID(),
        text: '我想先聊聊'
      })
      await api.deleteSession({ sessionId: session.value.id })
      return run
    })
    expect(free.ok && free.value.state).toBe('completed')
    expect(free.ok && free.value.manifest.sources).toEqual([])
    expect(free.ok && free.value.candidates).toEqual([])

    const review = await page.evaluate(async ({ actionId }) => {
      const api = window.myTracer
      const context = await api.review.begin({})
      if (!context.ok) throw new Error(context.error.code)
      const saved = await api.dataControl.backfillActionRecord({
        actionId,
        occurredOn: context.value.periodStartedOn,
        outcome: 'partial',
        durationMinutes: 3,
        summary: '合成复盘事实',
        note: '合成复盘记录：整理了纸张，还需下次继续。'
      })
      if (!saved.ok) throw new Error(saved.error.code)
      const summary = await api.review.getSummary({
        reviewContextId: context.value.reviewContextId
      })
      if (!summary.ok) throw new Error(summary.error.code)
      return { context: context.value, summary: summary.value }
    }, ids)
    const citation = reviewReferences(review.summary)[0].citation
    const reviewed = await page.evaluate(
      async ({ contextId, citation }) => {
        const api = window.myTracer.assistant
        const created = await api.createSession({
          entry: {
            object: { kind: 'review', id: contextId },
            intent: 'review',
            editorText: citation,
            editorRevision: 'synthetic-editor-1'
          },
          mode: 'temporary'
        })
        if (!created.ok) throw new Error(created.error.code)
        const run = await api.sendTurn({
          sessionId: created.value.id,
          expectedRevision: created.value.revision,
          requestId: crypto.randomUUID(),
          text: '根据选定事实起草复盘'
        })
        if (!run.ok || run.value.state !== 'completed') throw new Error(JSON.stringify(run))
        const candidate = run.value.candidates[0]
        const preview = await api.previewWrite({
          sessionId: created.value.id,
          candidateId: candidate.id,
          payload: candidate.payload,
          expectedTargetRevision: candidate.expectedTargetRevision
        })
        if (!preview.ok) throw new Error(preview.error.code)
        const formal = await api.confirmWrite({
          sessionId: created.value.id,
          previewId: preview.value.previewId,
          operationId: crypto.randomUUID()
        })
        await window.myTracer.review.cancel({ reviewContextId: contextId })
        const stale = await api.previewWrite({
          sessionId: created.value.id,
          candidateId: candidate.id,
          payload: candidate.payload,
          expectedTargetRevision: candidate.expectedTargetRevision
        })
        return { preview: preview.value, formal, stale }
      },
      { contextId: review.context.reviewContextId, citation }
    )
    expect(reviewed.preview.payload.kind).toBe('review-draft')
    expect(reviewed.formal).toMatchObject({ ok: false, error: { code: 'unsupported' } })
    expect(reviewed.stale.ok).toBe(false)

    await application.close()
    application = undefined
    const disk = await readFile(
      join(root.electronUserData, 'assistant/assistant-sessions-v1.json'),
      'utf8'
    )
    expect(disk).not.toContain(result.temporaryId)
    expect(disk).not.toContain('synthetic-fixture-key')
    application = await launch()
    page = await application.firstWindow()
    const restored = await page.evaluate(async ({ recordId, goalSessionId }) => {
      const sessions = await window.myTracer.assistant.listSessions()
      const record = await window.myTracer.assistant.getSession({ sessionId: recordId })
      const goal = await window.myTracer.assistant.getSession({ sessionId: goalSessionId })
      await window.myTracer.assistant.deleteSession({ sessionId: recordId })
      const deleted = await window.myTracer.assistant.getSession({ sessionId: recordId })
      return { sessions, record, goal, deleted, data: await window.myTracer.dataControl.list() }
    }, result)
    expect(restored.record.ok && restored.record.value.messages.length).toBe(2)
    expect(restored.goal.ok && restored.goal.value.messages.length).toBe(4)
    expect(restored.deleted).toMatchObject({ ok: false, error: { code: 'not-found' } })
    expect(
      restored.data.ok &&
        restored.data.value.actionRecords.find((r) => r.id === ids.recordIds[0])?.summary
    ).toBe(result.after.summary)
    const capture = async (name: string) => {
      if (process.env.MYTRACER_ASSISTANT_VISUAL !== '1') return
      const directory = join(process.cwd(), '.tmp/assistant-visual')
      await mkdir(directory, { recursive: true })
      await page.screenshot({ path: join(directory, `${name}.png`) })
    }
    // Actual host/settings mount, not the renderer fake adapter.
    await page.getByRole('button', { name: 'Assistant 服务设置', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Assistant 服务', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '关闭服务设置', exact: true }).click()
    await page.getByRole('button', { name: '目标', exact: true }).click()
    await page.getByRole('button', { name: /^整理居住空间/ }).click()
    await page.getByRole('button', { name: 'AI 接上上次', exact: true }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByLabel('继续聊聊')).toBeVisible()
    await capture('goal-resume')
    await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click()
    await page.getByRole('button', { name: '复盘', exact: true }).click()
    await page.getByRole('button', { name: '选择作参考', exact: true }).first().click()
    const coreBeforeDraft = await page.evaluate(() => window.myTracer.dataControl.list())
    await page.getByRole('button', { name: 'AI 回顾选定内容', exact: true }).click()
    await page.getByLabel('继续聊聊').fill('根据选定事实起草复盘')
    await page.getByRole('button', { name: '发送', exact: true }).click()
    await expect(page.getByRole('button', { name: '填入编辑草稿', exact: true })).toBeVisible()
    await capture('review-preview')
    await page.getByRole('button', { name: '填入编辑草稿', exact: true }).click()
    await expect(
      page.getByText('已填入未保存草稿；请回到编辑器检查并手动保存。', { exact: true })
    ).toBeVisible()
    await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click()
    await expect(page.getByLabel('一个真实进展', { exact: true })).toHaveValue('已整理一部分纸张。')
    await expect(page.getByLabel('一个主要阻力', { exact: true })).toHaveValue(
      '还有一小叠需要分类。'
    )
    await expect(page.getByLabel('下一周期的一个调整', { exact: true })).toHaveValue(
      '下次只整理五分钟。'
    )
    expect(await page.evaluate(() => window.myTracer.dataControl.list())).toEqual(coreBeforeDraft)
    // Record entry uses a real editor; filling a candidate leaves the database untouched.
    await page.getByRole('button', { name: '查看完整记录或修改', exact: true }).first().click()
    await page.getByRole('button', { name: '编辑记录', exact: true }).click()
    await page.getByRole('button', { name: 'AI 整理笔记', exact: true }).click()
    await page.getByLabel('整理要求（可修改）').fill('提炼简述')
    await page.getByRole('button', { name: '发送', exact: true }).click()
    await expect(page.getByRole('button', { name: '填入编辑草稿', exact: true })).toBeVisible()
    await capture('record-preview')
    if (process.env.MYTRACER_ASSISTANT_VISUAL === '1') {
      await application.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].setSize(820, 700)
      )
      await capture('record-narrow-native-820')
      await page.setViewportSize({ width: 420, height: 800 })
      await expect(page.getByLabel('整理要求（可修改）')).toBeVisible()
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
      ).toBe(true)
      await capture('record-stress-420')
    }
    await page.getByRole('button', { name: '填入编辑草稿', exact: true }).click()
    await expect(
      page.getByText('已填入未保存草稿；请回到编辑器检查并手动保存。', { exact: true })
    ).toBeVisible()
    await page
      .getByRole('region', { name: 'AI 整理笔记', exact: true })
      .getByRole('button', { name: '关闭', exact: true })
      .click()
    expect(await page.evaluate(() => window.myTracer.dataControl.list())).toEqual(coreBeforeDraft)
    const noReviewWrite = await page.evaluate(async () => {
      const context = await window.myTracer.review.begin({})
      if (!context.ok) throw new Error(context.error.code)
      return window.myTracer.review.getResult({ reviewContextId: context.value.reviewContextId })
    })
    expect(noReviewWrite).toEqual({ ok: true, value: null })
    await page.getByRole('button', { name: '保存修改', exact: true }).click()
    const manuallySaved = await page.evaluate(() => window.myTracer.dataControl.list())
    expect(
      manuallySaved.ok &&
        manuallySaved.value.actionRecords.some(
          (r) => r.summary === '整理了桌面的一角，剩余纸张下次继续。'
        )
    ).toBe(true)
    const quitRun = await page.evaluate(async ({ goalId }) => {
      const api = window.myTracer.assistant
      const created = await api.createSession({
        entry: { object: { kind: 'goal', id: goalId }, intent: 'clarify' },
        mode: 'persistent'
      })
      if (!created.ok) throw new Error(created.error.code)
      void api
        .sendTurn({
          sessionId: created.value.id,
          expectedRevision: created.value.revision,
          requestId: 'quit-drain',
          text: '等待取消'
        })
        .catch(() => undefined)
      return api.getRun({ sessionId: created.value.id, requestId: 'quit-drain' })
    }, ids)
    expect(quitRun.ok && quitRun.value.state).toBe('running')
    await application.close()
    application = undefined
    const finalStore = JSON.parse(
      await readFile(join(root.electronUserData, 'assistant/assistant-sessions-v1.json'), 'utf8')
    )
    expect(finalStore.version).toBe(1)
  } finally {
    await application?.close()
    await removeTemporaryTestRoot(root)
  }
})
