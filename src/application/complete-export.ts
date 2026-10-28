import type { ClockPort } from './ports/clock'
import {
  ExportDeliveryError,
  type CompleteExportDocumentPort,
  type ExportPort
} from './ports/export'
import {
  asCompleteExportRepository,
  type CompleteCorePersistenceSnapshot,
  CorePersistenceSnapshot,
  RepositoryPort
} from './ports/persistence'
import { createLocalDate } from '../domain/local-date'

export const COMPLETE_EXPORT_FORMAT = 'mytracer-core-export' as const
export const COMPLETE_EXPORT_VERSION_V1 = 1 as const
export const COMPLETE_EXPORT_VERSION = 8 as const

export const COMPLETE_EXPORT_ENUM_VALUES = Object.freeze({
  goalStatus: Object.freeze(['active', 'paused', 'ended']),
  actionStatus: Object.freeze(['pending', 'completed', 'cancelled', 'rescheduled']),
  routineStatus: Object.freeze(['active', 'paused', 'ended']),
  actionRecordOutcome: Object.freeze(['completed', 'partial', 'stopped']),
  routineRecordOutcome: Object.freeze(['target_met', 'acted', 'intentional_rest', 'not_done']),
  routinePlannedForDateBasis: Object.freeze(['schedule_at_recording', 'user_confirmed_history']),
  todayCommitment: Object.freeze(['focus', 'intention']),
  understandingSource: Object.freeze(['manual', 'ai_candidate_confirmed']),
  confusionStatus: Object.freeze(['open', 'resolved'])
})

interface ReviewResultExportV1 {
  readonly id: string
  readonly periodStartedOn: string
  readonly summary: string
  readonly adjustment: string
  readonly nextFocus: string
  readonly goalId: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

interface PreSummarySnapshot extends Omit<
  CorePersistenceSnapshot,
  'actionRecords' | 'routineRecords' | 'thoughts' | 'booklets'
> {
  readonly actionRecords: readonly Omit<
    CorePersistenceSnapshot['actionRecords'][number],
    'summary'
  >[]
  readonly routineRecords: readonly Omit<
    CorePersistenceSnapshot['routineRecords'][number],
    'summary'
  >[]
}

interface PreStageSnapshot extends Omit<PreSummarySnapshot, 'goals'> {
  readonly goals: readonly Omit<CorePersistenceSnapshot['goals'][number], 'predecessorGoalId'>[]
}

interface LegacySnapshot extends Omit<PreStageSnapshot, 'routines'> {
  readonly routines: readonly Omit<CorePersistenceSnapshot['routines'][number], 'arrangementMode'>[]
}

interface NumericDurationSnapshot extends Omit<LegacySnapshot, 'actionRecords'> {
  readonly actionRecords: readonly (Omit<
    PreSummarySnapshot['actionRecords'][number],
    'durationMinutes'
  > & { readonly durationMinutes: number })[]
}

interface CorePersistenceSnapshotV1 extends Omit<NumericDurationSnapshot, 'reviewResults'> {
  readonly reviewResults: readonly ReviewResultExportV1[]
}

export interface MyTracerCoreExportV1 extends Omit<
  CompleteExportDocumentPort,
  'exportVersion' | 'data'
> {
  readonly exportVersion: 1
  readonly enumValues: typeof COMPLETE_EXPORT_ENUM_VALUES
  readonly data: CorePersistenceSnapshotV1
}

export interface MyTracerCoreExportV2 extends Omit<CompleteExportDocumentPort, 'data'> {
  readonly exportVersion: 2
  readonly enumValues: typeof COMPLETE_EXPORT_ENUM_VALUES
  readonly data: NumericDurationSnapshot
}

export interface MyTracerCoreExportV3 extends Omit<CompleteExportDocumentPort, 'data'> {
  readonly exportVersion: 3
  readonly enumValues: typeof COMPLETE_EXPORT_ENUM_VALUES
  readonly data: LegacySnapshot
}

export interface MyTracerCoreExportV4 extends Omit<CompleteExportDocumentPort, 'data'> {
  readonly exportVersion: 4
  readonly enumValues: typeof COMPLETE_EXPORT_ENUM_VALUES
  readonly data: PreStageSnapshot
}

export interface MyTracerCoreExportV5 extends Omit<CompleteExportDocumentPort, 'data'> {
  readonly exportVersion: 5
  readonly enumValues: typeof COMPLETE_EXPORT_ENUM_VALUES
  readonly data: PreSummarySnapshot
}

export interface MyTracerCoreExportV6 extends Omit<CompleteExportDocumentPort, 'data'> {
  readonly exportVersion: 6
  readonly enumValues: typeof COMPLETE_EXPORT_ENUM_VALUES
  readonly data: Omit<CorePersistenceSnapshot, 'thoughts' | 'booklets'>
}

export interface MyTracerCoreExportV7 extends Omit<CompleteExportDocumentPort, 'data'> {
  readonly exportVersion: 7
  readonly enumValues: typeof COMPLETE_EXPORT_ENUM_VALUES
  readonly data: Omit<CorePersistenceSnapshot, 'booklets'>
}
export interface MyTracerCoreExportV8 extends CompleteExportDocumentPort {
  readonly exportVersion: 8
  readonly enumValues: typeof COMPLETE_EXPORT_ENUM_VALUES
}

export type CompleteExportApplicationErrorCode =
  | 'snapshot-failed'
  | 'serialization-failed'
  | 'export-validation-failed'
  | 'write-failed'
  | 'destination-changed'
  | 'replace-not-supported'

export class CompleteExportApplicationError extends Error {
  public constructor(
    readonly code: CompleteExportApplicationErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'CompleteExportApplicationError'
  }
}

function freezeRows<T extends object>(rows: readonly T[]): readonly T[] {
  return Object.freeze(rows.map((row) => Object.freeze({ ...row })))
}

function freezeSnapshot(snapshot: CorePersistenceSnapshot): CorePersistenceSnapshot {
  return Object.freeze({
    booklets: Object.freeze(
      snapshot.booklets.map((booklet) =>
        Object.freeze({ ...booklet, entries: freezeRows(booklet.entries) })
      )
    ),
    thoughts: freezeRows(snapshot.thoughts),
    goals: freezeRows(snapshot.goals),
    actions: freezeRows(snapshot.actions),
    routines: freezeRows(snapshot.routines),
    routineScheduleDays: freezeRows(snapshot.routineScheduleDays),
    todaySelections: freezeRows(snapshot.todaySelections),
    actionRecords: freezeRows(snapshot.actionRecords),
    routineRecords: freezeRows(snapshot.routineRecords),
    understandings: freezeRows(snapshot.understandings),
    confusions: freezeRows(snapshot.confusions),
    reviewResults: freezeRows(snapshot.reviewResults)
  })
}

function validInstant(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  )
}

