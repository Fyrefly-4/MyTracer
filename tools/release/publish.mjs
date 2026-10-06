import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { appendFile, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { GithubApi } from './github-api.mjs'
import { REPOSITORY, requireCondition, validateBundle, validatePublication } from './provenance.mjs'
import { publishCandidate } from './publication.mjs'
import {
  readTagApproval,
  selectCandidateArtifact,
  selectCandidateRun,
  validateSelection
} from './tag-approval.mjs'

// Offline tests inject only the transport and Git checkout identity; bundle extraction is real.
export async function runPublication(
  mode,
  environment = process.env,
  api,
  git = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
) {
  requireCondition(['prepare', 'publish'].includes(mode), 'publication-arguments')
  const event = JSON.parse(await readFile(environment.GITHUB_EVENT_PATH, 'utf8'))
  const approval = readTagApproval(event, environment)
  const sourceRevision = git(['rev-parse', 'HEAD'])
  requireCondition(
    sourceRevision === git(['rev-parse', `${approval.workflowRevision}^{commit}`]),
    'workflow-checkout'
  )
  const { version } = JSON.parse(await readFile('package.json', 'utf8'))
  const lock = JSON.parse(await readFile('package-lock.json', 'utf8'))
  requireCondition(
    version === approval.version &&
      lock.version === version &&
      lock.packages?.['']?.version === version,
    'source-version'
  )
  api ??= new GithubApi(environment.GH_TOKEN, mode === 'publish')
  const repository = await api.get('')
  const tag = await api.resolveTag(approval.tag)
  requireCondition(
    tag.sourceRevision === sourceRevision &&
      [tag.sourceRevision, tag.tagObjectRevision].includes(approval.eventRevision),
    'tag-event-source'
  )
  approval.workflowRevision = sourceRevision
  approval.tagObjectRevision = tag.tagObjectRevision
  await api.assertMainSource(sourceRevision)
  await api.assertReleaseAvailable(approval.tag, sourceRevision, approval.tagObjectRevision)

  let selection, run, artifact
  if (mode === 'prepare') {
    run = selectCandidateRun(await api.candidateRuns(sourceRevision), sourceRevision, approval.tag)
    artifact = selectCandidateArtifact(await api.runArtifacts(run.id), run)
  } else {
    selection = validateSelection(JSON.parse(environment.MYTRACER_RELEASE_SELECTION))
    requireCondition(
      selection.sourceRevision === sourceRevision &&
        selection.version === approval.version &&
        selection.tagObjectRevision === approval.tagObjectRevision,
      'selection-source'
    )
    // Never rediscover a replacement candidate in the write job.
    run = await api.get(`/actions/runs/${selection.runId}`)
    artifact = await api.get(`/actions/artifacts/${selection.artifactId}`)
  }
  const dispatch = {
    ...approval,
    sourceRevision,
    runId: run.id,
    runAttempt: run.run_attempt,
    artifactId: artifact.id,
    artifactDigest: artifact.digest,
    manifestSha256: selection?.manifestSha256 ?? '0'.repeat(64)
  }
  if (selection) {
    requireCondition(
      run.id === selection.runId &&
        artifact.id === selection.artifactId &&
        run.run_attempt === selection.runAttempt &&
        artifact.digest === selection.artifactDigest,
      'selection-changed'
    )
  }
  const context = {
    now: Date.now(),
    repository,
    run,
    artifact,
    dispatch,
    mainRevisions: [sourceRevision],
    existingVersions: (await api.allReleases()).map((release) => release.tag_name)
  }
  requireCondition(
    artifact.expired === false && /^sha256:[a-f0-9]{64}$/.test(artifact.digest),
    'candidate-artifact'
  )
  await mkdir('.tmp/release', { recursive: true })
  const base = await mkdtemp(`.tmp/release/${mode}-`)
  const archive = await api.request(`/repos/${REPOSITORY}/actions/artifacts/${artifact.id}/zip`, {
    binary: true
  })
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
  const manifestSha256 = createHash('sha256')
    .update(await readFile(manifestPath))
    .digest('hex')
  if (selection) requireCondition(manifestSha256 === selection.manifestSha256, 'manifest-integrity')
  dispatch.manifestSha256 = manifestSha256
  validatePublication({ ...context, manifest })
  selection = validateSelection({
    sourceRevision,
    tagObjectRevision: approval.tagObjectRevision,
    version,
    runId: run.id,
    runAttempt: run.run_attempt,
    artifactId: artifact.id,
    artifactDigest: artifact.digest,
    manifestSha256
  })
  if (mode === 'prepare') {
    requireCondition(typeof environment.GITHUB_OUTPUT === 'string', 'selection-output')
    await appendFile(environment.GITHUB_OUTPUT, `selection=${JSON.stringify(selection)}\n`)
  } else {
    const result = await publishCandidate({ context, directory, api })
    process.stdout.write(`Published release ${result.releaseId} from ${result.sourceRevision}.\n`)
  }
  if (environment.GITHUB_STEP_SUMMARY) {
    await appendFile(
      environment.GITHUB_STEP_SUMMARY,
      `Owner tag: ${approval.tag}\n\nSource: ${sourceRevision}\n\nCandidate run/attempt: ${run.id}/${run.run_attempt}\n\nArtifact: ${artifact.id}\n\nArchive digest: ${artifact.digest}\n\nManifest SHA-256: ${manifestSha256}\n`
    )
  }
  return selection
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  Promise.resolve()
    .then(() => {
      requireCondition(process.argv.length === 3, 'publication-arguments')
      return runPublication(process.argv[2])
    })
    .catch(() => {
      // Never print exception text, API bodies, signed URLs or credential-bearing environment.
      process.stderr.write(
        'Publication stopped. Check owner tag, main source, candidate and permissions; any created draft is preserved.\n'
      )
      process.exitCode = 1
    })
}
