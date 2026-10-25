import { spawnSync } from 'node:child_process'
import { readFileSync, rmSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function validateDiagnosticReport(data, exitCode) {
  // A green, skipped, timed-out, crashed or unrelated failing child is not a successful control.
  if (exitCode !== 1) throw new Error(`Expected assertion failure exit 1, got ${exitCode}`)
  const specs = data.suites.flatMap((suite) => suite.specs)
  if (data.errors.length || specs.length !== 1)
    throw new Error('Unexpected probe collection result')
  const results = specs[0].tests.flatMap((test) => test.results)
  if (
    results.length !== 1 ||
    results[0].status !== 'failed' ||
    results[0].errors.length !== 1 ||
    !results[0].errors.some((error) => error.message.includes('diagnostic-negative-control'))
  ) {
    throw new Error('Probe did not reach the controlled assertion')
  }
  for (const name of ['electron-window-0', 'electron-trace', 'electron-errors']) {
    const attachment = results[0].attachments.find((item) => item.name === name)
    if (!attachment) throw new Error(`Missing ${name}`)
    const bytes = attachment.path
      ? readFileSync(attachment.path)
      : Buffer.from(attachment.body, 'base64')
    if (!bytes.length) throw new Error(`Empty ${name}`)
    if (name === 'electron-window-0' && bytes.subarray(1, 4).toString() !== 'PNG')
      throw new Error('Invalid screenshot')
    if (
      name === 'electron-trace' &&
      (bytes.subarray(0, 2).toString() !== 'PK' || statSync(attachment.path).size < 100)
    )
      throw new Error('Invalid trace')
    if (name === 'electron-errors') {
      const log = JSON.parse(bytes.toString())
      for (const marker of ['synthetic-diagnostic-error', 'synthetic-main-diagnostic-error']) {
        if (!log.errors.some((error) => error.includes(marker)))
          throw new Error('Missing application error')
      }
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = join(
    process.env.RUNNER_TEMP ?? '.tmp',
    'mytracer-ci-phases',
    'diagnostics-probe.json'
  )
  rmSync(report, { force: true })
  const child = spawnSync(
    process.execPath,
    [
      'node_modules/@playwright/test/cli.js',
      'test',
      '--config=tests/diagnostics/playwright.config.ts'
    ],
    { stdio: 'inherit' }
  )
  validateDiagnosticReport(JSON.parse(readFileSync(report, 'utf8')), child.status)
  console.log(
    'Controlled failure stayed failed; screenshot, actual-context trace and application error attached.'
  )
}
