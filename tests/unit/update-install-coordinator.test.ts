import { describe, expect, it, vi } from 'vitest'
import { UpdateService } from '../../src/application/update-service'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore Main is compiled by the node project; Vitest exercises this coordinator at runtime.
import { UpdateInstallCoordinator } from '../../src/main/update-install-coordinator'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore Main is compiled by the node project; Vitest exercises this gate at runtime.
import { InstallOperationGate } from '../../src/main/install-operation-gate'

const input = { operationId: 'operation-1', version: '0.1.4' }

async function setup(
  options: {
    probe?: () => Promise<'clear' | 'unsaved' | 'unavailable'>
    verify?: () => Promise<boolean>
    startInstall?: () => boolean
    deadlineMs?: number
  } = {}
) {
  const startInstall = vi.fn(options.startInstall ?? (() => true))
  const service = new UpdateService({
    port: {
      check: async () => ({
        version: input.version,
        releaseNotes: 'Stable update',
        download: async () => ({ verify: options.verify ?? (async () => true), startInstall })
      })
    },
    currentVersion: '0.1.3',
    generateId: () => input.operationId
  })
  await service.check()
  await service.download(input)
  const gate = new InstallOperationGate()
  const closeDatabase = vi.fn()
  const quitApplication = vi.fn()
  const cancelAiRequests = vi.fn()
  const coordinator = new UpdateInstallCoordinator({
    service,
    gate,
    probeDrafts: options.probe ?? (async () => 'clear'),
    hasPendingAiDraft: () => false,
    cancelAiRequests,
    closeDatabase,
    quitApplication,
    drainDeadlineMs: options.deadlineMs ?? 1000
  })
  return {
    service,
    gate,
    coordinator,
    startInstall,
    closeDatabase,
    quitApplication,
    cancelAiRequests
  }
}

