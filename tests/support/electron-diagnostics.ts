import { test, type ElectronApplication, type Page, type TestInfo } from '@playwright/test'

// Only attach to apps launched with an isolated synthetic root and minimal environment.
// Never collect environment variables, databases, exports or arbitrary application files.
export async function startElectronDiagnostics(
  app: ElectronApplication,
  info: TestInfo
): Promise<(failure?: unknown) => Promise<void>> {
  const errors: string[] = []
  const record = (message: string): void => {
    if (errors.length < 100) errors.push(message.slice(0, 2000))
  }
  const watch = (page: Page): void => {
    page.on('pageerror', (error) => record(`renderer: ${error.message}`))
    page.on('console', (message) => {
      if (message.type() === 'error') record(`renderer console: ${message.text()}`)
    })
    page.on('crash', () => record('renderer crashed'))
  }
  app.on('window', watch)
  for (const page of app.windows()) watch(page)
  app.on('console', (message) => {
    if (message.type() === 'error') record(`main console: ${message.text()}`)
  })
  await test.step('Start trace on actual Electron context', () =>
    app.context().tracing.start({ screenshots: true, snapshots: true, sources: false }))
  let finished = false
  return async (failure?: unknown): Promise<void> => {
    if (finished) return
    finished = true
    if (failure === undefined) {
      await app.context().tracing.stop()
      return
    }
    // Individual capture failures must not prevent other evidence or mask the original failure.
    for (const [index, page] of app.windows().entries()) {
      try {
        const path = info.outputPath(`electron-window-${index}.png`)
        await page.screenshot({ path, timeout: 5000 })
        await info.attach(`electron-window-${index}`, { path, contentType: 'image/png' })
      } catch (error) {
        record(`screenshot unavailable: ${String(error)}`)
      }
    }
    try {
      const path = info.outputPath('electron-trace.zip')
      await app.context().tracing.stop({ path })
      await info.attach('electron-trace', { path, contentType: 'application/zip' })
    } catch (error) {
      record(`trace unavailable: ${String(error)}`)
    }
    try {
      await info.attach('electron-errors', {
        body: JSON.stringify({ failure: String(failure), errors }, null, 2),
        contentType: 'application/json'
      })
    } catch (error) {
      console.error('Could not attach Electron error diagnostics:', String(error))
    }
  }
}
