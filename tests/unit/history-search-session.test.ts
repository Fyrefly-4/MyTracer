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

it('returns from a book original visit to the complete source context without persisting the book', () => {
  const session = new UiSession(() => undefined)
  const history = {
    query: '合成关键词',
    kind: 'action-record' as const,
    goalId: 'g',
    date: '2025-12-31',
    page: 3
  }
  session.setDataHistory(history)
  session.selectDataRecord({ type: 'action-record', id: 'source' })
  session.setPosition('data', 200)
  session.setPanePosition('data', 'master', 400)
  session.setPanePosition('data', 'detail', 600)
  session.setBookMonth('2025-12')
  session.setBookPosition('2025-12', 800)
  const restore = session.visitBookOriginal({ type: 'routine-record', id: 'visited' })
  expect(session.takeNavigationSelection('data')).toBe(true)
  expect(session.dataHistory.query).toBe('')
  expect(session.dataRecord?.id).toBe('visited')
  expect(session.getPanePosition('data', 'master')).toBe(0)
  session.setPanePosition('data', 'detail', 999)
  restore()
  expect(session.dataHistory).toEqual(history)
  expect(session.dataRecord?.id).toBe('source')
  expect(session.getPosition('data')).toBe(200)
  expect(session.getPanePosition('data', 'master')).toBe(400)
  expect(session.getPanePosition('data', 'detail')).toBe(600)
  expect(session.bookReading.month).toBe('2025-12')
  expect(session.bookReading.positions.get('2025-12')).toBe(800)
  expect(new UiSession(() => undefined).bookReading.month).toBeNull()
})
