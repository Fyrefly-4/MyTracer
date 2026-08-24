import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'

const repositoryRoot = process.cwd()
const classifier = join(repositoryRoot, 'tools', 'ci', 'classify-changes.mjs')
const prValidator = join(repositoryRoot, 'tools', 'governance', 'validate-pr-context.mjs')
const workflow = join(repositoryRoot, '.github', 'workflows', 'verify.yml')
const temporaryDirectories: string[] = []

function temporaryDirectory() {
  const directory = mkdtempSync(join(tmpdir(), 'mytracer-ci-governance-'))
  temporaryDirectories.push(directory)
  return directory
}

function writePaths(paths: string[]) {
  const directory = temporaryDirectory()
  const file = join(directory, 'paths.txt')
  writeFileSync(file, `${paths.join('\n')}\n`, 'utf8')
  return file
}

function runClassifier(paths: string[], options: string[] = []) {
  const result = spawnSync(
    process.execPath,
    [classifier, 'classify', '--paths-file', writePaths(paths), ...options],
    { cwd: repositoryRoot, encoding: 'utf8', windowsHide: true }
  )
  const output = result.stdout.trim().split(/\r?\n/).at(-1)
  return { result, classification: output ? JSON.parse(output) : null }
}

function writePullRequestEvent(overrides: Record<string, unknown> = {}) {
  const directory = temporaryDirectory()
  const file = join(directory, 'event.json')
  writeFileSync(
    file,
    JSON.stringify({
      pull_request: {
        draft: false,
        title: 'ci(T093): add layered verification gates',
        body: [
          '## Task',
          'T093',
          '## Summary',
          'Layered verification.',
          '## Validation',
          'Unit tests passed.',
          '## Evidence',
          'Bound to the current revision.',
          '## Risk',
          'Hosted CI remains pending.'
        ].join('\n'),
        ...overrides
      }
    }),
    'utf8'
  )
  return file
}

function runPrValidator(eventFile: string) {
  return spawnSync(process.execPath, [prValidator, '--event-file', eventFile], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    windowsHide: true
  })
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('CI change classification', () => {
  test('keeps pure documentation and governance drafts on light paths', () => {
    const documentation = runClassifier(
      ['docs/guides/guide.md'],
      ['--event-name', 'pull_request', '--target-branch', 'dev', '--draft', 'true']
    )
    const governance = runClassifier(
      ['docs/implementation/TASK_TEMPLATE.md'],
      ['--event-name', 'pull_request', '--target-branch', 'dev', '--draft', 'true']
    )

    expect(documentation.result.status).toBe(0)
    expect(documentation.classification).toMatchObject({
      category: 'documentation',
      level: 'documentation',
      run_documentation: true,
      run_verification: false
    })
    expect(governance.classification).toMatchObject({
      category: 'governance',
      level: 'governance',
      run_governance: true,
      run_verification: false
    })
  })

  test('routes source, workflow, tools, tests, mixed, and unknown changes to full verification', () => {
    const cases = [
      ['src/main/index.ts'],
      ['.github/workflows/verify.yml'],
      ['tools/ci/check.mjs'],
      ['tests/unit/example.test.ts'],
      ['docs/guides/guide.md', 'src/main/index.ts'],
      ['.github/CONTRIBUTING.md'],
      ['assets/example.bin']
    ]

    for (const paths of cases) {
      const { result, classification } = runClassifier(paths, [
        '--event-name',
        'pull_request',
        '--target-branch',
        'dev',
        '--draft',
        'true'
      ])
      expect(result.status).toBe(0)
      expect(classification).toMatchObject({
        category: 'source',
        level: 'full',
        run_verification: true
      })
    }
  })

  test('raises Ready, main, and explicit PR modes without lowering required work', () => {
    const ready = runClassifier(
      ['docs/guides/guide.md'],
      ['--event-name', 'pull_request', '--target-branch', 'dev', '--draft', 'false']
    ).classification
    const main = runClassifier(
      ['docs/guides/guide.md'],
      ['--event-name', 'push', '--target-branch', 'main']
    ).classification
    const bodyDirectory = temporaryDirectory()
    const bodyFile = join(bodyDirectory, 'body.md')
    writeFileSync(bodyFile, '## CI mode\n\nmilestone\n', 'utf8')
    const requested = runClassifier(
      ['docs/guides/guide.md'],
      [
        '--event-name',
        'pull_request',
        '--target-branch',
        'dev',
        '--draft',
        'true',
        '--body-file',
        bodyFile
      ]
    ).classification

    expect(ready.level).toBe('full')
    expect(ready.run_documentation).toBe(true)
    expect(main.category).toBe('milestone')
    expect(main.level).toBe('milestone')
    expect(requested.category).toBe('milestone')
    expect(requested.level).toBe('milestone')
    expect(requested.run_milestone).toBe(true)
  })
})

