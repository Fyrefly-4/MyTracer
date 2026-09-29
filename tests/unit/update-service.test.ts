import { describe, expect, it, vi } from 'vitest'
import { UpdateService } from '../../src/application/update-service'
import {
  UpdatePortError,
  type CheckedUpdate,
  type UpdatePort
} from '../../src/application/ports/update'

function candidate(version = '0.1.3'): CheckedUpdate {
  return { version, releaseNotes: '<b>Release notes</b>', download: vi.fn(async () => undefined) }
}

function service(port: UpdatePort): UpdateService {
  let nextId = 0
  return new UpdateService({
    port,
    currentVersion: '0.1.2',
    generateId: () => `operation-${++nextId}`,
    checkDeadlineMs: 100,
    downloadDeadlineMs: 100
  })
}

describe('T082 update service', () => {
  it('checks only on request and downloads only the exact confirmed candidate', async () => {
    const checked = candidate()
    const port = { check: vi.fn(async () => checked) }
    const updates = service(port)
    expect(port.check).not.toHaveBeenCalled()
    const available = await updates.check()
    expect(available).toMatchObject({
      state: 'available',
      operationId: 'operation-1',
      candidate: { version: '0.1.3', releaseNotes: '<b>Release notes</b>' }
    })
    await updates.download({ operationId: 'wrong', version: '0.1.3' })
    await updates.download({ operationId: 'operation-1', version: '0.1.4' })
    expect(checked.download).not.toHaveBeenCalled()
    const downloaded = await updates.download({ operationId: 'operation-1', version: '0.1.3' })
    expect(downloaded.state).toBe('downloaded')
    expect(checked.download).toHaveBeenCalledOnce()
  })

  it.each([
    ['0.1.2', 'upToDate'],
    ['0.1.1', 'error'],
    ['0.1.3-beta.1', 'error'],
    ['0.1.3', 'available']
  ] as const)('classifies source version %s as %s', async (version, state) => {
    const updates = service({ check: async () => candidate(version) })
    const result = await updates.check()
    expect(result.state).toBe(state)
    if (state === 'error') expect(result.error?.code).toBe('unsupported-version')
  })

  it('keeps authentication and unavailable errors distinct from up to date', async () => {
    const authentication = service({
      check: async () => {
        throw new UpdatePortError('authentication')
      }
    })
    const unavailable = service({
      check: async () => {
        throw new UpdatePortError('not-configured')
      }
    })
    expect((await authentication.check()).error?.code).toBe('authentication')
    expect((await unavailable.check()).error?.code).toBe('not-configured')
  })

  it('ignores a late cancelled check and keeps the later candidate', async () => {
    let releaseFirst: ((value: CheckedUpdate) => void) | undefined
    const port = {
      check: vi
        .fn()
        .mockImplementationOnce(
          () => new Promise<CheckedUpdate>((resolve) => (releaseFirst = resolve))
        )
        .mockImplementationOnce(async () => candidate('0.1.4'))
    }
    const updates = service(port)
    const first = updates.check()
    expect(updates.cancel({ operationId: 'operation-1' }).error?.code).toBe('cancelled')
    expect((await updates.check()).candidate?.version).toBe('0.1.4')
    releaseFirst?.(candidate('0.1.3'))
    await first
    expect(updates.getStatus().candidate?.version).toBe('0.1.4')
  })

  it('rejects duplicate work and supports retry after a download failure', async () => {
    let resolveDownload: (() => void) | undefined
    const download = vi
      .fn()
      .mockRejectedValueOnce(new UpdatePortError('network'))
      .mockImplementationOnce(() => new Promise<void>((resolve) => (resolveDownload = resolve)))
    const updates = service({ check: async () => ({ ...candidate(), download }) })
    const available = await updates.check()
    const input = { operationId: available.operationId!, version: available.candidate!.version }
    expect((await updates.download(input)).error).toMatchObject({
      code: 'network',
      retryAction: 'download'
    })
    const pending = updates.download(input)
    expect((await updates.download(input)).state).toBe('downloading')
    resolveDownload?.()
    expect((await pending).state).toBe('downloaded')
    expect(download).toHaveBeenCalledTimes(2)
  })

  it('ignores progress and completion from a cancelled download', async () => {
    let resolveDownload: (() => void) | undefined
    let progress: ((percent: number) => void) | undefined
    const updates = service({
      check: async () => ({
        ...candidate(),
        download: async (_signal, onProgress) => {
          progress = onProgress
          await new Promise<void>((resolve) => (resolveDownload = resolve))
        }
      })
    })
    const available = await updates.check()
    const input = { operationId: available.operationId!, version: available.candidate!.version }
    const pending = updates.download(input)
    updates.cancel({ operationId: input.operationId })
    progress?.(99)
    resolveDownload?.()
    await pending
    expect(updates.getStatus()).toMatchObject({ state: 'error', error: { code: 'cancelled' } })
    expect(updates.getStatus().progressPercent).toBeUndefined()
  })
})
