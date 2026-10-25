const RELEASES_PATH = '/Fyrefly-4/MyTracer/releases'
const STABLE_VERSION = '(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)'
const ASSET_HOSTS = new Set([
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com',
  'github-releases.githubusercontent.com'
])

export function isAllowedUpdaterUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash)
      return false
    if (url.hostname === 'github.com') {
      if (url.search) return false
      if (url.pathname === `${RELEASES_PATH}.atom` || url.pathname === `${RELEASES_PATH}/latest`)
        return true
      const match = new RegExp(`^${RELEASES_PATH}/download/v(${STABLE_VERSION})/([^/]+)$`).exec(
        url.pathname
      )
      if (!match) return false
      return match[2] === 'latest.yml' || match[2] === `MyTracer-${match[1]}-x64-setup.exe`
    }
    // Preserve GitHub's existing signed CDN redirect boundary; no arbitrary remote hosts.
    return ASSET_HOSTS.has(url.hostname)
  } catch {
    return false
  }
}
