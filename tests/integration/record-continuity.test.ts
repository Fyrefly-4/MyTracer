import type { IpcMainInvokeEvent } from 'electron'
import { registerRecordDraftIpc } from '../../src/main/record-drafts-ipc'
import { DRAFT_CHANNELS } from '../../src/contracts/record-drafts'
import { randomUUID, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { RecordContinuity, ContinuityError } from '../../src/main/record-continuity'
import { ActionRecordingContextStore } from '../../src/main/action-recording-contexts'
import { RoutineRecordingContextStore } from '../../src/main/routine-recording-contexts'
import { SqliteConnection } from '../../src/infrastructure/sqlite/sqlite-connection'
import { ActionRecordService } from '../../src/application/action-records'
import { RoutineRecordService } from '../../src/application/routine-records'
import { ActionService } from '../../src/application/actions'
import { GoalService } from '../../src/application/goals'
import { RoutineService } from '../../src/application/routines'
import {
  asRoutineRecordRepository,
  asCompleteExportRepository,
  asDataControlRepository
} from '../../src/application/ports/persistence'
import type { RecordContinuityPort } from '../../src/application/ports/record-continuity'
import { type RecordDraft, hasRecordInput } from '../../src/contracts/record-drafts'
import { FakeClock } from '../support/fake-clock'
import {
  createTemporaryTestRoot,
  removeTemporaryTestRoot,
  type TemporaryTestRoot
} from '../support/temporary-test-root'

const roots: TemporaryTestRoot[] = []
const connections: SqliteConnection[] = []
const key = randomBytes(32)
// Synthetic authenticated protection; no dependency on a developer's OS keys or records.
const protection = {
  protect(text: string) {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64')
  },
  unprotect(text: string) {
    const value = Buffer.from(text, 'base64')
    const decipher = createDecipheriv('aes-256-gcm', key, value.subarray(0, 12))
    decipher.setAuthTag(value.subarray(12, 28))
    return Buffer.concat([decipher.update(value.subarray(28)), decipher.final()]).toString('utf8')
  }
}
function connect(path: string) {
  const c = SqliteConnection.open(path)
  connections.push(c)
  return c
}
function close(c: SqliteConnection) {
  c.close()
  connections.splice(connections.indexOf(c), 1)
}
function setup(c: SqliteConnection, store: RecordContinuityPort = c.continuity) {
  const clock = new FakeClock({
    instant: '2026-10-24T20:00:00.000Z',
    localDate: '2026-10-24',
    timeZone: 'UTC'
  })
  const dependencies = { repository: c.repository, unitOfWork: c, clock, generateId: randomUUID }
  const actions = new ActionRecordingContextStore(randomUUID)
  const routines = new RoutineRecordingContextStore(randomUUID)
  const continuity = new RecordContinuity({
    store,
    ...protection,
    actions,
    routines,
    snapshot(kind, id, capturedOn) {
      if (kind === 'first') {
        const goal = id ? c.repository.findGoalById(id) : null
        if (id && !goal) throw Error('Missing')
        return goal
      }
      if (kind === 'action') {
        const a = c.repository.findActionById(id)
        if (!a) throw Error('Missing')
        return [a, a.goalId ? c.repository.findGoalById(a.goalId) : null]
      }
      const r = asRoutineRecordRepository(c.repository)
      const routine = r.findRoutineById(id)
      if (!routine) throw Error('Missing')
      return [
        routine,
        r.listRoutineScheduleDays(id),
        r.findRoutineRecordByRoutineAndDate(id, capturedOn)?.id ?? null
      ]
    }
  })
  return {
    clock,
    actions,
    routines,
    continuity,
    records: new ActionRecordService(dependencies),
    routineRecords: new RoutineRecordService(dependencies),
    actionService: new ActionService(dependencies),
    routineService: new RoutineService(dependencies),
    goals: new GoalService(dependencies)
  }
}
async function fixture(kind: RecordDraft['kind']) {
  const root = await createTemporaryTestRoot()
  roots.push(root)
  const path = join(root.database, 'continuity.sqlite3')
  const c = connect(path)
  const s = setup(c)
  let objectId: string
  if (kind === 'first') objectId = randomUUID()
  else if (kind === 'action')
    objectId = s.actionService.createAction({ title: 'Synthetic action' }).id
  else
    objectId = s.routineService.createRoutine({
      name: 'Synthetic routine',
      minimumAction: 'One step',
      arrangementMode: 'unscheduled',
      weekdays: []
    }).id
  const context =
    kind === 'routine'
      ? s.routines.begin(1, objectId, '2026-10-24')
      : s.actions.begin(1, objectId, '2026-10-24', kind === 'first')
  s.continuity.bind(kind, objectId, context)
  const dto = { recordingContextId: context.id, capturedOn: context.capturedOn }
  const common = {
    durationMinutes: '',
    summary: '',
    note: '',
    outcome: kind === 'routine' ? 'acted' : 'partial'
  }
  const draft =
    kind === 'first'
      ? {
          ...common,
          context: { ...dto, actionId: objectId },
          title: '',
          goalId: '',
          unknownDuration: false,
          outcome: '',
          lifecycle: ''
        }
      : kind === 'action'
        ? {
            ...common,
            context: { ...dto, actionId: objectId },
            understanding: '',
            confusion: '',
            nextStep: '',
            deepExpanded: false,
            postExpanded: false,
            postAction: 'keep-pending',
            nextMode: 'clear',
            replacementActionId: '',
            applyRecordedNextStep: false
          }
        : { ...common, context: { ...dto, routineId: objectId } }
  return { root, path, c, s, objectId, context, value: { kind, draft } as RecordDraft }
}
afterEach(async () => {
  for (const c of connections.splice(0)) c.close()
  await Promise.all(roots.splice(0).map(removeTemporaryTestRoot))
})

describe('quiet record continuity', () => {
  for (const kind of ['first', 'action', 'routine'] as const) {
    it(`${kind}: empty/reverted inputs stay clean; encrypted inputs resume with original date and new authority`, async () => {
      const f = await fixture(kind)
      const before = f.c.repository.readSnapshot()
      expect(hasRecordInput(f.value)).toBe(false)
      f.s.continuity.retain(f.context.id, kind, f.value.draft, 1)
      expect(f.c.continuity.list()).toEqual([])
      const entered = { ...f.value.draft, note: 'Synthetic unfinished private note' }
      f.s.continuity.retain(f.context.id, kind, entered, 3)
      f.s.continuity.retain(f.context.id, kind, { ...entered, note: 'stale' }, 2)
      expect(f.c.repository.readSnapshot()).toEqual(before)
      expect(JSON.stringify(f.c.continuity.list())).not.toContain('private note')
      expect(
        JSON.stringify(asCompleteExportRepository(f.c.repository).readCompleteCoreSnapshot())
      ).not.toContain('private note')
      close(f.c)
      expect(readFileSync(f.path).includes(Buffer.from('Synthetic unfinished private note'))).toBe(
        false
      )
      const reopened = connect(f.path)
      const next = setup(reopened)
      const [restored] = next.continuity.load(2)
      expect(restored.draft.note).toBe(entered.note)
      expect(restored.draft.context.capturedOn).toBe('2026-10-24')
      expect(restored.draft.context.recordingContextId).not.toBe(f.context.id)
      expect(restored.draft.context.continuityIssue).toBeUndefined()
      expect(() =>
        next.actions.requireSender(1, restored.draft.context.recordingContextId)
      ).toThrow()
      next.continuity.retain(
        restored.draft.context.recordingContextId,
        kind,
        { ...restored.draft, note: '' },
        1
      )
      expect(reopened.continuity.list()).toEqual([])
    })
    it(`${kind}: formal commit, receipt and draft cleanup are atomic; lost replies and late autosaves cannot replay`, async () => {
      const f = await fixture(kind)
      const entered = { ...f.value.draft, note: 'Synthetic retained note' }
      f.s.continuity.retain(f.context.id, kind, entered, 1)
      const work = () =>
        kind === 'first'
          ? f.s.records.recordFirstAction({
              actionId: f.objectId,
              recordId: f.context.operationId,
              capturedOn: f.context.capturedOn,
              title: 'Synthetic first',
              goalId: null,
              durationMinutes: null,
              outcome: 'partial',
              lifecycle: 'complete',
              note: entered.note
            })
          : kind === 'action'
            ? f.s.records.recordAction({
                actionId: f.objectId,
                capturedOn: f.context.capturedOn,
                durationMinutes: 2,
                outcome: 'partial',
                postRecord: { action: 'complete' },
                note: entered.note
              })
            : f.s.routineRecords.recordRoutine({
                routineId: f.objectId,
                capturedOn: f.context.capturedOn,
                outcome: 'acted',
                note: entered.note
              })
      expect(f.s.continuity.commit(f.context.id, work).kind).toBe('saved')
      expect(f.s.continuity.reconcile(f.context.id)).toEqual({
        state: 'saved',
        objectId: f.objectId,
        occurredOn: f.context.capturedOn
      })
      expect(() => f.s.continuity.commit(f.context.id, work)).toThrow(ContinuityError)
      f.s.continuity.retain(f.context.id, kind, entered, 2)
      expect(f.c.continuity.list()).toEqual([])
      const snapshot = f.c.repository.readSnapshot()
      expect(kind === 'routine' ? snapshot.routineRecords : snapshot.actionRecords).toHaveLength(1)
      if (kind !== 'routine') expect(snapshot.actions[0].status).toBe('completed')
      close(f.c)
      const reopened = connect(f.path)
      expect(setup(reopened).continuity.load(2)).toEqual([])
      expect(reopened.continuity.find(f.context.operationId)).toMatchObject({
        state: 'saved',
        payload: null,
        objectId: f.objectId,
        occurredOn: f.context.capturedOn
      })
    })
    it(`${kind}: explicit discard wins over a later retained revision`, async () => {
      const f = await fixture(kind)
      const entered = { ...f.value.draft, note: 'Synthetic discarded' }
      f.s.continuity.retain(f.context.id, kind, entered, 1)
      f.s.continuity.discard(f.context.id)
      f.s.continuity.retain(f.context.id, kind, entered, 100)
      expect(f.c.continuity.list()).toEqual([])
      expect(() => f.s.continuity.commit(f.context.id, () => ({ kind: 'saved' }))).toThrow()
    })
  }
  it('rolls back business effects when the receipt/cleanup fails, retaining the input', async () => {
    const f = await fixture('action')
    const entered = { ...f.value.draft, note: 'Synthetic rollback' }
    f.s.continuity.retain(f.context.id, 'action', entered, 1)
    const store = f.c.continuity
    const failing = setup(f.c, {
      list: () => store.list(),
      find: (id) => store.find(id),
      transaction: (work) => store.transaction(work),
      write: (row) => {
        if (row.state === 'saved') throw Error('Synthetic disk failure')
        store.write(row)
      }
    })
    const [restored] = failing.continuity.load(2)
    expect(() =>
      failing.continuity.commit(restored.draft.context.recordingContextId, () =>
        failing.records.recordAction({
          actionId: f.objectId,
          capturedOn: '2026-10-24',
          durationMinutes: 2,
          outcome: 'completed',
          postRecord: { action: 'complete' }
        })
      )
    ).toThrow('Synthetic disk failure')
    expect(f.c.repository.readSnapshot().actionRecords).toEqual([])
    expect(f.c.repository.findActionById(f.objectId)?.status).toBe('pending')
    expect(f.c.continuity.list()).toHaveLength(1)
  })
  it.each(['keep-captured-on', 'use-current-on'] as const)(
    'revalidates changed objects and receipts the explicit date choice %s',
    async (dateChoice) => {
      const f = await fixture('action')
      f.s.continuity.retain(
        f.context.id,
        'action',
        { ...f.value.draft, note: 'Synthetic old date' },
        1
      )
      const action = f.c.repository.findActionById(f.objectId)!
      f.c.repository.saveAction({ ...action, title: 'Changed synthetic action' })
      const next = setup(f.c)
      const [restored] = next.continuity.load(2)
      expect(restored.draft.context.continuityIssue).toBe('changed')
      expect(() =>
        next.continuity.commit(restored.draft.context.recordingContextId, () => ({ kind: 'saved' }))
      ).toThrow('context-changed')
      next.continuity.review(restored.draft.context.recordingContextId)
      next.clock.setState({
        instant: '2026-10-25T08:00:00.000Z',
        localDate: '2026-10-25',
        timeZone: 'UTC'
      })
      const input = {
        actionId: f.objectId,
        capturedOn: restored.draft.context.capturedOn,
        durationMinutes: null,
        outcome: 'partial' as const
      }
      expect(
        next.continuity.commit(restored.draft.context.recordingContextId, () =>
          next.records.recordAction(input)
        ).kind
      ).toBe('date-confirmation-required')
      expect(f.c.continuity.list()).toHaveLength(1)
      const result = next.continuity.commit(restored.draft.context.recordingContextId, () =>
        next.records.recordAction({ ...input, dateChoice })
      )
      const occurredOn = dateChoice === 'keep-captured-on' ? '2026-10-24' : '2026-10-25'
      expect(result).toMatchObject({ kind: 'saved', record: { occurredOn } })
      expect(next.continuity.reconcile(restored.draft.context.recordingContextId)).toEqual({
        state: 'saved',
        objectId: f.objectId,
        occurredOn
      })
    }
  )
  it('keeps unavailable objects and corrupted encrypted input without replay or erasure', async () => {
    const f = await fixture('action')
    f.s.continuity.retain(
      f.context.id,
      'action',
      { ...f.value.draft, note: 'Synthetic missing' },
      1
    )
    asDataControlRepository(f.c.repository).deleteRoot({ type: 'action', id: f.objectId })
    const next = setup(f.c)
    const [restored] = next.continuity.load(2)
    expect(restored.draft.context.continuityIssue).toBe('unavailable')
    expect(() => next.continuity.review(restored.draft.context.recordingContextId)).toThrow()
    const row = f.c.continuity.find(f.context.operationId)!
    f.c.continuity.write({ ...row, payload: 'corrupt synthetic ciphertext' })
    expect(() => setup(f.c).continuity.load(3)).toThrow()
    expect(f.c.continuity.list()).toHaveLength(1)
  })
  it('backs up a populated v7 database consistently before v8 and preserves export boundaries', async () => {
    const f = await fixture('action')
    close(f.c)
    const legacy = new Database(f.path)
    legacy.exec(
      "DROP TABLE thoughts; DROP TABLE record_continuity; UPDATE metadata SET value = '7' WHERE key = 'schemaVersion'"
    )
    const original = legacy.prepare('SELECT * FROM actions').all()
    legacy.close()
    const reopened = connect(f.path)
    const backups = readdirSync(f.root.database).filter((name) =>
      name.includes('before-record-continuity-v8')
    )
    expect(backups).toHaveLength(1)
    const backup = new Database(join(f.root.database, backups[0]), { readonly: true })
    try {
      expect(backup.prepare('SELECT * FROM actions').all()).toEqual(original)
      expect(
        backup.prepare("SELECT value FROM metadata WHERE key = 'schemaVersion'").pluck().get()
      ).toBe('7')
      expect(backup.pragma('integrity_check', { simple: true })).toBe('ok')
    } finally {
      backup.close()
    }
    expect(reopened.repository.readSnapshot().actions).toHaveLength(1)
    const snapshot = asCompleteExportRepository(reopened.repository).readCompleteCoreSnapshot()
    expect(snapshot.sourceDataVersion).toBe(9)
    expect(Object.keys(snapshot.coreSnapshot)).not.toContain('record_continuity')
  })
  it('preserves completion and next-action creation exactly once after a lost reply', async () => {
    const f = await fixture('first')
    const goal = f.s.goals.createGoal({
      name: 'Synthetic goal',
      initialNextAction: { title: 'Synthetic current step' }
    })
    const action = f.c.repository.readSnapshot().actions.find((a) => a.goalId === goal.id)!
    const context = f.s.actions.begin(1, action.id, '2026-10-24')
    f.s.continuity.bind('action', action.id, context)
    const work = () =>
      f.s.records.recordAction({
        actionId: action.id,
        capturedOn: context.capturedOn,
        durationMinutes: 1,
        outcome: 'partial',
        nextStep: 'Synthetic replacement',
        understanding: 'Synthetic understanding',
        confusion: 'Synthetic question',
        postRecord: {
          action: 'complete',
          currentNextResolution: { kind: 'create-from-recorded-next-step' }
        }
      })
    expect(f.s.continuity.commit(context.id, work).kind).toBe('saved')
    expect(() => f.s.continuity.commit(context.id, work)).toThrow('already-saved')
    const snapshot = f.c.repository.readSnapshot()
    expect(snapshot.actionRecords).toHaveLength(1)
    expect(snapshot.understandings).toHaveLength(1)
    expect(snapshot.confusions).toHaveLength(1)
    expect(snapshot.actions).toHaveLength(2)
    expect(snapshot.goals[0].currentNextActionId).not.toBe(action.id)
  })
  it('revalidates routine schedule and refuses a different record already occupying the day', async () => {
    const f = await fixture('routine')
    f.s.continuity.retain(
      f.context.id,
      'routine',
      { ...f.value.draft, note: 'Synthetic old arrangement' },
      1
    )
    f.s.routineService.replaceRoutineSchedule({
      routineId: f.objectId,
      arrangementMode: 'weekly',
      weekdays: [6]
    })
    const next = setup(f.c)
    const [restored] = next.continuity.load(2)
    expect(restored.draft.context.continuityIssue).toBe('changed')
    next.continuity.review(restored.draft.context.recordingContextId)
    const input = { routineId: f.objectId, capturedOn: '2026-10-24', outcome: 'acted' as const }
    next.routineRecords.recordRoutine(input)
    expect(() =>
      next.continuity.commit(restored.draft.context.recordingContextId, () =>
        next.routineRecords.recordRoutine(input)
      )
    ).toThrow('context-changed')
    next.continuity.review(restored.draft.context.recordingContextId)
    expect(() =>
      next.continuity.commit(restored.draft.context.recordingContextId, () =>
        next.routineRecords.recordRoutine(input)
      )
    ).toThrow(/already has a record/)
    expect(f.c.continuity.list()).toHaveLength(1)
    expect(f.c.repository.readSnapshot().routineRecords).toHaveLength(1)
  })
  it('rolls migration 8 back on failure and leaves version 7 with a readable backup', async () => {
    const f = await fixture('action')
    close(f.c)
    const legacy = new Database(f.path)
    legacy.exec(
      "DROP TABLE thoughts; DROP TABLE record_continuity; UPDATE metadata SET value = '7' WHERE key = 'schemaVersion'; CREATE TRIGGER fail_v8 BEFORE UPDATE ON metadata WHEN NEW.value = '8' BEGIN SELECT RAISE(ABORT, 'synthetic migration failure'); END"
    )
    legacy.close()
    expect(() => SqliteConnection.open(f.path)).toThrow('synthetic migration failure')
    const inspected = new Database(f.path)
    try {
      expect(
        inspected.prepare("SELECT value FROM metadata WHERE key = 'schemaVersion'").pluck().get()
      ).toBe('7')
      expect(
        inspected.prepare("SELECT name FROM sqlite_master WHERE name = 'record_continuity'").get()
      ).toBeUndefined()
      expect(inspected.prepare('SELECT * FROM actions').all()).toHaveLength(1)
    } finally {
      inspected.close()
    }
    expect(
      readdirSync(f.root.database).filter((name) => name.includes('before-record-continuity-v8'))
    ).toHaveLength(1)
  })
  it('does not downgrade to plaintext when protection fails', async () => {
    const f = await fixture('first')
    const continuity = new RecordContinuity({
      store: f.c.continuity,
      actions: f.s.actions,
      routines: f.s.routines,
      snapshot: () => null,
      unprotect: protection.unprotect,
      protect: () => {
        throw Error('Synthetic protection unavailable')
      }
    })
    continuity.bind('first', f.objectId, f.context)
    expect(() =>
      continuity.retain(
        f.context.id,
        'first',
        { ...f.value.draft, note: 'Synthetic secret input' },
        1
      )
    ).toThrow('Synthetic protection unavailable')
    expect(f.c.continuity.list()).toEqual([])
    expect(JSON.stringify(f.c.repository.readSnapshot())).not.toContain('Synthetic secret input')
  })
  it('validates sender capabilities and the concrete input contract before persisting', async () => {
    const f = await fixture('action')
    const handlers = new Map<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown>()
    registerRecordDraftIpc({
      ipc: {
        removeHandler: (name) => {
          handlers.delete(name)
        },
        handle: (name, fn) => {
          handlers.set(name, fn)
        }
      },
      service: f.s.continuity,
      actions: f.s.actions,
      routines: f.s.routines,
      assertSender: (event) => {
        if (event.sender.id === 99) throw Error('Untrusted sender')
      }
    })
    const input = {
      ...f.value,
      draft: { ...f.value.draft, note: 'Synthetic IPC input' },
      revision: 1
    }
    const invoke = (sender: number, value: unknown) =>
      handlers.get(DRAFT_CHANNELS.retain)!({ sender: { id: sender } } as IpcMainInvokeEvent, value)
    expect(() => invoke(99, input)).toThrow('Untrusted sender')
    expect(() => invoke(2, input)).toThrow()
    expect(() => invoke(1, { ...input, arbitraryPath: '/forbidden' })).toThrow()
    expect(() =>
      invoke(1, { ...input, draft: { ...input.draft, apiKey: 'synthetic-not-a-key' } })
    ).toThrow()
    expect(() => invoke(1, { ...input, revision: -1 })).toThrow()
    expect(f.c.continuity.list()).toEqual([])
    invoke(1, input)
    expect(f.c.continuity.list()).toHaveLength(1)
  })
})