function validLocalDate(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    return String(createLocalDate(value)) === value
  } catch {
    return false
  }
}

function validEnum(value: unknown, allowed: readonly string[]): value is string {
  return typeof value === 'string' && allowed.includes(value)
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new CompleteExportApplicationError('export-validation-failed', message)
}

function assertKeys(
  record: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
  optional: readonly string[] = []
): void {
  assert(
    Object.keys(record).every((key) => allowed.includes(key) || optional.includes(key)) &&
      allowed.every((key) => Object.hasOwn(record, key)),
    `${label} contains an unsupported field.`
  )
}

function record(value: unknown, label: string): Record<string, unknown> {
  assert(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    `${label} is invalid.`
  )
  return value as Record<string, unknown>
}

function rows(value: unknown, label: string): readonly Record<string, unknown>[] {
  assert(Array.isArray(value), `${label} must be an array.`)
  return value.map((item) => record(item, label))
}

function unique(rowsToCheck: readonly Record<string, unknown>[], key: string, label: string): void {
  const values = rowsToCheck.map((item) => item[key])
  assert(
    values.every((value) => typeof value === 'string' && value.trim().length > 0),
    `${label} has an invalid key.`
  )
  assert(new Set(values).size === values.length, `${label} contains duplicate values.`)
}

function assertNoForbiddenKeys(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertNoForbiddenKeys)
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    assert(
      !/(?:credential|api[_-]?key|safe[_-]?storage|password|token|prompt|request|response|diagnostic|stack|cache|path|userData|environment)/i.test(
        key
      ),
      'Export contains a forbidden technical field.'
    )
    assertNoForbiddenKeys(child)
  }
}

function assertSorted<T extends Record<string, unknown>>(
  values: readonly T[],
  compare: (left: T, right: T) => number,
  label: string
): void {
  for (let index = 1; index < values.length; index += 1) {
    assert(compare(values[index - 1]!, values[index]!) <= 0, `${label} is not stably sorted.`)
  }
}

