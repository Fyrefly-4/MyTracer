import { afterEach, describe, expect, it, vi } from 'vitest'
import { UiSession } from '../../src/renderer/src/app/ui-session'

afterEach(() => vi.unstubAllGlobals())

describe('goal search reading context', () => {
  it('retains the exact query through a record visit without changing selection or filters', () => {
    vi.stubGlobal('document', { querySelector: () => ({ scrollTop: 120 }) })
    const navigate = vi.fn()
    const session = new UiSession(navigate)
    session.selectGoal('outside-first-page')
    session.setGoalFilter('active')
    session.setGoalSearchQuery('  合成关键词  ')
    session.setListPage('goals', 'master', 2)
    session.openDataRecord({ type: 'action-record', id: 'record' }, 'goals')
    expect(navigate).toHaveBeenCalledWith('data')
    expect(session.goalSearchQuery).toBe('  合成关键词  ')
    expect(session.goalId).toBe('outside-first-page')
    expect(session.goalFilter).toBe('active')
    expect(session.getListPage('goals', 'master')).toBe(2)
    expect(session.getPosition('goals')).toBe(120)
    expect(new UiSession(() => undefined).goalSearchQuery).toBe('')
  })

  it('clears the query for an explicit goal destination while preserving that destination', () => {
    vi.stubGlobal('document', { querySelector: () => null })
    const navigate = vi.fn()
    const session = new UiSession(navigate)
    session.setGoalSearchQuery('没有匹配')
    session.openGoal('explicit-goal')
    expect(session.goalSearchQuery).toBe('')
    expect(session.goalId).toBe('explicit-goal')
    expect(session.takeNavigationSelection('goals')).toBe(true)
    expect(navigate).toHaveBeenCalledWith('goals')
  })
})
