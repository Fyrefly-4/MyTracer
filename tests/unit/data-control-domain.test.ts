import { describe, expect, it } from 'vitest'
import {
  countDeleteImpact,
  fingerprintDeleteImpact,
  normalizeDeleteImpact,
  normalizeDeleteTarget
} from '../../src/domain/data-control'

describe('data-control domain', () => {
  it('creates a stable, sorted and duplicate-free impact fingerprint and matching counts', () => {
    const impact = normalizeDeleteImpact({
      target: { type: 'action', id: ' action-1 ' },
      goals: [],
      actions: ['b', 'a', 'a'],
      routines: [],
      routineScheduleDays: [],
      todaySelections: ['action-1|2026-08-19'],
      actionRecords: ['record-2', 'record-1'],
      routineRecords: [],
      understandings: [],
      confusions: [],
      reviewResults: [],
      detachedRoutines: [],
      detachedReviewResults: [],
      clearedCurrentNext: ['goal-1']
    })
    expect(impact.target.id).toBe('action-1')
    expect(impact.actions).toEqual(['a', 'b'])
    expect(countDeleteImpact(impact)).toMatchObject({ actions: 2, actionRecords: 2 })
    expect(fingerprintDeleteImpact(impact)).toBe(
      fingerprintDeleteImpact({ ...impact, actions: ['b', 'a'] })
    )
  })

  it('rejects blank ids and unsupported roots', () => {
    expect(() => normalizeDeleteTarget({ type: 'goal', id: ' ' })).toThrow()
    expect(() => normalizeDeleteTarget({ type: 'other' as never, id: 'id' })).toThrow()
  })
})
