import { UpdatePortError } from '../../application/ports/update'

const API_ASSET_PREFIX = 'https://api.github.com/repos/Fyrefly-4/MyTracer/releases/assets/'

export interface ReleaseInfo {
  readonly version: string
  readonly releaseNotes: string
  readonly file: { readonly name: string; readonly sha512: string }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function validatePrivateRelease(value: unknown): ReleaseInfo {
  if (
    !isRecord(value) ||
    typeof value.version !== 'string' ||
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value.version) ||
    !Array.isArray(value.files)
  ) {
    throw new UpdatePortError('invalid-metadata')
  }
  const expectedName = `MyTracer-${value.version}-x64-setup.exe`
  const file = value.files.find((entry: unknown) => isRecord(entry) && entry.url === expectedName)
  const assets = value.assets
  if (!isRecord(file) || !Array.isArray(assets)) throw new UpdatePortError('invalid-metadata')
  const asset = assets.find((entry: unknown) => isRecord(entry) && entry.name === expectedName)
  if (!isRecord(asset) || typeof asset.url !== 'string') {
    throw new UpdatePortError('invalid-metadata')
  }
  let url: URL
  try {
    url = new URL(asset.url)
  } catch {
    throw new UpdatePortError('invalid-metadata')
  }
  if (
    !url.href.startsWith(API_ASSET_PREFIX) ||
    !/^\d+$/.test(url.pathname.slice(new URL(API_ASSET_PREFIX).pathname.length)) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new UpdatePortError('invalid-metadata')
  }
  const checksum = file.sha512
  if (
    typeof checksum !== 'string' ||
    !/^[A-Za-z0-9+/]{86}==$/.test(checksum) ||
    Buffer.from(checksum, 'base64').length !== 64
  ) {
    throw new UpdatePortError('invalid-metadata')
  }
  return {
    version: value.version,
    releaseNotes: typeof value.releaseNotes === 'string' ? value.releaseNotes.slice(0, 1200) : '',
    file: { name: expectedName, sha512: checksum }
  }
}
