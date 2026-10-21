import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import Database from 'better-sqlite3'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import {
  createTemporaryTestRoot,
  removeTemporaryTestRoot,
  type TemporaryTestRoot
} from '../support/temporary-test-root'

const coreTables = Object.freeze([
  'metadata',
  'goals',
  'actions',
  'routines',
  'routine_schedule_days',
  'today_selections',
  'action_records',
  'routine_records',
  'understandings',
  'confusions',
  'review_results'
])

async function launch(root: TemporaryTestRoot): Promise<ElectronApplication> {
  const application = await electron.launch({
    cwd: root.root,
    args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
    env: {
      ...minimalElectronEnvironment(root),
      NODE_ENV: 'test',
      MYTRACER_E2E_AI_SCENARIO: 'aggregate-ac02',
      MYTRACER_LITELLM_API_KEY: '__ac02_forbidden_credential__',
      MYTRACER_E2E_DIAGNOSTIC_MARKER: '__ac02_forbidden_diagnostic__'
    }
  })
  return application
}

function sqliteSnapshot(root: TemporaryTestRoot): Readonly<Record<string, readonly unknown[]>> {
  const database = new Database(join(root.electronUserData, 'data', 'mytracer.sqlite3'), {
    readonly: true
  })
  try {
    return Object.freeze(
      Object.fromEntries(
        coreTables.map((table) => [
          table,
          database.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()
        ])
      )
    )
  } finally {
    database.close()
  }
}

async function openTodayAction(page: Page, title: string, expectInput = true): Promise<void> {
  await page.getByRole('button', { name: '今天', exact: true }).click()
  await page
    .getByRole('button', { name: new RegExp(title) })
    .first()
    .click()
  if (expectInput) await expect(page.getByLabel('现在最卡住你的是什么？')).toBeVisible()
}

async function triggerDraft(page: Page, input: string, acknowledgement: string): Promise<void> {
  await page.getByLabel('现在最卡住你的是什么？').fill(input)
  await page.getByRole('button', { name: '帮我找一个小起点' }).click()
  await expect(page.getByText(acknowledgement)).toBeVisible()
  await expect(page.getByRole('group', { name: /选择一个临时建议/ })).toBeVisible()
}

async function triggerFailure(page: Page, input: string, error: RegExp): Promise<void> {
  await page.getByLabel('现在最卡住你的是什么？').fill(input)
  await page.getByRole('button', { name: '帮我找一个小起点' }).click()
  await expect(page.getByText(error)).toBeVisible()
}

async function todayCommitments(page: Page): Promise<{
  readonly focuses: readonly { readonly id: string; readonly commitment: string }[]
  readonly intentions: readonly { readonly id: string; readonly commitment: string }[]
}> {
  return page.evaluate(async () => {
    const result = await window.myTracer.today.get({})
    if (!result.ok) throw new Error(result.error.message)
    return {
      focuses: result.value.focuses.map(({ id, commitment }) => ({ id, commitment })),
      intentions: result.value.intentions.map(({ id, commitment }) => ({ id, commitment }))
    }
  })
}

