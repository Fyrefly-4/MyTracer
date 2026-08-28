import { describe, expect, it, vi } from 'vitest'
import { RecoveryApplicationError, RecoveryService } from '../../src/application/recovery'
import type { RecoveryRepositoryPort } from '../../src/application/ports/persistence'
import { FakeClock } from '../support/fake-clock'

const goalId = '11111111-1111-4111-8111-111111111111'
const goal = {
  id: goalId,
  title: 'Learn',
  description: null,
  status: 'active' as const,
  currentNextActionId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-08-20T00:00:00.000Z'
}
const clock = new FakeClock({
  instant: '2026-08-20T12:00:00.000+08:00',
  localDate: '2026-08-20',
  timeZone: 'Asia/Shanghai'
})

describe('Recovery application query', () => {
  it('takes one clock snapshot and one repository snapshot while reusing Progress facts', () => {
    const snapshot = vi.fn(() => ({
      goal,
      actions: [],
      progress: { actionRows: [], routineRecords: [] }
    }))
    const repository = { queryRecoverySnapshot: snapshot } as unknown as RecoveryRepositoryPort
    const clockSpy = vi.spyOn(clock, 'snapshot')
    const result = new RecoveryService({ repository, clock }).getContext({ goalId })
    expect(result).toMatchObject({ asOfLocalDate: '2026-08-20', lastRealActionOn: null })
    expect(snapshot).toHaveBeenCalledOnce()
    expect(snapshot).toHaveBeenCalledWith(goalId)
    expect(clockSpy).toHaveBeenCalledOnce()
  })

  it('returns not-found without using createdAt or updatedAt as action facts', () => {
    const repository = {
      queryRecoverySnapshot: () => ({
        goal: null,
        actions: [],
        progress: { actionRows: [], routineRecords: [] }
      })
    } as unknown as RecoveryRepositoryPort
    expect(() => new RecoveryService({ repository, clock }).getContext({ goalId })).toThrowError(
      expect.objectContaining<Partial<RecoveryApplicationError>>({ code: 'not-found' })
    )
  })
})
