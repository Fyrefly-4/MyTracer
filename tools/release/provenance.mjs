import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { lstat, readFile, readdir, realpath } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'

export const REPOSITORY = 'Fyrefly-4/MyTracer'
export const REPOSITORY_ID = 1326905280
export const OWNER = Object.freeze({ login: 'Fyrefly-4', id: 183197199 })
export const CANDIDATE_WORKFLOW = '.github/workflows/update-candidate.yml'
const SHA = /^[a-f0-9]{40}$/
const HASH = /^[a-f0-9]{64}$/
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

export function requireCondition(condition, code) {
  if (!condition) throw new Error(code)
}

function keys(value, expected, code) {
  requireCondition(value && typeof value === 'object' && !Array.isArray(value), code)
  requireCondition(Object.keys(value).sort().join(',') === [...expected].sort().join(','), code)
}

export function isHigherVersion(candidate, current) {
  if (!VERSION.test(candidate) || !VERSION.test(current)) return false
  const a = candidate.split('.').map(BigInt)
  const b = current.split('.').map(BigInt)
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i]
  }
  return false
}

export function validateManifest(manifest) {
  keys(
    manifest,
    [
      'schemaVersion',
      'repository',
      'sourceRevision',
      'version',
      'dataVersion',
      'exportVersion',
      'signing',
      'build',
      'compatibleFrom',
      'assets',
      'tests'
    ],
    'manifest-shape'
  )
  requireCondition(
    manifest.schemaVersion === 1 && manifest.repository === REPOSITORY,
    'manifest-repository'
  )
  requireCondition(SHA.test(manifest.sourceRevision), 'source-revision')
  requireCondition(VERSION.test(manifest.version), 'stable-version')
  requireCondition(
    ((manifest.dataVersion === 3 && manifest.exportVersion === 2) ||
      (manifest.dataVersion === 4 && manifest.exportVersion === 3)) && manifest.signing === 'unsigned',
    'compatibility-boundary'
  )
  keys(
    manifest.build,
    ['workflow', 'runId', 'runAttempt', 'event', 'ref', 'artifactName'],
    'build-shape'
  )
  requireCondition(manifest.build.workflow === CANDIDATE_WORKFLOW, 'build-workflow')
  requireCondition(
    /^[1-9]\d*$/.test(manifest.build.runId) && /^[1-9]\d*$/.test(manifest.build.runAttempt),
    'build-run'
  )
  requireCondition(
    ['pull_request', 'push', 'workflow_dispatch'].includes(manifest.build.event),
    'build-event'
  )
  requireCondition(
    typeof manifest.build.ref === 'string' &&
      (/^refs\/(heads|pull)\/[A-Za-z0-9/_-]+$/.test(manifest.build.ref) ||
        /^refs\/tags\/v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(manifest.build.ref)),
    'build-ref'
  )
  requireCondition(
    manifest.build.artifactName ===
      `update-candidate-${manifest.build.runId}-${manifest.build.runAttempt}`,
    'artifact-name'
  )
  requireCondition(
    Array.isArray(manifest.compatibleFrom) &&
      manifest.compatibleFrom.length > 0 &&
      new Set(manifest.compatibleFrom).size === manifest.compatibleFrom.length &&
      manifest.compatibleFrom.every((v) => isHigherVersion(manifest.version, v)),
    'compatible-versions'
  )
  const setup = `MyTracer-${manifest.version}-x64-setup.exe`
  const required = [setup, `${setup}.blockmap`, 'latest.yml', 'SHA256SUMS.txt']
  requireCondition(
    Array.isArray(manifest.assets) && manifest.assets.length === required.length,
    'asset-set'
  )
  requireCondition(
    new Set(manifest.assets.map((a) => a.name)).size === required.length,
    'duplicate-asset'
  )
  for (const asset of manifest.assets) {
    keys(asset, ['name', 'size', 'sha256', 'sha512'], 'asset-shape')
    requireCondition(required.includes(asset.name), 'asset-name')
    requireCondition(
      Number.isSafeInteger(asset.size) && asset.size > 0 && asset.size <= 512 * 1024 * 1024,
      'asset-size'
    )
    requireCondition(
      HASH.test(asset.sha256) && /^[A-Za-z0-9+/]{86}==$/.test(asset.sha512),
      'asset-hash'
    )
  }
  keys(manifest.tests, ['aggregate', 'package', 'package-smoke'], 'tests-shape')
  for (const evidence of Object.values(manifest.tests)) {
    keys(evidence, ['sourceRevision', 'exitCode', 'captureStatus', 'commandStatus'], 'test-shape')
    requireCondition(
      evidence.sourceRevision === manifest.sourceRevision &&
        evidence.exitCode === 0 &&
        evidence.captureStatus === 'complete' &&
        evidence.commandStatus === 'passed',
      'test-evidence'
    )
  }
  return manifest
}

export async function hashFile(path, algorithm = 'sha256', encoding = 'hex') {
  const hash = createHash(algorithm)
  for await (const data of createReadStream(path)) hash.update(data)
  return hash.digest(encoding)
}

export async function describeAsset(directory, name) {
  const path = join(directory, name)
  const details = await lstat(path)
  requireCondition(details.isFile() && !details.isSymbolicLink(), 'asset-file')
  const physical = await realpath(path)
  requireCondition(dirname(physical) === (await realpath(directory)), 'asset-outside-bundle')
  return {
    name,
    size: details.size,
    sha256: await hashFile(path),
    sha512: await hashFile(path, 'sha512', 'base64')
  }
}

