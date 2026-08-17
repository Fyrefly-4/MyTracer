import { describe, expect, it } from 'vitest'
import {
  assertTodayCommitmentChange,
  assertTodaySelectionCanBeRemoved,
  decideTodaySelectionCreate
} from '../../src/domain/today-selection'

describe('TodaySelection domain', () => {
  it('creates an absent commitment and treats the same explicit selection as idempotent', () => {
    expect(decideTodaySelectionCreate(null, 'focus')).toBe('create')
    expect(decideTodaySelectionCreate(null, 'intention')).toBe('create')
    expect(decideTodaySelectionCreate('focus', 'focus')).toBe('already-selected')
    expect(decideTodaySelectionCreate('intention', 'intention')).toBe('already-selected')
  })

  it('reports a stable conflict instead of replacing a different commitment', () => {
    expect(() => decideTodaySelectionCreate('focus', 'intention')).toThrowError(
      expect.objectContaining({ code: 'selection-conflict' })
    )
    expect(() => decideTodaySelectionCreate('intention', 'focus')).toThrowError(
      expect.objectContaining({ code: 'selection-conflict' })
    )
    expect(() => assertTodaySelectionCanBeRemoved('focus', 'intention')).toThrowError(
      expect.objectContaining({ code: 'selection-conflict' })
    )
  })

  it('allows only an explicit change from an existing different commitment', () => {
    expect(() => assertTodayCommitmentChange('focus', 'intention')).not.toThrow()
    expect(() => assertTodayCommitmentChange('intention', 'focus')).not.toThrow()
    expect(() => assertTodayCommitmentChange(null, 'focus')).toThrowError(
      expect.objectContaining({ code: 'invariant-violation' })
    )
    expect(() => assertTodayCommitmentChange('focus', 'focus')).toThrowError(
      expect.objectContaining({ code: 'invariant-violation' })
    )
  })
})
