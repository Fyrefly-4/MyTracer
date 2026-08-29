import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EmptyAiConfiguration } from '../../src/infrastructure/configuration/empty-ai-configuration'
import { ReviewService } from '../../src/application/review'
import { EmptySafeStorageCredentialAdapter } from '../../src/infrastructure/credentials/safe-storage-credential-adapter'
import { SafeDiagnostics } from '../../src/infrastructure/diagnostics/safe-diagnostics'
import { SqliteConnection } from '../../src/infrastructure/sqlite/sqlite-connection'
import { FakeClock } from '../support/fake-clock'
import {
  assertExistingPathWithinRoot,
  createTemporaryTestRoot,
  removeTemporaryTestRoot,
  type TemporaryTestRoot
} from '../support/temporary-test-root'

const createdRoots: TemporaryTestRoot[] = []

afterEach(async () => {
  await Promise.all(createdRoots.splice(0).map((root) => removeTemporaryTestRoot(root)))
})

describe('Main foundations integration', () => {
  it('combines an isolated SQLite database, FakeClock, safe diagnostics, and empty configuration', async () => {
    const root = await createTemporaryTestRoot()
    createdRoots.push(root)
    const databasePath = join(root.database, 'main-foundations.sqlite3')
    const connection = SqliteConnection.open(databasePath)
    const events: unknown[] = []
    const diagnosticsClock = new FakeClock({
      instant: '2026-08-09T08:30:00.000Z',
      localDate: '2026-08-09',
      timeZone: 'Asia/Shanghai'
    })
    const diagnostics = new SafeDiagnostics(diagnosticsClock, {
      write: (event) => events.push(event)
    })
    const capabilityCheck = vi.fn(() => false)
    const credentialStore = new EmptySafeStorageCredentialAdapter({
      isEncryptionAvailable: capabilityCheck
    })

    try {
      expect(await assertExistingPathWithinRoot(root, databasePath)).toBe(databasePath)
      expect(connection.inspectPragmas()).toEqual({ foreignKeys: 1, journalMode: 'wal' })
      expect(connection.repository.readSnapshot()).toEqual({
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
      })
      const beforeReview = connection.repository.readSnapshot()
      const review = new ReviewService({
        repository: connection.repository,
        clock: diagnosticsClock
      })
      const period = review.beginReview()
      expect(period).toEqual({
        periodStartedOn: '2026-08-03',
        periodEndedOn: '2026-08-09'
      })
      expect(review.getReviewSummary(period)).toMatchObject({
        totalDurationMinutes: 0,
        realActionCount: 0,
        routineOutcomeCounts: {
          targetMet: 0,
          acted: 0,
          intentionalRest: 0,
          notDone: 0
        }
      })
      expect(connection.repository.readSnapshot()).toEqual(beforeReview)
      expect(new EmptyAiConfiguration(credentialStore).readState()).toEqual({
        configured: false,
        availability: 'not-configured',
        credentialProtection: 'unavailable'
      })
      expect(credentialStore.readCredential()).toBeNull()

      diagnostics.record({
        code: 'safe-storage-unavailable',
        severity: 'warning',
        correlationId: 'startup.configuration',
        category: 'credential-protection'
      })

      const serialized = JSON.stringify(events)
      expect(serialized).toContain('safe-storage-unavailable')
      expect(serialized).not.toContain(root.root)
      expect(serialized).not.toMatch(
        /(?:API[_-]?KEY|SECRET|TOKEN|PASSWORD|SELECT|mytracer\.sqlite3)/i
      )
      expect(capabilityCheck).toHaveBeenCalledTimes(1)
    } finally {
      connection.close()
    }
  })
})
