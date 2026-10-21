import { execFileSync } from 'node:child_process'
import { appendFile, copyFile, mkdir, readFile, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { GithubApi } from './github-api.mjs'
import {
  REPOSITORY,
  REPOSITORY_ID,
  describeAsset,
  isHigherVersion,
  validateLatest
} from './provenance.mjs'

const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
const SHA = /^[a-f0-9]{40}$/
const PREFIX = `/repos/${REPOSITORY}`

export class ReleaseError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

function check(condition, code) {
  if (!condition) throw new ReleaseError(code)
}

export function safeErrorCode(error) {
  if (error instanceof ReleaseError) return error.code
  const message = error instanceof Error ? error.message : ''
  if (/^github-http-\d{3}$/.test(message)) return message
  if (
    [
      'missing-ci-credential',
      'download-redirect',
      'download-failed',
      'response-too-large',
      'remote-integrity',
      'remote-asset-set',
      'remote-asset',
      'updater-metadata',
      'non-main-source',
      'tag-changed',
      'asset-file',
      'asset-outside-bundle'
    ].includes(message)
  )
    return message
  return 'unexpected-error'
}

export function validateSelection(value) {
  check(value && typeof value === 'object', 'selection-shape')
  check(Number.isSafeInteger(value.releaseId) && value.releaseId > 0, 'release-id')
  check(VERSION.test(value.version) && value.tag === `v${value.version}`, 'stable-version')
  check(SHA.test(value.sourceRevision), 'source-revision')
  return value
}

async function assertRepository(api) {
  const repository = await api.get('')
  check(
    repository.full_name === REPOSITORY && repository.id === REPOSITORY_ID && repository.private,
    'private-repository'
  )
}

// Release Please's merged PR is the approval. A normal application push is not.
export async function assertReleasePullRequest(api, sha) {
  const prs = await api.get(`/commits/${sha}/pulls?per_page=100`)
  check(Array.isArray(prs), 'release-pr-response')
  const matches = prs.filter(
    (pr) =>
      pr.merged_at &&
      pr.merge_commit_sha === sha &&
      pr.base?.ref === 'main' &&
      pr.base?.repo?.full_name === REPOSITORY &&
      pr.head?.repo?.full_name === REPOSITORY &&
      pr.head?.ref === 'release-please--branches--main--components--mytracer' &&
      pr.labels?.some((label) =>
        ['autorelease: pending', 'autorelease: tagged'].includes(label.name)
      )
  )
  check(matches.length === 1, 'merged-release-pr-required')
}

async function assertRelease(api, selection) {
  validateSelection(selection)
  const release = await api.get(`/releases/${selection.releaseId}`)
  check(release.tag_name === selection.tag && release.prerelease === false, 'release-target')
  check(release.target_commitish === selection.sourceRevision, 'release-source')
  const tag = await api.resolveTag(selection.tag)
  check(tag.sourceRevision === selection.sourceRevision, 'tag-source')
  await api.assertMainSource(selection.sourceRevision)
  await assertReleasePullRequest(api, selection.sourceRevision)
  return release
}

export async function selectRelease({ api, eventSha, created, releaseId, releaseSha, tag }) {
  check(SHA.test(eventSha), 'event-sha')
  await assertRepository(api)
  let selection
  if (created === 'true') {
    selection = validateSelection({
      releaseId: Number(releaseId),
      sourceRevision: releaseSha,
      tag,
      version: tag?.slice(1)
    })
  } else {
    // Full-run retries no longer receive release_created from Release Please.
    // Recover only the release approved by THIS push's merged release PR, never another draft.
    const releases = (await api.allReleases()).filter(
      (release) =>
        release.target_commitish === eventSha && /^v\d+\.\d+\.\d+$/.test(release.tag_name)
    )
    if (releases.length === 0) return null
    check(releases.length === 1, 'ambiguous-release')
    const release = releases[0]
    selection = validateSelection({
      releaseId: release.id,
      sourceRevision: eventSha,
      tag: release.tag_name,
      version: release.tag_name.slice(1)
    })
  }
  const release = await assertRelease(api, selection)
  // A retry after successful publication is a read-only no-op, never an overwrite.
  if (!release.draft) return null
  return selection
}

export async function validateAssets(directory, selection) {
  validateSelection(selection)
  const setup = `MyTracer-${selection.version}-x64-setup.exe`
  const names = [setup, `${setup}.blockmap`, 'latest.yml']
  check((await readdir(directory)).sort().join(',') === [...names].sort().join(','), 'asset-set')
  const assets = []
  for (const name of names) {
    const asset = await describeAsset(directory, name)
    check(asset.size > 0 && asset.size <= 256 * 1024 * 1024, 'asset-size')
    assets.push(asset)
  }
  validateLatest(await readFile(join(directory, 'latest.yml'), 'utf8'), {
    version: selection.version,
    assets
  })
  return assets
}

export async function bundleAssets({ selection, sourceRevision, directory = '.tmp/release-pr' }) {
  validateSelection(selection)
  check(sourceRevision === selection.sourceRevision, 'checkout-source')
  const pkg = JSON.parse(await readFile('package.json', 'utf8'))
  const lock = JSON.parse(await readFile('package-lock.json', 'utf8'))
  check(
    pkg.version === selection.version &&
      lock.version === pkg.version &&
      lock.packages?.['']?.version === pkg.version,
    'package-version'
  )
  await mkdir(directory, { recursive: true })
  check((await readdir(directory)).length === 0, 'bundle-not-empty')
  const setup = `MyTracer-${selection.version}-x64-setup.exe`
  for (const name of [setup, `${setup}.blockmap`, 'latest.yml']) {
    await describeAsset('release', name)
    await copyFile(join('release', name), join(directory, name))
  }
  await validateAssets(directory, selection)
}

function assertNewest(releases, selection) {
  check(
    releases
      .filter((r) => !r.draft && !r.prerelease && r.id !== selection.releaseId)
      .filter((r) => /^v\d+\.\d+\.\d+$/.test(r.tag_name))
      .every((r) => isHigherVersion(selection.version, r.tag_name.slice(1))),
    'newer-version-exists'
  )
}

export async function publishRelease({ api, selection, directory }) {
  await assertRepository(api)
  const assets = await validateAssets(directory, selection)
  let release = await assertRelease(api, selection)
  if (release.draft === false) {
    // The final visibility request may have succeeded before its response was lost.
    // A retry may confirm identical published bytes, never overwrite or repromote them.
    await api.verifyAssets(selection.releaseId, assets)
    return release
  }
  check(release.draft === true, 'published-version-immutable')
  assertNewest(await api.allReleases(), selection)
  const remote = await api.get(`/releases/${selection.releaseId}/assets?per_page=100`)
  check(
    Array.isArray(remote) && remote.every((a) => assets.some((b) => a.name === b.name)),
    'unexpected-remote-assets'
  )
  for (const asset of assets) {
    const existing = remote.filter((a) => a.name === asset.name)
    check(existing.length <= 1, 'duplicate-remote-asset')
    if (existing.length) {
      const previous = existing[0]
      if (previous.state === 'uploaded') {
        const bytes = await api.request(`${PREFIX}/releases/assets/${previous.id}`, {
          binary: true
        })
        if (
          previous.size === asset.size &&
          bytes.length === asset.size &&
          createHash('sha256').update(bytes).digest('hex') === asset.sha256
        )
          continue
      }
      // Only replace partial/rebuilt bytes in this still-private draft; never a published version.
      release = await assertRelease(api, selection)
      check(release.draft === true, 'published-version-immutable')
      await api.request(`${PREFIX}/releases/assets/${previous.id}`, { method: 'DELETE' })
    }
    const data = await readFile(join(directory, asset.name))
    check(createHash('sha256').update(data).digest('hex') === asset.sha256, 'local-asset-changed')
    const result = await api.uploadAsset(selection.releaseId, asset.name, data)
    check(
      result.name === asset.name && result.size === data.length && result.state === 'uploaded',
      'asset-upload'
    )
  }
  await api.verifyAssets(selection.releaseId, assets)
  release = await assertRelease(api, selection)
  check(release.draft === true, 'published-version-immutable')
  assertNewest(await api.allReleases(), selection)
  const visible = await api.makeVisible(selection.releaseId)
  check(
    visible.id === selection.releaseId &&
      visible.tag_name === selection.tag &&
      visible.draft === false &&
      visible.prerelease === false,
    'release-visibility'
  )
  return visible
}

export async function run(mode, env = process.env) {
  check(env.GITHUB_REPOSITORY === REPOSITORY, 'workflow-repository')
  check(
    env.GITHUB_EVENT_NAME === 'push' && env.GITHUB_REF === 'refs/heads/main',
    'main-push-required'
  )
  let selection
  if (mode === 'select') {
    selection = await selectRelease({
      api: new GithubApi(env.GH_TOKEN),
      eventSha: env.GITHUB_SHA,
      created: env.RELEASE_CREATED,
      releaseId: env.RELEASE_ID,
      releaseSha: env.RELEASE_SHA,
      tag: env.RELEASE_TAG
    })
    await appendFile(env.GITHUB_OUTPUT, `selection=${selection ? JSON.stringify(selection) : ''}\n`)
    if (selection)
      await appendFile(
        env.GITHUB_STEP_SUMMARY,
        `Release ${selection.tag}; source ${selection.sourceRevision}; draft ${selection.releaseId}.\n`
      )
    return
  }
  selection = validateSelection(JSON.parse(env.MYTRACER_RELEASE_SELECTION))
  const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  check(sourceRevision === selection.sourceRevision, 'checkout-source')
  if (mode === 'bundle') return bundleAssets({ selection, sourceRevision })
  check(mode === 'publish', 'command')
  const release = await publishRelease({
    api: new GithubApi(env.GH_TOKEN, true),
    selection,
    directory: '.tmp/release-pr'
  })
  await appendFile(env.GITHUB_STEP_SUMMARY, `Published ${selection.tag}: ${release.html_url}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const mode = process.argv[2]
  run(mode).catch((error) => {
    const stage = ['select', 'bundle', 'publish'].includes(mode) ? mode : 'command'
    process.stderr.write(
      `Release ${stage} failed: ${safeErrorCode(error)}. Inspect the release state before retrying.\n`
    )
    process.exitCode = 1
  })
}