describe('T083 installation coordination', () => {
  it('blocks new commands during package verification and restores them on cancellation', async () => {
    let finishVerification: ((valid: boolean) => void) | undefined
    const flow = await setup({
      verify: () => new Promise<boolean>((resolve) => (finishVerification = resolve))
    })
    const installing = flow.coordinator.install(input)
    await vi.waitFor(() => expect(finishVerification).toBeDefined())
    expect(flow.service.getStatus().state).toBe('preparing')
    expect(flow.gate.state).toBe('preparing')
    const write = vi.fn()
    expect(() => flow.gate.run(write)).toThrow('unavailable')
    expect(write).not.toHaveBeenCalled()
    flow.coordinator.cancelPreparation({ operationId: input.operationId })
    expect((await installing).blocker).toBe('cancelled')
    finishVerification?.(true)
    await Promise.resolve()
    expect(flow.service.getStatus().state).toBe('downloaded')
    expect(flow.gate.run(() => 'old-app-write')).toBe('old-app-write')
    expect(flow.closeDatabase).not.toHaveBeenCalled()
    expect(flow.startInstall).not.toHaveBeenCalled()
  })

  it('reopens the gate when preparation package verification fails', async () => {
    const flow = await setup({ verify: async () => false })
    expect((await flow.coordinator.install(input)).status.error?.code).toBe('integrity')
    expect(flow.gate.run(() => 'old-app-write')).toBe('old-app-write')
    expect(flow.closeDatabase).not.toHaveBeenCalled()
    expect(flow.startInstall).not.toHaveBeenCalled()
  })

  it('blocks unsaved Renderer content without closing the database', async () => {
    const flow = await setup({ probe: async () => 'unsaved' })
    expect((await flow.coordinator.install(input)).blocker).toBe('unsaved-content')
    expect(flow.service.getStatus().state).toBe('downloaded')
    expect(flow.gate.state).toBe('open')
    expect(flow.closeDatabase).not.toHaveBeenCalled()
    expect(flow.startInstall).not.toHaveBeenCalled()
  })

  it('cancels preparation if a draft appears before the final Renderer barrier', async () => {
    let probes = 0
    const flow = await setup({ probe: async () => (++probes === 1 ? 'clear' : 'unsaved') })
    expect((await flow.coordinator.install(input)).blocker).toBe('unsaved-content')
    expect(probes).toBe(2)
    expect(flow.service.getStatus().state).toBe('downloaded')
    expect(flow.gate.state).toBe('open')
    expect(flow.closeDatabase).not.toHaveBeenCalled()
  })

  it('drains an in-flight command before closing DB and starting installer', async () => {
    const flow = await setup()
    const order: string[] = []
    let finish: (() => void) | undefined
    const pending = flow.gate.run(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        })
    )
    flow.closeDatabase.mockImplementation(() => order.push('close'))
    flow.startInstall.mockImplementation(() => {
      order.push('installer')
      return true
    })
    const installing = flow.coordinator.install(input)
    await vi.waitFor(() => expect(flow.gate.state).toBe('preparing'))
    expect(() => flow.gate.run(() => 'write')).toThrow('unavailable')
    expect(flow.closeDatabase).not.toHaveBeenCalled()
    finish?.()
    await pending
    expect((await installing).status.state).toBe('installing')
    expect(order).toEqual(['close', 'installer'])
    expect(flow.cancelAiRequests).toHaveBeenCalledOnce()
    expect(flow.gate.state).toBe('closed')
  })

  it('restores the old app when drain times out', async () => {
    const flow = await setup({ deadlineMs: 20 })
    let finish: (() => void) | undefined
    const pending = flow.gate.run(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        })
    )
    expect((await flow.coordinator.install(input)).blocker).toBe('timeout')
    expect(flow.service.getStatus().state).toBe('downloaded')
    expect(flow.gate.state).toBe('open')
    expect(flow.closeDatabase).not.toHaveBeenCalled()
    expect(flow.startInstall).not.toHaveBeenCalled()
    finish?.()
    await pending
  })

  it('blocks installation if Renderer becomes unavailable while existing work drains', async () => {
    let rendererAvailable = true
    let probes = 0
    const flow = await setup({
      probe: async () => {
        probes += 1
        return rendererAvailable ? 'clear' : 'unavailable'
      }
    })
    let finish: (() => void) | undefined
    const pending = flow.gate.run(() => new Promise<void>((resolve) => (finish = resolve)))
    const installing = flow.coordinator.install(input)
    await vi.waitFor(() => expect(flow.cancelAiRequests).toHaveBeenCalledOnce())
    rendererAvailable = false
    finish?.()
    await pending
    expect((await installing).blocker).toBe('renderer-unavailable')
    expect(probes).toBe(3)
    expect(flow.gate.state).toBe('open')
    expect(flow.service.getStatus().state).toBe('downloaded')
    expect(flow.closeDatabase).not.toHaveBeenCalled()
    expect(flow.startInstall).not.toHaveBeenCalled()
  })

  it('honors explicit cancellation while an existing operation drains', async () => {
    const flow = await setup()
    let finish: (() => void) | undefined
    const pending = flow.gate.run(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        })
    )
    const installing = flow.coordinator.install(input)
    await vi.waitFor(() => expect(flow.gate.state).toBe('preparing'))
    expect(flow.coordinator.cancelPreparation({ operationId: input.operationId }).state).toBe(
      'downloaded'
    )
    expect((await installing).blocker).toBe('cancelled')
    expect(flow.gate.state).toBe('open')
    expect(flow.closeDatabase).not.toHaveBeenCalled()
    finish?.()
    await pending
  })

  it('keeps writes blocked when installer handoff fails after DB closure', async () => {
    const flow = await setup({ startInstall: () => false })
    expect((await flow.coordinator.install(input)).blocker).toBe('restart-required')
    expect(flow.closeDatabase).toHaveBeenCalledOnce()
    expect(flow.gate.state).toBe('closed')
    expect(flow.service.getStatus().state).toBe('restartRequired')
    expect((await flow.service.check()).state).toBe('restartRequired')
    expect(flow.quitApplication).not.toHaveBeenCalled()
  })
})
