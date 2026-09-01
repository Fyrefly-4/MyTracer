import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ActionRecordService } from '../../src/application/action-records'
import { GoalService } from '../../src/application/goals'
import { TodayService } from '../../src/application/today'
import { asStartHelpContextQueryRepository } from '../../src/application/ports/persistence'
import { SqliteConnection } from '../../src/infrastructure/sqlite/sqlite-connection'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore Main is compiled by the node project; this integration test exercises the exact coordinator.
import { AiStartHelpContextCoordinator } from '../../src/main/ai-start-help-context'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore Main is compiled by the node project; this integration test exercises the exact store.
import { AiStartHelpSessionStore } from '../../src/main/ai-start-help-session'
import { FakeClock } from '../support/fake-clock'
import {
  createTemporaryTestRoot,
  removeTemporaryTestRoot,
  type TemporaryTestRoot
} from '../support/temporary-test-root'

const roots: TemporaryTestRoot[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => removeTemporaryTestRoot(root)))
})

async function waitForDraft(store: AiStartHelpSessionStore, senderId: number) {
  for (let index = 0; index < 20; index += 1) {
    const value = store.status(senderId)
    if (value.state === 'draft-ready') return value
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  throw new Error('DraftReady was not reached.')
}

describe('T063 Start Help confirmation with real SQLite commands', () => {
  it('keeps unconfirmed paths equal and persists only atomic explicit confirmations', async () => {
    const root = await createTemporaryTestRoot()
    roots.push(root)
    const connection = SqliteConnection.open(join(root.database, 't063-confirmation.sqlite3'))
    const clock = new FakeClock({
      instant: '2026-09-01T08:00:00.000Z',
      localDate: '2026-09-01',
      timeZone: 'Asia/Shanghai'
    })
    const goals = new GoalService({
      repository: connection.repository,
      unitOfWork: connection,
      clock,
      generateId: () => crypto.randomUUID()
    })
    const records = new ActionRecordService({
      repository: connection.repository,
      unitOfWork: connection,
      clock,
      generateId: () => crypto.randomUUID()
    })
    const today = new TodayService({
      repository: connection.repository,
      unitOfWork: connection,
      clock
    })
    const goal = goals.createGoal({
      name: 'T063 Goal',
      initialNextAction: { title: 'T063 opened Action' }
    })
    const openedActionId = goal.currentNextActionId!
    today.selectActionForToday(openedActionId)
    const savedRecord = records.recordAction({
      actionId: openedActionId,
      capturedOn: '2026-09-01',
      durationMinutes: 3,
      outcome: 'partial'
    })
    if (savedRecord.kind !== 'saved') throw new Error('record setup failed')

    const coordinator = new AiStartHelpContextCoordinator({
      contextQuery: asStartHelpContextQueryRepository(connection.repository),
      clock,
      contextBudget: { totalTextCharacters: 8_000 },
      requestCapture: { captureStartHelpRequest: () => undefined },
      generateRequestId: () => crypto.randomUUID()
    })
    const store = new AiStartHelpSessionStore({
      selectContext: (input) => coordinator.start(input),
      readConfiguration: () => ({
        configured: true,
        availability: 'configured-available',
        credentialProtection: 'available'
      }),
      execute: async (request) => ({
        ok: true,
        draft: {
          requestId: request.requestId,
          acknowledgement: 'A validated draft',
          suggestions: [{ candidateId: `action-${request.requestId}`, text: 'Small next step' }],
          understandingCandidates: [
            { candidateId: `understanding-${request.requestId}`, text: 'A candidate fact' }
          ]
        }
      }),
      confirmSuggestion: (command) => {
        goals.createAndSetGoalCurrentNextAction({
          goalId: command.goalId,
          title: command.finalText,
          expectedCurrentNextActionId: command.expectedCurrentNextActionId,
          expectedGoalUpdatedAt: command.expectedGoalUpdatedAt,
          expectedContextActionId: command.contextActionId,
          expectedContextActionUpdatedAt: command.expectedActionUpdatedAt
        })
      },
      confirmUnderstanding: (command) => {
        records.addConfirmedUnderstandingToActionRecord({
          actionRecordId: command.actionRecordId,
          expectedGoalId: command.expectedGoalId,
          text: command.finalText
        })
      },
      generateSessionId: () => crypto.randomUUID(),
      generateTargetRef: () => crypto.randomUUID()
    })
    const startInput = {
      actionId: openedActionId,
      locale: 'zh-CN',
      userInput: '卡住了',
      expectedActionUpdatedAt: connection.repository.findActionById(openedActionId)!.updatedAt
    }

    const beforeTemporaryPaths = connection.repository.readSnapshot()
    const rejectedStart = store.start(1, startInput)
    await waitForDraft(store, 1)
    store.reject(1, rejectedStart.sessionId!)
    expect(connection.repository.readSnapshot()).toEqual(beforeTemporaryPaths)
    const closedStart = store.start(1, startInput)
    await waitForDraft(store, 1)
    store.close(1, closedStart.sessionId!)
    expect(connection.repository.readSnapshot()).toEqual(beforeTemporaryPaths)

    const confirmationStart = store.start(1, startInput)
    const ready = await waitForDraft(store, 1)
    const actionCandidateId = ready.draft!.suggestions[0]!.candidateId
    const understandingCandidateId = ready.draft!.understandingCandidates![0]!.candidateId
    const targetRef = ready.draft!.understandingTargets![0]!.targetRef

    const beforeInvalidTarget = connection.repository.readSnapshot()
    store.confirmUnderstanding(1, {
      sessionId: confirmationStart.sessionId!,
      candidateId: understandingCandidateId,
      targetRef: 'forged-target',
      finalText: 'Must not persist'
    })
    expect(connection.repository.readSnapshot()).toEqual(beforeInvalidTarget)

    store.confirmUnderstanding(1, {
      sessionId: confirmationStart.sessionId!,
      candidateId: understandingCandidateId,
      targetRef,
      finalText: '  Final confirmed understanding  '
    })
    const afterUnderstanding = connection.repository.readSnapshot()
    expect(afterUnderstanding.understandings).toEqual([
      expect.objectContaining({
        actionRecordId: savedRecord.record.id,
        text: 'Final confirmed understanding',
        source: 'ai_candidate_confirmed'
      })
    ])
    expect(afterUnderstanding.actionRecords).toEqual(beforeInvalidTarget.actionRecords)

    store.confirmSuggestion(1, {
      sessionId: confirmationStart.sessionId!,
      candidateId: actionCandidateId,
      finalText: '  Final confirmed Action  '
    })
    const afterAction = connection.repository.readSnapshot()
    expect(afterAction.actions).toHaveLength(beforeInvalidTarget.actions.length + 1)
    expect(afterAction.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          goalId: goal.id,
          title: 'Final confirmed Action',
          status: 'pending'
        })
      ])
    )
    expect(afterAction.todaySelections).toEqual(beforeInvalidTarget.todaySelections)
    expect(afterAction.actionRecords).toEqual(beforeInvalidTarget.actionRecords)
    expect(afterAction.confusions).toEqual(beforeInvalidTarget.confusions)
    expect(store.status(1).state).toBe('confirmed')
    connection.close()
  })

  it('returns stale-context and an equal snapshot when the Goal changes before confirmation', async () => {
    const root = await createTemporaryTestRoot()
    roots.push(root)
    const connection = SqliteConnection.open(join(root.database, 't063-stale.sqlite3'))
    const clock = new FakeClock({
      instant: '2026-09-01T08:00:00.000Z',
      localDate: '2026-09-01',
      timeZone: 'Asia/Shanghai'
    })
    const goals = new GoalService({
      repository: connection.repository,
      unitOfWork: connection,
      clock,
      generateId: () => crypto.randomUUID()
    })
    const goal = goals.createGoal({
      name: 'Stale Goal',
      initialNextAction: { title: 'Opened Action' }
    })
    const openedActionId = goal.currentNextActionId!
    new TodayService({
      repository: connection.repository,
      unitOfWork: connection,
      clock
    }).selectActionForToday(openedActionId)
    const coordinator = new AiStartHelpContextCoordinator({
      contextQuery: asStartHelpContextQueryRepository(connection.repository),
      clock,
      contextBudget: { totalTextCharacters: 8_000 },
      requestCapture: { captureStartHelpRequest: () => undefined },
      generateRequestId: () => crypto.randomUUID()
    })
    const store = new AiStartHelpSessionStore({
      selectContext: (input) => coordinator.start(input),
      readConfiguration: () => ({
        configured: true,
        availability: 'configured-available',
        credentialProtection: 'available'
      }),
      execute: async (request) => ({
        ok: true,
        draft: {
          requestId: request.requestId,
          acknowledgement: 'A validated draft',
          suggestions: [{ candidateId: 'candidate-1', text: 'Small next step' }]
        }
      }),
      confirmSuggestion: (command) => {
        goals.createAndSetGoalCurrentNextAction({
          goalId: command.goalId,
          title: command.finalText,
          expectedCurrentNextActionId: command.expectedCurrentNextActionId,
          expectedGoalUpdatedAt: command.expectedGoalUpdatedAt,
          expectedContextActionId: command.contextActionId,
          expectedContextActionUpdatedAt: command.expectedActionUpdatedAt
        })
      },
      confirmUnderstanding: () => undefined,
      generateSessionId: () => crypto.randomUUID(),
      generateTargetRef: () => crypto.randomUUID()
    })
    const started = store.start(2, {
      actionId: openedActionId,
      locale: 'zh-CN',
      userInput: '卡住了'
    })
    await waitForDraft(store, 2)
    clock.setState({
      instant: '2026-09-01T08:01:00.000Z',
      localDate: '2026-09-01',
      timeZone: 'Asia/Shanghai'
    })
    goals.updateGoalDetails({ goalId: goal.id, name: 'Changed Goal' })
    const beforeConfirm = connection.repository.readSnapshot()

    const result = store.confirmSuggestion(2, {
      sessionId: started.sessionId!,
      candidateId: 'candidate-1',
      finalText: 'Must not persist'
    })

    expect(result).toMatchObject({
      state: 'draft-ready',
      error: { code: 'stale-context' },
      draft: { suggestions: [{ status: 'failed' }] }
    })
    expect(connection.repository.readSnapshot()).toEqual(beforeConfirm)
    connection.close()
  })
})
