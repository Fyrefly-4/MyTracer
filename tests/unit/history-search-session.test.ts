import { afterEach, expect, it, vi } from 'vitest'
import { UiSession } from '../../src/renderer/src/app/ui-session'

afterEach(() => vi.unstubAllGlobals())

it('retains Data search context in this session and resets restrictions for an explicit source link', () => {
  vi.stubGlobal('document', { querySelector: () => ({ scrollTop: 120 }) })
  const navigate = vi.fn()
  const session = new UiSession(navigate)
  const context = {
    query: '  靠窗  ',
    kind: 'action-record' as const,
    goalId: 'g',
    date: '2026-08-01',
    page: 3
  }
  session.setDataHistory(context)
  session.selectDataRecord({ type: 'action-record', id: 'old' })
  session.setPanePosition('data', 'master', 150)
  expect(session.dataHistory).toEqual(context)
  expect(new UiSession(() => undefined).dataHistory.query).toBe('')
  session.openDataRecord({ type: 'routine-record', id: 'explicit' }, 'home')
  expect(session.dataHistory).toEqual({ query: '', kind: 'all', goalId: 'all', date: '', page: 1 })
  expect(session.dataRecord).toEqual({ type: 'routine-record', id: 'explicit' })
  expect(session.takeNavigationSelection('data')).toBe(true)
  expect(navigate).toHaveBeenCalledWith('data')
  expect(session.getPosition('home')).toBe(120)
})
