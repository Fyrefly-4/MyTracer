import { spawnSync } from 'node:child_process'
import { expect, test } from 'vitest'

// The child suite has its own hard deadline; Vitest must allow it to finish/report failure.
const childTimeoutMs = 60_000

test(
  'Release PR pipeline preserves approval, retry, integrity and publication boundaries',
  () => {
    const args = ['--test', 'tests/support/release-pr-scenarios.mjs']
    const result = spawnSync(process.execPath, args, {
      cwd: process.cwd(),
      encoding: 'utf8',
      windowsHide: true,
      timeout: childTimeoutMs
    })
    expect(result.status, result.error?.message ?? `${result.stdout}\n${result.stderr}`).toBe(0)
  },
  childTimeoutMs + 10_000
)
