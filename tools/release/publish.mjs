import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { GithubApi } from './github-api.mjs'
import { OWNER, requireCondition, validateBundle, validatePublication } from './provenance.mjs'
import { publishCandidate } from './publication.mjs'

try {
  const mode = process.argv[2]
  requireCondition(
    process.argv.length === 3 && ['prepare', 'publish'].includes(mode),
    'publication-arguments'
  )
  const environment = process.env
  const event = JSON.parse(await readFile(environment.GITHUB_EVENT_PATH, 'utf8'))
  requireCondition(
    environment.GITHUB_EVENT_NAME === 'workflow_dispatch' &&
      environment.GITHUB_REF === 'refs/heads/main' &&
      event.sender?.login === OWNER.login &&
      event.sender?.id === OWNER.id &&
      environment.GITHUB_ACTOR === OWNER.login &&
      environment.GITHUB_TRIGGERING_ACTOR === OWNER.login,
    'dispatch-owner'
  )
  const git = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
  const workflowRevision = git(['rev-parse', 'HEAD'])
  requireCondition(workflowRevision === environment.GITHUB_SHA, 'workflow-checkout')
  const { source_sha, version, run_id, artifact_id, manifest_sha256 } = event.inputs
  requireCondition(
    /^[a-f0-9]{40}$/.test(source_sha) &&
      /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version) &&
      /^[1-9]\d*$/.test(run_id) &&
      /^[1-9]\d*$/.test(artifact_id) &&
      /^[a-f0-9]{64}$/.test(manifest_sha256),
    'dispatch-input'
  )
  requireCondition(
    Number.isSafeInteger(Number(run_id)) && Number.isSafeInteger(Number(artifact_id)),
    'dispatch-id'
  )
  git(['merge-base', '--is-ancestor', source_sha, workflowRevision])
  const api = new GithubApi(environment.GH_TOKEN, mode === 'publish')
  const [repository, run, artifact, releases] = await Promise.all([
    api.get(''),
    api.get(`/actions/runs/${run_id}`),
    api.get(`/actions/artifacts/${artifact_id}`),
    api.allReleases()
  ])
  // Only approvals checked into the trusted main checkout are authoritative, never bundle-provided approvals.
  const ledger = await readFile('docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md', 'utf8')
  const approvals = [...ledger.matchAll(/```release-approval\r?\n([\s\S]*?)```/g)].map((m) =>
    JSON.parse(m[1])
  )
  const matching = approvals.filter(
    (a) =>
      a.sourceRevision === source_sha &&
      a.version === version &&
      a.artifactId === Number(artifact_id)
  )
  requireCondition(matching.length === 1, 'missing-main-acceptance')
  const context = {
    now: Date.now(),
    repository,
    run,
    artifact,
    approval: matching[0],
    mainRevisions: [source_sha],
    existingVersions: releases.map((r) => r.tag_name),
    dispatch: {
      actor: event.sender.login,
      actorId: event.sender.id,
      ref: environment.GITHUB_REF,
      workflowRevision,
      sourceRevision: source_sha,
      version,
      tag: `v${version}`,
      runId: Number(run_id),
      artifactId: Number(artifact_id),
      manifestSha256: manifest_sha256
    }
  }
  const base = `.tmp/release/${mode}`
  await mkdir(base, { recursive: true })
  const archive = await api.request(
    `/repos/Fyrefly-4/MyTracer/actions/artifacts/${artifact_id}/zip`,
    { binary: true }
  )
  requireCondition(
    `sha256:${createHash('sha256').update(archive).digest('hex')}` === artifact.digest,
    'archive-integrity'
  )
  const zip = join(base, 'candidate.zip'),
    directory = join(base, 'bundle')
  await writeFile(zip, archive)
  execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-File',
      'tools/release/extract-artifact.ps1',
      '-Archive',
      zip,
      '-Destination',
      directory,
      '-Version',
      version
    ],
    { stdio: 'pipe', windowsHide: true }
  )
  const manifestPath = join(directory, 'candidate-manifest.json')
  const manifest = await validateBundle(manifestPath)
  requireCondition(
    createHash('sha256')
      .update(await readFile(manifestPath))
      .digest('hex') === manifest_sha256,
    'manifest-integrity'
  )
  validatePublication({ ...context, manifest })
  await api.assertVersionAbsent(`v${version}`)
  if (mode === 'publish') {
    const result = await publishCandidate({ context, directory, api })
    process.stdout.write(`Published release ${result.releaseId} from ${result.sourceRevision}.\n`)
  } else
    process.stdout.write(
      `Approved immutable candidate ${version} validated; no writes performed.\n`
    )
} catch {
  // Never print exception text, GitHub bodies, signed URLs or credential-bearing environment.
  process.stderr.write(
    'Publication stopped. Check source, acceptance, artifact and permissions; any created draft/tag is preserved.\n'
  )
  process.exitCode = 1
}
