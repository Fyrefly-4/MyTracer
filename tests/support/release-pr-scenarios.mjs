import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  bundleAssets,
  publishRelease,
  ReleaseError,
  safeErrorCode,
  recoverySelection,
  selectRelease,
  validateAssets,
  validateSelection
} from '../../tools/release/release-pr.mjs'
import { GithubApi } from '../../tools/release/github-api.mjs'

const repository = 'Fyrefly-4/MyTracer'
const sha = 'a'.repeat(40)
const otherSha = 'b'.repeat(40)
const selection = {
  releaseId: 10,
  sourceRevision: sha,
  tag: 'v0.1.5',
  version: '0.1.5'
}

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'mytracer-release-pr-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const setup = 'MyTracer-0.1.5-x64-setup.exe'
  const setupBytes = Buffer.from('synthetic installer, not executable')
  const hash = createHash('sha512').update(setupBytes).digest('base64')
  await writeFile(join(directory, setup), setupBytes)
  await writeFile(join(directory, `${setup}.blockmap`), 'synthetic blockmap')
  await writeFile(
    join(directory, 'latest.yml'),
    [
      'version: 0.1.5',
      'files:',
      `  - url: ${setup}`,
      `    sha512: ${hash}`,
      `    size: ${setupBytes.length}`,
      `path: ${setup}`,
      `sha512: ${hash}`,
      "releaseDate: '2026-10-21T00:00:00.000Z'",
      ''
    ].join('\n')
  )
  const calls = []
  const state = {
    repository: { full_name: repository, id: 1326905280, private: true },
    release: {
      id: 10,
      tag_name: selection.tag,
      target_commitish: sha,
      draft: true,
      prerelease: false,
      html_url: `https://github.com/${repository}/releases/tag/${selection.tag}`
    },
    prs: [
      {
        merged_at: '2026-10-21T00:00:00Z',
        merge_commit_sha: sha,
        base: { ref: 'main', repo: { full_name: repository } },
        head: {
          ref: 'release-please--branches--main--components--mytracer',
          repo: { full_name: repository }
        },
        labels: [{ name: 'autorelease: tagged' }]
      }
    ],
    releases: [],
    remote: [],
    bytes: new Map(),
    tagSha: sha,
    main: true,
    failVerify: false,
    failUpload: false,
    nextId: 100
  }
  state.releases = [state.release]
  const api = {
    async get(path) {
      calls.push(`get:${path}`)
      if (path === '') return state.repository
      if (path === '/releases/10') return state.release
      if (path === '/releases/10/assets?per_page=100') return [...state.remote]
      if (path === `/commits/${sha}/pulls?per_page=100`) return state.prs
      if (path === `/commits/${otherSha}/pulls?per_page=100`) return []
      throw Error(`Unexpected fixture read: ${path}`)
    },
    async allReleases() {
      calls.push('releases')
      return state.releases
    },
    async resolveTag(tag) {
      assert.equal(tag, selection.tag)
      calls.push('tag')
      return { sourceRevision: state.tagSha }
    },
    async assertMainSource(source) {
      assert.equal(source, sha)
      calls.push('main')
      if (!state.main) throw Error('non-main-source')
    },
    async request(path, options = {}) {
      const id = Number(path.split('/').at(-1))
      if (options.method === 'DELETE') {
        calls.push(`delete:${id}`)
        assert.equal(state.release.draft, true)
        state.remote = state.remote.filter((a) => a.id !== id)
        state.bytes.delete(id)
        return null
      }
      assert.equal(options.binary, true)
      calls.push(`download:${id}`)
      assert(state.bytes.has(id))
      return state.bytes.get(id)
    },
    async uploadAsset(id, name, data) {
      assert.equal(id, selection.releaseId)
      assert.equal(state.release.draft, true)
      calls.push(`upload:${name}`)
      if (state.failUpload) throw Error('github-http-503')
      const asset = { id: state.nextId++, name, size: data.length, state: 'uploaded' }
      state.remote.push(asset)
      state.bytes.set(asset.id, Buffer.from(data))
      return asset
    },
    async verifyAssets(id, expected) {
      assert.equal(id, selection.releaseId)
      calls.push('verify')
      if (state.failVerify) throw Error('remote-integrity')
      assert.equal(state.remote.length, expected.length)
      for (const asset of expected) {
        const matches = state.remote.filter((r) => r.name === asset.name)
        assert.equal(matches.length, 1)
        const bytes = state.bytes.get(matches[0].id)
        assert.equal(bytes.length, asset.size)
        assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256)
      }
    },
    async makeVisible(id) {
      assert.equal(id, selection.releaseId)
      calls.push('visible')
      state.release.draft = false
      return state.release
    }
  }
  return {
    directory,
    calls,
    state,
    api,
    async seed(name, data, status = 'uploaded') {
      const id = state.nextId++
      state.remote.push({ id, name, size: data.length, state: status })
      state.bytes.set(id, data)
      return id
    },
    select(options = {}) {
      return selectRelease({
        api,
        eventSha: sha,
        created: 'true',
        releaseId: '10',
        releaseSha: sha,
        tag: 'v0.1.5',
        ...options
      })
    },
    publish() {
      return publishRelease({ api, selection, directory })
    }
  }
}