test('continuous E2E-AC-02 proves isolation, every temporary branch, confirmation, and reopen', async () => {
  test.setTimeout(240_000)
  const root = await createTemporaryTestRoot()
  const destination = join(root.exports, 'ac02-export.json')
  let application: ElectronApplication | undefined
  try {
    application = await launch(root)
    let page = await application.firstWindow()
    const setup = await page.evaluate(async () => {
      const primary = await window.myTracer.goals.create({
        name: '__ac02_allowed_goal__',
        description: '只允许当前目标进入请求',
        initialNextAction: { title: '__ac02_allowed_action__' }
      })
      if (!primary.ok || !primary.value.currentNextActionId) throw new Error('Primary Goal failed')
      const originalActionId = primary.value.currentNextActionId
      const selected = await window.myTracer.today.selectAction({ actionId: originalActionId })
      const extraAction = await window.myTracer.actions.create({
        goalId: primary.value.id,
        title: '__ac02_allowed_extra_action__'
      })
      if (!selected.ok || !extraAction.ok) throw new Error('Primary Action setup failed')

      const recordIds: string[] = []
      for (let index = 0; index < 6; index += 1) {
        const sequence = index + 1
        const day = String(31 - index).padStart(2, '0')
        const record = await window.myTracer.dataControl.backfillActionRecord({
          actionId: originalActionId,
          occurredOn: `2026-08-${day}`,
          durationMinutes: sequence,
          outcome: 'partial',
          understanding:
            sequence === 6 ? '__ac02_excluded_record_6__' : `__ac02_allowed_record_${sequence}__`,
          confusion: `__ac02_allowed_confusion_${sequence}__`,
          nextStep: `__ac02_allowed_next_${sequence}__`,
          note: `__ac02_forbidden_note_${sequence}__`
        })
        if (!record.ok) throw new Error(record.error.message)
        recordIds.push(record.value.id)
      }

      const other = await window.myTracer.goals.create({
        name: '__ac02_forbidden_other_goal__',
        initialNextAction: { title: '__ac02_forbidden_other_action__' }
      })
      if (!other.ok || !other.value.currentNextActionId) throw new Error('Other Goal failed')
      const otherRecord = await window.myTracer.dataControl.backfillActionRecord({
        actionId: other.value.currentNextActionId,
        occurredOn: '2026-08-31',
        durationMinutes: 99,
        outcome: 'completed',
        understanding: '__ac02_forbidden_other_record__'
      })
      const routine = await window.myTracer.routines.create({
        goalId: other.value.id,
        name: '__ac02_forbidden_routine__',
        minimumAction: '__ac02_forbidden_routine_minimum__',
        weekdays: [1]
      })
      if (!otherRecord.ok || !routine.ok) throw new Error('Forbidden fixture failed')
      const routineRecord = await window.myTracer.dataControl.backfillRoutineRecord({
        routineId: routine.value.id,
        occurredOn: '2026-08-31',
        outcome: 'acted',
        plannedForDate: false,
        durationMinutes: 2,
        note: '__ac02_forbidden_routine_record__'
      })
      if (!routineRecord.ok) throw new Error(routineRecord.error.message)

      const review = await window.myTracer.review.begin({})
      if (!review.ok) throw new Error(review.error.message)
      const reviewResult = await window.myTracer.review.complete({
        reviewContextId: review.value.reviewContextId,
        confirmedProgress: '__ac02_forbidden_review__',
        mainObstacle: '__ac02_forbidden_review_obstacle__',
        nextAdjustment: '__ac02_forbidden_review_adjustment__',
        relatedGoalId: other.value.id,
        nextStepChange: { kind: 'none' }
      })
      if (!reviewResult.ok) throw new Error(reviewResult.error.message)

      const empty = await window.myTracer.goals.create({
        name: '__ac02_empty_goal__',
        initialNextAction: { title: '__ac02_empty_action__' }
      })
      if (!empty.ok || !empty.value.currentNextActionId) throw new Error('Empty Goal failed')

      return {
        primaryGoalId: primary.value.id,
        originalActionId,
        firstRecordId: recordIds[0],
        emptyActionId: empty.value.currentNextActionId
      }
    })

    await page.reload()
    await openTodayAction(page, '__ac02_allowed_action__', false)
    await expect(page.getByText('AI 尚未配置')).toBeVisible()
    await expect(page.getByText('AI 状态', { exact: true })).toHaveCount(0)
    const beforeConfigurationBranches = sqliteSnapshot(root)
    const notConfigured = await page.evaluate(
      (actionId) =>
        window.myTracer.aiStartHelp.start({
          actionId,
          locale: 'zh-CN',
          userInput: '__ac02_not_configured__'
        }),
      setup.originalActionId
    )
    expect(notConfigured).toMatchObject({
      state: 'failed',
      error: { code: 'not-configured', retryable: false }
    })
    expect(sqliteSnapshot(root)).toEqual(beforeConfigurationBranches)

    await page.getByRole('button', { name: '从环境变量导入配置' }).click()
    await expect(page.getByLabel('现在最卡住你的是什么？')).toBeVisible()
    await page.getByRole('button', { name: '停用 AI 功能' }).click()
    await expect(page.getByText('AI 功能已停用')).toBeVisible()
    const disabled = await page.evaluate(
      (actionId) =>
        window.myTracer.aiStartHelp.start({
          actionId,
          locale: 'zh-CN',
          userInput: '__ac02_disabled__'
        }),
      setup.originalActionId
    )
    expect(disabled).toMatchObject({
      state: 'failed',
      error: { code: 'disabled', retryable: false }
    })
    expect(sqliteSnapshot(root)).toEqual(beforeConfigurationBranches)
    await page.getByRole('button', { name: '启用 AI' }).click()
    await expect(page.getByLabel('现在最卡住你的是什么？')).toBeVisible()

    await page.evaluate(async () => {
      await Promise.all([
        window.myTracer.aiStartHelp.status(),
        window.myTracer.today.get({}),
        window.myTracer.goals.list({ status: 'active' })
      ])
    })
    await page.getByRole('button', { name: '目标', exact: true }).click()
    await openTodayAction(page, '__ac02_allowed_action__')
    expect(await page.evaluate(() => window.myTracer.aiStartHelp.status())).toEqual({
      state: 'idle',
      generation: 0
    })

    const initial = sqliteSnapshot(root)
    const initialToday = await todayCommitments(page)

    await triggerDraft(page, '__ac02_close__', '__ac02_ack_close__')
    await expect(page.getByLabel('现在最卡住你的是什么？')).toHaveCount(0)
    const closeCandidates = page
      .getByRole('group', { name: /选择一个临时建议/ })
      .locator('.ai-start-help-candidate')
    await expect(closeCandidates.first()).toHaveClass(/is-selected/)
    expect(sqliteSnapshot(root)).toEqual(initial)
    await page
      .getByRole('group', { name: /选择一个临时建议/ })
      .getByRole('textbox')
      .first()
      .fill('__ac02_unsubmitted_edit__')
    await page.getByRole('button', { name: '结束本次帮助' }).click()
    await expect(page.getByText(/本次帮助已结束，未确认内容没有保存/)).toBeVisible()
    expect(sqliteSnapshot(root)).toEqual(initial)

    await triggerDraft(page, '__ac02_reject__', '__ac02_ack_reject__')
    await page.getByRole('button', { name: '这次不采用建议' }).click()
    await expect(page.getByText(/你没有采用这次建议，没有保存任何内容/)).toBeVisible()
    expect(sqliteSnapshot(root)).toEqual(initial)

    await triggerDraft(page, '__ac02_stale__', '__ac02_ack_stale__')
    const changedGoal = await page.evaluate((goalId) => {
      return window.myTracer.goals.updateDetails({
        goalId,
        name: '__ac02_allowed_goal_changed__'
      })
    }, setup.primaryGoalId)
    expect(changedGoal.ok).toBe(true)
    const beforeStaleConfirmation = sqliteSnapshot(root)
    await page.getByRole('button', { name: '确认并设为新的下一步' }).click()
    await expect(page.getByText(/当前行动已经变化/)).toBeVisible()
    expect(sqliteSnapshot(root)).toEqual(beforeStaleConfirmation)
    const restoredGoal = await page.evaluate((goalId) => {
      return window.myTracer.goals.updateDetails({ goalId, name: '__ac02_allowed_goal__' })
    }, setup.primaryGoalId)
    expect(restoredGoal.ok).toBe(true)

    await triggerDraft(page, '__ac02_accept_original__', '__ac02_ack_accept_original__')
    await page.getByRole('button', { name: '确认并设为新的下一步' }).click()
    await expect(page.getByText('已保存为新的下一步。')).toBeVisible()
    const afterOriginal = sqliteSnapshot(root)
    const afterOriginalData = await page.evaluate(() => window.myTracer.dataControl.list())
    expect(afterOriginalData).toMatchObject({
      ok: true,
      value: {
        actions: expect.arrayContaining([
          expect.objectContaining({
            goalId: setup.primaryGoalId,
            title: '__ac02_suggestion_accept_original__',
            status: 'pending'
          })
        ])
      }
    })
    expect(afterOriginal.actions).toHaveLength(initial.actions.length + 1)
    expect(
      await page.evaluate(
        (goalId) => window.myTracer.goals.getDetail({ goalId }),
        setup.primaryGoalId
      )
    ).toMatchObject({
      ok: true,
      value: { currentNextAction: { title: '__ac02_suggestion_accept_original__' } }
    })
    expect(await todayCommitments(page)).toEqual(initialToday)

    await triggerDraft(page, '__ac02_edit_confirm__', '__ac02_ack_edit_confirm__')
    await page
      .getByRole('group', { name: /选择一个临时建议/ })
      .getByRole('textbox')
      .first()
      .fill('__ac02_final_edited_action__')
    await page.getByRole('button', { name: '确认并设为新的下一步' }).click()
    await expect(page.getByText('已保存为新的下一步。')).toBeVisible()
    const afterActions = sqliteSnapshot(root)
    const afterActionsData = await page.evaluate(() => window.myTracer.dataControl.list())
    expect(afterActionsData).toMatchObject({
      ok: true,
      value: {
        actions: expect.arrayContaining([
          expect.objectContaining({
            id: setup.originalActionId,
            title: '__ac02_allowed_action__',
            status: 'pending'
          }),
          expect.objectContaining({
            goalId: setup.primaryGoalId,
            title: '__ac02_final_edited_action__',
            status: 'pending'
          })
        ])
      }
    })
    expect(afterActions.actions).toHaveLength(initial.actions.length + 2)
    expect(
      await page.evaluate(
        (goalId) => window.myTracer.goals.getDetail({ goalId }),
        setup.primaryGoalId
      )
    ).toMatchObject({
      ok: true,
      value: { currentNextAction: { title: '__ac02_final_edited_action__' } }
    })
    const initialOriginalAction = initial.actions.find(
      (row) => (row as { readonly id?: unknown }).id === setup.originalActionId
    )
    const finalOriginalAction = afterActions.actions.find(
      (row) => (row as { readonly id?: unknown }).id === setup.originalActionId
    )
    expect(finalOriginalAction).toEqual(initialOriginalAction)
    expect(afterActions.today_selections).toEqual(initial.today_selections)
    expect(afterActions.action_records).toEqual(initial.action_records)
    expect(afterActions.understandings).toEqual(initial.understandings)
    expect(afterActions.confusions).toEqual(initial.confusions)
    expect(await todayCommitments(page)).toEqual(initialToday)

    await triggerDraft(page, '__ac02_understandings__', '__ac02_ack_understandings__')
    const understandingGroup = page.getByRole('group', { name: /可选：保存一条理解/ })
    const candidateBlocks = understandingGroup.locator('.ai-start-help-candidate')
    await expect(candidateBlocks).toHaveCount(3)
    await expect(page.getByText(/确认前不会保存或改变当前行动/)).toBeVisible()

    await candidateBlocks.nth(0).getByRole('combobox').selectOption({ index: 1 })
    await candidateBlocks.nth(0).getByRole('button', { name: '保存这条理解' }).click()
    await expect(candidateBlocks.nth(0).getByRole('button', { name: '已保存' })).toBeVisible()
    await candidateBlocks.nth(1).getByRole('textbox').fill('__ac02_final_understanding_2__')
    await candidateBlocks.nth(1).getByRole('combobox').selectOption({ index: 1 })
    await candidateBlocks.nth(1).getByRole('button', { name: '保存这条理解' }).click()
    await expect(candidateBlocks.nth(1).getByRole('button', { name: '已保存' })).toBeVisible()
    await page.getByRole('button', { name: '这次不采用建议' }).click()
    await expect(page.getByText(/你没有采用这次建议/)).toBeVisible()

    const afterUnderstandings = sqliteSnapshot(root)
    const confirmedFacts = await page.evaluate(() => window.myTracer.dataControl.list())
    expect(confirmedFacts).toMatchObject({
      ok: true,
      value: {
        understandings: expect.arrayContaining([
          expect.objectContaining({
            actionRecordId: setup.firstRecordId,
            text: '__ac02_understanding_understandings_1__',
            source: 'ai_candidate_confirmed'
          }),
          expect.objectContaining({
            actionRecordId: setup.firstRecordId,
            text: '__ac02_final_understanding_2__',
            source: 'ai_candidate_confirmed'
          })
        ])
      }
    })
    expect(afterUnderstandings.understandings).toHaveLength(afterActions.understandings.length + 2)
    expect(afterUnderstandings.actions).toEqual(afterActions.actions)
    expect(afterUnderstandings.today_selections).toEqual(afterActions.today_selections)
    expect(afterUnderstandings.action_records).toEqual(afterActions.action_records)
    expect(afterUnderstandings.confusions).toEqual(afterActions.confusions)
    expect(JSON.stringify(afterUnderstandings)).not.toContain(
      '__ac02_understanding_understandings_3__'
    )

    const emptySelected = await page.evaluate(
      (actionId) => window.myTracer.today.selectAction({ actionId }),
      setup.emptyActionId
    )
    expect(emptySelected.ok).toBe(true)
    await page.reload()
    await openTodayAction(page, '__ac02_empty_action__')
    const beforeNoRecord = sqliteSnapshot(root)
    await triggerDraft(page, '__ac02_no_record__', '__ac02_ack_no_record__')
    await expect(page.getByText(/没有可关联的真实行动记录/)).toBeVisible()
    const noRecordCandidates = page
      .getByRole('group', { name: /可选：保存一条理解/ })
      .locator('.ai-start-help-candidate')
    await expect(noRecordCandidates).toHaveCount(3)
    await expect(
      noRecordCandidates.first().getByRole('button', { name: '保存这条理解' })
    ).toBeDisabled()
    await page.getByRole('button', { name: '这次不采用建议' }).click()
    expect(sqliteSnapshot(root)).toEqual(beforeNoRecord)

    await openTodayAction(page, '__ac02_allowed_action__')
    const beforeFailures = sqliteSnapshot(root)

    await triggerFailure(page, '__ac02_invalid__', /未通过安全检查/)
    expect(sqliteSnapshot(root)).toEqual(beforeFailures)
    await triggerFailure(page, '__ac02_authentication__', /认证未通过/)
    expect(sqliteSnapshot(root)).toEqual(beforeFailures)
    await triggerFailure(page, '__ac02_network__', /网络暂时不可用/)
    expect(sqliteSnapshot(root)).toEqual(beforeFailures)
    await triggerFailure(page, '__ac02_provider_unavailable__', /AI 服务暂时不可用/)
    expect(sqliteSnapshot(root)).toEqual(beforeFailures)
    await expect(page.getByRole('button', { name: '开始记录' })).toBeVisible()

    await page.getByLabel('现在最卡住你的是什么？').fill('__ac02_cancel__')
    await page.getByRole('button', { name: '帮我找一个小起点' }).click()
    await expect(page.getByText(/正在根据当前行动整理一个小起点/)).toBeVisible()
    await expect(page.getByRole('button', { name: '取消整理' })).toBeVisible()
    await page.getByRole('button', { name: '取消整理' }).click()
    await expect(page.getByText('已取消这次整理，没有保存任何内容。')).toBeVisible()
    expect(sqliteSnapshot(root)).toEqual(beforeFailures)

    await triggerFailure(page, '__ac02_timeout_retry__', /等待时间较长/)
    expect(sqliteSnapshot(root)).toEqual(beforeFailures)
    await page.getByRole('button', { name: '重新整理建议' }).click()
    await expect(page.getByText('__ac02_ack_retry_new_generation__')).toBeVisible()
    await page.waitForTimeout(1_000)
    await expect(page.getByText('__ac02_ack_retry_new_generation__')).toBeVisible()
    await expect(page.getByText('__ac02_ack_late_old_generation__')).toHaveCount(0)
    expect(sqliteSnapshot(root)).toEqual(beforeFailures)
    await page.getByRole('button', { name: '结束本次帮助' }).click()
    expect(sqliteSnapshot(root)).toEqual(beforeFailures)

    await application.evaluate(({ dialog }, target) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: target })
    }, destination)
    const exportResult = await page.evaluate(() => window.myTracer.exports.generate())
    expect(exportResult).toMatchObject({ ok: true, value: { exportVersion: 2 } })
    const exported = JSON.parse(await readFile(destination, 'utf8'))
    expect(exported.data.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: '__ac02_suggestion_accept_original__' }),
        expect.objectContaining({ title: '__ac02_final_edited_action__' })
      ])
    )
    expect(exported.data.understandings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: '__ac02_understanding_understandings_1__',
          source: 'ai_candidate_confirmed'
        }),
        expect.objectContaining({
          text: '__ac02_final_understanding_2__',
          source: 'ai_candidate_confirmed'
        })
      ])
    )
    expect(JSON.stringify(exported)).not.toMatch(
      /__ac02_forbidden_credential__|__ac02_unsubmitted_edit__|__ac02_ack_|__ac02_suggestion_stale__|__ac02_timeout_retry__/
    )

    const beforeRestart = sqliteSnapshot(root)
    await application.close()
    application = undefined
    application = await launch(root)
    page = await application.firstWindow()
    expect(await page.evaluate(() => window.myTracer.aiStartHelp.status())).toEqual({
      state: 'idle',
      generation: 0
    })
    expect(sqliteSnapshot(root)).toEqual(beforeRestart)

    const beforeRecording = await page.evaluate(() => window.myTracer.progress.get({}))
    const beforeRecordingToday = await todayCommitments(page)
    if (!beforeRecording.ok) throw new Error('Progress query failed before confirmed Action record')
    const candidates = page.locator('details.action-candidates')
    if ((await candidates.getAttribute('open')) === null)
      await candidates.locator(':scope > summary').click()
    await page.getByRole('button', { name: /__ac02_final_edited_action__.*待行动/ }).click()
    const recordingPanel = page.getByLabel('__ac02_final_edited_action__ 行动记录')
    await recordingPanel.getByRole('button', { name: '开始记录' }).click()
    await recordingPanel.getByLabel('投入时长（分钟，必填）').fill('2')
    await recordingPanel.getByLabel('本次结果').selectOption('partial')
    await recordingPanel.getByRole('button', { name: '保存记录' }).click()
    await expect(recordingPanel).toContainText('记录已保存')
    const afterRecording = await page.evaluate(() => window.myTracer.progress.get({}))
    expect(afterRecording).toMatchObject({
      ok: true,
      value: {
        totalDurationMinutes: beforeRecording.value.totalDurationMinutes + 2,
        realActionCount: beforeRecording.value.realActionCount + 1,
        records: expect.arrayContaining([
          expect.objectContaining({
            actionTitle: '__ac02_final_edited_action__',
            durationMinutes: 2,
            outcome: 'partial'
          })
        ])
      }
    })
    expect(await todayCommitments(page)).toEqual(beforeRecordingToday)
    const confirmedActionFacts = sqliteSnapshot(root)
    await application.close()
    application = undefined
    application = await launch(root)
    page = await application.firstWindow()
    expect(await page.evaluate(() => window.myTracer.progress.get({}))).toEqual(afterRecording)
    expect(sqliteSnapshot(root)).toEqual(confirmedActionFacts)
  } finally {
    await application?.close().catch(() => undefined)
    await removeTemporaryTestRoot(root)
  }
})
