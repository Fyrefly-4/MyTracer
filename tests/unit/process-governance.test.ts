import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'

const repositoryRoot = process.cwd()
const collector = join(repositoryRoot, 'tools', 'evidence', 'capture-command.mjs')
const validator = join(repositoryRoot, 'tools', 'governance', 'validate-task-metadata.mjs')
const temporaryDirectories: string[] = []

function createOutputDirectory() {
  const relativeDirectory = `.tmp/process-governance-${process.pid}-${Date.now()}-${temporaryDirectories.length}`
  const absoluteDirectory = join(repositoryRoot, relativeDirectory)
  temporaryDirectories.push(absoluteDirectory)
  return relativeDirectory
}

function runCollector(
  output: string,
  command: string[],
  extraArgs: string[] = [],
  extraEnvironment: Record<string, string> = {},
  baseRevision: string | null = 'base123'
) {
  return spawnSync(
    process.execPath,
    [
      collector,
      '--task',
      'T091',
      '--gate',
      'unit',
      ...(baseRevision === null ? [] : ['--base-revision', baseRevision]),
      '--output',
      output,
      ...extraArgs,
      '--',
      ...command
    ],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      windowsHide: true,
      env: { ...process.env, ...extraEnvironment }
    }
  )
}

function readArtifact(output: string) {
  const directory = join(repositoryRoot, output)
  const files = readdirSync(directory).filter((file) => file.endsWith('.json'))
  expect(files).toHaveLength(1)
  return JSON.parse(readFileSync(join(directory, files[0]), 'utf8'))
}

function runValidator(metadataDirectory: string, profilesDirectory: string, taskIndex: string) {
  return spawnSync(
    process.execPath,
    [
      validator,
      '--metadata-dir',
      metadataDirectory,
      '--profiles-dir',
      profilesDirectory,
      '--task-index',
      taskIndex
    ],
    { cwd: repositoryRoot, encoding: 'utf8', windowsHide: true }
  )
}

function standardProfile(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    id: 'standard-task@1',
    taskKinds: ['implementation', 'fix'],
    automaticPhases: [
      'local_development',
      'validation_execution',
      'task_branch_publish',
      'draft_pr_maintenance',
      'review_handoff'
    ],
    ownerGates: [
      'docs_closeout_scope',
      'ready_for_review',
      'merge_dev',
      'merge_main',
      'tag',
      'release',
      'dependency_change',
      'migration_change',
      'non_task_publication_external_write',
      'ai_provider_or_permission_change'
    ],
    maxValidityDays: 30,
    allowedAdditionalConstraints: ['disable_phase', 'pause_before'],
    worktree: {
      isolationRequired: true,
      disposable: true,
      cleanupAfter: ['merged', 'owner-released']
    },
    extensionPoints: {
      compatibility: 'additive-within-v1',
      breakingChanges: 'require-new-profile-version'
    },
    ...overrides
  }
}

function writeStandardProfile(directory: string, overrides: Record<string, unknown> = {}) {
  mkdirSync(directory)
  writeFileSync(
    join(directory, 'standard-task-v1.json'),
    JSON.stringify(standardProfile(overrides))
  )
}

