import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.e2e.test.ts',
  outputDir: join(
    process.env.RUNNER_TEMP ?? tmpdir(),
    'mytracer-playwright-results',
    String(process.pid)
  ),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: [['list']],
  use: {
    screenshot: 'off',
    trace: 'off',
    video: 'off'
  }
})
