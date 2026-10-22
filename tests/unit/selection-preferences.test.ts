import { describe, expect, it } from 'vitest'
import {
  chooseVisibleSelection,
  SelectionPreferences
} from '../../src/renderer/src/app/selection-preferences'

describe('viewed selection preferences', () => {
  it('restores valid page-specific identifiers across restart without storing business data', () => {
    let value: string | null = null
    const storage = {
      getItem: () => value,
      setItem: (_: string, next: string) => {
        value = next
      }
    }
    const first = new SelectionPreferences(storage)
    first.remember('goals', { type: 'goal', id: 'g1' })
    first.remember('today', { type: 'routine', id: 'r1' })
    first.remember('data', { type: 'action-record', id: 'record1' })
    const restarted = new SelectionPreferences(storage)
    expect(restarted.get('goals')).toEqual({ type: 'goal', id: 'g1' })
    expect(restarted.get('today')).toEqual({ type: 'routine', id: 'r1' })
    expect(restarted.get('data')).toEqual({ type: 'action-record', id: 'record1' })
    expect(Object.keys(JSON.parse(value!))).toEqual(['goals', 'today', 'data'])
  })
  it.each([
    'not json',
    'null',
    '[]',
    '{"goals":{"type":"action","id":"x"},"today":{"type":"routine","id":" "},"data":{"type":"action-record","id":12}}'
  ])('ignores malformed storage %s', (value) => {
    const preferences = new SelectionPreferences({ getItem: () => value, setItem: () => undefined })
    expect(preferences.get('goals')).toBeNull()
    expect(preferences.get('today')).toBeNull()
    expect(preferences.get('data')).toBeNull()
  })
  it('retains session memory when storage is unavailable', () => {
    const preferences = new SelectionPreferences({
      getItem: () => {
        throw Error('blocked')
      },
      setItem: () => {
        throw Error('quota')
      }
    })
    preferences.remember('goals', { type: 'goal', id: 'g1' })
    expect(preferences.get('goals')?.id).toBe('g1')
  })
  it('resolves only visible results after deletion, filtering and pagination; empty results preserve preference', () => {
    const preferences = new SelectionPreferences()
    preferences.remember('goals', { type: 'goal', id: 'b' })
    const choose = (ids: string[]) =>
      chooseVisibleSelection(ids, preferences.get('goals')?.id ?? null, (id) => id)
    expect(choose(['a', 'b'])).toBe('b')
    expect(choose(['a', 'c'])).toBe('a')
    expect(choose(['d', 'e'])).toBe('d')
    expect(choose([])).toBeNull()
    expect(preferences.get('goals')?.id).toBe('b')
    expect(choose(['b', 'c'])).toBe('b')
  })
})
