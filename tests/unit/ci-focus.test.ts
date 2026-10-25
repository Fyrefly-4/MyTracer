import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, test } from 'vitest'
import { focusReportFixture } from '../support/focus-report-fixture'

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
      `--repeat-each=${repeat}`,
      '--forbid-only'
    ]
  })
  expect(focusPlan('recovery-context', repeat).arguments).toEqual([
    'tests/e2e/recovery-context.e2e.test.ts',
    `--repeat-each=${repeat}`,
    '--forbid-only'
  ])
  expect(focusPlan('content-drafts', repeat).arguments).toEqual([
    'tests/e2e/goal-content-draft.e2e.test.ts',
    'tests/e2e/routine-content-draft.e2e.test.ts',
    `--repeat-each=${repeat}`,
    '--forbid-only'
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

const selection = focusPlan('content-drafts', '3')
test('accepts exact collected identities and all repetitions', () => {
  const report = focusReportFixture()
  expect(() => validateFocusReport(report, selection, structuredClone(report))).not.toThrow()
})
test.each([
  'suite',
  'scenario',
  'repeat',
  'duplicate',
  'identity',
  'only',
  'skip',
  'result',
  'retry',
  'errors'
])('rejects incomplete or invalid evidence: %s', (fault) => {
  const discovery = focusReportFixture()
  const report = structuredClone(discovery)
  if (fault === 'suite') report.suites.pop()
  if (fault === 'scenario') report.suites[0].specs.splice(0, 3)
  if (fault === 'repeat') report.suites[0].specs.shift()
  if (fault === 'duplicate') report.suites[0].specs[0] = structuredClone(report.suites[0].specs[1])
  if (fault === 'identity') report.suites[0].specs[0].id = 'different-test'
  if (fault === 'only') report.config.forbidOnly = false
  if (fault === 'skip') report.suites[0].specs[0].tests[0].expectedStatus = 'skipped'
  if (fault === 'result') report.suites[0].specs[0].tests[0].results = []
  if (fault === 'retry') report.suites[0].specs[0].tests[0].results[0].retry = 1
  if (fault === 'errors') report.errors.push({ message: 'runner error' })
  // Even self-consistent reduced aggregate totals must not pass.
  report.stats.expected = report.suites.reduce((sum, suite) => sum + suite.specs.length, 0)
  expect(() => validateFocusReport(report, selection, discovery)).toThrow()
})
test('rejects a missing selected suite in discovery too', () => {
  const discovery = focusReportFixture()
  discovery.suites.pop()
  expect(() => validateFocusReport(discovery, selection, discovery)).toThrow()
})

test('Playwright rejects test.only during focused discovery before any execution', () => {
  const root = mkdtempSync(join(tmpdir(), 'mytracer-focus-only-'))
  try {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ type: 'module' }))
    const api = pathToFileURL(join(process.cwd(), 'node_modules/@playwright/test/index.mjs')).href
    writeFileSync(
      join(root, 'playwright.config.mjs'),
      "export default { testDir: '.', testMatch: '*.spec.mjs', workers: 1, retries: 0 }"
    )
    writeFileSync(
      join(root, 'exclusive.spec.mjs'),
      `import {test} from ${JSON.stringify(api)}; test.only('exclusive', () => {throw new Error('must not execute')}); test('omitted', () => {});`
    )
    const result = spawnSync(
      process.execPath,
      [
        join(process.cwd(), 'node_modules/@playwright/test/cli.js'),
        'test',
        '--config=playwright.config.mjs',
        '--list',
        '--forbid-only',
        '--reporter=json'
      ],
      {
        cwd: root,
        encoding: 'utf8',
        timeout: 5000,
        env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: join(root, 'discovery.json') }
      }
    )
    expect(result.status).toBe(1)
    const report = JSON.parse(readFileSync(join(root, 'discovery.json'), 'utf8'))
    expect(
      report.errors.some(
        (error: { message: string }) =>
          error.message.includes("'.only'") && error.message.includes('--forbid-only')
      )
    ).toBe(true)
    expect(report.stats.expected).toBe(0)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
