import { describe, expect, it } from 'vitest'
import { UiSession } from '../../src/renderer/src/app/ui-session'
import {
  GOAL_COVER_KEY_PREFIX,
  goalCoverMark,
  validateGoalCoverMark,
  readGoalCoverMark,
  saveGoalCoverMark
} from '../../src/renderer/src/features/goals/goal-cover'

describe('Goal cover presentation', () => {
  it('uses current visible position, with custom cards still occupying their position', () => {
    expect(['', '', ''].map((mark, position) => goalCoverMark(position, mark))).toEqual([
      'I',
      'II',
      'III'
    ])
    expect(['R', '', ''].map((mark, position) => goalCoverMark(position, mark))).toEqual([
      'R',
      'II',
      'III'
    ])
    expect(['', 'R', ''].map((mark, position) => goalCoverMark(position, mark))).toEqual([
      'I',
      'R',
      'III'
    ])
    expect(goalCoverMark(2, '')).toBe('III')
  })
  it('validates graphemes without truncating Unicode or title-derived heuristics', () => {
    for (const mark of ['', '文', ' R ', 'UI', '👩🏽‍💻书', '🇨🇳', 'e\u0301']) {
      expect(validateGoalCoverMark(mark)).toEqual({ value: mark.trim(), valid: true })
    }
    for (const mark of ['ABC', '三字符', 'a b', 'a\nb', '\u202eR', '\ud800', '\u200d', '\u0301']) {
      expect(validateGoalCoverMark(mark).valid).toBe(false)
      expect(goalCoverMark(1, mark)).toBe('II')
    }
  })
  it('persists per goal and clearing restores ordinal without rewriting another goal', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value)
      },
      removeItem: (key: string) => {
        values.delete(key)
      }
    }
    expect(saveGoalCoverMark('a', 'R', () => storage)).toBe(true)
    expect(saveGoalCoverMark('b', '文', () => storage)).toBe(true)
    expect(readGoalCoverMark('a', () => storage)).toBe('R')
    expect(saveGoalCoverMark('a', 'long', () => storage)).toBe(false)
    expect(readGoalCoverMark('a', () => storage)).toBe('R')
    expect(saveGoalCoverMark('a', '', () => storage)).toBe(true)
    expect(values.has(`${GOAL_COVER_KEY_PREFIX}a`)).toBe(false)
    expect(
      goalCoverMark(
        1,
        readGoalCoverMark('a', () => storage)
      )
    ).toBe('II')
    expect(readGoalCoverMark('b', () => storage)).toBe('文')
    values.set(`${GOAL_COVER_KEY_PREFIX}a`, 'invalid')
    expect(readGoalCoverMark('a', () => storage)).toBe('')
  })
  it('degrades safely when storage getters, reads or writes are unavailable', () => {
    const blocked = (): never => {
      throw new Error('unavailable')
    }
    expect(readGoalCoverMark('a', blocked)).toBe('')
    expect(readGoalCoverMark('a', () => ({ getItem: blocked }))).toBe('')
    expect(saveGoalCoverMark('a', 'R', blocked)).toBe(false)
    expect(saveGoalCoverMark('a', '', () => ({ setItem: blocked, removeItem: blocked }))).toBe(
      false
    )
  })
  it('retains cosmetic drafts and guards updates until saved or cancelled', () => {
    const session = new UiSession(() => undefined)
    session.setGoalCoverDraft('a', '')
    session.setGoalCoverDraft('b', '文')
    session.selectGoal('b')
    expect(session.getGoalCoverDraft('a')).toBe('')
    expect(session.hasUnsavedContent()).toBe(true)
    session.clearGoalCoverDraft('a')
    expect(session.hasUnsavedContent()).toBe(true)
    session.clearGoalCoverDraft('b')
    expect(session.hasUnsavedContent()).toBe(false)
  })
})