function noWrites(f) {
  assert(!f.calls.some((call) => /^(upload:|delete:|visible$)/.test(call)))
}

test('selects the exact Release Please SHA even if main push has advanced', async (t) => {
  const f = await fixture(t)
  assert.deepEqual(await f.select({ eventSha: otherSha }), selection)
  noWrites(f)
})

test('full-run retry recovers only the exact merged release PR draft', async (t) => {
  const f = await fixture(t)
  assert.deepEqual(await f.select({ created: '' }), selection)
  noWrites(f)
})

test('ordinary push cannot publish an older draft', async (t) => {
  const f = await fixture(t)
  assert.equal(await f.select({ created: '', eventSha: otherSha }), null)
  noWrites(f)
})

test('an approved release missing from the API cannot silently skip the build', async (t) => {
  const f = await fixture(t)
  f.state.releases = []
  await assert.rejects(() => f.select({ created: '' }), /approved-release-not-found/)
  noWrites(f)
})

test('manual recovery selects the exact old release independently of the workflow SHA', async (t) => {
  const f = await fixture(t)
  f.state.releases = [] // Direct ID lookup also works when the list omits the draft.
  assert.deepEqual(await f.select({ eventSha: otherSha, recovery: selection }), selection)
  noWrites(f)
})

test('recovery validates identity and refuses newer stable releases before building', async (t) => {
  const f = await fixture(t)
  await assert.rejects(
    () => f.select({ recovery: { ...selection, tag: 'v0.1.6', version: '0.1.6' } }),
    /release-target/
  )
  f.state.releases.push({ id: 11, tag_name: 'v0.2.0', draft: false, prerelease: false })
  await assert.rejects(() => f.select({ recovery: selection }), /newer-version-exists/)
  noWrites(f)
})

test('dispatch requires main and all exact inputs; push ignores recovery inputs', () => {
  const env = {
    GITHUB_REF: 'refs/heads/main',
    GITHUB_EVENT_NAME: 'workflow_dispatch',
    RECOVERY_RELEASE_ID: '10',
    RECOVERY_TAG: selection.tag,
    RECOVERY_SOURCE_SHA: sha
  }
  assert.deepEqual(recoverySelection(env), selection)
  for (const key of ['RECOVERY_RELEASE_ID', 'RECOVERY_TAG', 'RECOVERY_SOURCE_SHA']) {
    assert.throws(() => recoverySelection({ ...env, [key]: '' }))
  }
  assert.throws(() => recoverySelection({ ...env, GITHUB_REF: 'refs/heads/feature' }))
  assert.throws(() => recoverySelection({ ...env, GITHUB_EVENT_NAME: 'pull_request' }))
  assert.equal(recoverySelection({ ...env, GITHUB_EVENT_NAME: 'push' }), undefined)
})

