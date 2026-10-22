import { afterEach, expect, it, vi } from 'vitest'
import { UiSession } from '../../src/renderer/src/app/ui-session'
afterEach(() => vi.unstubAllGlobals())
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
  unsubscribe()
  restarted.openAction('action', 'home')
  expect(restarted.takeNavigationSelection('today')).toBe(true)
  restarted.openDataRecord({ type: 'routine-record', id: 'record2' }, 'home')
  expect(restarted.takeNavigationSelection('data')).toBe(true)
})
