import { describe, expect, it, vi } from 'vitest'
import { RecordBookService, RecordBookBusyError } from '../../src/application/record-book-service'
import type { RepositoryPort } from '../../src/application/ports/persistence'
import { FakeClock } from '../support/fake-clock'

function setup() {
  const snapshot = {
    sourceDataVersion: 4,
    coreSnapshot: {
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
    }
  }
  const read = vi.fn(() => snapshot)
  const delivery = { deliverRecordBook: vi.fn(async () => ({ kind: 'cancelled' as const })) }
  const service = new RecordBookService({
    repository: { readCompleteCoreSnapshot: read } as unknown as RepositoryPort,
    clock: new FakeClock({
      instant: '2026-01-01T00:00:00.000Z',
      localDate: '2025-12-31',
      timeZone: 'America/Los_Angeles'
    }),
    delivery
  })
  return { service, read, delivery }
}
describe('record book service', () => {
  it('reads one fresh consistent snapshot per entry or export and does not mutate storage', async () => {
    const { service, read, delivery } = setup()
    const first = service.read()
    expect(first.readAt).toBe('2026-01-01T00:00:00.000Z')
    service.read()
    await service.export()
    expect(read).toHaveBeenCalledTimes(3)
    expect(delivery.deliverRecordBook).toHaveBeenCalledWith(
      first,
      'mytracer-record-book-2026-01-01.html'
    )
  })
  it('releases the export lock after cancel and failure, and rejects concurrent exports', async () => {
    const { service, delivery } = setup()
    let resolve!: (value: { kind: 'cancelled' }) => void
    delivery.deliverRecordBook.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        })
    )
    const pending = service.export()
    await expect(service.export()).rejects.toBeInstanceOf(RecordBookBusyError)
    resolve({ kind: 'cancelled' })
    await expect(pending).resolves.toEqual({ kind: 'cancelled' })
    delivery.deliverRecordBook.mockRejectedValueOnce(new Error('failure'))
    await expect(service.export()).rejects.toThrow('failure')
    await expect(service.export()).resolves.toEqual({ kind: 'cancelled' })
    await expect(service.export()).resolves.toEqual({ kind: 'cancelled' })
  })
  it('does not deliver when reading fails and permits a later retry', async () => {
    const { service, read, delivery } = setup()
    read.mockImplementationOnce(() => {
      throw new Error('read failed')
    })
    await expect(service.export()).rejects.toThrow('read failed')
    expect(delivery.deliverRecordBook).not.toHaveBeenCalled()
    await expect(service.export()).resolves.toEqual({ kind: 'cancelled' })
  })
})
