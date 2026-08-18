#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { isAbsolute, join, relative, sep } from 'node:path'

const DEFAULT_OUTPUT = '.tmp/evidence'
const SENSITIVE_ARGUMENT =
  /(?:api[-_]?key|access[-_]?token|auth[-_]?token|credential|password|secret|token)/i
const ABSOLUTE_PATH = /^(?:[A-Za-z]:[\\/]|\\\\|\/)/

function usageError(message) {
  throw new Error(message)
}

function parseArguments(argv) {
  const options = {
    task: null,
    gate: null,
    baseRevision: null,
    output: DEFAULT_OUTPUT,
    command: []
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--') {
      options.command = argv.slice(index + 1)
      break
    }
    if (argument === '--task') {
      options.task = argv[++index]
      continue
    }
    if (argument === '--gate') {
      options.gate = argv[++index]
      continue
    }
    if (argument === '--base-revision') {
      options.baseRevision = argv[++index]
      continue
    }
    if (argument === '--output') {
      options.output = argv[++index]
      continue
    }
    usageError(`Unknown option: ${argument}`)
  }

  if (!options.task || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(options.task)) {
    usageError('A safe --task value is required.')
  }
  if (!options.gate || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(options.gate)) {
    usageError('A safe --gate value is required.')
  }
  if (!options.command.length || !options.command[0]) {
    usageError('A command must follow --.')
  }

  return options
}

function safeOutputDirectory(output) {
  if (!output || isAbsolute(output)) {
    usageError('--output must be a relative path under .tmp/.')
  }
  const normalized = output.replaceAll('\\', '/')
  if (
    (normalized !== '.tmp' && !normalized.startsWith('.tmp/')) ||
    normalized.includes('/../') ||
    normalized.startsWith('../') ||
    normalized.endsWith('/..')
  ) {
    usageError('--output must stay under .tmp/.')
  }
  return join(process.cwd(), ...normalized.split('/'))
}

function slug(value) {
  return (
    String(value ?? 'unknown')
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'unknown'
  )
}

function redactCommand(command) {
  let redactNext = false
  return command
    .map((argument) => {
      if (redactNext) {
        redactNext = false
        return '[REDACTED]'
      }
      if (!SENSITIVE_ARGUMENT.test(argument)) {
        return argument
      }
      const separatorIndex = argument.search(/[=:]/)
      if (separatorIndex >= 0) {
        return `${argument.slice(0, separatorIndex + 1)}[REDACTED]`
      }
      redactNext = true
      return argument
    })
    .map((argument) => {
      if (argument === '[REDACTED]' || SENSITIVE_ARGUMENT.test(argument)) {
        return argument
      }
      if (ABSOLUTE_PATH.test(argument)) {
        return '[PATH_REDACTED]'
      }
      const separatorIndex = argument.search(/[=:]/)
      if (separatorIndex >= 0 && ABSOLUTE_PATH.test(argument.slice(separatorIndex + 1))) {
        return `${argument.slice(0, separatorIndex + 1)}[PATH_REDACTED]`
      }
      return argument
    })
}

function readGitValue(args) {
  const result = spawnSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    windowsHide: true
  })
  if (result.error || result.status !== 0) {
    return null
  }
  const value = result.stdout.trim()
  return value || null
}

async function readElectronVersion(errors) {
  try {
    const packageJson = JSON.parse(await readFile(join(process.cwd(), 'package.json'), 'utf8'))
    return packageJson.devDependencies?.electron ?? packageJson.dependencies?.electron ?? null
  } catch {
    errors.push('package-json-unavailable')
    return null
  }
}

function readCiMetadata() {
  const environment = process.env
  return {
    workflow: environment.GITHUB_WORKFLOW ?? null,
    runId: environment.GITHUB_RUN_ID ?? null,
    runAttempt: environment.GITHUB_RUN_ATTEMPT ?? null,
    eventName: environment.GITHUB_EVENT_NAME ?? null,
    headRevision: environment.GITHUB_SHA ?? null,
    mergeRevision: environment.GITHUB_MERGE_COMMIT_SHA ?? null
  }
}

