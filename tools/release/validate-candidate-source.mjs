import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { GithubApi } from './github-api.mjs'
import { OWNER, requireCondition } from './provenance.mjs'

export async function validateCandidateSource({
  event,
  environment,
  api,
  sourceRevision,
  version
}) {
  const ref = environment.GITHUB_REF
  requireCondition(
    environment.GITHUB_EVENT_NAME === 'workflow_dispatch' &&
      /^refs\/tags\/v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(ref) &&
      event.sender?.login === OWNER.login &&
      event.sender?.id === OWNER.id &&
      environment.GITHUB_ACTOR === OWNER.login &&
      environment.GITHUB_TRIGGERING_ACTOR === OWNER.login &&
      ref === `refs/tags/v${version}`,
    'candidate-tag-owner'
  )
  const tag = await api.resolveTag(ref.slice('refs/tags/'.length))
  requireCondition(tag.sourceRevision === sourceRevision, 'candidate-tag-source')
  await api.assertMainSource(sourceRevision)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  Promise.resolve()
    .then(async () => {
      const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'))
      const { version } = JSON.parse(await readFile('package.json', 'utf8'))
      const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
      await validateCandidateSource({
        event,
        environment: process.env,
        api: new GithubApi(process.env.GH_TOKEN),
        sourceRevision,
        version
      })
    })
    .catch(() => {
      process.stderr.write(
        'Candidate tag rebuild stopped; only owner-approved main sources are allowed.\n'
      )
      process.exitCode = 1
    })
}