function taskSidecar(task: string, overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    task,
    dependencies: {
      requires: [],
      blocks: [],
      can_parallel: [],
      prefer_after: [],
      conflicts_with: []
    },
    conflict_basis: {},
    shared_surfaces: [
      {
        files: ['src/example.ts'],
        modules: [],
        schema_tables: [],
        ipc_contracts: [],
        domain_invariants: [],
        risk: 'low',
        integration_policy: 'serial'
      }
    ],
    external: [],
    ...overrides
  }
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('deterministic evidence collector', () => {
  test('records a successful explicit-argv command without absolute paths', () => {
    const output = createOutputDirectory()
    const result = runCollector(output, ['node', '-e', 'process.exit(0)'])

    expect(result.status).toBe(0)
    const artifact = readArtifact(output)
    expect(artifact).toMatchObject({
      schemaVersion: 1,
      task: 'T091',
      gate: 'unit',
      baseRevision: 'base123',
      platform: process.platform,
      commandStatus: 'passed',
      captureStatus: 'complete',
      exitCode: 0
    })
    expect(artifact.command).toEqual(['node', '-e', 'process.exit(0)'])
    expect(JSON.stringify(artifact)).not.toContain(repositoryRoot)
    expect(artifact.artifacts[0].relativePath.startsWith('.tmp/')).toBe(true)
  })

  test('separates a pull-request head revision from its merge revision', () => {
    const output = createOutputDirectory()
    const eventDirectory = mkdtempSync(join(tmpdir(), 'mytracer-ci-event-'))
    temporaryDirectories.push(eventDirectory)
    const eventPath = join(eventDirectory, 'event.json')
    writeFileSync(
      eventPath,
      JSON.stringify({
        pull_request: {
          head: { sha: 'head123' },
          base: { sha: 'base456' }
        }
      })
    )

    const result = runCollector(
      output,
      ['node', '-e', 'process.exit(0)'],
      [],
      {
        GITHUB_EVENT_NAME: 'pull_request',
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_HEAD_REF: 'docs/T091-deterministic-evidence',
        GITHUB_SHA: 'merge789',
        GITHUB_WORKFLOW: 'Verification',
        GITHUB_RUN_ID: '123'
      },
      null
    )

    expect(result.status).toBe(0)
    expect(readArtifact(output)).toMatchObject({
      sourceBranch: 'docs/T091-deterministic-evidence',
      baseRevision: 'base456',
      ci: {
        eventName: 'pull_request',
        headRevision: 'head123',
        mergeRevision: 'merge789'
      }
    })
    expect(JSON.stringify(readArtifact(output))).not.toContain(eventPath)
  })

  test('starts a Windows command wrapper without changing the recorded command', () => {
    const output = createOutputDirectory()
    const result = runCollector(output, ['npm.cmd', '--version'])

    expect(result.status).toBe(0)
    expect(readArtifact(output)).toMatchObject({
      command: ['npm.cmd', '--version'],
      commandStatus: 'passed',
      exitCode: 0
    })
  })

  test('keeps a failing command artifact and propagates its exit code', () => {
    const output = createOutputDirectory()
    const result = runCollector(output, ['node', '-e', 'process.exit(7)'])

    expect(result.status).toBe(7)
    expect(readArtifact(output)).toMatchObject({ commandStatus: 'failed', exitCode: 7 })
  })

  test('records a missing command as not-started instead of a pass', () => {
    const output = createOutputDirectory()
    const result = runCollector(output, ['mytracer-command-does-not-exist'])

    expect(result.status).not.toBe(0)
    expect(readArtifact(output)).toMatchObject({ commandStatus: 'not-started', exitCode: null })
  })

  test('redacts sensitive command arguments', () => {
    const output = createOutputDirectory()
    const result = runCollector(output, [
      'node',
      '-e',
      'process.exit(0)',
      '--',
      '--token',
      'secret-value'
    ])

    expect(result.status).toBe(0)
    expect(readArtifact(output).command).toEqual([
      'node',
      '-e',
      'process.exit(0)',
      '--',
      '--token',
      '[REDACTED]'
    ])
  })

  test('redacts absolute paths from command metadata', () => {
    const output = createOutputDirectory()
    const result = runCollector(output, [
      'node',
      '-e',
      'process.exit(0)',
      '--',
      '--output=C:\\Users\\owner\\private.sqlite3'
    ])

    expect(result.status).toBe(0)
    expect(readArtifact(output).command).toEqual([
      'node',
      '-e',
      'process.exit(0)',
      '--',
      '--output=[PATH_REDACTED]'
    ])
  })
})