const byId = (left: Record<string, unknown>, right: Record<string, unknown>) =>
  String(left.id).localeCompare(String(right.id))
const byOccurrence = (left: Record<string, unknown>, right: Record<string, unknown>) =>
  String(left.occurredOn).localeCompare(String(right.occurredOn)) || byId(left, right)

function validateCompleteExportVersion(
  value: unknown,
  expectedVersion: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
): void {
  const document = record(value, 'Export document')
  assertKeys(
    document,
    [
      'format',
      'exportVersion',
      'sourceDataVersion',
      'exportedAt',
      'localTimeZone',
      'enumValues',
      'data'
    ],
    'Export document',
    ['appVersion']
  )
  assert(document.format === COMPLETE_EXPORT_FORMAT, 'Export format is invalid.')
  assert(document.exportVersion === expectedVersion, 'Export version is invalid.')
  assert(
    Number.isInteger(document.sourceDataVersion) && Number(document.sourceDataVersion) > 0,
    'Source data version is invalid.'
  )
  if (expectedVersion === 8)
    assert(document.sourceDataVersion === 10, 'Export v8 requires source data version 10.')
  if (expectedVersion === 7)
    assert(document.sourceDataVersion === 9, 'Export v7 requires source data version 9.')
  if (expectedVersion === 6)
    assert(
      document.sourceDataVersion === 7 || document.sourceDataVersion === 8,
      'Export v6 requires source data version 7 or 8.'
    )
  if (expectedVersion === 5)
    assert(document.sourceDataVersion === 6, 'Export v5 requires source data version 6.')
  assert(validInstant(document.exportedAt), 'Export timestamp is invalid.')
  assert(
    document.appVersion === undefined ||
      (typeof document.appVersion === 'string' && document.appVersion.trim().length > 0),
    'App version is invalid.'
  )
  assert(
    typeof document.localTimeZone === 'string' && document.localTimeZone.trim(),
    'Export time zone is invalid.'
  )

  const enumValues = record(document.enumValues, 'Export enum values')
  assertKeys(enumValues, Object.keys(COMPLETE_EXPORT_ENUM_VALUES), 'Export enum values')
  for (const [key, expected] of Object.entries(COMPLETE_EXPORT_ENUM_VALUES)) {
    assert(Array.isArray(enumValues[key]), `Export enum ${key} is invalid.`)
    assert(
      JSON.stringify(enumValues[key]) === JSON.stringify(expected),
      `Export enum ${key} changed.`
    )
  }

  const data = record(document.data, 'Export data')
  const collectionNames = [
    'goals',
    'actions',
    'routines',
    'routineScheduleDays',
    'todaySelections',
    'actionRecords',
    'routineRecords',
    'understandings',
    'confusions',
    'reviewResults'
  ] as const
  assertKeys(
    data,
    [
      ...collectionNames,
      ...(expectedVersion >= 7 ? ['thoughts'] : []),
      ...(expectedVersion >= 8 ? ['booklets'] : [])
    ],
    'Export data'
  )
  if (expectedVersion >= 7) {
    const thoughts = rows(data.thoughts, 'Thoughts')
    unique(thoughts, 'id', 'Thoughts')
    assertSorted(thoughts, byOccurrence, 'Thoughts')
    for (const thought of thoughts) {
      assertKeys(thought, ['id', 'occurredOn', 'text', 'createdAt', 'updatedAt'], 'Thought')
      assert(typeof thought.id === 'string' && thought.id.length > 0, 'Thought id is invalid.')
      assert(validLocalDate(thought.occurredOn), 'Thought date is invalid.')
      assert(
        typeof thought.text === 'string' && thought.text.trim().length > 0,
        'Thought text is invalid.'
      )
      assert(
        validInstant(thought.createdAt) && validInstant(thought.updatedAt),
        'Thought timestamps are invalid.'
      )
    }
  }
  if (expectedVersion >= 8) {
    const booklets = rows(data.booklets, 'Booklets')
    unique(booklets, 'id', 'Booklets')
    assertSorted(booklets, (a, b) => String(a.id).localeCompare(String(b.id)), 'Booklets')
    const allEntryIds = new Set<string>()
    for (const booklet of booklets) {
      assertKeys(
        booklet,
        ['id', 'title', 'note', 'revision', 'createdAt', 'updatedAt', 'entries'],
        'Booklet'
      )
      assert(typeof booklet.id === 'string' && booklet.id.length > 0, 'Booklet id is invalid.')
      assert(
        typeof booklet.title === 'string' && booklet.title.length <= 200,
        'Booklet title is invalid.'
      )
      assert(
        typeof booklet.note === 'string' && booklet.note.length <= 4000,
        'Booklet note is invalid.'
      )
      assert(
        Number.isSafeInteger(booklet.revision) && Number(booklet.revision) > 0,
        'Booklet revision is invalid.'
      )
      assert(
        validInstant(booklet.createdAt) && validInstant(booklet.updatedAt),
        'Booklet timestamps are invalid.'
      )
      const entries = rows(booklet.entries, 'Booklet entries')
      assert(entries.length <= 1000, 'Booklet is too large.')
      const sources = new Set<string>()
      for (const entry of entries) {
        assertKeys(entry, ['id', 'kind', 'sourceId'], 'Booklet entry')
        assert(
          typeof entry.id === 'string' && entry.id.length > 0 && !allEntryIds.has(entry.id),
          'Booklet entry id is invalid.'
        )
        allEntryIds.add(String(entry.id))
        assert(
          entry.kind === 'action-record' || entry.kind === 'thought',
          'Booklet source kind is invalid.'
        )
        if (entry.sourceId !== null) {
          assert(
            typeof entry.sourceId === 'string' && entry.sourceId.length > 0,
            'Booklet source id is invalid.'
          )
          const key = `${entry.kind}:${entry.sourceId}`
          assert(!sources.has(key), 'Booklet source is duplicated.')
          sources.add(key)
          assert(
            rows(entry.kind === 'thought' ? data.thoughts : data.actionRecords, 'Sources').some(
              (source) => source.id === entry.sourceId
            ),
            'Booklet source is missing.'
          )
        }
      }
    }
  }
  const collections = Object.fromEntries(
    collectionNames.map((name) => [name, rows(data[name], name)])
  ) as Record<(typeof collectionNames)[number], readonly Record<string, unknown>[]>
  assertNoForbiddenKeys(document)

  const goals = collections.goals
  const actions = collections.actions
  const routines = collections.routines
  const scheduleDays = collections.routineScheduleDays
  const selections = collections.todaySelections
  const actionRecords = collections.actionRecords
  const routineRecords = collections.routineRecords
  const understandings = collections.understandings
  const confusions = collections.confusions
  const reviews = collections.reviewResults
  ;[
    goals,
    actions,
    routines,
    actionRecords,
    routineRecords,
    understandings,
    confusions,
    reviews
  ].forEach((items, index) =>
    unique(items, 'id', collectionNames[[0, 1, 2, 5, 6, 7, 8, 9][index]!]!)
  )
  assert(
    new Set(scheduleDays.map((item) => `${item.routineId}|${item.weekday}`)).size ===
      scheduleDays.length,
    'Routine schedule days contain duplicates.'
  )
  if (expectedVersion >= 2) {
    assert(
      new Set(reviews.map((item) => item.periodStartedOn)).size === reviews.length,
      'Review results contain duplicate periods.'
    )
    assert(Number(document.sourceDataVersion) >= 3, 'Export v2 requires source data version 3.')
  }
  if (expectedVersion >= 3)
    assert(Number(document.sourceDataVersion) >= 4, 'Export v3 requires source data version 4.')
  assert(
    new Set(selections.map((item) => `${item.actionId}|${item.selectedFor}`)).size ===
      selections.length,
    'Today selections contain duplicates.'
  )
  assert(
    new Set(routineRecords.map((item) => `${item.routineId}|${item.occurredOn}`)).size ===
      routineRecords.length,
    'Routine records contain duplicates.'
  )

  assertSorted(goals, byId, 'Goals')
  assertSorted(actions, byId, 'Actions')
  if (expectedVersion === 4)
    assert(document.sourceDataVersion === 5, 'Export v4 requires source data version 5.')
  assertSorted(routines, byId, 'Routines')
  assertSorted(actionRecords, byOccurrence, 'Action records')
  assertSorted(routineRecords, byOccurrence, 'Routine records')
  assertSorted(understandings, byId, 'Understandings')
  assertSorted(confusions, byId, 'Confusions')

  const goalIds = new Set(goals.map((item) => String(item.id)))
  const byGoalId = new Map(goals.map((item) => [item.id, item]))
  const actionById = new Map(actions.map((item) => [String(item.id), item]))
  const routineIds = new Set(routines.map((item) => String(item.id)))
  const actionRecordIds = new Set(actionRecords.map((item) => String(item.id)))
  for (const goal of goals) {
    assertKeys(
      goal,
      [
        'id',
        'title',
        'description',
        'status',
        'currentNextActionId',
        'createdAt',
        'updatedAt',
        ...(expectedVersion >= 5 ? ['predecessorGoalId'] : [])
      ],
      'Goal'
    )
    assert(
      validEnum(goal.status, COMPLETE_EXPORT_ENUM_VALUES.goalStatus) &&
        validInstant(goal.createdAt) &&
        validInstant(goal.updatedAt),
      'Goal is invalid.'
    )
    if (expectedVersion >= 5 && goal.predecessorGoalId !== null) {
      const visited = new Set([goal.id])
      let current = goal
      while (current.predecessorGoalId !== null) {
        assert(typeof current.predecessorGoalId === 'string', 'Stage predecessor is invalid.')
        const previous = byGoalId.get(current.predecessorGoalId)
        assert(
          previous && previous.status === 'ended' && !visited.has(previous.id),
          'Stage relation is invalid.'
        )
        visited.add(previous.id)
        current = previous
      }
    }
    if (goal.currentNextActionId !== null) {
      const action = actionById.get(String(goal.currentNextActionId))
      assert(
        action?.goalId === goal.id && action?.status === 'pending',
        'Goal current next action is invalid.'
      )
    }
  }
  for (const action of actions) {
    assertKeys(
      action,
      ['id', 'goalId', 'title', 'description', 'status', 'createdAt', 'updatedAt'],
      'Action'
    )
    assert(
      (action.goalId === null || goalIds.has(String(action.goalId))) &&
        validEnum(action.status, COMPLETE_EXPORT_ENUM_VALUES.actionStatus) &&
        validInstant(action.createdAt) &&
        validInstant(action.updatedAt),
      'Action is invalid.'
    )
  }
  for (const routine of routines) {
    assertKeys(
      routine,
      [
        'id',
        'goalId',
        'name',
        'minimumAction',
        'description',
        'status',
        'createdAt',
        'updatedAt',
        ...(expectedVersion >= 4 ? ['arrangementMode'] : [])
      ],
      'Routine'
    )
    assert(
      (routine.goalId === null || goalIds.has(String(routine.goalId))) &&
        validEnum(routine.status, COMPLETE_EXPORT_ENUM_VALUES.routineStatus) &&
        validInstant(routine.createdAt) &&
        validInstant(routine.updatedAt),
      'Routine is invalid.'
    )
  }
  if (expectedVersion >= 4)
    for (const routine of routines) {
      const days = scheduleDays.filter((day) => day.routineId === routine.id)
      assert(
        (routine.arrangementMode === 'weekly' && days.length > 0) ||
          (routine.arrangementMode === 'unscheduled' && days.length === 0),
        'Routine arrangement is invalid.'
      )
    }
  for (const schedule of scheduleDays) {
    assertKeys(schedule, ['routineId', 'weekday'], 'Routine schedule day')
    assert(
      routineIds.has(String(schedule.routineId)) &&
        Number.isInteger(schedule.weekday) &&
        Number(schedule.weekday) >= 1 &&
        Number(schedule.weekday) <= 7,
      'Routine schedule day is invalid.'
    )
  }
  for (const selection of selections) {
    assertKeys(
      selection,
      ['actionId', 'selectedFor', 'kind', 'selectedBy', 'createdAt'],
      'Today selection'
    )
    assert(
      actionById.has(String(selection.actionId)) &&
        validLocalDate(selection.selectedFor) &&
        validEnum(selection.kind, COMPLETE_EXPORT_ENUM_VALUES.todayCommitment) &&
        selection.selectedBy === 'user' &&
        validInstant(selection.createdAt),
      'Today selection is invalid.'
    )
  }
  for (const actionRecord of actionRecords) {
    assertKeys(
      actionRecord,
      [
        'id',
        'actionId',
        'occurredOn',
        'durationMinutes',
        'outcome',
        'nextStep',
        'note',
        ...(expectedVersion >= 6 ? ['summary'] : []),
        'createdAt',
        'updatedAt'
      ],
      'Action record'
    )
    assert(
      actionById.has(String(actionRecord.actionId)) &&
        validLocalDate(actionRecord.occurredOn) &&
        ((expectedVersion >= 3 && actionRecord.durationMinutes === null) ||
          (Number.isInteger(actionRecord.durationMinutes) &&
            Number(actionRecord.durationMinutes) >= 0)) &&
        validEnum(actionRecord.outcome, COMPLETE_EXPORT_ENUM_VALUES.actionRecordOutcome) &&
        validInstant(actionRecord.createdAt) &&
        validInstant(actionRecord.updatedAt),
      'Action record is invalid.'
    )
  }
  for (const routineRecord of routineRecords) {
    assertKeys(
      routineRecord,
      [
        'id',
        'routineId',
        'occurredOn',
        'outcome',
        'plannedForDate',
        'plannedForDateBasis',
        'durationMinutes',
        'note',
        ...(expectedVersion >= 6 ? ['summary'] : []),
        'createdAt',
        'updatedAt'
      ],
      'Routine record'
    )
    const noDuration =
      routineRecord.outcome === 'intentional_rest' || routineRecord.outcome === 'not_done'
    assert(
      routineIds.has(String(routineRecord.routineId)) &&
        validLocalDate(routineRecord.occurredOn) &&
        typeof routineRecord.plannedForDate === 'boolean' &&
        validEnum(routineRecord.outcome, COMPLETE_EXPORT_ENUM_VALUES.routineRecordOutcome) &&
        validEnum(
          routineRecord.plannedForDateBasis,
          COMPLETE_EXPORT_ENUM_VALUES.routinePlannedForDateBasis
        ) &&
        (noDuration
          ? routineRecord.durationMinutes === null
          : routineRecord.durationMinutes === null ||
            (Number.isInteger(routineRecord.durationMinutes) &&
              Number(routineRecord.durationMinutes) >= 0)) &&
        validInstant(routineRecord.createdAt) &&
        validInstant(routineRecord.updatedAt),
      'Routine record is invalid.'
    )
  }
  for (const row of [...actionRecords, ...routineRecords]) {
    assert(row.note === null || typeof row.note === 'string', 'Record note is invalid.')
    if (expectedVersion >= 6)
      assert(
        row.summary === null ||
          (typeof row.summary === 'string' && Array.from(row.summary).length <= 500),
        'Record summary is invalid.'
      )
  }
  for (const understanding of understandings) {
    assertKeys(
      understanding,
      ['id', 'actionRecordId', 'text', 'source', 'revokedAt', 'createdAt', 'updatedAt'],
      'Understanding'
    )
    assert(
      actionRecordIds.has(String(understanding.actionRecordId)) &&
        validEnum(understanding.source, COMPLETE_EXPORT_ENUM_VALUES.understandingSource) &&
        (understanding.revokedAt === null || validInstant(understanding.revokedAt)) &&
        validInstant(understanding.createdAt) &&
        validInstant(understanding.updatedAt),
      'Understanding is invalid.'
    )
  }
  for (const confusion of confusions) {
    assertKeys(
      confusion,
      [
        'id',
        'actionRecordId',
        'text',
        'status',
        'resolvedAt',
        'resolution',
        'createdAt',
        'updatedAt'
      ],
      'Confusion'
    )
    const resolved = confusion.status === 'resolved'
    assert(
      actionRecordIds.has(String(confusion.actionRecordId)) &&
        validEnum(confusion.status, COMPLETE_EXPORT_ENUM_VALUES.confusionStatus) &&
        (resolved
          ? validInstant(confusion.resolvedAt)
          : confusion.resolvedAt === null && confusion.resolution === null) &&
        validInstant(confusion.createdAt) &&
        validInstant(confusion.updatedAt),
      'Confusion is invalid.'
    )
  }
  for (const review of reviews) {
    assertKeys(
      review,
      expectedVersion === 1
        ? [
            'id',
            'periodStartedOn',
            'summary',
            'adjustment',
            'nextFocus',
            'goalId',
            'createdAt',
            'updatedAt'
          ]
        : [
            'id',
            'periodStartedOn',
            'confirmedProgress',
            'mainObstacle',
            'nextAdjustment',
            'goalId',
            'createdAt',
            'updatedAt'
          ],
      'Review result'
    )
    const textFields =
      expectedVersion === 1
        ? [review.summary, review.adjustment, review.nextFocus]
        : [review.confirmedProgress, review.mainObstacle, review.nextAdjustment]
    assert(
      validLocalDate(review.periodStartedOn) &&
        textFields.every((text) => typeof text === 'string' && text.trim().length > 0) &&
        (review.goalId === null || goalIds.has(String(review.goalId))) &&
        validInstant(review.createdAt) &&
        validInstant(review.updatedAt),
      'Review result is invalid.'
    )
  }
}

