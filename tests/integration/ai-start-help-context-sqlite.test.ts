import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  asCompleteExportRepository,
  asStartHelpContextQueryRepository,
  type StartHelpContextQuerySnapshotPersistence
} from '../../src/application/ports/persistence'
import { SqliteConnection } from '../../src/infrastructure/sqlite/sqlite-connection'
import {
  seedStartHelpIsolationFixture,
  START_HELP_FORBIDDEN_MARKERS,
  START_HELP_IDS,
  START_HELP_MARKERS
} from '../support/ai-start-help-context-fixture'
import {
  createTemporaryTestRoot,
  removeTemporaryTestRoot,
  type TemporaryTestRoot
} from '../support/temporary-test-root'

const roots: TemporaryTestRoot[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => removeTemporaryTestRoot(root)))
})

async function openFixture() {
  const root = await createTemporaryTestRoot()
  roots.push(root)
  const connection = SqliteConnection.open(join(root.database, 't061.sqlite3'))
  const fixture = seedStartHelpIsolationFixture(connection.repository)
  return { connection, fixture }
}

function expectEmptySnapshot(snapshot: StartHelpContextQuerySnapshotPersistence): void {
  expect(snapshot).toEqual({
    goal: null,
    action: null,
    todaySelection: null,
    currentNextAction: null,
    records: []
  })
}

describe('T061 narrow SQLite Start Help context query', () => {
  it('returns only the selected active goal slice and leaves persisted data unchanged', async () => {
    const { connection, fixture } = await openFixture()
    const before = asCompleteExportRepository(connection.repository).readCompleteCoreSnapshot()

    const snapshot = asStartHelpContextQueryRepository(connection.repository).queryStartHelpContext(
      START_HELP_IDS.action,
      fixture.selectedFor
    )

    expect(snapshot.goal).toMatchObject({
      id: START_HELP_IDS.goal,
      title: START_HELP_MARKERS.allowedGoalName,
      status: 'active'
    })
    expect(snapshot.action).toMatchObject({
      id: START_HELP_IDS.action,
      title: START_HELP_MARKERS.allowedActionTitle,
      status: 'pending'
    })
    expect(snapshot.currentNextAction).toMatchObject({
      id: START_HELP_IDS.currentNextAction,
      title: START_HELP_MARKERS.allowedCurrentNextTitle,
      status: 'pending'
    })
    expect(snapshot.records.map((record) => record.id)).toEqual(fixture.relatedRecordIds)
    expect(snapshot.records[0]?.understandings.map((item) => item.text)).toContain(
      START_HELP_MARKERS.allowedUnderstanding
    )
    expect(snapshot.records[0]?.confusions.map((item) => item.text)).toContain(
      START_HELP_MARKERS.allowedConfusion
    )

    const serialized = JSON.stringify(snapshot)
    START_HELP_FORBIDDEN_MARKERS.forEach((marker) => expect(serialized).not.toContain(marker))
    expect(serialized).not.toContain('__forbidden_related_note_')
    expect(asCompleteExportRepository(connection.repository).readCompleteCoreSnapshot()).toEqual(
      before
    )
    connection.close()
  })

  it.each([
    ['missing Action', 'action-missing'],
    ['Action without a Goal', START_HELP_IDS.noGoalAction],
    ['terminal Action', START_HELP_IDS.terminalAction]
  ])('returns an empty slice for %s without mutating data', async (_label, actionId) => {
    const { connection, fixture } = await openFixture()
    const before = asCompleteExportRepository(connection.repository).readCompleteCoreSnapshot()

    expectEmptySnapshot(
      asStartHelpContextQueryRepository(connection.repository).queryStartHelpContext(
        actionId,
        fixture.selectedFor
      )
    )
    expect(asCompleteExportRepository(connection.repository).readCompleteCoreSnapshot()).toEqual(
      before
    )
    connection.close()
  })
})
