import { describe, expect, it } from 'vitest'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore Main is compiled by the node project; Vitest exercises this gate at runtime.
import { InstallOperationGate } from '../../src/main/install-operation-gate'

describe('T083 Main install operation gate', () => {
  it('rejects new operations during preparation and waits for an existing export', async () => {
    const gate = new InstallOperationGate()
    let finish: (() => void) | undefined
    const exportResult = gate.run(() => new Promise<void>((resolve) => (finish = resolve)))
    expect(gate.beginPreparation()).toBe(true)
    expect(() => gate.run(() => 'write')).toThrow('unavailable')
    expect(gate.seal()).toBe(false)
    const drain = gate.drain(new AbortController().signal)
    finish?.()
    await exportResult
    expect(await drain).toBe(true)
    expect(gate.seal()).toBe(true)
    expect(() => gate.run(() => 'write')).toThrow('unavailable')
  })

  it('opens the old application again after cancellation or timeout', async () => {
    const gate = new InstallOperationGate()
    expect(gate.beginPreparation()).toBe(true)
    const controller = new AbortController()
    const drain = gate.drain(controller.signal)
    controller.abort()
    expect(await drain).toBe(false)
    expect(gate.cancelPreparation()).toBe(true)
    expect(gate.run(() => 'old app available')).toBe('old app available')
  })

  it('does not leave rejected in-flight work as a permanent blocker', async () => {
    const gate = new InstallOperationGate()
    const pending = gate.run(() => Promise.reject(new Error('export failed')))
    expect(gate.beginPreparation()).toBe(true)
    await expect(pending).rejects.toThrow('export failed')
    expect(await gate.drain(new AbortController().signal)).toBe(true)
    expect(gate.seal()).toBe(true)
  })
})
