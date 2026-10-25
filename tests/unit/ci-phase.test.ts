import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'

const runner = join(process.cwd(), 'tools/ci/run-phase.mjs')
test.each([0, 7])('phase runner preserves child exit %i with exact provenance', (exitCode) => {
  const root = mkdtempSync(join(tmpdir(), 'mytracer-phase-'))
  try {
    execFileSync('git', ['init', '--quiet', root])
    execFileSync(
      'git',
      [
        '-c',
        'user.name=Synthetic',
        '-c',
        'user.email=test@example.invalid',
        'commit',
        '--allow-empty',
        '-m',
        'synthetic'
      ],
      { cwd: root }
    )
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ scripts: { lint: `node -e "process.exit(${exitCode})"` } })
    )
    const eventPath = join(root, 'event.json')
    writeFileSync(
      eventPath,
      JSON.stringify({
        pull_request: { head: { sha: 'synthetic-head' }, base: { sha: 'synthetic-base' } }
      })
    )
    const child = spawnSync(process.execPath, [runner, 'lint'], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        RUNNER_TEMP: root,
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_STEP_SUMMARY: join(root, 'summary.md'),
        GITHUB_RUN_ID: 'synthetic-run',
        GITHUB_RUN_ATTEMPT: '2'
      }
    })
    expect(child.status, child.stderr).toBe(exitCode)
    const record = JSON.parse(readFileSync(join(root, 'mytracer-ci-phases/lint.json'), 'utf8'))
    expect(record).toMatchObject({
      exitCode,
      phase: 'lint',
      head: 'synthetic-head',
      base: 'synthetic-base',
      run: 'synthetic-run',
      attempt: '2'
    })
    expect(record.checkout).toBe(
      execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
    )
    expect(record.durationMs).toBeGreaterThan(0)
    expect(readFileSync(join(root, 'summary.md'), 'utf8')).toContain(
      exitCode === 0 ? 'passed' : 'failed'
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
