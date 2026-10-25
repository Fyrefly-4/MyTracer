import { spawnSync, execFileSync } from 'node:child_process'
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

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
  e2e: ['run', 'test:e2e:run']
}
const phase = process.argv[2]
if (!Object.hasOwn(commands, phase)) throw new Error('Unknown verification phase')
const output = join(process.env.RUNNER_TEMP ?? '.tmp', 'mytracer-ci-phases')
mkdirSync(output, { recursive: true })
const event = process.env.GITHUB_EVENT_PATH
  ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
  : {}
const startedAt = new Date().toISOString()
const start = performance.now()
const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', commands[phase], {
  stdio: 'inherit',
  shell: process.platform === 'win32'
})
const durationMs = Math.round(performance.now() - start)
const record = {
  schemaVersion: 1,
  phase,
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
  exitCode: result.status ?? 1,
  signal: result.signal,
  launchError: result.error?.message ?? null
}
writeFileSync(join(output, `${phase}.json`), JSON.stringify(record, null, 2) + '\n')
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `### ${phase}: ${record.exitCode === 0 ? 'passed' : 'failed'}\n\n` +
      `${record.durationMs} ms; run ${record.run}, attempt ${record.attempt}; ` +
      `head ${record.head}; base ${record.base}; checkout ${record.checkout}.\n\n`
  )
}
process.exitCode = record.exitCode
