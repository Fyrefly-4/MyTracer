import { describe, expect, it } from 'vitest'
import {
  createGoal,
  GoalDomainError,
  setGoalCurrentNextAction,
  transitionGoal,
  updateGoalDetails
} from '../../src/domain/goal'

const now = '2026-08-09T08:00:00.000Z'

function activeGoal() {
  return createGoal({ id: 'goal-1', name: ' System learning ', description: ' React ', now })
}

describe('Goal domain', () => {
  it('creates an active Goal and updates text without changing identity', () => {
    const goal = activeGoal()
    expect(goal).toMatchObject({
      id: 'goal-1',
      name: 'System learning',
      description: 'React',
      status: 'active',
      currentNextActionId: null
    })

    const updated = updateGoalDetails(goal, {
      name: 'Systematically learn React',
      description: ' ',
      now: '2026-08-09T09:00:00.000Z'
    })
    expect(updated).toMatchObject({
      id: goal.id,
      name: 'Systematically learn React',
      description: null,
      createdAt: goal.createdAt,
      updatedAt: '2026-08-09T09:00:00.000Z'
    })
    expect(() => updateGoalDetails(goal, { name: ' ', now })).toThrowError(GoalDomainError)
  })

  it('supports only the approved lifecycle and keeps ended terminal', () => {
    const goal = activeGoal()
    const paused = transitionGoal(goal, 'pause', now)
    expect(paused.status).toBe('paused')
    expect(transitionGoal(paused, 'resume', now).status).toBe('active')
    expect(transitionGoal(paused, 'end', now).status).toBe('ended')
    const ended = transitionGoal(goal, 'end', now)

    for (const transition of ['pause', 'resume', 'end'] as const) {
      expect(() => transitionGoal(ended, transition, now)).toThrowError(
        expect.objectContaining({ code: 'invalid-transition' })
      )
    }
    expect(() => transitionGoal(goal, 'resume', now)).toThrowError(
      expect.objectContaining({ code: 'invalid-transition' })
    )
  })

  it('allows only an active Goal to reference a same-Goal pending Action', () => {
    const goal = activeGoal()
    const action = { id: 'action-1', goalId: goal.id, status: 'pending' as const }
    const withCurrent = setGoalCurrentNextAction(goal, action, now)
    expect(withCurrent.currentNextActionId).toBe(action.id)
    expect(setGoalCurrentNextAction(withCurrent, null, now).currentNextActionId).toBeNull()

    expect(() => setGoalCurrentNextAction(goal, { ...action, goalId: 'goal-2' }, now)).toThrowError(
      expect.objectContaining({ code: 'invariant-violation' })
    )
    expect(() =>
      setGoalCurrentNextAction(goal, { ...action, status: 'completed' }, now)
    ).toThrowError(expect.objectContaining({ code: 'invariant-violation' }))

    const paused = transitionGoal(withCurrent, 'pause', now)
    expect(paused.currentNextActionId).toBe(action.id)
    expect(() => setGoalCurrentNextAction(paused, null, now)).toThrowError(
      expect.objectContaining({ code: 'invalid-transition' })
    )
  })
})
