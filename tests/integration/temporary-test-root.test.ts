import { access, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  assertExistingPathWithinRoot,
  createTemporaryTestRoot,
  removeTemporaryTestRoot
} from '../support/temporary-test-root'

describe('temporary test data roots', () => {
  it('creates unique isolated roots and removes only the owned root', async () => {
    const first = await createTemporaryTestRoot()
    const second = await createTemporaryTestRoot()
    let firstRemoved = false

    try {
      expect(first.root).not.toBe(second.root)
      expect(await assertExistingPathWithinRoot(first, first.electronUserData)).toBe(
        await realpath(first.electronUserData)
      )
      expect(await assertExistingPathWithinRoot(first, first.database)).toBe(
        await realpath(first.database)
      )
      await expect(assertExistingPathWithinRoot(first, second.root)).rejects.toThrow(/outside/)

      await removeTemporaryTestRoot(first)
      firstRemoved = true
      await expect(access(first.root)).rejects.toThrow()
      await expect(access(second.root)).resolves.toBeUndefined()
    } finally {
      if (!firstRemoved) {
        await removeTemporaryTestRoot(first)
      }
      await removeTemporaryTestRoot(second)
    }
  })

  it('rejects the OS temporary directory itself as a test child path', async () => {
    const root = await createTemporaryTestRoot()

    try {
      await expect(assertExistingPathWithinRoot(root, tmpdir())).rejects.toThrow(/outside/)
    } finally {
      await removeTemporaryTestRoot(root)
    }
  })

  it('refuses cleanup for a forged root object', async () => {
    const first = await createTemporaryTestRoot()
    const second = await createTemporaryTestRoot()
    const forgedSystemRoot = { ...first, root: tmpdir() }
    const forgedOwnedRoot = { ...first, root: second.root }

    try {
      await expect(removeTemporaryTestRoot(forgedSystemRoot)).rejects.toThrow(/unowned/)
      await expect(removeTemporaryTestRoot(forgedOwnedRoot)).rejects.toThrow(/unowned/)
      await expect(access(first.root)).resolves.toBeUndefined()
      await expect(access(second.root)).resolves.toBeUndefined()
    } finally {
      await removeTemporaryTestRoot(first)
      await removeTemporaryTestRoot(second)
    }
  })
})
