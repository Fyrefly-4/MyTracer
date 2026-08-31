import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  ContextBudget,
  SelectedStartHelpContext
} from '../../src/application/ai-start-help-context'
import type {
  StartHelpRequestCapturePort,
  StartHelpRequestDto
} from '../../src/application/ports/ai-start-help'
import type { ClockPort } from '../../src/application/ports/clock'
import {
  asCompleteExportRepository,
  asStartHelpContextQueryRepository,
  type StartHelpContextQueryPort
} from '../../src/application/ports/persistence'
import { SqliteConnection } from '../../src/infrastructure/sqlite/sqlite-connection'
import {
  seedStartHelpIsolationFixture,
  START_HELP_FORBIDDEN_MARKERS,
  START_HELP_IDS,
  START_HELP_MARKERS
} from '../support/ai-start-help-context-fixture'
import { FakeStartHelpRequestCapture } from '../support/fake-ai-provider'
import { FakeClock } from '../support/fake-clock'
import {
  createTemporaryTestRoot,
  removeTemporaryTestRoot,
  type TemporaryTestRoot
} from '../support/temporary-test-root'

const roots: TemporaryTestRoot[] = []

interface CoordinatorInput {
  readonly actionId: string
  readonly locale: string
  readonly userInput: string
  readonly expectedActionUpdatedAt?: string
  readonly expectedGoalUpdatedAt?: string
}

type CoordinatorConstructor = new (dependencies: {
  readonly contextQuery: StartHelpContextQueryPort
  readonly clock: ClockPort
  readonly contextBudget: ContextBudget
  readonly requestCapture: StartHelpRequestCapturePort
  readonly generateRequestId: () => string
}) => { start(input: CoordinatorInput): SelectedStartHelpContext }

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => removeTemporaryTestRoot(root)))
})

describe('T061 Start Help request isolation', () => {
  it('captures exactly one allowlisted request only after a valid explicit start', async () => {
    const { AiStartHelpContextCoordinator } = await vi.importActual<{
      AiStartHelpContextCoordinator: CoordinatorConstructor
    }>('../../src/main/ai-start-help-context')
    const root = await createTemporaryTestRoot()
    roots.push(root)
    const connection = SqliteConnection.open(join(root.database, 't061-isolation.sqlite3'))
    const fixture = seedStartHelpIsolationFixture(connection.repository)
    const before = asCompleteExportRepository(connection.repository).readCompleteCoreSnapshot()
    const capture = new FakeStartHelpRequestCapture<StartHelpRequestDto>()
    const clock = new FakeClock({
      instant: '2026-08-31T08:00:00.000Z',
      localDate: fixture.selectedFor,
      timeZone: 'Asia/Shanghai'
    })
    let requestSequence = 0
    const contextQuery = asStartHelpContextQueryRepository(connection.repository)
    expect(Object.keys(contextQuery)).toEqual(['queryStartHelpContext'])
    const adjacentSources = Object.freeze({
      credential: START_HELP_MARKERS.credential,
      configuration: START_HELP_MARKERS.configuration,
      diagnostics: START_HELP_MARKERS.diagnostics,
      log: START_HELP_MARKERS.log
    })
    const createCoordinator = (totalTextCharacters: number) => {
      const compositionFixture = {
        contextQuery,
        clock,
        contextBudget: { totalTextCharacters },
        requestCapture: capture,
        generateRequestId: () => `request-${++requestSequence}`,
        adjacentSources
      }
      return new AiStartHelpContextCoordinator(compositionFixture)
    }

    const coordinator = createCoordinator(8_000)
    expect(capture.calls).toHaveLength(0)

    expect(() =>
      coordinator.start({ actionId: 'missing', locale: 'zh-CN', userInput: 'Help' })
    ).toThrowError(/not found/i)
    expect(() =>
      coordinator.start({
        actionId: START_HELP_IDS.action,
        locale: 'zh-CN',
        userInput: '   '
      })
    ).toThrowError(/must not be blank/i)
    expect(() =>
      coordinator.start({
        actionId: START_HELP_IDS.noGoalAction,
        locale: 'zh-CN',
        userInput: 'Help'
      })
    ).toThrowError(/not found/i)
    expect(() =>
      coordinator.start({
        actionId: START_HELP_IDS.terminalAction,
        locale: 'zh-CN',
        userInput: 'Help'
      })
    ).toThrowError(/not found/i)
    expect(() =>
      coordinator.start({
        actionId: START_HELP_IDS.action,
        locale: 'zh-CN',
        userInput: 'Help',
        expectedActionUpdatedAt: 'stale'
      })
    ).toThrowError(/changed/i)
    expect(() =>
      createCoordinator(1).start({
        actionId: START_HELP_IDS.action,
        locale: 'zh-CN',
        userInput: 'Help'
      })
    ).toThrowError(/exceeds/i)
    expect(() =>
      coordinator.start({
        actionId: START_HELP_IDS.action,
        locale: 'x'.repeat(8_000),
        userInput: 'Help'
      })
    ).toThrowError(/exceeds/i)
    expect(capture.calls).toHaveLength(0)

    const selected = coordinator.start({
      actionId: START_HELP_IDS.action,
      locale: 'zh-CN',
      userInput: 'Please help me start.',
      expectedActionUpdatedAt: fixture.actionUpdatedAt,
      expectedGoalUpdatedAt: fixture.goalUpdatedAt
    })

    expect(capture.calls).toHaveLength(1)
    expect(capture.calls[0]).toEqual(selected.requestDto)
    expect(selected.manifest.selectedRecordIds).toEqual(fixture.relatedRecordIds.slice(0, 5))
    expect(selected.manifest.excludedCounts.overFiveLimit).toBe(1)
    expect(selected.manifest.totalTextCharacters).toBeLessThanOrEqual(8_000)

    const requestJson = JSON.stringify(capture.calls[0])
    ;[
      START_HELP_MARKERS.allowedGoalName,
      START_HELP_MARKERS.allowedGoalDescription,
      START_HELP_MARKERS.allowedActionTitle,
      START_HELP_MARKERS.allowedActionDescription,
      START_HELP_MARKERS.allowedCurrentNextTitle,
      START_HELP_MARKERS.allowedCurrentNextDescription,
      START_HELP_MARKERS.allowedUnderstanding,
      START_HELP_MARKERS.allowedConfusion,
      START_HELP_MARKERS.allowedNextStep
    ].forEach((marker) => expect(requestJson.split(marker)).toHaveLength(2))
    START_HELP_FORBIDDEN_MARKERS.forEach((marker) => expect(requestJson).not.toContain(marker))
    expect(requestJson).not.toContain('__forbidden_related_note_')
    Object.values(START_HELP_IDS).forEach((id) => expect(requestJson).not.toContain(id))
    fixture.relatedRecordIds.forEach((id) => expect(requestJson).not.toContain(id))
    expect(JSON.stringify(selected.manifest)).toContain(START_HELP_IDS.action)
    expect(asCompleteExportRepository(connection.repository).readCompleteCoreSnapshot()).toEqual(
      before
    )
    connection.close()
  })
})
