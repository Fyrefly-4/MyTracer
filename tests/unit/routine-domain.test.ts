import { describe, expect, it } from 'vitest'
import { createLocalDate } from '../../src/domain/local-date'
import {
  createRoutine,
  expandRoutineScheduleShortcut,
  isRoutinePlannedOn,
  normalizeRoutineWeekdays,
  replaceRoutineSchedule,
  RoutineDomainError,
  transitionRoutine,
  updateRoutineDetails
} from '../../src/domain/routine'

const now = '2026-08-14T08:00:00.000Z'

function activeRoutine() {
  return createRoutine({
    id: 'routine-1',
    goalId: null,
    name: ' Light activity ',
    description: ' Move gently ',
    minimumAction: ' Walk for five minutes ',
    weekdays: [5, 1, 3],
    now
  })
}

describe('Routine domain', () => {
  it('normalizes text and a non-empty ISO weekday set', () => {
    expect(activeRoutine()).toMatchObject({
      name: 'Light activity',
      description: 'Move gently',
      minimumAction: 'Walk for five minutes',
      status: 'active',
      weekdays: [1, 3, 5]
    })
    expect(normalizeRoutineWeekdays([7, 1])).toEqual([1, 7])
    for (const weekdays of [[], [0], [8], [1, 1], [1.5]] as const) {
      expect(() => normalizeRoutineWeekdays(weekdays)).toThrowError(RoutineDomainError)
    }
    expect(() =>
      createRoutine({
        id: 'routine-1',
        name: ' ',
        minimumAction: 'Move',
        weekdays: [1],
        now
      })
    ).toThrowError(expect.objectContaining({ code: 'validation' }))
  })

  it('uses daily and weekdays only as shortcuts for concrete weekday sets', () => {
    expect(expandRoutineScheduleShortcut('daily')).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(expandRoutineScheduleShortcut('weekdays')).toEqual([1, 2, 3, 4, 5])
  })

  it('supports the approved lifecycle and keeps ended terminal', () => {
    const routine = activeRoutine()
    const paused = transitionRoutine(routine, 'pause', now)
    expect(paused.status).toBe('paused')
    expect(transitionRoutine(paused, 'resume', now).status).toBe('active')
    expect(transitionRoutine(paused, 'end', now).status).toBe('ended')
    const ended = transitionRoutine(routine, 'end', now)
    for (const transition of ['pause', 'resume', 'end'] as const) {
      expect(() => transitionRoutine(ended, transition, now)).toThrowError(
        expect.objectContaining({ code: 'invalid-transition' })
      )
    }
  })

  it('updates details or the current schedule without changing identity', () => {
    const routine = activeRoutine()
    const details = updateRoutineDetails(routine, {
      name: 'Daily movement',
      description: ' ',
      minimumAction: 'Stretch once',
      now: '2026-08-14T09:00:00.000Z'
    })
    expect(details).toMatchObject({
      id: routine.id,
      goalId: routine.goalId,
      description: null,
      weekdays: routine.weekdays
    })
    const scheduled = replaceRoutineSchedule(details, [2, 4], '2026-08-14T10:00:00.000Z')
    expect(scheduled).toMatchObject({ id: routine.id, weekdays: [2, 4] })
  })

  it('matches LocalDate through ISO weekday without creating facts', () => {
    const routine = activeRoutine()
    expect(isRoutinePlannedOn(routine, createLocalDate('2026-08-14'))).toBe(true)
    expect(isRoutinePlannedOn(routine, createLocalDate('2026-08-15'))).toBe(false)
  })
})
