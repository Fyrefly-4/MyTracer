const API_RELEASES_PATH = '/repos/Fyrefly-4/MyTracer/releases'
const WEB_RELEASES_PATH = '/Fyrefly-4/MyTracer/releases/'
const ASSET_HOSTS = new Set([
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com',
  'github-releases.githubusercontent.com'
])

export function isAllowedUpdaterUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.username || url.password) return false
    if (url.hostname === 'api.github.com') {
      return (
        url.pathname === `${API_RELEASES_PATH}/latest` ||
        new RegExp(`^${API_RELEASES_PATH}/assets/[0-9]+$`).test(url.pathname)
      )
    }
    if (url.hostname === 'github.com') return url.pathname.startsWith(WEB_RELEASES_PATH)
    return ASSET_HOSTS.has(url.hostname)
  } catch {
    return false
  }
}
