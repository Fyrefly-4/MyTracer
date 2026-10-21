import { spawnSync } from 'node:child_process'
import { expect, test } from 'vitest'

test('Release PR pipeline preserves approval, retry, integrity and publication boundaries', () => {
  const result = spawnSync(process.execPath, ['--test', 'tests/support/release-pr-scenarios.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000
  })
  expect(result.status, result.error?.message ?? `${result.stdout}\n${result.stderr}`).toBe(0)
})