test('retry of a published version is a read-only no-op', async (t) => {
  const f = await fixture(t)
  f.state.release.draft = false
  assert.equal(await f.select({ created: '' }), null)
  noWrites(f)
})

test('rejects ambiguous release recovery rather than selecting arbitrarily', async (t) => {
  const f = await fixture(t)
  f.state.releases.push({ ...f.state.release, id: 11, tag_name: 'v0.1.6' })
  await assert.rejects(() => f.select({ created: '' }), /ambiguous-release/)
  noWrites(f)
})

for (const [name, mutate, code] of [
  ['moved tag', (f) => (f.state.tagSha = otherSha), 'tag-source'],
  ['wrong draft source', (f) => (f.state.release.target_commitish = otherSha), 'release-source'],
  ['wrong draft tag', (f) => (f.state.release.tag_name = 'v0.1.6'), 'release-target'],
  ['prerelease', (f) => (f.state.release.prerelease = true), 'release-target'],
  ['non-main source', (f) => (f.state.main = false), 'non-main-source'],
  ['missing visibility', (f) => delete f.state.repository.private, 'repository-target'],
  ['null visibility', (f) => (f.state.repository.private = null), 'repository-target'],
  ['string visibility', (f) => (f.state.repository.private = 'false'), 'repository-target'],
  ['numeric visibility', (f) => (f.state.repository.private = 0), 'repository-target'],
  [
    'wrong repository name',
    (f) => (f.state.repository.full_name = 'other/repo'),
    'repository-target'
  ],
  ['wrong repository ID', (f) => (f.state.repository.id = 1), 'repository-target'],
  ['missing release PR', (f) => (f.state.prs = []), 'merged-release-pr-required'],
  ['unmerged release PR', (f) => (f.state.prs[0].merged_at = null), 'merged-release-pr-required'],
  [
    'ordinary code PR',
    (f) => (f.state.prs[0].head.ref = 'codex/feature'),
    'merged-release-pr-required'
  ],
  [
    'forked release PR',
    (f) => (f.state.prs[0].head.repo.full_name = 'other/MyTracer'),
    'merged-release-pr-required'
  ],
  ['unlabelled release PR', (f) => (f.state.prs[0].labels = []), 'merged-release-pr-required'],
  [
    'release PR from another SHA',
    (f) => (f.state.prs[0].merge_commit_sha = otherSha),
    'merged-release-pr-required'
  ]
]) {
  test(`selection rejects ${name} without writes`, async (t) => {
    const f = await fixture(t)
    mutate(f)
    await assert.rejects(f.select, new RegExp(code))
    noWrites(f)
  })
}

test('validates the three assets and exact updater metadata', async (t) => {
  const f = await fixture(t)
  assert.equal((await validateAssets(f.directory, selection)).length, 3)
  await writeFile(join(f.directory, 'extra.json'), '{}')
  await assert.rejects(() => validateAssets(f.directory, selection), /asset-set/)
})

