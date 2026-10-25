import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, test } from 'vitest'

const { focusPlan, validateFocusReport } = await import(
  pathToFileURL(join(process.cwd(), 'tools/ci/focus-plan.mjs')).href
)

test.each(['1', '3'])('selects exact synthetic regressions with %s independent runs', (repeat) => {
  expect(focusPlan('data-reading', repeat)).toEqual({
    profile: 'data-reading',
    repeat: Number(repeat),
    arguments: [
      'tests/e2e/data-reading-workspace.e2e.test.ts',
      '--grep=history',
      `--repeat-each=${repeat}`
    ]
  })
  expect(focusPlan('content-drafts', repeat).arguments).toEqual([
    'tests/e2e/goal-content-draft.e2e.test.ts',
    'tests/e2e/routine-content-draft.e2e.test.ts',
    `--repeat-each=${repeat}`
  ])
})

test.each([
  '',
  undefined,
  '../shell.e2e.test.ts',
  'data-reading && echo unexpected',
  '--workers=4',
  'toString',
  '__proto__'
])('rejects unapproved selection %s', (profile) => {
  expect(() => focusPlan(profile, '1')).toThrow('Unknown focused Electron profile')
})
test.each(['', undefined, '0', '2', '4', '01', '1 --retries=2'])(
  'rejects unbounded or injected repeat %s',
  (repeat) => {
    expect(() => focusPlan('data-reading', repeat)).toThrow('Focus repeat must be 1 or 3')
  }
)

test('focused entrypoint stays separate from required verification and preserves safety controls', () => {
  const workflow = readFileSync('.github/workflows/electron-focus.yml', 'utf8')
  const gate = readFileSync('.github/workflows/verify.yml', 'utf8')
  expect(workflow).toContain('name: Focused Electron (not CI Gate)')
  expect(workflow).toContain('workflow_dispatch:')
  expect(workflow).toContain('contents: read')
  expect(workflow).toContain('persist-credentials: false')
  expect(workflow).toContain('runs-on: windows-2025')
  expect(workflow).toContain('node-version: 24.18.0')
  expect(workflow).toContain('retention-days: 7')
  expect(workflow).toContain('group: ${{ github.workflow }}-')
  expect(workflow).toContain('cancel-in-progress: true')
  expect(workflow).not.toMatch(/pull_request_target|continue-on-error|contents: write/)
  expect(workflow).not.toMatch(/run:.*\$\{\{/)
  expect(workflow.indexOf('run: node tools/ci/focus-plan.mjs')).toBeLessThan(
    workflow.indexOf('run: node tools/ci/run-phase.mjs install')
  )
  for (const phase of ['install', 'electron', 'build', 'diagnostics', 'focus']) {
    expect(workflow).toContain(`run: node tools/ci/run-phase.mjs ${phase}`)
  }
  expect(gate).toContain('name: CI Gate')
  expect(gate).toContain('run: node tools/ci/run-phase.mjs e2e')
  expect(gate).not.toContain('FOCUS_PROFILE')
})

test('accepts fully executed serial repetitions', () => {
  expect(() =>
    validateFocusReport(
      { errors: [], stats: { expected: 33, unexpected: 0, skipped: 0, flaky: 0 } },
      3
    )
  ).not.toThrow()
})
test.each([
  { expected: 0, unexpected: 0, skipped: 0, flaky: 0 },
  { expected: 0, unexpected: 0, skipped: 33, flaky: 0 },
  { expected: 32, unexpected: 1, skipped: 0, flaky: 0 },
  { expected: 33, unexpected: 0, skipped: 1, flaky: 0 },
  { expected: 33, unexpected: 0, skipped: 0, flaky: 1 },
  { expected: 1, unexpected: 0, skipped: 0, flaky: 0 }
])('rejects empty, skipped, failed, flaky or partial repetitions: %j', (stats) => {
  expect(() => validateFocusReport({ errors: [], stats }, 3)).toThrow('successful executed tests')
})
test('rejects runner errors even with otherwise passing stats', () => {
  expect(() =>
    validateFocusReport(
      { errors: [{}], stats: { expected: 3, unexpected: 0, skipped: 0, flaky: 0 } },
      3
    )
  ).toThrow()
})