// Accept only the concrete single-file NSIS metadata emitted by the locked builder.
// Reject unknown YAML instead of interpreting aliases, tags or arbitrary remote paths.
export function validateLatest(text, manifest) {
  const lines = text.replaceAll('\r', '').trimEnd().split('\n')
  const setup = manifest.assets.find((a) => a.name.endsWith('.exe'))
  requireCondition(
    lines.length === 8 &&
      lines[0] === `version: ${manifest.version}` &&
      lines[1] === 'files:' &&
      lines[2] === `  - url: ${setup.name}` &&
      lines[3] === `    sha512: ${setup.sha512}` &&
      lines[4] === `    size: ${setup.size}` &&
      lines[5] === `path: ${setup.name}` &&
      lines[6] === `sha512: ${setup.sha512}` &&
      /^releaseDate: '?\d{4}-\d{2}-\d{2}T[\d:.]+Z'?$/.test(lines[7]),
    'updater-metadata'
  )
}

export async function validateBundle(manifestPath) {
  const manifest = validateManifest(JSON.parse(await readFile(manifestPath, 'utf8')))
  const directory = dirname(resolve(manifestPath))
  const allowed = [...manifest.assets.map((a) => a.name), 'candidate-manifest.json'].sort()
  requireCondition(
    (await readdir(directory)).sort().join(',') === allowed.join(','),
    'unexpected-bundle-file'
  )
  for (const expected of manifest.assets) {
    const actual = await describeAsset(directory, expected.name)
    requireCondition(
      JSON.stringify(actual) ===
        JSON.stringify({
          name: expected.name,
          size: expected.size,
          sha256: expected.sha256,
          sha512: expected.sha512
        }),
      'bundle-integrity'
    )
  }
  validateLatest(await readFile(join(directory, 'latest.yml'), 'utf8'), manifest)
  const sums =
    manifest.assets
      .filter((a) => a.name !== 'SHA256SUMS.txt')
      .map((a) => `${a.sha256}  ${a.name}`)
      .join('\n') + '\n'
  requireCondition(
    (await readFile(join(directory, 'SHA256SUMS.txt'), 'utf8')) === sums,
    'checksum-list'
  )
  return manifest
}

export function validatePublication(context) {
  const { manifest, run, artifact, repository, dispatch, mainRevisions, existingVersions, now } =
    context
  validateManifest(manifest)
  requireCondition(
    dispatch.actor === OWNER.login && dispatch.actorId === OWNER.id,
    'owner-identity'
  )
  requireCondition(
    dispatch.ref === `refs/tags/${dispatch.tag}` &&
      SHA.test(dispatch.workflowRevision) &&
      dispatch.workflowRevision === dispatch.sourceRevision &&
      SHA.test(dispatch.tagObjectRevision),
    'trusted-workflow'
  )
  requireCondition(
    repository.full_name === REPOSITORY &&
      repository.id === REPOSITORY_ID &&
      typeof repository.private === 'boolean',
    'repository-target'
  )
  requireCondition(
    SHA.test(dispatch.sourceRevision) &&
      mainRevisions.includes(dispatch.sourceRevision) &&
      dispatch.sourceRevision === manifest.sourceRevision,
    'accepted-main-source'
  )
  requireCondition(
    dispatch.version === manifest.version && dispatch.tag === `v${manifest.version}`,
    'release-version'
  )
  requireCondition(!existingVersions.includes(dispatch.tag), 'existing-version')
  requireCondition(
    existingVersions
      .filter((tag) => /^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(tag))
      .every((tag) => isHigherVersion(manifest.version, tag.slice(1))),
    'non-monotonic-release'
  )
  requireCondition(
    run.id === dispatch.runId &&
      run.run_attempt === dispatch.runAttempt &&
      run.path === CANDIDATE_WORKFLOW &&
      run.status === 'completed' &&
      run.conclusion === 'success' &&
      run.head_sha === manifest.sourceRevision &&
      (run.head_branch === 'main' ||
        (run.event === 'workflow_dispatch' && run.head_branch === dispatch.tag)) &&
      ['push', 'workflow_dispatch'].includes(run.event) &&
      run.repository?.id === REPOSITORY_ID &&
      run.head_repository?.id === REPOSITORY_ID,
    'candidate-run'
  )
  requireCondition(
    manifest.build.event === run.event &&
      (manifest.build.ref === 'refs/heads/main' ||
        (run.event === 'workflow_dispatch' &&
          run.head_branch === dispatch.tag &&
          manifest.build.ref === dispatch.ref)) &&
      manifest.build.runId === String(run.id) &&
      manifest.build.runAttempt === String(run.run_attempt),
    'candidate-provenance'
  )
  requireCondition(
    artifact.id === dispatch.artifactId &&
      artifact.name === manifest.build.artifactName &&
      artifact.expired === false &&
      artifact.workflow_run?.id === run.id &&
      artifact.workflow_run?.head_sha === manifest.sourceRevision &&
      artifact.workflow_run?.repository_id === REPOSITORY_ID &&
      /^sha256:[a-f0-9]{64}$/.test(artifact.digest) &&
      artifact.digest === dispatch.artifactDigest,
    'candidate-artifact'
  )
  const age = now - Date.parse(artifact.created_at)
  requireCondition(
    Number.isFinite(age) &&
      age >= 0 &&
      age <= 14 * 24 * 60 * 60 * 1000 &&
      Date.parse(artifact.expires_at) > now,
    'artifact-expired'
  )
  requireCondition(HASH.test(dispatch.manifestSha256), 'manifest-hash')
  return manifest
}

export function safeRelativeBundle(path) {
  const result = relative(process.cwd(), resolve(path)).replaceAll('\\', '/')
  requireCondition(result.startsWith('.tmp/') && !result.split('/').includes('..'), 'bundle-output')
  return result
}
