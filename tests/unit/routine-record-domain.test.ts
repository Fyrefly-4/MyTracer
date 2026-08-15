import { describe, expect, it } from 'vitest'
import { createRoutineRecord, projectRoutineRecordState } from '../../src/domain/routine-record'

const base = {
  id: 'record-1',
  routineId: 'routine-1',
  occurredOn: '2026-08-10',
  plannedForDate: true,
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
})
