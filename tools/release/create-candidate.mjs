import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import {
  describeAsset,
  requireCondition,
  safeRelativeBundle,
  validateBundle,
  CANDIDATE_WORKFLOW,
  REPOSITORY
} from './provenance.mjs'

try {
  requireCondition(
    process.argv.length === 4 && process.argv[2] === '--output',
    'candidate-arguments'
  )
  const directory = safeRelativeBundle(process.argv[3])
  const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  requireCondition(
    execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {
      encoding: 'utf8'
    }).trim() === '',
    'dirty-source'
  )
  const { version } = JSON.parse(await readFile('package.json', 'utf8'))
  const build = {
    workflow: CANDIDATE_WORKFLOW,
    runId: process.env.GITHUB_RUN_ID,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    event: process.env.GITHUB_EVENT_NAME,
    ref: process.env.GITHUB_REF,
    artifactName: `update-candidate-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}`
  }
  requireCondition(process.env.GITHUB_REPOSITORY === REPOSITORY, 'candidate-repository')
  const tests = {}
  const commands = {
    aggregate: ['npm.cmd', 'run', 'verify'],
    package: [
      'node',
      'node_modules/electron-builder/cli.js',
      '--win',
      'nsis',
      '--x64',
      '--publish',
      'never'
    ],
    'package-smoke': ['npm.cmd', 'run', 'test:package-smoke']
  }
  const files = await readdir('.tmp/evidence')
  for (const [gate, command] of Object.entries(commands)) {
    const matches = []
    for (const name of files.filter((f) => f.endsWith('.json'))) {
      const evidence = JSON.parse(await readFile(join('.tmp/evidence', name), 'utf8'))
      if (
        evidence.task === 'T084' &&
        evidence.gate === gate &&
        evidence.sourceRevision === sourceRevision &&
        evidence.ci?.runId === build.runId &&
        evidence.ci?.runAttempt === build.runAttempt &&
        JSON.stringify(evidence.command) === JSON.stringify(command)
      )
        matches.push(evidence)
    }
    requireCondition(matches.length === 1, 'candidate-evidence')
    const { exitCode, captureStatus, commandStatus } = matches[0]
    tests[gate] = { sourceRevision, exitCode, captureStatus, commandStatus }
  }
  await mkdir(directory, { recursive: true })
  requireCondition((await readdir(directory)).length === 0, 'candidate-output-exists')
  const setup = `MyTracer-${version}-x64-setup.exe`
  const names = [setup, `${setup}.blockmap`, 'latest.yml']
  for (const name of names) await copyFile(join('release', name), join(directory, name))
  const assets = []
  for (const name of names) assets.push(await describeAsset(directory, name))
  await writeFile(
    join(directory, 'SHA256SUMS.txt'),
    assets.map((a) => `${a.sha256}  ${a.name}`).join('\n') + '\n'
  )
  assets.push(await describeAsset(directory, 'SHA256SUMS.txt'))
  const manifest = {
    schemaVersion: 1,
    repository: REPOSITORY,
    sourceRevision,
    version,
    dataVersion: 3,
    exportVersion: 2,
    signing: 'unsigned',
    build,
    compatibleFrom: ['0.1.4'],
    assets,
    tests
  }
  const manifestPath = join(resolve(directory), 'candidate-manifest.json')
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
  await validateBundle(manifestPath)
  process.stdout.write(
    `Candidate ${version} ${sourceRevision}; actual artifact ID/digest are provided by the upload receipt.\n`
  )
} catch {
  process.stderr.write('Candidate capture failed; no publication performed.\n')
  process.exitCode = 1
}