describe('terminal gate evaluation', () => {
  const successfulRequiredJobs = [
    '--result-classify',
    'success',
    '--expect-governance',
    'true',
    '--result-governance',
    'success',
    '--result-pr-quality',
    'skipped',
    '--result-documentation',
    'skipped',
    '--result-verification',
    'skipped',
    '--result-milestone',
    'skipped'
  ]

  test('accepts successful required jobs and expected skips', () => {
    const result = spawnSync(process.execPath, [classifier, 'gate', ...successfulRequiredJobs], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      windowsHide: true
    })
    expect(result.status).toBe(0)
  })

  test.each(['failure', 'cancelled', 'skipped'])(
    'rejects a required job that finishes as %s',
    (jobResult) => {
      const args = successfulRequiredJobs.map((value, index, all) =>
        index > 0 && all[index - 1] === '--result-governance' ? jobResult : value
      )
      const result = spawnSync(process.execPath, [classifier, 'gate', ...args], {
        cwd: repositoryRoot,
        encoding: 'utf8',
        windowsHide: true
      })
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('governance was required')
    }
  )

  test('rejects failure even when a job was not selected', () => {
    const args = successfulRequiredJobs.map((value, index, all) =>
      index > 0 && all[index - 1] === '--result-documentation' ? 'failure' : value
    )
    const result = spawnSync(process.execPath, [classifier, 'gate', ...args], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      windowsHide: true
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('documentation unexpectedly finished as failure')
  })

  test('makes the legacy gate depend on the new CI Gate result', () => {
    const result = spawnSync(
      process.execPath,
      [classifier, 'gate', ...successfulRequiredJobs, '--result-ci-gate', 'failure'],
      { cwd: repositoryRoot, encoding: 'utf8', windowsHide: true }
    )
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('CI Gate was required')
  })
})

describe('PR context validation', () => {
  test('warns without failing when a Draft PR lacks context', () => {
    const result = runPrValidator(
      writePullRequestEvent({ draft: true, title: 'work in progress', body: '' })
    )
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Draft PR')
    expect(result.stdout).toContain('::warning')
  })

  test('requires Task, Summary, Validation, Evidence, and Risk when Ready', () => {
    const result = runPrValidator(writePullRequestEvent({ body: '## Task\nT093\n' }))
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Summary must contain actual context')
    expect(result.stderr).toContain('Evidence must contain actual context')
  })

  test('rejects an invalid task identifier when Ready', () => {
    const event = writePullRequestEvent()
    const parsed = JSON.parse(readFileSync(event, 'utf8'))
    parsed.pull_request.body = parsed.pull_request.body.replace('T093', 'T93')
    writeFileSync(event, JSON.stringify(parsed), 'utf8')

    const result = runPrValidator(event)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('valid Txxx identifier')
  })

  test('rejects placeholder context when Ready', () => {
    const event = writePullRequestEvent()
    const parsed = JSON.parse(readFileSync(event, 'utf8'))
    parsed.pull_request.body = parsed.pull_request.body.replace(
      'Bound to the current revision.',
      'Pending'
    )
    writeFileSync(event, JSON.stringify(parsed), 'utf8')

    const result = runPrValidator(event)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Evidence must contain actual context')
  })

  test('rejects an empty checklist as Ready context', () => {
    const event = writePullRequestEvent()
    const parsed = JSON.parse(readFileSync(event, 'utf8'))
    parsed.pull_request.body = parsed.pull_request.body.replace(
      'Hosted CI remains pending.',
      '- [ ]'
    )
    writeFileSync(event, JSON.stringify(parsed), 'utf8')

    const result = runPrValidator(event)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Risk must contain actual context')
  })

  test('rejects multiline Markdown placeholders as Ready context', () => {
    const event = writePullRequestEvent()
    const parsed = JSON.parse(readFileSync(event, 'utf8'))
    parsed.pull_request.body = parsed.pull_request.body.replace(
      'Unit tests passed.',
      '- TBD\n1. Pending\n**Pending**'
    )
    writeFileSync(event, JSON.stringify(parsed), 'utf8')

    const result = runPrValidator(event)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Validation must contain actual context')
  })

  test('accepts complete Ready context while title convention remains warning-only', () => {
    const result = runPrValidator(writePullRequestEvent({ title: 'Layered gates' }))
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('::warning')
    expect(result.stdout).toContain('satisfies the structural requirements')
  })
})