describe('task metadata validator', () => {
  test('accepts valid sidecars and never writes the task index', () => {
    const directory = mkdtempSync(join(tmpdir(), 'mytracer-metadata-'))
    temporaryDirectories.push(directory)
    const metadataDirectory = join(directory, 'metadata')
    mkdirSync(metadataDirectory)
    const profilesDirectory = join(directory, 'profiles')
    writeStandardProfile(profilesDirectory)
    const taskIndex = join(directory, 'TASK_INDEX.md')
    const taskIndexText = '| T090 | GOV-01 |\n| T091 | GOV-02 |\n'
    writeFileSync(taskIndex, taskIndexText)
    writeFileSync(
      join(metadataDirectory, 'T091.json'),
      JSON.stringify({
        schemaVersion: 1,
        task: 'T091',
        dependencies: {
          requires: ['T090'],
          blocks: [],
          can_parallel: [],
          prefer_after: [],
          conflicts_with: ['T090']
        },
        conflict_basis: { T090: 'shares governance documentation surface' },
        shared_surfaces: [
          {
            files: ['AGENTS.md'],
            modules: [],
            schema_tables: [],
            ipc_contracts: [],
            domain_invariants: [],
            risk: 'high',
            integration_policy: 'serial'
          }
        ],
        external: []
      })
    )

    const result = runValidator(metadataDirectory, profilesDirectory, taskIndex)

    expect(result.status).toBe(0)
    expect(readFileSync(taskIndex, 'utf8')).toBe(taskIndexText)
  })

  test('rejects unknown relations and duplicate dependencies', () => {
    const directory = mkdtempSync(join(tmpdir(), 'mytracer-metadata-invalid-'))
    temporaryDirectories.push(directory)
    const metadataDirectory = join(directory, 'metadata')
    mkdirSync(metadataDirectory)
    const profilesDirectory = join(directory, 'profiles')
    writeStandardProfile(profilesDirectory)
    const taskIndex = join(directory, 'TASK_INDEX.md')
    writeFileSync(taskIndex, '| T090 | GOV-01 |\n| T091 | GOV-02 |\n')
    writeFileSync(
      join(metadataDirectory, 'T091.json'),
      JSON.stringify({
        schemaVersion: 1,
        task: 'T091',
        dependencies: {
          requires: ['T091', 'T091'],
          blocks: [],
          can_parallel: [],
          prefer_after: [],
          conflicts_with: ['T090'],
          unsupported: []
        },
        conflict_basis: {},
        shared_surfaces: [
          {
            files: ['AGENTS.md'],
            modules: [],
            schema_tables: [],
            ipc_contracts: [],
            domain_invariants: [],
            risk: 'high',
            integration_policy: 'serial'
          }
        ],
        external: []
      })
    )

    const result = runValidator(metadataDirectory, profilesDirectory, taskIndex)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('duplicate T091')
    expect(result.stderr).toContain('unsupported relation')
    expect(result.stderr).toContain('missing basis for T090')
  })

  test('accepts an applicable active Profile and ignores natural expiry on a done task', () => {
    const directory = mkdtempSync(join(tmpdir(), 'mytracer-profile-valid-'))
    temporaryDirectories.push(directory)
    const metadataDirectory = join(directory, 'metadata')
    mkdirSync(metadataDirectory)
    const profilesDirectory = join(directory, 'profiles')
    writeStandardProfile(profilesDirectory)
    const taskIndex = join(directory, 'TASK_INDEX.md')
    writeFileSync(
      taskIndex,
      '| T041 | S4 | scope | basis | none | `active` | — |\n| T042 | S4 | scope | basis | none | `done` | — |\n'
    )
    const activeExecution = {
      profile: 'standard-task@1',
      activated_at: '2026-08-24T09:00:00+08:00',
      valid_until: '2026-09-23T09:00:00+08:00',
      additional_constraints: [{ type: 'pause_before', phase: 'review_handoff' }]
    }
    const historicalExecution = {
      profile: 'standard-task@1',
      activated_at: '2025-01-01T00:00:00Z',
      valid_until: '2025-01-15T00:00:00Z',
      additional_constraints: []
    }
    writeFileSync(
      join(metadataDirectory, 'T041.json'),
      JSON.stringify(
        taskSidecar('T041', { task_kind: 'implementation', execution: activeExecution })
      )
    )
    writeFileSync(
      join(metadataDirectory, 'T042.json'),
      JSON.stringify(taskSidecar('T042', { task_kind: 'fix', execution: historicalExecution }))
    )

    const result = runValidator(metadataDirectory, profilesDirectory, taskIndex)

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('2 sidecar(s), 1 profile(s)')
  })

  test.each([
    {
      name: 'unknown Profile',
      taskKind: 'implementation',
      state: 'active',
      execution: { profile: 'missing@1' },
      expected: 'references unknown profile missing@1'
    },
    {
      name: 'task kind mismatch',
      taskKind: 'governance',
      state: 'active',
      execution: {},
      expected: 'does not support task kind governance'
    },
    {
      name: 'reversed validity interval',
      taskKind: 'implementation',
      state: 'active',
      execution: {
        activated_at: '2026-08-25T00:00:00Z',
        valid_until: '2026-08-24T00:00:00Z'
      },
      expected: 'valid_until must be later than activated_at'
    },
    {
      name: 'timestamp without timezone',
      taskKind: 'implementation',
      state: 'active',
      execution: { activated_at: '2026-08-24T00:00:00' },
      expected: 'activated_at must be an RFC3339 timestamp with timezone'
    },
    {
      name: 'validity longer than registry maximum',
      taskKind: 'implementation',
      state: 'active',
      execution: {
        activated_at: '2026-08-01T00:00:00Z',
        valid_until: '2026-09-01T00:00:01Z'
      },
      expected: 'validity exceeds 30 days'
    },
    {
      name: 'constraint outside the Profile',
      taskKind: 'implementation',
      state: 'active',
      execution: {
        additional_constraints: [{ type: 'pause_before', phase: 'merge_dev' }]
      },
      expected: 'phase is not defined by profile standard-task@1'
    },
    {
      name: 'unsupported constraint type',
      taskKind: 'implementation',
      state: 'active',
      execution: {
        additional_constraints: [{ type: 'grant_phase', phase: 'review_handoff' }]
      },
      expected: 'type is not allowed by profile standard-task@1'
    },
    {
      name: 'inactive lifecycle state',
      taskKind: 'implementation',
      state: 'pending',
      execution: {},
      expected: 'incompatible with TASK_INDEX state pending'
    }
  ])('rejects $name metadata', ({ taskKind, state, execution, expected }) => {
    const directory = mkdtempSync(join(tmpdir(), 'mytracer-profile-invalid-'))
    temporaryDirectories.push(directory)
    const metadataDirectory = join(directory, 'metadata')
    mkdirSync(metadataDirectory)
    const profilesDirectory = join(directory, 'profiles')
    writeStandardProfile(profilesDirectory)
    const taskIndex = join(directory, 'TASK_INDEX.md')
    writeFileSync(taskIndex, `| T041 | S4 | scope | basis | none | \`${state}\` | — |\n`)
    writeFileSync(
      join(metadataDirectory, 'T041.json'),
      JSON.stringify(
        taskSidecar('T041', {
          task_kind: taskKind,
          execution: {
            profile: 'standard-task@1',
            activated_at: '2026-08-24T00:00:00Z',
            valid_until: '2026-09-23T00:00:00Z',
            additional_constraints: [],
            ...execution
          }
        })
      )
    )

    const result = runValidator(metadataDirectory, profilesDirectory, taskIndex)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(expected)
  })

  test('rejects a registry Profile with unsupported phases and missing safety gates', () => {
    const directory = mkdtempSync(join(tmpdir(), 'mytracer-profile-registry-invalid-'))
    temporaryDirectories.push(directory)
    const metadataDirectory = join(directory, 'metadata')
    mkdirSync(metadataDirectory)
    const profilesDirectory = join(directory, 'profiles')
    writeStandardProfile(profilesDirectory, {
      automaticPhases: ['run_arbitrary_command'],
      ownerGates: ['merge_dev'],
      maxValidityDays: 31
    })
    const taskIndex = join(directory, 'TASK_INDEX.md')
    writeFileSync(taskIndex, '| T041 | S4 | scope | basis | none | `active` | — |\n')
    writeFileSync(join(metadataDirectory, 'T041.json'), JSON.stringify(taskSidecar('T041')))

    const result = runValidator(metadataDirectory, profilesDirectory, taskIndex)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('unsupported value run_arbitrary_command')
    expect(result.stderr).toContain('missing repository safety gate ready_for_review')
    expect(result.stderr).toContain('maxValidityDays must be an integer from 1 through 30')
  })

  test('requires the standard-task@1 registry entry even before a task references it', () => {
    const directory = mkdtempSync(join(tmpdir(), 'mytracer-profile-registry-missing-'))
    temporaryDirectories.push(directory)
    const metadataDirectory = join(directory, 'metadata')
    mkdirSync(metadataDirectory)
    const profilesDirectory = join(directory, 'profiles')
    mkdirSync(profilesDirectory)
    writeFileSync(
      join(profilesDirectory, 'future-task-v1.json'),
      JSON.stringify(standardProfile({ id: 'future-task@1' }))
    )
    const taskIndex = join(directory, 'TASK_INDEX.md')
    writeFileSync(taskIndex, '| T041 | S4 | scope | basis | none | `active` | — |\n')
    writeFileSync(join(metadataDirectory, 'T041.json'), JSON.stringify(taskSidecar('T041')))

    const result = runValidator(metadataDirectory, profilesDirectory, taskIndex)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('required profile standard-task@1 is missing')
  })
})

