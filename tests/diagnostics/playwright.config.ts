import { defineConfig } from '@playwright/test'
import { resolve } from 'node:path'
import base from '../../playwright.config'
export default defineConfig({
  ...base,
  testDir: '.',
  testMatch: '*.probe.ts',
  reporter: [
    [
      'json',
      {
        outputFile: resolve(
          process.env.RUNNER_TEMP ?? '.tmp',
          'mytracer-ci-phases',
          'diagnostics-probe.json'
        )
      }
    ]
  ]
})
