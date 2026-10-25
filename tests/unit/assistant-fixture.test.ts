import { mkdir, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createOfflineAssistantFixture } from '../../src/main/test-assistant-provider'
import {
  createTemporaryTestRoot,
  removeTemporaryTestRoot,
  type TemporaryTestRoot
} from '../support/temporary-test-root'

let root: TemporaryTestRoot
beforeEach(async () => {
  root = await createTemporaryTestRoot()
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('MYTRACER_E2E_ASSISTANT', 'journey')
})
afterEach(async () => {
  vi.unstubAllEnvs()
  await removeTemporaryTestRoot(root)
})
function launch() {
  return {
    isPackaged: false,
    userDataPath: root.electronUserData,
    testRoot: root.root,
    cwd: root.root
  }
}
async function mark() {
  await writeFile(join(root.root, '.assistant-synthetic-test'), 'isolated-synthetic-only', {
    flag: 'wx'
  })
}
describe('offline Assistant fixture isolation', () => {
  it('never replaces credential protection in a packaged application even with all test inputs', async () => {
    await mark()
    expect(createOfflineAssistantFixture({ ...launch(), isPackaged: true })).toBeNull()
  })
  it('rejects a normal userData directory despite test environment and marker', async () => {
    await mark()
    const normalProfile = join(root.root, 'normal-profile')
    await mkdir(normalProfile)
    expect(createOfflineAssistantFixture({ ...launch(), userDataPath: normalProfile })).toBeNull()
  })
  it('requires the explicit launch root, marker, and matching working directory', async () => {
    expect(createOfflineAssistantFixture(launch())).toBeNull()
    await mark()
    expect(createOfflineAssistantFixture({ ...launch(), testRoot: '' })).toBeNull()
    expect(createOfflineAssistantFixture({ ...launch(), cwd: root.database })).toBeNull()
  })
  it('rejects a redirected root instead of following its fixture marker', async () => {
    await mark()
    const link = join(root.artifacts, 'mytracer-tests-link')
    await symlink(root.root, link, 'junction')
    expect(createOfflineAssistantFixture({ ...launch(), testRoot: link })).toBeNull()
  })
  it('selects the synthetic transport only in the explicitly marked isolated development profile', async () => {
    await mark()
    const fixture = createOfflineAssistantFixture(launch())
    expect(fixture).not.toBeNull()
    expect(fixture?.protection.protect('synthetic-only')).toBe('synthetic-ciphertext')
    vi.stubEnv('NODE_ENV', 'production')
    expect(createOfflineAssistantFixture(launch())).toBeNull()
  })
})