describe('documentation and workflow structure', () => {
  test('checks changed local documentation links', () => {
    const root = temporaryDirectory()
    const docs = join(root, 'docs')
    mkdirSync(docs)
    writeFileSync(join(docs, 'target.md'), '# Target\n', 'utf8')
    writeFileSync(join(docs, 'guide.md'), '# Guide\n\n[Target](target.md)\n', 'utf8')
    const pathsFile = join(root, 'paths.txt')
    writeFileSync(pathsFile, 'docs/guide.md\n', 'utf8')

    const passing = spawnSync(
      process.execPath,
      [classifier, 'docs', '--repository-root', root, '--paths-file', pathsFile],
      { cwd: repositoryRoot, encoding: 'utf8', windowsHide: true }
    )
    writeFileSync(join(docs, 'guide.md'), '# Guide\n\n[Missing](missing.md)\n', 'utf8')
    const failing = spawnSync(
      process.execPath,
      [classifier, 'docs', '--repository-root', root, '--paths-file', pathsFile],
      { cwd: repositoryRoot, encoding: 'utf8', windowsHide: true }
    )

    expect(passing.status).toBe(0)
    expect(failing.status).toBe(1)
    expect(failing.stderr).toContain('broken local link')
  })

  test('rejects unformatted or structurally invalid documentation', () => {
    const root = temporaryDirectory()
    const docs = join(root, 'docs')
    mkdirSync(docs)
    const guide = join(docs, 'guide.md')
    const pathsFile = join(root, 'paths.txt')
    writeFileSync(pathsFile, 'docs/guide.md\n', 'utf8')
    writeFileSync(guide, '# Guide\n\n### Skipped heading\n\n-   badly spaced\n', 'utf8')

    const result = spawnSync(
      process.execPath,
      [classifier, 'docs', '--repository-root', root, '--paths-file', pathsFile],
      { cwd: repositoryRoot, encoding: 'utf8', windowsHide: true }
    )

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('heading levels must not skip')
    expect(result.stderr).toContain('not formatted with Prettier')
  })

  test('keeps one workflow with layered jobs, terminal gates, and no path filter', () => {
    const content = readFileSync(workflow, 'utf8')
    for (const job of [
      'classify:',
      'pr_quality:',
      'documentation:',
      'governance:',
      'verification:',
      'milestone:',
      'ci_gate:',
      'windows_required:'
    ]) {
      expect(content).toContain(job)
    }
    expect(content).toContain('name: CI Gate')
    expect(content).toContain('name: Windows required gate')
    expect(content.match(/^ {4}if: always\(\)/gm)).toHaveLength(2)
    expect(content).not.toMatch(/^\s+paths(?:-ignore)?:/m)
    expect(content).not.toContain('pull_request_target')
    expect(content).toContain('permissions:\n  contents: read')
    expect(content).not.toMatch(/^\s+(?:contents|actions|deployments): write$/m)
    expect(content).toMatch(
      /on:\r?\n {2}pull_request:\r?\n {4}branches:\r?\n {6}- dev\r?\n {6}- main/
    )
    expect(content).toMatch(/\n {2}push:\r?\n {4}branches:\r?\n {6}- dev\r?\n {6}- main/)
    expect(content).toMatch(/\n {2}workflow_dispatch:\r?\n {4}inputs:/)
    expect(content.match(/^ {6}- dev$/gm)).toHaveLength(2)
    expect(content.match(/^ {6}- main$/gm)).toHaveLength(2)
    expect(content).toContain('cancel-in-progress: true')
    expect(content).toContain(
      'group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}'
    )
    for (const eventType of [
      'opened',
      'synchronize',
      'reopened',
      'edited',
      'ready_for_review',
      'converted_to_draft'
    ]) {
      expect(content).toContain(`- ${eventType}`)
    }
    for (const condition of [
      "if: needs.classify.outputs.run_pr_quality == 'true'",
      "if: needs.classify.outputs.run_documentation == 'true'",
      "if: needs.classify.outputs.run_governance == 'true'",
      "if: needs.classify.outputs.run_verification == 'true'",
      "if: needs.classify.outputs.run_milestone == 'true' && needs.verification.result == 'success'"
    ]) {
      expect(content).toContain(condition)
    }
    for (const variable of [
      'MYTRACER_EXPECT_PR_QUALITY',
      'MYTRACER_EXPECT_DOCUMENTATION',
      'MYTRACER_EXPECT_GOVERNANCE',
      'MYTRACER_EXPECT_VERIFICATION',
      'MYTRACER_EXPECT_MILESTONE',
      'MYTRACER_RESULT_CLASSIFY',
      'MYTRACER_RESULT_PR_QUALITY',
      'MYTRACER_RESULT_DOCUMENTATION',
      'MYTRACER_RESULT_GOVERNANCE',
      'MYTRACER_RESULT_VERIFICATION',
      'MYTRACER_RESULT_MILESTONE'
    ]) {
      expect(content.match(new RegExp(`^ {6}${variable}:`, 'gm'))).toHaveLength(2)
    }
    expect(content).toContain('MYTRACER_RESULT_CI_GATE: ${{ needs.ci_gate.result }}')
    expect(content).toMatch(/windows_required:[\s\S]*?needs:[\s\S]*?- ci_gate/)
  })
})
