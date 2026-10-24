import { describe, expect, it } from 'vitest'
import {
  AiContextSelector,
  AiStartHelpContextError,
  type SelectAiContextInput
} from '../../src/application/ai-start-help-context'
import type {
  ActionPersistenceRecord,
  GoalPersistenceRecord,
  StartHelpActionRecordFactPersistence,
  StartHelpContextQuerySnapshotPersistence
} from '../../src/application/ports/persistence'

const goal: GoalPersistenceRecord = {
  id: 'goal-id',
  title: ' Goal name\r\n ',
  description: ' Goal description ',
  status: 'active',
  predecessorGoalId: '__private_previous_stage__',
  currentNextActionId: 'current-next-id',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: 'goal-version'
}
const action: ActionPersistenceRecord = {
  id: 'action-id',
  goalId: goal.id,
  title: ' Action title ',
  description: ' Action description ',
  status: 'pending',
  createdAt: '2026-08-02T00:00:00.000Z',
  updatedAt: 'action-version'
}
const currentNextAction: ActionPersistenceRecord = {
  id: 'current-next-id',
  goalId: goal.id,
  title: ' Current next ',
  description: ' Current description ',
  status: 'pending',
  createdAt: '2026-08-03T00:00:00.000Z',
  updatedAt: 'current-version'
}

function record(
  id: string,
  occurredOn: string,
  createdAt: string,
  text = 'allowlisted fact'
): StartHelpActionRecordFactPersistence {
  return {
    id,
    actionId: action.id,
    actionTitle: action.title,
    occurredOn,
    durationMinutes: 10,
    outcome: 'partial',
    nextStep: `next-${text}`,
    createdAt,
    understandings: [{ id: `understanding-${id}`, text: `understanding-${text}` }],
    confusions: [{ id: `confusion-${id}`, text: `confusion-${text}` }]
  }
}

function snapshot(
  overrides: Partial<StartHelpContextQuerySnapshotPersistence> = {}
): StartHelpContextQuerySnapshotPersistence {
  return {
    goal,
    action,
    todaySelection: {
      actionId: action.id,
      selectedFor: '2026-08-31',
      kind: 'focus',
      selectedBy: 'user',
      createdAt: '2026-08-31T00:00:00.000Z'
    },
    currentNextAction,
    records: [
      record('record-c', '2026-08-30', '2026-08-30T09:00:00.000Z'),
      record('record-b', '2026-08-31', '2026-08-31T08:00:00.000Z'),
      record('record-a', '2026-08-31', '2026-08-31T08:00:00.000Z'),
      record('record-d', '2026-08-29', '2026-08-29T08:00:00.000Z'),
      record('record-e', '2026-08-28', '2026-08-28T08:00:00.000Z'),
      record('record-f', '2026-08-27', '2026-08-27T08:00:00.000Z')
    ],
    ...overrides
  }
}

function input(overrides: Partial<SelectAiContextInput> = {}): SelectAiContextInput {
  return {
    requestId: 'request-id',
    locale: 'zh-CN',
    userInput: ' Current resistance\r\n ',
    expectedActionUpdatedAt: action.updatedAt,
    expectedGoalUpdatedAt: goal.updatedAt,
    snapshot: snapshot(),
    ...overrides
  }
}

