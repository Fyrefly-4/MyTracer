import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, test } from 'vitest'

const checker = await import(
  pathToFileURL(join(process.cwd(), 'tools/ci/check-diagnostics.mjs')).href
)
const report = (status: string, message: string) => ({
  errors: [],
  suites: [
    { specs: [{ tests: [{ results: [{ status, errors: [{ message }], attachments: [] }] }] }] }
  ]
})
test('a green probe cannot validate failure evidence', () => {
  expect(() => checker.validateDiagnosticReport(report('passed', ''), 0)).toThrow(
    'Expected assertion failure'
  )
})
test.each(['skipped', 'timedOut', 'interrupted'])(
  'rejects %s rather than treating it as the negative control',
  (status) => {
    expect(() =>
      checker.validateDiagnosticReport(report(status, 'diagnostic-negative-control'), 1)
    ).toThrow('controlled assertion')
  }
)
test('an unrelated failure cannot validate the control', () => {
  expect(() =>
    checker.validateDiagnosticReport(report('failed', 'sandbox launch failed'), 1)
  ).toThrow('controlled assertion')
})
test('the intended failure without attachments cannot pass', () => {
  expect(() =>
    checker.validateDiagnosticReport(report('failed', 'diagnostic-negative-control'), 1)
  ).toThrow('Missing electron-window-0')
})

test('an additional cleanup failure is not swallowed by the control', () => {
  const data = report('failed', 'diagnostic-negative-control')
  data.suites[0].specs[0].tests[0].results[0].errors.push({ message: 'cleanup failed' })
  expect(() => checker.validateDiagnosticReport(data, 1)).toThrow('controlled assertion')
})
