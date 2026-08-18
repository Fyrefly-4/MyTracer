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

function runCollector(output: string, command: string[], extraArgs: string[] = []) {
  return spawnSync(
    process.execPath,
    [
      collector,
      '--task',
      'T091',
      '--gate',
      'unit',
      '--base-revision',
      'base123',
      '--output',
      output,
      ...extraArgs,
      '--',
      ...command
    ],
    { cwd: repositoryRoot, encoding: 'utf8', windowsHide: true }
  )
}

function readArtifact(output: string) {
  const directory = join(repositoryRoot, output)
  const files = readdirSync(directory).filter((file) => file.endsWith('.json'))
  expect(files).toHaveLength(1)
  return JSON.parse(readFileSync(join(directory, files[0]), 'utf8'))
}

function runValidator(metadataDirectory: string, taskIndex: string) {
  return spawnSync(
    process.execPath,
    [validator, '--metadata-dir', metadataDirectory, '--task-index', taskIndex],
    { cwd: repositoryRoot, encoding: 'utf8', windowsHide: true }
  )
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
          conflicts_with: []
        },
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

    const result = runValidator(metadataDirectory, taskIndex)

    expect(result.status).toBe(0)
    expect(readFileSync(taskIndex, 'utf8')).toBe(taskIndexText)
  })

  test('rejects unknown relations and duplicate dependencies', () => {
    const directory = mkdtempSync(join(tmpdir(), 'mytracer-metadata-invalid-'))
    temporaryDirectories.push(directory)
    const metadataDirectory = join(directory, 'metadata')
    mkdirSync(metadataDirectory)
    const taskIndex = join(directory, 'TASK_INDEX.md')
    writeFileSync(taskIndex, '| T091 | GOV-02 |\n')
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
          conflicts_with: [],
          unsupported: []
        },
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

    const result = runValidator(metadataDirectory, taskIndex)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('duplicate T091')
  })
})
