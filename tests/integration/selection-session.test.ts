import { afterEach, expect, it, vi } from 'vitest'
import { UiSession } from '../../src/renderer/src/app/ui-session'
afterEach(() => vi.unstubAllGlobals())

it('limits data-page leave protection to data drafts while preserving global protection', () => {
  const session = new UiSession(vi.fn())
  session.setGoalCoverDraft('goal', '新')
  session.setUnsavedContent('goal-next-action-goal', true)
  expect(session.hasActiveUnsavedContent()).toBe(true)
  expect(session.hasUnsavedContent()).toBe(true)
  expect(session.hasDataUnsavedContent()).toBe(false)

  const sources = [
    'data-backfill',
    'data-action-record-edit-action',
    'data-routine-record-edit-routine',
    'data-understanding-edit-understanding',
    'data-confusion-edit-confusion'
  ]
  for (const source of sources) {
    session.setUnsavedContent(source, true)
    expect(session.hasDataUnsavedContent()).toBe(true)
    session.setUnsavedContent(source, false)
    expect(session.hasDataUnsavedContent()).toBe(false)
  }
  session.setUnsavedContent(sources[0], true)
  session.setUnsavedContent(sources[1], true)
  session.setUnsavedContent(sources[0], false)
  expect(session.hasDataUnsavedContent()).toBe(true)
  session.setUnsavedContent(sources[1], false)
  expect(session.hasDataUnsavedContent()).toBe(false)
  expect(session.getGoalCoverDraft('goal')).toBe('新')
  expect(session.hasUnsavedContent()).toBe(true)
})

it('integrates page preferences, one-shot explicit routes and reactive draft protection', () => {
  let saved: string | null = null
  vi.stubGlobal('window', {
    localStorage: {
      getItem: () => saved,
      setItem: (_: string, value: string) => {
        saved = value
      }
    }
  })
  vi.stubGlobal('document', { querySelector: () => null })
  const navigate = vi.fn()
  const session = new UiSession(navigate)
  session.selectGoal('remembered')
  session.selectTodayRoutine('routine')
  session.selectDataRecord({ type: 'action-record', id: 'record' })
  session.selectGoal(null)
  const restarted = new UiSession(navigate)
  expect(restarted.goalId).toBe('remembered')
  expect(restarted.todaySelection).toEqual({ type: 'routine', id: 'routine' })
  expect(restarted.dataRecord?.id).toBe('record')
  expect(restarted.takeNavigationSelection('goals')).toBe(false)
  restarted.openGoal('explicit')
  expect(navigate).toHaveBeenCalledWith('goals')
  expect(restarted.goalId).toBe('explicit')
  expect(restarted.takeNavigationSelection('goals')).toBe(true)
  expect(restarted.takeNavigationSelection('goals')).toBe(false)
  const listener = vi.fn()
  const unsubscribe = restarted.subscribeUnsaved(listener)
  restarted.setUnsavedContent('goal-next-action-explicit', true)
  expect(restarted.hasActiveUnsavedContent()).toBe(true)
  restarted.setUnsavedContent('goal-next-action-explicit', false)
  expect(restarted.hasActiveUnsavedContent()).toBe(false)
  expect(listener).toHaveBeenCalledTimes(2)
  restarted.setGoalCoverDraft('explicit', '')
  expect(restarted.hasActiveUnsavedContent()).toBe(true)
  expect(listener).toHaveBeenCalledTimes(3)
  restarted.setGoalCoverDraft('explicit', 'A')
  expect(listener).toHaveBeenCalledTimes(3)
  restarted.clearGoalCoverDraft('explicit')
  expect(restarted.hasActiveUnsavedContent()).toBe(false)
  expect(listener).toHaveBeenCalledTimes(4)
  unsubscribe()
  restarted.openAction('action', 'home')
  expect(restarted.takeNavigationSelection('today')).toBe(true)
  restarted.openDataRecord({ type: 'routine-record', id: 'record2' }, 'home')
  expect(restarted.takeNavigationSelection('data')).toBe(true)
})
