import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildCompleteExport, validateCompleteExport } from '../../src/application/complete-export'
import { DataControlService } from '../../src/application/data-control'
import { asCompleteExportRepository } from '../../src/application/ports/persistence'
import { SqliteConnection } from '../../src/infrastructure/sqlite/sqlite-connection'
import { FakeClock } from '../support/fake-clock'
import {
  createTemporaryTestRoot,
  removeTemporaryTestRoot,
  type TemporaryTestRoot
} from '../support/temporary-test-root'

const roots: TemporaryTestRoot[] = []
const instant = '2026-08-20T08:00:00.000Z'
const clock = () => new FakeClock({ instant, localDate: '2026-08-20', timeZone: 'Asia/Shanghai' })

async function openConnection() {
  const root = await createTemporaryTestRoot()
  roots.push(root)
  return SqliteConnection.open(
    join(root.database, `complete-export-${crypto.randomUUID()}.sqlite3`)
  )
}

function populate(connection: SqliteConnection): void {
  connection.transaction((repository) => {
    repository.saveGoal({
      id: 'goal',
      title: 'Goal',
      description: null,
      status: 'paused',
      predecessorGoalId: null,
      currentNextActionId: null,
      createdAt: instant,
      updatedAt: instant
    })
    repository.saveAction({
      id: 'action',
      goalId: 'goal',
      title: 'Action',
      description: null,
      status: 'completed',
      createdAt: instant,
      updatedAt: instant
    })
    repository.saveRoutine({
      arrangementMode: 'weekly' as const,
      id: 'routine',
      goalId: 'goal',
      name: 'Routine',
      minimumAction: 'One',
      description: null,
      status: 'ended',
      createdAt: instant,
      updatedAt: instant
    })
    repository.saveRoutineScheduleDay({ routineId: 'routine', weekday: 1 })
    repository.createTodaySelection({
      actionId: 'action',
      selectedFor: '2026-08-20',
      kind: 'intention',
      selectedBy: 'user',
      createdAt: instant
    })
    repository.saveActionRecord({
      id: 'action-record',
      actionId: 'action',
      occurredOn: '2026-08-20',
      durationMinutes: 0,
      outcome: 'stopped',
      nextStep: null,
      note: null,
      createdAt: instant,
      updatedAt: instant
    })
    repository.saveRoutineRecord({
      id: 'routine-record',
      routineId: 'routine',
      occurredOn: '2026-08-20',
      outcome: 'intentional_rest',
      plannedForDate: false,
      plannedForDateBasis: 'user_confirmed_history',
      durationMinutes: null,
      note: null,
      createdAt: instant,
      updatedAt: instant
    })
    repository.saveUnderstanding({
      id: 'understanding',
      actionRecordId: 'action-record',
      text: 'Kept but revoked',
      source: 'ai_candidate_confirmed',
      revokedAt: instant,
      createdAt: instant,
      updatedAt: instant
    })
    repository.saveConfusion({
      id: 'confusion',
      actionRecordId: 'action-record',
      text: 'Resolved',
      status: 'resolved',
      resolvedAt: instant,
      resolution: 'Done',
      createdAt: instant,
      updatedAt: instant
    })
    repository.saveReviewResult({
      id: 'review',
      periodStartedOn: '2026-08-17',
      confirmedProgress: 'Summary',
      mainObstacle: 'Adjust',
      nextAdjustment: 'Focus',
      goalId: 'goal',
      createdAt: instant,
      updatedAt: instant
    })
  })
}

afterEach(async () => Promise.all(roots.splice(0).map(removeTemporaryTestRoot)))

describe('complete export SQLite snapshot', () => {
  it('binds schema version and all ten sorted core collections in one complete snapshot', async () => {
    const connection = await openConnection()
    populate(connection)
    const snapshot = asCompleteExportRepository(connection.repository).readCompleteCoreSnapshot()
    expect(snapshot.sourceDataVersion).toBe(6)
    expect(Object.values(snapshot.coreSnapshot).map((rows) => rows.length)).toEqual([
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1
    ])
    const document = buildCompleteExport(snapshot, clock())
    expect(() => validateCompleteExport(document)).not.toThrow()
    connection.close()
  })

  it('exports legal null relationships after transactional Goal deletion and can reopen unchanged facts', async () => {
    const connection = await openConnection()
    populate(connection)
    const service = new DataControlService({
      repository: connection.repository,
      unitOfWork: connection,
      clock: clock(),
      generateId: () => 'unused'
    })
    const preview = service.previewDelete({ type: 'goal', id: 'goal' })
    service.confirmDelete(preview.target, preview.fingerprint)
    const afterDelete = asCompleteExportRepository(connection.repository).readCompleteCoreSnapshot()
    expect(afterDelete.coreSnapshot.routines[0]?.goalId).toBeNull()
    expect(afterDelete.coreSnapshot.reviewResults[0]?.goalId).toBeNull()
    expect(() => validateCompleteExport(buildCompleteExport(afterDelete, clock()))).not.toThrow()
    connection.close()
  })
})
