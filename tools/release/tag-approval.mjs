import { CANDIDATE_WORKFLOW, OWNER, REPOSITORY_ID, requireCondition } from './provenance.mjs'

const SHA = /^[a-f0-9]{40}$/
const HASH = /^[a-f0-9]{64}$/
const TAG = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
const positive = (value) => Number.isSafeInteger(value) && value > 0

// Tagger names and commit authors are not approval identities: authenticate the push sender.
export function readTagApproval(event, environment) {
  requireCondition(
    environment.GITHUB_EVENT_NAME === 'push' &&
      event.created === true &&
      event.deleted === false &&
      event.forced === false &&
      event.sender?.login === OWNER.login &&
      event.sender?.id === OWNER.id &&
      environment.GITHUB_ACTOR === OWNER.login &&
      environment.GITHUB_TRIGGERING_ACTOR === OWNER.login,
    'tag-owner-approval'
  )
  const ref = environment.GITHUB_REF
  requireCondition(
    typeof ref === 'string' && ref === event.ref && ref.startsWith('refs/tags/'),
    'tag-ref'
  )
  const tag = ref.slice('refs/tags/'.length)
  requireCondition(
    TAG.test(tag) && SHA.test(environment.GITHUB_SHA) && SHA.test(event.after),
    'tag-version'
  )
  return {
    actor: event.sender.login,
    actorId: event.sender.id,
    ref,
    tag,
    version: tag.slice(1),
    workflowRevision: environment.GITHUB_SHA,
    eventRevision: event.after
  }
}

export function selectCandidateRun(runs, sourceRevision, tag) {
  requireCondition(Array.isArray(runs) && SHA.test(sourceRevision), 'candidate-discovery')
  const candidates = runs
    .filter(
      (run) =>
        run.path === CANDIDATE_WORKFLOW &&
        run.head_sha === sourceRevision &&
        (run.head_branch === 'main' ||
          (typeof tag === 'string' &&
            TAG.test(tag) &&
            run.event === 'workflow_dispatch' &&
            run.head_branch === tag)) &&
        ['push', 'workflow_dispatch'].includes(run.event) &&
        run.status === 'completed' &&
        run.conclusion === 'success' &&
        run.repository?.id === REPOSITORY_ID &&
        run.head_repository?.id === REPOSITORY_ID &&
        positive(run.id) &&
        positive(run.run_attempt)
    )
    .sort((a, b) => b.id - a.id)
  requireCondition(candidates.length > 0, 'candidate-not-ready')
  requireCondition(
    new Set(candidates.map((run) => run.id)).size === candidates.length,
    'candidate-run-ambiguous'
  )
  return candidates[0]
}

export function selectCandidateArtifact(artifacts, run) {
  requireCondition(Array.isArray(artifacts), 'candidate-artifact-list')
  const matches = artifacts.filter(
    (artifact) => artifact.name === `update-candidate-${run.id}-${run.run_attempt}`
  )
  requireCondition(matches.length === 1 && positive(matches[0].id), 'candidate-artifact-ambiguous')
  return matches[0]
}

// Only fixed, validated metadata crosses the read-only/write job boundary.
export function validateSelection(selection) {
  const expected = [
    'sourceRevision',
    'tagObjectRevision',
    'version',
    'runId',
    'runAttempt',
    'artifactId',
    'artifactDigest',
    'manifestSha256'
  ]
  requireCondition(
    selection && Object.keys(selection).sort().join(',') === expected.sort().join(','),
    'selection-shape'
  )
  requireCondition(
    SHA.test(selection.sourceRevision) &&
      SHA.test(selection.tagObjectRevision) &&
      TAG.test(`v${selection.version}`) &&
      positive(selection.runId) &&
      positive(selection.runAttempt) &&
      positive(selection.artifactId) &&
      /^sha256:[a-f0-9]{64}$/.test(selection.artifactDigest) &&
      HASH.test(selection.manifestSha256),
    'selection-values'
  )
  return selection
}