test('bundle binds package and lock versions to the selected checkout', async (t) => {
  const f = await fixture(t)
  const root = await mkdtemp(join(tmpdir(), 'mytracer-release-bundle-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(join(root, 'release'))
  for (const name of [
    'MyTracer-0.1.5-x64-setup.exe',
    'MyTracer-0.1.5-x64-setup.exe.blockmap',
    'latest.yml'
  ]) {
    await copyFile(join(f.directory, name), join(root, 'release', name))
  }
  await writeFile(join(root, 'package.json'), JSON.stringify({ version: '0.1.5' }))
  const lock = { version: '0.1.5', packages: { '': { version: '0.1.5' } } }
  await writeFile(join(root, 'package-lock.json'), JSON.stringify(lock))
  const previous = process.cwd()
  try {
    process.chdir(root)
    await assert.rejects(
      () => bundleAssets({ selection, sourceRevision: otherSha }),
      /checkout-source/
    )
    lock.packages[''].version = '0.1.4'
    await writeFile('package-lock.json', JSON.stringify(lock))
    await assert.rejects(() => bundleAssets({ selection, sourceRevision: sha }), /package-version/)
    lock.packages[''].version = '0.1.5'
    await writeFile('package-lock.json', JSON.stringify(lock))
    await bundleAssets({ selection, sourceRevision: sha })
    assert.equal((await validateAssets('.tmp/release-pr', selection)).length, 3)
    await assert.rejects(() => bundleAssets({ selection, sourceRevision: sha }), /bundle-not-empty/)
  } finally {
    process.chdir(previous)
  }
})

test('metadata with wrong checksum cannot cause any publication write', async (t) => {
  const f = await fixture(t)
  const file = join(f.directory, 'latest.yml')
  const data = await readFile(file, 'utf8')
  await writeFile(file, data.replaceAll(/sha512: .*/g, `sha512: ${'A'.repeat(86)}==`))
  await assert.rejects(f.publish, /updater-metadata/)
  noWrites(f)
})

test('uploads all three assets and verifies bytes before visibility', async (t) => {
  const f = await fixture(t)
  await f.publish()
  assert.equal(f.calls.filter((c) => c.startsWith('upload:')).length, 3)
  assert(f.calls.indexOf('verify') > f.calls.findLastIndex((c) => c.startsWith('upload:')))
  assert(f.calls.indexOf('visible') > f.calls.indexOf('verify'))
  assert.equal(f.calls.at(-1), 'visible')
  assert.equal(f.state.release.draft, false)
})

test('matching assets are reused on retry, not reuploaded', async (t) => {
  const f = await fixture(t)
  for (const name of ['MyTracer-0.1.5-x64-setup.exe', 'latest.yml']) {
    await f.seed(name, await readFile(join(f.directory, name)))
  }
  await f.publish()
  assert.deepEqual(
    f.calls.filter((c) => c.startsWith('upload:')),
    ['upload:MyTracer-0.1.5-x64-setup.exe.blockmap']
  )
  assert(!f.calls.some((c) => c.startsWith('delete:')))
})

test('changed rebuilt bytes are replaced only inside the same draft', async (t) => {
  const f = await fixture(t)
  const id = await f.seed('MyTracer-0.1.5-x64-setup.exe', Buffer.from('old failed build'))
  await f.publish()
  assert(f.calls.includes(`delete:${id}`))
  assert(f.calls.indexOf(`delete:${id}`) < f.calls.indexOf('upload:MyTracer-0.1.5-x64-setup.exe'))
})

test('a partial failed upload can be replaced on retry', async (t) => {
  const f = await fixture(t)
  const id = await f.seed('latest.yml', Buffer.alloc(0), 'starter')
  await f.publish()
  assert(f.calls.includes(`delete:${id}`))
  assert(!f.calls.includes(`download:${id}`))
})

for (const [name, mutate, code] of [
  [
    'newer stable release',
    (f) => f.state.releases.push({ id: 12, tag_name: 'v0.2.0', draft: false, prerelease: false }),
    'newer-version-exists'
  ],
  [
    'duplicate version',
    (f) => f.state.releases.push({ id: 12, tag_name: 'v0.1.5', draft: false, prerelease: false }),
    'newer-version-exists'
  ],
  [
    'unexpected remote asset',
    (f) => f.state.remote.push({ id: 12, name: 'secret.txt', size: 5, state: 'uploaded' }),
    'unexpected-remote-assets'
  ]
]) {
  test(`publication refuses ${name} before any write`, async (t) => {
    const f = await fixture(t)
    mutate(f)
    await assert.rejects(f.publish, new RegExp(code))
    noWrites(f)
  })
}

test('upload failure leaves the draft hidden', async (t) => {
  const f = await fixture(t)
  f.state.failUpload = true
  await assert.rejects(f.publish, /github-http-503/)
  assert(!f.calls.includes('visible'))
  assert.equal(f.state.release.draft, true)
})

test('readback failure leaves the draft hidden', async (t) => {
  const f = await fixture(t)
  f.state.failVerify = true
  await assert.rejects(f.publish, /remote-integrity/)
  assert(!f.calls.includes('visible'))
  assert.equal(f.state.release.draft, true)
})

test('newer release appearing after upload prevents publishing stale latest', async (t) => {
  const f = await fixture(t)
  const verify = f.api.verifyAssets
  f.api.verifyAssets = async (...args) => {
    await verify(...args)
    f.state.releases.push({ id: 12, tag_name: 'v0.2.0', draft: false, prerelease: false })
  }
  await assert.rejects(f.publish, /newer-version-exists/)
  assert(!f.calls.includes('visible'))
})

test('tag movement after upload prevents visibility', async (t) => {
  const f = await fixture(t)
  const verify = f.api.verifyAssets
  f.api.verifyAssets = async (...args) => {
    await verify(...args)
    f.state.tagSha = otherSha
  }
  await assert.rejects(f.publish, /tag-source/)
  assert(!f.calls.includes('visible'))
})

test('stable versions and SHA are validated before use', () => {
  for (const version of ['0.1.5-beta.1', '01.1.5', '1.2', '1.2.3\nmalicious']) {
    assert.throws(() => validateSelection({ ...selection, version, tag: `v${version}` }))
  }
  assert.throws(() => validateSelection({ ...selection, releaseId: 0 }))
  assert.throws(() => validateSelection({ ...selection, sourceRevision: 'main' }))
})

test('diagnostics retain controlled codes and suppress secrets from unknown exceptions', () => {
  assert.equal(safeErrorCode(new ReleaseError('tag-source')), 'tag-source')
  assert.equal(safeErrorCode(new Error('github-http-403')), 'github-http-403')
  assert.equal(safeErrorCode(new Error('remote-integrity')), 'remote-integrity')
  for (const error of [
    new Error('Bearer synthetic-secret https://signed.invalid/?token=secret'),
    new Error('github-http-403\nBearer synthetic-secret'),
    { message: 'synthetic-secret' },
    'synthetic-secret'
  ]) {
    assert.equal(safeErrorCode(error), 'unexpected-error')
  }
})

test('GitHub DELETE accepts 204 without trying to parse JSON', async () => {
  const calls = []
  const api = new GithubApi('synthetic-token', true, async (url, options) => {
    calls.push({ url, options })
    return new Response(null, { status: 204 })
  })
  assert.equal(
    await api.request('/repos/Fyrefly-4/MyTracer/releases/assets/100', { method: 'DELETE' }),
    null
  )
  assert.equal(calls.length, 1)
  assert.equal(calls[0].options.method, 'DELETE')
})

test('read-only GitHub transport refuses DELETE before network access', async () => {
  const api = new GithubApi('synthetic-token', false, async () => {
    assert.fail('Network must not be called')
  })
  await assert.rejects(
    () => api.request('/repos/Fyrefly-4/MyTracer/releases/assets/100', { method: 'DELETE' }),
    /read-only-transport/
  )
})

async function artifactFixture(t, names, attempt = '3') {
  const root = await mkdtemp(join(tmpdir(), 'mytracer-run-assets-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const downloads = join(root, '.tmp', 'release-download')
  await mkdir(downloads, { recursive: true })
  for (const name of names) {
    await mkdir(join(downloads, name))
    await writeFile(join(downloads, name, 'marker'), name)
  }
  const script = fileURLToPath(
    new URL('../../tools/release/select-run-assets.mjs', import.meta.url)
  )
  return {
    root,
    downloads,
    run() {
      return spawnSync(process.execPath, [script], {
        cwd: root,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 10000,
        env: {
          ...process.env,
          GITHUB_RUN_ID: '123',
          GITHUB_RUN_ATTEMPT: attempt,
          MYTRACER_RELEASE_SELECTION: JSON.stringify(selection)
        }
      })
    }
  }
}

test('artifact selection uses same run/SHA and highest eligible attempt', async (t) => {
  const expected = `release-assets-${sha}-123-3`
  const f = await artifactFixture(t, [
    `release-assets-${sha}-123-1`,
    expected,
    `release-assets-${sha}-123-2`,
    `release-assets-${sha}-123-4`,
    `release-assets-${sha}-456-3`,
    `release-assets-${otherSha}-123-3`
  ])
  const result = f.run()
  assert.equal(result.status, 0, result.stderr)
  assert.equal(await readFile(join(f.root, '.tmp', 'release-pr', 'marker'), 'utf8'), expected)
})

test('publish-only retry reuses the older successful build artifact', async (t) => {
  const expected = `release-assets-${sha}-123-1`
  const f = await artifactFixture(t, [expected], '4')
  const result = f.run()
  assert.equal(result.status, 0, result.stderr)
  assert.equal(await readFile(join(f.root, '.tmp', 'release-pr', 'marker'), 'utf8'), expected)
})

test('artifact selection rejects no matching directories without output', async (t) => {
  const f = await artifactFixture(t, [
    `release-assets-${sha}-456-1`,
    `release-assets-${otherSha}-123-1`,
    `release-assets-${sha}-123-4`,
    `release-assets-${sha}-123-0`,
    `release-assets-${sha}-123-invalid`
  ])
  await writeFile(join(f.downloads, `release-assets-${sha}-123-2`), 'not a directory')
  const result = f.run()
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /missing-build-artifact/)
  await assert.rejects(readFile(join(f.root, '.tmp', 'release-pr', 'marker')), { code: 'ENOENT' })
})

test('published retry verifies identical bytes without republishing historical latest', async (t) => {
  const f = await fixture(t)
  await f.publish()
  f.calls.length = 0
  f.state.releases.push({ id: 12, tag_name: 'v0.2.0', draft: false, prerelease: false })
  assert.equal(await f.publish(), f.state.release)
  assert(f.calls.includes('verify'))
  noWrites(f)
  assert.equal(f.state.release.draft, false)
})

for (const [name, mutate] of [
  ['missing asset', (f) => f.state.remote.pop()],
  [
    'different bytes',
    (f) => {
      const asset = f.state.remote[0]
      const bytes = Buffer.from(f.state.bytes.get(asset.id))
      bytes[0] ^= 1
      f.state.bytes.set(asset.id, bytes)
    }
  ],
  [
    'extra asset',
    (f) => f.state.remote.push({ id: 999, name: 'extra.txt', size: 0, state: 'uploaded' })
  ]
]) {
  test(`published retry rejects ${name} without mutation`, async (t) => {
    const f = await fixture(t)
    await f.publish()
    mutate(f)
    f.calls.length = 0
    await assert.rejects(f.publish)
    assert(f.calls.includes('verify'))
    noWrites(f)
    assert.equal(f.state.release.draft, false)
  })
}

for (const visibility of [true, false]) {
  test(`repository.private=${visibility} preserves selection, publication and retry`, async (t) => {
    const f = await fixture(t)
    f.state.repository.private = visibility
    assert.deepEqual(await f.select(), selection)
    noWrites(f)
    await f.publish()
    assert.equal(f.calls.filter((c) => c.startsWith('upload:')).length, 3)
    assert(f.calls.indexOf('visible') > f.calls.indexOf('verify'))
    assert.equal(f.state.release.draft, false)
    f.calls.length = 0
    await f.publish()
    noWrites(f)
  })
}
for (const invalid of [undefined, null, 'false', 0]) {
  test(`publication rejects malformed visibility ${String(invalid)} before writes`, async (t) => {
    const f = await fixture(t)
    f.state.repository.private = invalid
    await assert.rejects(f.publish, /repository-target/)
    noWrites(f)
  })
}
