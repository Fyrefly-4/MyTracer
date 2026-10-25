import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// No arbitrary paths, grep expressions, shell arguments, workers or retries from inputs.
export function focusPlan(profile, repeat) {
  if (!['1', '3'].includes(repeat)) throw new Error('Focus repeat must be 1 or 3')
  const profiles = {
    'recovery-context': ['tests/e2e/recovery-context.e2e.test.ts'],
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
    arguments: [...profiles[profile], `--repeat-each=${repeat}`, '--forbid-only']
  }
}

// The pinned Playwright JSON reporter gives each repeat its own spec id.
// Discover with the same selection first, rather than freezing today's scenario count.
export function focusManifest(report, selection) {
  const config = report.config
  if (
    !Array.isArray(report.errors) ||
    report.errors.length ||
    config?.forbidOnly !== true ||
    config.workers !== 1 ||
    config.shard != null ||
    config.projects?.length !== 1 ||
    config.projects[0].repeatEach !== selection.repeat ||
    config.projects[0].retries !== 0
  )
    throw new Error('Invalid focused collection configuration')
  const expectedFiles = selection.arguments
    .filter((arg) => arg.endsWith('.test.ts'))
    .map((file) => file.split('/').at(-1))
  const entries = []
  function visit(suite, parents) {
    const titles = [...parents, suite.title]
    for (const spec of suite.specs ?? []) {
      if (
        !expectedFiles.includes(spec.file) ||
        typeof spec.id !== 'string' ||
        !spec.id ||
        spec.tests?.length !== 1
      ) {
        throw new Error('Unexpected focused test identity')
      }
      const test = spec.tests[0]
      const scenario = JSON.stringify([
        spec.file,
        ...titles,
        spec.title,
        spec.line,
        spec.column,
        test.projectId
      ])
      entries.push({ id: spec.id, scenario, file: spec.file, test })
    }
    for (const child of suite.suites ?? []) visit(child, titles)
  }
  for (const suite of report.suites ?? []) visit(suite, [])
  const ids = new Set(entries.map((entry) => entry.id))
  const files = new Set(entries.map((entry) => entry.file))
  const repeats = new Map()
  for (const entry of entries) repeats.set(entry.scenario, (repeats.get(entry.scenario) ?? 0) + 1)
  if (
    !entries.length ||
    ids.size !== entries.length ||
    files.size !== expectedFiles.length ||
    expectedFiles.some((file) => !files.has(file)) ||
    [...repeats.values()].some((count) => count !== selection.repeat)
  ) {
    throw new Error('Incomplete or duplicate focused collection')
  }
  return entries
}

export function validateFocusReport(report, selection, discovery) {
  const expected = focusManifest(discovery, selection)
  const actual = focusManifest(report, selection)
  const identities = (entries) =>
    entries.map(({ id, scenario }) => JSON.stringify([id, scenario])).sort()
  if (JSON.stringify(identities(actual)) !== JSON.stringify(identities(expected))) {
    throw new Error('Focused execution does not match collected test identities and repetitions')
  }
  const stats = report.stats
  if (
    stats?.expected !== expected.length ||
    stats.unexpected !== 0 ||
    stats.skipped !== 0 ||
    stats.flaky !== 0 ||
    actual.some(
      ({ test }) =>
        test.expectedStatus !== 'passed' ||
        test.status !== 'expected' ||
        test.results?.length !== 1 ||
        test.results[0].status !== 'passed' ||
        test.results[0].retry !== 0 ||
        test.results[0].errors?.length !== 0
    )
  ) {
    throw new Error(
      'Focused report must contain successful executed tests for every collected repetition, with no failures or skips'
    )
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(focusPlan(process.env.FOCUS_PROFILE, process.env.FOCUS_REPEAT)))
}
