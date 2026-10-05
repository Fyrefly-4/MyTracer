import { createHash } from 'node:crypto'
import { REPOSITORY, requireCondition } from './provenance.mjs'

const PREFIX = `/repos/${REPOSITORY}`
const MAX_BYTES = 256 * 1024 * 1024

async function bytes(response) {
  const parts = []
  let size = 0
  for await (const part of response.body) {
    size += part.length
    requireCondition(size <= MAX_BYTES, 'response-too-large')
    parts.push(part)
  }
  return Buffer.concat(parts)
}

export class GithubApi {
  constructor(token, writable = false, fetcher = fetch) {
    requireCondition(typeof token === 'string' && token.length > 0, 'missing-ci-credential')
    this.token = token
    this.writable = writable
    this.fetcher = fetcher
  }

  async request(
    path,
    { method = 'GET', body, binary = false, missing = false, upload = false } = {}
  ) {
    requireCondition(path.startsWith(`${PREFIX}/`) || path === PREFIX, 'api-target')
    requireCondition(method === 'GET' || this.writable, 'read-only-transport')
    const host = upload ? 'uploads.github.com' : 'api.github.com'
    const response = await this.fetcher(`https://${host}${path}`, {
      method,
      redirect: 'manual',
      signal: AbortSignal.timeout(120_000),
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: binary ? 'application/octet-stream' : 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': upload ? 'application/octet-stream' : 'application/json'
      },
      body: body === undefined ? undefined : upload ? body : JSON.stringify(body)
    })
    if (missing && response.status === 404) return null
    if (binary && response.status === 302) {
      const url = new URL(response.headers.get('location'))
      requireCondition(
        url.protocol === 'https:' &&
          !url.username &&
          !url.password &&
          (url.hostname.endsWith('.blob.core.windows.net') ||
            [
              'objects.githubusercontent.com',
              'release-assets.githubusercontent.com',
              'github-releases.githubusercontent.com'
            ].includes(url.hostname)),
        'download-redirect'
      )
      // Signed redirect is consumed without forwarding the API credential.
      const download = await this.fetcher(url.href, {
        redirect: 'error',
        signal: AbortSignal.timeout(120_000)
      })
      requireCondition(download.ok, 'download-failed')
      return bytes(download)
    }
    requireCondition(response.ok, `github-http-${response.status}`)
    const result = await bytes(response)
    return binary ? result : JSON.parse(result.toString('utf8'))
  }

  async get(path) {
    return this.request(`${PREFIX}${path}`)
  }

  async allReleases() {
    const releases = []
    for (let page = 1; page <= 10; page++) {
      const batch = await this.get(`/releases?per_page=100&page=${page}`)
      requireCondition(Array.isArray(batch), 'release-list')
      releases.push(...batch)
      if (batch.length < 100) return releases
    }
    throw new Error('release-list-limit')
  }

  async assertVersionAbsent(tag) {
    const release = await this.request(`${PREFIX}/releases/tags/${encodeURIComponent(tag)}`, {
      missing: true
    })
    const reference = await this.request(`${PREFIX}/git/ref/tags/${encodeURIComponent(tag)}`, {
      missing: true
    })
    requireCondition(release === null && reference === null, 'existing-version')
  }

  async createDraft(input) {
    return this.request(`${PREFIX}/releases`, { method: 'POST', body: input })
  }

  async uploadAsset(id, name, data) {
    return this.request(`${PREFIX}/releases/${id}/assets?name=${encodeURIComponent(name)}`, {
      method: 'POST',
      body: data,
      upload: true
    })
  }

  async verifyAssets(id, expected) {
    const remote = await this.get(`/releases/${id}/assets?per_page=100`)
    requireCondition(Array.isArray(remote) && remote.length === expected.length, 'remote-asset-set')
    for (const asset of expected) {
      const matches = remote.filter((a) => a.name === asset.name)
      requireCondition(matches.length === 1 && matches[0].state === 'uploaded', 'remote-asset')
      const data = await this.request(`${PREFIX}/releases/assets/${matches[0].id}`, {
        binary: true
      })
      requireCondition(
        matches[0].size === asset.size &&
          data.length === asset.size &&
          createHash('sha256').update(data).digest('hex') === asset.sha256,
        'remote-integrity'
      )
    }
  }

  async makeVisible(id) {
    await this.request(`${PREFIX}/releases/${id}`, {
      method: 'PATCH',
      body: { draft: false, prerelease: false, make_latest: 'true' }
    })
    return this.get(`/releases/${id}`)
  }
}
