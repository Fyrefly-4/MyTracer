import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'

const runner = join(process.cwd(), 'tools/ci/run-phase.mjs')
test.each([
  ['lint', 0, true],
  ['lint', 7, true],
  ['focus', 0, true],
  ['focus', 7, true],
  ['focus', 0, false]
] as const)(
  'phase %s records child exit %i (fresh report: %s) with exact provenance',
  (phase, exitCode, emitReport) => {
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
        JSON.stringify({
          scripts: { lint: `node -e "process.exit(${exitCode})"`, 'test:e2e:run': 'node probe.cjs' }
        })
      )
      writeFileSync(
        join(root, 'probe.cjs'),
        `require('node:fs').writeFileSync('arguments.json', JSON.stringify(process.argv.slice(2))); ${emitReport ? "require('node:fs').writeFileSync(process.env.PLAYWRIGHT_JSON_OUTPUT_FILE, JSON.stringify({errors:[], stats:{expected:3, unexpected:0, skipped:0, flaky:0}}));" : ''} process.exit(${exitCode})`
      )
      if (phase === 'focus' && !emitReport) {
        mkdirSync(join(root, 'mytracer-ci-phases'))
        writeFileSync(
          join(root, 'mytracer-ci-phases/focus-repeat.json'),
          JSON.stringify({
            errors: [],
            stats: { expected: 3, unexpected: 0, skipped: 0, flaky: 0 }
          })
        )
      }
      const expectedStatus = phase === 'focus' && !emitReport ? 1 : exitCode
      const eventPath = join(root, 'event.json')
      writeFileSync(
        eventPath,
        JSON.stringify({
          pull_request: { head: { sha: 'synthetic-head' }, base: { sha: 'synthetic-base' } }
        })
      )
      const child = spawnSync(process.execPath, [runner, phase], {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          RUNNER_TEMP: root,
          FOCUS_PROFILE: 'content-drafts',
          FOCUS_REPEAT: '3',
          GITHUB_EVENT_PATH: eventPath,
          GITHUB_STEP_SUMMARY: join(root, 'summary.md'),
          GITHUB_RUN_ID: 'synthetic-run',
          GITHUB_RUN_ATTEMPT: '2'
        }
      })
      expect(child.status, child.stderr).toBe(expectedStatus)
      const record = JSON.parse(
        readFileSync(join(root, `mytracer-ci-phases/${phase}.json`), 'utf8')
      )
      expect(record).toMatchObject({
        exitCode: expectedStatus,
        phase,
        head: 'synthetic-head',
        base: 'synthetic-base',
        run: 'synthetic-run',
        attempt: '2'
      })
      if (phase === 'focus') {
        expect(record.selection).toMatchObject({ profile: 'content-drafts', repeat: 3 })
        expect(record.scope).toBe('focused-only; not the CI Gate')
        expect(JSON.parse(readFileSync(join(root, 'arguments.json'), 'utf8'))).toEqual(
          record.selection.arguments
        )
        expect(readFileSync(join(root, 'summary.md'), 'utf8')).toContain('does not replace CI Gate')
      }
      expect(record.checkout).toBe(
        execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
      )
      const logged = child.stdout.split(/\r?\n/).find((line) => line.startsWith('CI_PHASE '))
      expect(logged).toBeDefined()
      expect(JSON.parse(logged!.slice('CI_PHASE '.length))).toEqual(record)
      expect(record.durationMs).toBeGreaterThan(0)
      expect(readFileSync(join(root, 'summary.md'), 'utf8')).toContain(
        expectedStatus === 0 ? 'passed' : 'failed'
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }
)
