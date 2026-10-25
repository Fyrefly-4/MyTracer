import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: '.',
  testMatch: 'assistant.browser.test.ts',
  fullyParallel: false,
  outputDir: '../../.tmp/assistant-browser-results',
  use: {
    baseURL: 'http://127.0.0.1:4178',
    headless: true,
    launchOptions: { executablePath: process.env.MYTRACER_TEST_CHROMIUM }
  },
  webServer: {
    command: 'node_modules/.bin/vite --config tests/renderer/assistant.vite.config.ts',
    cwd: '../..',
    url: 'http://127.0.0.1:4178/tests/renderer/assistant-harness.html',
    reuseExistingServer: false
  }
})
