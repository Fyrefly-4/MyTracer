import { describe, expect, it } from 'vitest'
import {
  createRoutineRecord,
  projectRoutineRecordState,
  updateRoutineRecord
} from '../../src/domain/routine-record'

const base = {
  id: 'record-1',
  routineId: 'routine-1',
  occurredOn: '2026-08-10',
  plannedForDate: true,
  plannedForDateBasis: 'schedule_at_recording' as const,
  now: '2026-08-10T08:00:00.000Z'
}

describe('RoutineRecord domain', () => {
  it.each(['target_met', 'acted'] as const)(
    'preserves %s with nullable or zero duration',
    (outcome) => {
      expect(createRoutineRecord({ ...base, outcome }).durationMinutes).toBeNull()
      expect(createRoutineRecord({ ...base, outcome, durationMinutes: 0 }).durationMinutes).toBe(0)
    }
  )

  it.each(['intentional_rest', 'not_done'] as const)(
    'preserves %s and rejects duration',
    (outcome) => {
      expect(createRoutineRecord({ ...base, outcome }).outcome).toBe(outcome)
      expect(() => createRoutineRecord({ ...base, outcome, durationMinutes: 0 })).toThrowError(
        /cannot include duration/
      )
    }
  )

  it('projects a missing row as unknown without creating a record', () => {
    expect(projectRoutineRecordState(null)).toBe('unknown')
    expect(
      projectRoutineRecordState(createRoutineRecord({ ...base, outcome: 'intentional_rest' }))
    ).toBe('intentional_rest')
  })

  it('rejects unknown and invalid LocalDate as persisted inputs', () => {
    expect(() => createRoutineRecord({ ...base, outcome: 'unknown' as never })).toThrowError(
      /outcome is invalid/
    )
    expect(() =>
      createRoutineRecord({ ...base, occurredOn: '2026-02-30', outcome: 'acted' })
    ).toThrowError(/occurrence date is invalid/)
  })

  it('updates historical plan provenance while preserving identity and creation time', () => {
    const current = createRoutineRecord({ ...base, outcome: 'acted', durationMinutes: 1 })
    expect(updateRoutineRecord(current, {
      occurredOn: '2026-08-09', outcome: 'target_met', plannedForDate: false,
      plannedForDateBasis: 'user_confirmed_history', durationMinutes: 2,
      now: '2026-08-11T08:00:00.000Z'
    })).toMatchObject({
      id: 'record-1', routineId: 'routine-1', createdAt: base.now,
      plannedForDateBasis: 'user_confirmed_history', updatedAt: '2026-08-11T08:00:00.000Z'
    })
  })
})