describe('AiContextSelector', () => {
  it.each([null, 0, 12])(
    'keeps duration %s in existing minimal provider context',
    (durationMinutes) => {
      const fact = { ...record('r', '2026-08-31', '2026-08-31T08:00:00.000Z'), durationMinutes }
      const result = new AiContextSelector({ totalTextCharacters: 8_000 }).select(
        input({ snapshot: snapshot({ records: [fact] }) })
      )
      expect(result.requestDto.recentRelevantRecords[0]?.durationMinutes).toBe(durationMinutes)
    }
  )

  it('selects the allowlisted DTO, sorts deterministically, caps at five, and keeps IDs in the manifest only', () => {
    const result = new AiContextSelector({ totalTextCharacters: 8_000 }).select(input())

    expect(JSON.stringify(result.requestDto)).not.toContain('__private_previous_stage__')
    expect(result.requestDto.goal).not.toHaveProperty('predecessorGoalId')
    expect(result.requestDto).toMatchObject({
      requestId: 'request-id',
      locale: 'zh-CN',
      userInput: 'Current resistance',
      goal: { name: 'Goal name', description: 'Goal description' },
      action: { title: 'Action title', description: 'Action description' },
      currentNextAction: { title: 'Current next', description: 'Current description' }
    })
    expect(result.manifest.selectedRecordIds).toEqual([
      'record-a',
      'record-b',
      'record-c',
      'record-d',
      'record-e'
    ])
    expect(result.requestDto.recentRelevantRecords).toHaveLength(5)
    expect(result.manifest.excludedCounts).toEqual({
      otherGoals: 0,
      unrelatedRecords: 0,
      overFiveLimit: 1,
      overBudget: 0
    })
    expect(result.manifest.eligibleUnderstandingTargetRecordIds).toEqual(
      result.manifest.selectedRecordIds
    )
    expect(
      result.manifest.fieldEntries.reduce((total, entry) => total + entry.sentCharacters, 0)
    ).toBe(result.manifest.totalTextCharacters)
    expect(result.manifest.totalTextCharacters).toBeLessThanOrEqual(result.manifest.budget)
    expect(
      result.manifest.fieldEntries.find((entry) => entry.requestPath === 'locale')
    ).toMatchObject({ originalCharacters: 5, sentCharacters: 5, truncated: false })

    const serializedRequest = JSON.stringify(result.requestDto)
    for (const id of [
      goal.id,
      action.id,
      currentNextAction.id,
      ...result.manifest.selectedRecordIds
    ]) {
      expect(serializedRequest).not.toContain(id)
    }
    expect(serializedRequest).not.toContain('sourceId')
    expect(serializedRequest).not.toContain('manifest')
  })

  it('counts Unicode code points and truncates only the final included optional field', () => {
    const compactGoal = { ...goal, title: 'G', description: 'lower' }
    const compactAction = { ...action, title: 'A', description: 'lower' }
    const compactCurrent = { ...currentNextAction, title: '🙂XYZ', description: 'lower' }
    const result = new AiContextSelector({ totalTextCharacters: 7 }).select(
      input({
        locale: 'z',
        userInput: '🙂',
        expectedGoalUpdatedAt: compactGoal.updatedAt,
        expectedActionUpdatedAt: compactAction.updatedAt,
        snapshot: snapshot({
          goal: compactGoal,
          action: compactAction,
          currentNextAction: compactCurrent,
          records: []
        })
      })
    )

    expect(result.requestDto.currentNextAction).toEqual({ title: '🙂XY' })
    expect(result.requestDto.goal).toEqual({ name: 'G' })
    expect(result.requestDto.action).toEqual({ title: 'A' })
    expect(result.manifest.totalTextCharacters).toBe(7)
    expect(
      result.manifest.fieldEntries.find((entry) => entry.requestPath === 'currentNextAction.title')
    ).toMatchObject({ originalCharacters: 4, sentCharacters: 3, truncated: true })
    expect(
      result.manifest.fieldEntries.find((entry) => entry.requestPath === 'goal.description')
    ).toMatchObject({ sentCharacters: 0, exclusionReason: 'over-budget' })
  })

  it('excludes oldest records for budget after the five-record cap without substituting record six', () => {
    const minimalGoal = { ...goal, title: 'G', description: null, currentNextActionId: null }
    const minimalAction = { ...action, title: 'A', description: null }
    const records = snapshot().records.map((item) => ({
      ...item,
      understandings: [],
      confusions: [],
      nextStep: null
    }))
    const result = new AiContextSelector({ totalTextCharacters: 48 }).select(
      input({
        userInput: 'I',
        expectedGoalUpdatedAt: minimalGoal.updatedAt,
        expectedActionUpdatedAt: minimalAction.updatedAt,
        snapshot: snapshot({
          goal: minimalGoal,
          action: minimalAction,
          currentNextAction: null,
          records
        })
      })
    )

    expect(result.manifest.selectedRecordIds).toEqual([
      'record-a',
      'record-b',
      'record-c',
      'record-d'
    ])
    expect(result.manifest.selectedRecordIds).not.toContain('record-f')
    expect(result.manifest.excludedCounts).toMatchObject({ overBudget: 1, overFiveLimit: 1 })
  })

  it('rejects mandatory overflow without truncation', () => {
    expect(() =>
      new AiContextSelector({ totalTextCharacters: 2 }).select(
        input({
          userInput: 'I',
          snapshot: snapshot({
            goal: { ...goal, title: 'G' },
            action: { ...action, title: 'A' }
          })
        })
      )
    ).toThrowError(
      expect.objectContaining<Partial<AiStartHelpContextError>>({
        code: 'context-too-large'
      })
    )
  })

  const invalidContexts: ReadonlyArray<
    readonly [string, StartHelpContextQuerySnapshotPersistence, AiStartHelpContextError['code']]
  > = [
    ['missing Action', snapshot({ action: null }), 'not-found'],
    ['missing Goal', snapshot({ goal: null }), 'invalid-context'],
    ['not Today', snapshot({ todaySelection: null }), 'invalid-context'],
    [
      'terminal Action',
      snapshot({ action: { ...action, status: 'completed' } }),
      'invalid-context'
    ],
    ['paused Goal', snapshot({ goal: { ...goal, status: 'paused' } }), 'invalid-context'],
    ['invalid current next', snapshot({ currentNextAction: null }), 'invalid-context']
  ]

  it.each(invalidContexts)('rejects %s as a local error', (_name, context, code) => {
    expect(() =>
      new AiContextSelector({ totalTextCharacters: 8_000 }).select(input({ snapshot: context }))
    ).toThrowError(expect.objectContaining<Partial<AiStartHelpContextError>>({ code }))
  })

  it('rejects stale Action and Goal versions locally', () => {
    const selector = new AiContextSelector({ totalTextCharacters: 8_000 })
    expect(() => selector.select(input({ expectedActionUpdatedAt: 'stale' }))).toThrowError(
      expect.objectContaining<Partial<AiStartHelpContextError>>({ code: 'stale' })
    )
    expect(() => selector.select(input({ expectedGoalUpdatedAt: 'stale' }))).toThrowError(
      expect.objectContaining<Partial<AiStartHelpContextError>>({ code: 'stale' })
    )
  })

  it('does not duplicate the opened Action when it is already current next', () => {
    const sameGoal = { ...goal, currentNextActionId: action.id }
    const result = new AiContextSelector({ totalTextCharacters: 8_000 }).select(
      input({
        expectedGoalUpdatedAt: sameGoal.updatedAt,
        snapshot: snapshot({ goal: sameGoal, currentNextAction: null })
      })
    )
    expect(result.requestDto).not.toHaveProperty('currentNextAction')
    expect(result.manifest).not.toHaveProperty('currentNextActionId')
  })
})