export function validateCompleteExportV1(value: unknown): asserts value is MyTracerCoreExportV1 {
  validateCompleteExportVersion(value, COMPLETE_EXPORT_VERSION_V1)
}

export function validateCompleteExport(
  value: unknown
): asserts value is
  | MyTracerCoreExportV1
  | MyTracerCoreExportV2
  | MyTracerCoreExportV3
  | MyTracerCoreExportV4
  | MyTracerCoreExportV5
  | MyTracerCoreExportV6
  | MyTracerCoreExportV7
  | MyTracerCoreExportV8 {
  const document = record(value, 'Export document')
  if (document.exportVersion === COMPLETE_EXPORT_VERSION_V1) {
    validateCompleteExportV1(value)
    return
  }
  if (document.exportVersion === 2) {
    validateCompleteExportVersion(value, 2)
    return
  }
  if (document.exportVersion === 3) {
    validateCompleteExportVersion(value, 3)
    return
  }
  if (document.exportVersion === 4) {
    validateCompleteExportVersion(value, 4)
    return
  }
  if (document.exportVersion === 5) {
    validateCompleteExportVersion(value, 5)
    return
  }
  if (document.exportVersion === 6) {
    validateCompleteExportVersion(value, 6)
    return
  }
  if (document.exportVersion === 7) {
    validateCompleteExportVersion(value, 7)
    return
  }
  if (document.exportVersion === COMPLETE_EXPORT_VERSION) {
    validateCompleteExportVersion(value, COMPLETE_EXPORT_VERSION)
    return
  }
  throw new CompleteExportApplicationError('export-validation-failed', 'Export version is invalid.')
}

