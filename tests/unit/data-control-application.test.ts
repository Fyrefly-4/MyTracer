import { describe, expect, it, vi } from 'vitest'
import { DataControlService } from '../../src/application/data-control'
import type { RepositoryPort, UnitOfWorkPort } from '../../src/application/ports/persistence'
import type { DeleteImpact } from '../../src/domain/data-control'
import { FakeClock } from '../support/fake-clock'

function setup() {
  const currentRoutineRecord = {
    id: 'routine-record-1',
    routineId: 'routine-1',
    occurredOn: '2026-08-18',
    outcome: 'acted' as const,
    plannedForDate: false,
    plannedForDateBasis: 'schedule_at_recording' as const,
    durationMinutes: 2,
    note: null,
    createdAt: 'created',
    updatedAt: 'created'
  }
  const repository = {
    createTodaySelection: vi.fn(),
    findTodaySelection: vi.fn(),
    listActions: vi.fn(() => []),
    listTodaySelectionsOn: vi.fn(() => []),
    deleteTodaySelection: vi.fn(),
    deleteTodaySelectionByKind: vi.fn(),
    updateTodaySelectionCommitment: vi.fn(),
    findActionRecordById: vi.fn(() => null),
    listActionRecordsByActionId: vi.fn(() => []),
    listUnderstandingsByActionRecordId: vi.fn(() => []),
    listConfusionsByActionRecordId: vi.fn(() => []),
    createRoutineRecord: vi.fn(() => true),
    findRoutineRecordByRoutineAndDate: vi.fn(() => currentRoutineRecord),
    listRoutineRecordsByRoutineId: vi.fn(() => []),
    findRoutineById: vi.fn(),
    listRoutines: vi.fn(() => []),
    listRoutineScheduleDays: vi.fn(() => []),
    replaceRoutineScheduleDays: vi.fn(),
    createActionRecord: vi.fn(() => true),
    updateActionRecord: vi.fn(() => true),
    findUnderstandingById: vi.fn(),
    updateUnderstanding: vi.fn(() => true),
    findConfusionById: vi.fn(),
    updateConfusion: vi.fn(() => true),
    updateRoutineRecord: vi.fn(() => true),
    findRoutineRecordById: vi.fn(() => currentRoutineRecord),
    findDeleteImpact: vi.fn((): DeleteImpact | null => null),
    deleteRoot: vi.fn(() => true),
    readSnapshot: vi.fn(() => ({
      goals: [],
      actions: [],
      routines: [],
      routineScheduleDays: [],
      todaySelections: [],
      actionRecords: [],
      routineRecords: [],
      understandings: [],
      confusions: [],
      reviewResults: []
    }))
  }
  const port = repository as unknown as RepositoryPort
  const unitOfWork: UnitOfWorkPort = { transaction: (work) => work(port) }
  const service = new DataControlService({
    repository: port,
    unitOfWork,
    clock: new FakeClock({
      instant: '2026-08-19T08:00:00.000Z',
      localDate: '2026-08-19',
      timeZone: 'Asia/Shanghai'
    }),
    generateId: () => 'generated-id'
  })
  return { currentRoutineRecord, repository, service }
}

describe('DataControlService', () => {
  it('never turns a missing update target into a create', () => {
    const { repository, service } = setup()
    expect(() =>
      service.updateActionRecord({
        recordId: 'missing',
        occurredOn: '2026-08-18',
        durationMinutes: 1,
        outcome: 'partial'
      })
    ).toThrowError(expect.objectContaining({ code: 'not-found' }))
    expect(repository.createActionRecord).not.toHaveBeenCalled()
    expect(repository.updateActionRecord).not.toHaveBeenCalled()
  })

  it('requires explicit historical plan confirmation on date change and writes provenance', () => {
    const { repository, service } = setup()
    expect(() =>
      service.updateRoutineRecord({
        recordId: 'routine-record-1',
        occurredOn: '2026-08-17',
        outcome: 'acted'
      })
    ).toThrowError(expect.objectContaining({ code: 'validation' }))
    expect(repository.updateRoutineRecord).not.toHaveBeenCalled()

    service.updateRoutineRecord({
      recordId: 'routine-record-1',
      occurredOn: '2026-08-17',
      outcome: 'acted',
      plannedForDate: true,
      durationMinutes: 3
    })
    expect(repository.updateRoutineRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        occurredOn: '2026-08-17',
        plannedForDate: true,
        plannedForDateBasis: 'user_confirmed_history',
        createdAt: 'created'
      })
    )
  })

  it('rejects a stale fingerprint before invoking the root delete', () => {
    const { repository, service } = setup()
    repository.findDeleteImpact.mockReturnValue({
      target: { type: 'action', id: 'action-1' },
      goals: [],
      actions: ['action-1'],
      routines: [],
      routineScheduleDays: [],
      todaySelections: [],
      actionRecords: [],
      routineRecords: [],
      understandings: [],
      confusions: [],
      reviewResults: [],
      detachedRoutines: [],
      detachedReviewResults: [],
      clearedCurrentNext: []
    })
    expect(() =>
      service.confirmDelete({ type: 'action', id: 'action-1' }, 'old-fingerprint')
    ).toThrowError(expect.objectContaining({ code: 'delete-preview-stale' }))
    expect(repository.deleteRoot).not.toHaveBeenCalled()
  })
})
