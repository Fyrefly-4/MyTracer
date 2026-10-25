import { spawnSync, execFileSync } from 'node:child_process'
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { focusPlan, validateFocusReport } from './focus-plan.mjs'

const phase = process.argv[2]
const selection =
  phase === 'focus' ? focusPlan(process.env.FOCUS_PROFILE, process.env.FOCUS_REPEAT) : null
const commands = {
  install: ['ci'],
  electron: ['exec', '--', 'install-electron', '--no'],
  format: ['run', 'format:check'],
  lint: ['run', 'lint'],
  types: ['run', 'typecheck'],
  unit: ['run', 'test:unit'],
  integration: ['run', 'test:integration'],
  build: ['run', 'build'],
  diagnostics: ['run', 'test:diagnostics'],
  scroll: [
    'run',
    'test:e2e:run',
    '--',
    'tests/e2e/data-reading-workspace.e2e.test.ts',
    '--grep=history',
    '--repeat-each=3'
  ],
  e2e: ['run', 'test:e2e:run'],
  focus: ['run', 'test:e2e:run', '--', ...(selection?.arguments ?? [])]
}
if (!Object.hasOwn(commands, phase)) throw new Error('Unknown verification phase')
const output = join(process.env.RUNNER_TEMP ?? '.tmp', 'mytracer-ci-phases')
mkdirSync(output, { recursive: true })
const event = process.env.GITHUB_EVENT_PATH
  ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
  : {}
if (selection) rmSync(join(output, 'focus-repeat.json'), { force: true })
const startedAt = new Date().toISOString()
const start = performance.now()
const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', commands[phase], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: ['scroll', 'focus'].includes(phase)
    ? { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: join(output, `${phase}-repeat.json`) }
    : process.env
})
const durationMs = Math.round(performance.now() - start)
let focusReportError = null
if (selection && result.status === 0) {
  try {
    validateFocusReport(
      JSON.parse(readFileSync(join(output, 'focus-repeat.json'), 'utf8')),
      selection.repeat
    )
  } catch {
    focusReportError = 'Focused report missing/invalid, or tests were skipped, failed or incomplete'
  }
}
const record = {
  schemaVersion: 1,
  phase,
  ...(selection
    ? {
        selection,
        scope: 'focused-only; not the CI Gate',
        childExitCode: result.status,
        focusReportError
      }
    : {}),
  run: process.env.GITHUB_RUN_ID ?? null,
  attempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
  head: event.pull_request?.head.sha ?? process.env.GITHUB_SHA ?? null,
  base: event.pull_request?.base.sha ?? null,
  checkout: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  platform: process.platform,
  node: process.version,
  runner: process.env.RUNNER_OS ?? null,
  runnerImage: process.env.ImageOS ?? null,
  runnerImageVersion: process.env.ImageVersion ?? null,
  dependencyCacheHit: process.env.CI_CACHE_HIT ?? null,
  startedAt,
  finishedAt: new Date().toISOString(),
  durationMs,
  exitCode: focusReportError ? 1 : (result.status ?? 1),
  signal: result.signal,
  launchError: result.error?.message ?? null
}
writeFileSync(join(output, `${phase}.json`), JSON.stringify(record, null, 2) + '\n')
// The same bounded record remains accessible when artifact downloads are unavailable.
console.log(`CI_PHASE ${JSON.stringify(record)}`)
if (process.env.GITHUB_STEP_SUMMARY) {
  if (selection)
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `Focused only: ${selection.profile}, ${selection.repeat} independent run(s). This does not replace CI Gate.\n\n`
    )
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `### ${phase}: ${record.exitCode === 0 ? 'passed' : 'failed'}\n\n` +
      `${record.durationMs} ms; run ${record.run}, attempt ${record.attempt}; ` +
      `head ${record.head}; base ${record.base}; checkout ${record.checkout}.\n\n`
  )
}
process.exitCode = record.exitCode
