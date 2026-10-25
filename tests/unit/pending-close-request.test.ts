import { expect, it, vi } from 'vitest'
import { PendingCloseRequest } from '../../src/preload/pending-close-request'
it('delivers a startup close request after renderer mount, including StrictMode resubscription', () => {
  const requests = new PendingCloseRequest()
  requests.receive('close-1')
  const first = vi.fn()
  const unsubscribe = requests.subscribe(first)
  expect(first).toHaveBeenCalledWith('close-1')
  unsubscribe()
  const second = vi.fn()
  requests.subscribe(second)
  expect(second).toHaveBeenCalledWith('close-1')
  requests.receive('')
  expect(second).toHaveBeenLastCalledWith('')
  expect(first).toHaveBeenCalledTimes(1)
})
it('does not resurrect a cancelled startup request', () => {
  const requests = new PendingCloseRequest()
  requests.receive('close-1')
  requests.receive('')
  const listener = vi.fn()
  requests.subscribe(listener)
  expect(listener).toHaveBeenCalledExactlyOnceWith('')
})
