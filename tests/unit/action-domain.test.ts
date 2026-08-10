import { describe, expect, it } from 'vitest'
import {
  assertActionCanBeSelectedForToday,
  createAction,
  resolveCurrentNextActionId,
  restoreRescheduledActionForToday,
  transitionAction,
  updateActionDetails
} from '../../src/domain/action'

const now = '2026-08-09T08:00:00.000Z'

describe('Action domain', () => {
  it('creates a pending Action and updates details without changing identity, Goal, or state', () => {
    const action = createAction({
      id: 'action-1',
      goalId: 'goal-1',
      title: '  Run an example  ',
      description: '  First pass  ',
      now
    })
    expect(action).toMatchObject({
      id: 'action-1',
      goalId: 'goal-1',
      title: 'Run an example',
      description: 'First pass',
      status: 'pending'
    })
    expect(
      updateActionDetails(action, {
        title: 'Try the reducer example',
        description: ' ',
        now: '2026-08-09T09:00:00.000Z'
      })
    ).toMatchObject({
      id: 'action-1',
      goalId: 'goal-1',
      title: 'Try the reducer example',
      description: null,
      status: 'pending'
    })
  })

  it('allows only the approved lifecycle and never treats partial as an Action state', () => {
    const action = createAction({ id: 'action-1', title: 'Run an example', now })
    expect(transitionAction(action, 'complete', now).status).toBe('completed')
    expect(transitionAction(action, 'cancel', now).status).toBe('cancelled')
    const rescheduled = transitionAction(action, 'reschedule', now)
    expect(rescheduled.status).toBe('rescheduled')
    expect(restoreRescheduledActionForToday(rescheduled, now).status).toBe('pending')
    expect(() => transitionAction(rescheduled, 'complete', now)).toThrowError(
      expect.objectContaining({ code: 'invalid-transition' })
    )
    expect(['pending', 'completed', 'cancelled', 'rescheduled']).not.toContain('partial')
  })

  it('permits Today selection only for pending/rescheduled Actions with no Goal or an active Goal', () => {
    const action = createAction({ id: 'action-1', goalId: 'goal-1', title: 'Run', now })
    expect(() =>
      assertActionCanBeSelectedForToday(action, {
        id: 'goal-1',
        status: 'active',
        currentNextActionId: null
      })
    ).not.toThrow()
    expect(() =>
      assertActionCanBeSelectedForToday(action, {
        id: 'goal-1',
        status: 'paused',
        currentNextActionId: null
      })
    ).toThrowError(expect.objectContaining({ code: 'invalid-transition' }))
    expect(() =>
      assertActionCanBeSelectedForToday(transitionAction(action, 'complete', now), {
        id: 'goal-1',
        status: 'active',
        currentNextActionId: null
      })
    ).toThrowError(expect.objectContaining({ code: 'invalid-transition' }))
  })

  it('resolves a current next Action only to clear or another same-Goal pending Action', () => {
    const goal = { id: 'goal-1', status: 'active' as const, currentNextActionId: 'action-1' }
    const replacement = createAction({
      id: 'action-2',
      goalId: 'goal-1',
      title: 'Next',
      now
    })
    expect(
      resolveCurrentNextActionId({
        goal,
        transitionedActionId: 'action-1',
        replacement
      })
    ).toBe('action-2')
    expect(
      resolveCurrentNextActionId({
        goal: { ...goal, status: 'ended' },
        transitionedActionId: 'action-1',
        replacement: null
      })
    ).toBeNull()
    expect(() =>
      resolveCurrentNextActionId({
        goal: { ...goal, status: 'paused' },
        transitionedActionId: 'action-1',
        replacement
      })
    ).toThrowError(expect.objectContaining({ code: 'invalid-transition' }))
    expect(() =>
      resolveCurrentNextActionId({
        goal,
        transitionedActionId: 'action-1',
        replacement: { ...replacement, id: 'action-1' }
      })
    ).toThrowError(expect.objectContaining({ code: 'invariant-violation' }))
  })
})