export function buildCompleteExport(
  snapshot: CompleteCorePersistenceSnapshot,
  clock: Pick<ClockPort, 'snapshot'>
): MyTracerCoreExportV8 {
  const now = clock.snapshot()
  const document: MyTracerCoreExportV8 = Object.freeze({
    format: COMPLETE_EXPORT_FORMAT,
    exportVersion: COMPLETE_EXPORT_VERSION,
    sourceDataVersion: snapshot.sourceDataVersion,
    exportedAt: now.instant,
    localTimeZone: now.timeZone,
    enumValues: COMPLETE_EXPORT_ENUM_VALUES,
    data: freezeSnapshot(snapshot.coreSnapshot)
  })
  validateCompleteExport(document)
  return document
}

export interface CompleteExportServiceDependencies {
  readonly repository: RepositoryPort
  readonly clock: ClockPort
  readonly exportPort: ExportPort
}

export class CompleteExportService {
  public constructor(private readonly dependencies: CompleteExportServiceDependencies) {}

  public async generateCompleteExport(): Promise<
    | { readonly kind: 'cancelled' }
    | {
        readonly kind: 'exported'
        readonly fileName: string
        readonly byteLength: number
        readonly exportVersion: 8
        readonly exportedAt: string
      }
  > {
    let document: MyTracerCoreExportV8
    const clockSnapshot = this.dependencies.clock.snapshot()
    try {
      document = buildCompleteExport(
        asCompleteExportRepository(this.dependencies.repository).readCompleteCoreSnapshot(),
        { snapshot: () => clockSnapshot }
      )
    } catch (error) {
      if (error instanceof CompleteExportApplicationError) throw error
      throw new CompleteExportApplicationError(
        'snapshot-failed',
        'Could not read a complete export snapshot.'
      )
    }
    const suggestedName = `mytracer-export-${String(clockSnapshot.localDate)}-v8.json`
    try {
      const result = await this.dependencies.exportPort.deliverCompleteExport(
        document,
        suggestedName
      )
      return result.kind === 'cancelled'
        ? result
        : Object.freeze({
            ...result,
            exportVersion: COMPLETE_EXPORT_VERSION,
            exportedAt: document.exportedAt
          })
    } catch (error) {
      if (error instanceof ExportDeliveryError) {
        throw new CompleteExportApplicationError(error.code, error.message)
      }
      throw new CompleteExportApplicationError('write-failed', 'Could not deliver the export file.')
    }
  }
}
