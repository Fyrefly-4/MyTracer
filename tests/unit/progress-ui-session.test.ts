import { describe, expect, it } from 'vitest'
import { UiSession } from '../../src/renderer/src/app/ui-session'

describe('progress reading position', () => {
  it('keeps page state inside each UI session, independent of filters and other sessions', () => {
    const session = new UiSession(() => undefined)
    const other = new UiSession(() => undefined)
    session.setProgressRecordPage(3)
    session.applyProgressFilter({ goalId: 'goal', from: '2026-08-01', through: '' })
    expect(session.progressRecordPage).toBe(3)
    expect(other.progressRecordPage).toBe(1)
    session.setProgressRecordPage(0)
    expect(session.progressRecordPage).toBe(1)
  })
})

describe('independent notebook reading positions', () => {
  it('keeps pane positions separate from one another, pages, and other app sessions', () => {
    const session = new UiSession(() => undefined)
    const other = new UiSession(() => undefined)
    session.setPanePosition('today', 'master', 180)
    session.setPanePosition('today', 'detail', 420)
    session.setPanePosition('goals', 'master', 75)
    expect(session.getPanePosition('today', 'master')).toBe(180)
    expect(session.getPanePosition('today', 'detail')).toBe(420)
    expect(session.getPanePosition('goals', 'master')).toBe(75)
    expect(session.getPanePosition('goals', 'detail')).toBe(0)
    expect(other.getPanePosition('today', 'master')).toBe(0)
    session.setPosition('review', 230)
    expect(session.getPosition('review')).toBe(230)
    expect(session.getPanePosition('today', 'master')).toBe(180)
  })
})

describe('notebook list pages', () => {
  it('retains separate master and per-object history pages without leaking between sessions', () => {
    const session = new UiSession(() => undefined)
    session.setListPage('goals', 'master', 2)
    session.setListPage('goals', 'history:goal-a', 3)
    session.setListPage('routines', 'master', 4)
    expect(session.getListPage('goals', 'master')).toBe(2)
    expect(session.getListPage('goals', 'history:goal-a')).toBe(3)
    expect(session.getListPage('goals', 'history:goal-b')).toBe(1)
    expect(session.getListPage('routines', 'master')).toBe(4)
    expect(new UiSession(() => undefined).getListPage('goals', 'master')).toBe(1)
    session.setListPage('goals', 'master', 0)
    expect(session.getListPage('goals', 'master')).toBe(1)
    session.setListPage('goals', 'master', Number.NaN)
    expect(session.getListPage('goals', 'master')).toBe(1)
  })
})