function childInvocation(command) {
  if (process.platform !== 'win32' || !/\.(?:cmd|bat)$/i.test(command[0])) {
    return { executable: command[0], args: command.slice(1) }
  }

  return {
    executable: process.env.ComSpec ?? process.env.COMSPEC ?? 'cmd.exe',
    args: ['/d', '/s', '/c', ...command]
  }
}

function childResult(command) {
  return new Promise((resolve) => {
    let spawnError = null
    const invocation = childInvocation(command)
    let child
    try {
      child = spawn(invocation.executable, invocation.args, {
        cwd: process.cwd(),
        shell: false,
        stdio: 'inherit',
        windowsHide: true
      })
    } catch (error) {
      resolve({ code: null, signal: null, spawnError: error })
      return
    }
    child.once('error', (error) => {
      spawnError = error
    })
    child.once('close', (code, signal) => {
      resolve({ code, signal, spawnError })
    })
  })
}

async function writeArtifact(directory, artifact) {
  const revision = slug(artifact.sourceRevision?.slice(0, 12) ?? 'unknown')
  const timestamp = artifact.startedAt.replace(/\D/g, '').slice(0, 14)
  const filename = `${slug(artifact.task)}-${slug(artifact.gate)}-${revision}-${timestamp}.json`
  const artifactPath = join(directory, filename)
  const relativePath = relative(process.cwd(), artifactPath).split(sep).join('/')
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    throw new Error('artifact-path-outside-worktree')
  }
  artifact.artifacts = [
    {
      name: filename,
      relativePath
    }
  ]
  const temporaryPath = `${artifactPath}.tmp`
  await writeFile(temporaryPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
  await rename(temporaryPath, artifactPath)
  return { filename, relativePath }
}

async function run(argv) {
  const options = parseArguments(argv)
  const outputDirectory = safeOutputDirectory(options.output)
  const startedAt = new Date().toISOString()
  const captureErrors = []
  const sourceBranch =
    readGitValue(['symbolic-ref', '--short', '-q', 'HEAD']) ??
    readGitValue(['rev-parse', '--abbrev-ref', 'HEAD'])
  const sourceRevision = readGitValue(['rev-parse', 'HEAD'])
  if (!sourceBranch) captureErrors.push('git-branch-unavailable')
  if (!sourceRevision) captureErrors.push('git-revision-unavailable')
  const electron = await readElectronVersion(captureErrors)
  const baseRevision = options.baseRevision ?? process.env.GITHUB_BASE_SHA ?? null
  const command = redactCommand(options.command)
  const result = await childResult(options.command)
  const finishedAt = new Date().toISOString()
  const commandStatus = result.spawnError
    ? 'not-started'
    : result.code === 0 && result.signal === null
      ? 'passed'
      : 'failed'
  const artifact = {
    schemaVersion: 1,
    task: options.task,
    gate: options.gate,
    sourceBranch,
    sourceRevision,
    baseRevision,
    platform: process.platform,
    node: process.version,
    electron,
    command,
    startedAt,
    finishedAt,
    exitCode: result.spawnError ? null : result.code,
    signal: result.signal,
    artifacts: [],
    ci: readCiMetadata(),
    commandStatus,
    captureStatus: captureErrors.length === 0 ? 'complete' : 'incomplete',
    captureErrors
  }

  await mkdir(outputDirectory, { recursive: true })
  const artifactInfo = await writeArtifact(outputDirectory, artifact)
  process.stdout.write(`Evidence artifact: ${artifactInfo.relativePath}\n`)

  if (captureErrors.length > 0) {
    return 2
  }
  if (result.spawnError) {
    return 127
  }
  if (typeof result.code === 'number') {
    return result.code
  }
  return 1
}

try {
  const exitCode = await run(process.argv.slice(2))
  process.exitCode = exitCode
} catch (error) {
  const code = error instanceof Error && error.message ? error.message : 'capture-command-failed'
  process.stderr.write(`capture-command: ${code}\n`)
  process.exitCode = 2
}
