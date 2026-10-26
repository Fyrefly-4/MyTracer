import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import type { IpcMainInvokeEvent } from 'electron'
import { expect, it } from 'vitest'
import { ReviewService } from '../../src/application/review'
import { DataControlService } from '../../src/application/data-control'
import { buildRecordBook } from '../../src/application/record-book'
import { REVIEW_CHANNELS, type BeginReviewDto, type ReviewResult } from '../../src/contracts/review'
import { SqliteConnection } from '../../src/infrastructure/sqlite/sqlite-connection'
import { FakeClock } from '../support/fake-clock'
import { createTemporaryTestRoot, removeTemporaryTestRoot } from '../support/temporary-test-root'

const ipcModulePath = '../../src/main/review-ipc'
const contextModulePath = '../../src/main/review-contexts'
const { registerReviewIpc } = await import(ipcModulePath)
const { ReviewContextStore } = await import(contextModulePath)

it('acknowledges one explicit save only after a weekly result is durable and readable outside the ordinary record list', async () => {
  const root = await createTemporaryTestRoot()
  const path = join(root.database, 'review-save.sqlite3')
  let connection: SqliteConnection | undefined
  const clock = new FakeClock({
    instant: '2026-10-25T12:00:00.000Z',
    localDate: '2026-10-25',
    timeZone: 'Etc/UTC'
  })
  try {
    connection = SqliteConnection.open(path)
    const dependencies = {
      repository: connection.repository,
      unitOfWork: connection,
      generateId: randomUUID,
      clock
    }
    const handlers = new Map<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown>()
    registerReviewIpc({
      ipc: {
        removeHandler: (channel: string) => handlers.delete(channel),
        handle: (
          channel: string,
          handler: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown
        ) => handlers.set(channel, handler)
      },
      service: new ReviewService(dependencies),
      contexts: new ReviewContextStore(randomUUID),
      assertSender: (event: IpcMainInvokeEvent) => expect(event.sender.id).toBe(7)
    })
    const invoke = (channel: string, input: unknown) =>
      handlers.get(channel)!({ sender: { id: 7 } } as IpcMainInvokeEvent, input)
    const begun = invoke(REVIEW_CHANNELS.begin, {}) as ReviewResult<BeginReviewDto>
    expect(begun.ok).toBe(true)
    if (!begun.ok) throw new Error('Synthetic review did not begin')
    const input = {
      reviewContextId: begun.value.reviewContextId,
      confirmedProgress: '合成进展',
      mainObstacle: '合成阻力',
      nextAdjustment: '合成调整',
      relatedGoalId: null,
      nextStepChange: { kind: 'none' }
    }
    expect(invoke(REVIEW_CHANNELS.complete, input)).toMatchObject({
      ok: true,
      value: { confirmedProgress: input.confirmedProgress, periodStartedOn: '2026-10-19' }
    })
    const saved = connection.repository.readSnapshot().reviewResults
    expect(saved).toHaveLength(1)
    const ordinaryList = new DataControlService(dependencies).listData()
    expect(ordinaryList.actionRecords).toEqual([])
    expect(ordinaryList.routineRecords).toEqual([])
    expect(ordinaryList).not.toHaveProperty('reviewResults')
    // A repeated submission of the consumed context must not produce a second write.
    expect(invoke(REVIEW_CHANNELS.complete, input)).toMatchObject({
      ok: false,
      error: { code: 'context-stale' }
    })
    connection.close()
    connection = SqliteConnection.open(path)
    expect(connection.repository.readSnapshot().reviewResults).toEqual(saved)
    const reopened = new ReviewService({ repository: connection.repository, clock })
    expect(reopened.getReviewResult(reopened.beginReview())).toMatchObject({
      confirmedProgress: input.confirmedProgress,
      mainObstacle: input.mainObstacle,
      nextAdjustment: input.nextAdjustment
    })
    const book = buildRecordBook(connection.repository.readSnapshot())
    expect(book.months.flatMap((month) => month.days.flatMap((day) => day.entries))).toEqual([
      expect.objectContaining({
        kind: 'review',
        date: '2026-10-19',
        fields: expect.arrayContaining([
          { label: '确认的进展', text: input.confirmedProgress },
          { label: '主要障碍', text: input.mainObstacle },
          { label: '下一步调整', text: input.nextAdjustment }
        ])
      })
    ])
  } finally {
    connection?.close()
    await removeTemporaryTestRoot(root)
  }
})
