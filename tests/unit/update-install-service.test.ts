import { describe, expect, it, vi } from 'vitest'
import { UpdateService } from '../../src/application/update-service'
import type { DownloadedUpdate } from '../../src/application/ports/update'

function createService(downloaded: DownloadedUpdate): UpdateService {
  return new UpdateService({
    port: {
      check: async () => ({
        version: '0.1.4',
        releaseNotes: 'Stable update',
        download: async () => downloaded
      })
    },
    currentVersion: '0.1.3',
    generateId: () => 'operation-1'
  })
}

async function reachDownloaded(service: UpdateService): Promise<void> {
  await service.check()
  await service.download({ operationId: 'operation-1', version: '0.1.4' })
}

describe('T083 install preparation', () => {
  it('never installs without an exact downloaded candidate and explicit preparation', async () => {
    const startInstall = vi.fn(() => true)
    const service = createService({ verify: async () => true, startInstall })
    const input = { operationId: 'operation-1', version: '0.1.4' }
    expect((await service.confirmInstall(input)).state).toBe('idle')
    await reachDownloaded(service)
    expect((await service.confirmInstall(input)).state).toBe('downloaded')
    expect((await service.prepareInstall({ ...input, version: '0.1.5' })).state).toBe('downloaded')
    expect((await service.prepareInstall({ ...input, operationId: 'stale' })).state).toBe(
      'downloaded'
    )
    expect(startInstall).not.toHaveBeenCalled()
    expect((await service.prepareInstall(input)).state).toBe('preparing')
    expect(startInstall).not.toHaveBeenCalled()
    expect((await service.confirmInstall(input)).state).toBe('installing')
    expect(startInstall).toHaveBeenCalledOnce()
    expect((await service.confirmInstall(input)).state).toBe('installing')
    expect(startInstall).toHaveBeenCalledOnce()
  })

  it('verifies again before preparation and before installer execution', async () => {
    const verify = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    const startInstall = vi.fn(() => true)
    const service = createService({ verify, startInstall })
    await reachDownloaded(service)
    const input = { operationId: 'operation-1', version: '0.1.4' }
    expect((await service.prepareInstall(input)).state).toBe('preparing')
    expect((await service.confirmInstall(input)).error?.code).toBe('integrity')
    expect(verify).toHaveBeenCalledTimes(2)
    expect(startInstall).not.toHaveBeenCalled()
  })

  it('cancellation preserves the old application and ignores late verification', async () => {
    let resolveVerification: ((valid: boolean) => void) | undefined
    const startInstall = vi.fn(() => true)
    const service = createService({
      verify: () => new Promise<boolean>((resolve) => (resolveVerification = resolve)),
      startInstall
    })
    await reachDownloaded(service)
    const input = { operationId: 'operation-1', version: '0.1.4' }
    const pending = service.prepareInstall(input)
    expect(service.cancelPreparation({ operationId: 'stale' }).state).toBe('preparing')
    expect(service.cancel({ operationId: input.operationId }).state).toBe('preparing')
    expect(service.cancelPreparation({ operationId: input.operationId }).state).toBe('downloaded')
    resolveVerification?.(true)
    await pending
    expect(service.getStatus().state).toBe('downloaded')
    expect(startInstall).not.toHaveBeenCalled()
  })

  it('does not start installer when the updater rejects the handoff', async () => {
    const service = createService({ verify: async () => true, startInstall: () => false })
    await reachDownloaded(service)
    const input = { operationId: 'operation-1', version: '0.1.4' }
    await service.prepareInstall(input)
    expect((await service.confirmInstall(input)).state).toBe('error')
  })
})