describe('T061 static AI context boundaries', () => {
  test('keeps the Start Help coordinator Main-only and unexposed', () => {
    const coordinator = readFileSync(
      join(repositoryRoot, 'src', 'main', 'ai-start-help-context.ts'),
      'utf8'
    )
    const mainIndex = readFileSync(join(repositoryRoot, 'src', 'main', 'index.ts'), 'utf8')
    const preload = readFileSync(join(repositoryRoot, 'src', 'preload', 'index.ts'), 'utf8')
    const renderer = readFileSync(join(repositoryRoot, 'src', 'renderer', 'src', 'App.tsx'), 'utf8')

    ;[mainIndex, preload, renderer].forEach((source) => {
      expect(source).not.toContain('ai-start-help-context')
      expect(source).not.toContain('AiStartHelpContextCoordinator')
    })
    expect(coordinator.indexOf('.queryStartHelpContext(')).toBeGreaterThan(-1)
    expect(coordinator.indexOf('this.selector.select(')).toBeGreaterThan(
      coordinator.indexOf('.queryStartHelpContext(')
    )
    expect(coordinator.indexOf('.captureStartHelpRequest(')).toBeGreaterThan(
      coordinator.indexOf('this.selector.select(')
    )
  })

  test('keeps the narrow SQLite query independent from broad snapshots and excluded tables', () => {
    const source = readFileSync(
      join(repositoryRoot, 'src', 'infrastructure', 'sqlite', 'sqlite-repository.ts'),
      'utf8'
    )
    const queryStart = source.indexOf('queryStartHelpContext(')
    const nextQuery = source.indexOf('queryProgressSnapshot(', queryStart)
    expect(queryStart).toBeGreaterThan(-1)
    expect(nextQuery).toBeGreaterThan(queryStart)
    const querySource = source.slice(queryStart, nextQuery)

    ;[
      'readSnapshot(',
      'readCompleteCoreSnapshot(',
      'routine_records',
      'review_results',
      'credentials',
      'diagnostics'
    ].forEach((forbidden) => expect(querySource).not.toContain(forbidden))
  })
})
