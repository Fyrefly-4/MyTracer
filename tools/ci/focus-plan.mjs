import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// No arbitrary paths, grep expressions, shell arguments, workers or retries from inputs.
export function focusPlan(profile, repeat) {
  if (!['1', '3'].includes(repeat)) throw new Error('Focus repeat must be 1 or 3')
  const profiles = {
    'data-reading': ['tests/e2e/data-reading-workspace.e2e.test.ts', '--grep=history'],
    'content-drafts': [
      'tests/e2e/goal-content-draft.e2e.test.ts',
      'tests/e2e/routine-content-draft.e2e.test.ts'
    ]
  }
  if (!Object.hasOwn(profiles, profile)) throw new Error('Unknown focused Electron profile')
  return {
    profile,
    repeat: Number(repeat),
    arguments: [...profiles[profile], `--repeat-each=${repeat}`]
  }
}

export function validateFocusReport(report, repeat) {
  const stats = report.stats
  if (
    !Array.isArray(report.errors) ||
    report.errors.length !== 0 ||
    !Number.isInteger(stats?.expected) ||
    stats.expected <= 0 ||
    stats.expected % repeat !== 0 ||
    stats.unexpected !== 0 ||
    stats.skipped !== 0 ||
    stats.flaky !== 0
  ) {
    throw new Error(
      'Focused report must contain successful executed tests for every repetition, with no failures or skips'
    )
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(focusPlan(process.env.FOCUS_PROFILE, process.env.FOCUS_REPEAT)))
}
