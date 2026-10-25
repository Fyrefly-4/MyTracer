import { UpdatePortError } from '../../application/ports/update'

export interface ReleaseInfo {
  readonly version: string
  readonly releaseNotes: string
  readonly file: { readonly name: string; readonly sha512: string }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function validatePublicRelease(value: unknown): ReleaseInfo {
  if (
    !isRecord(value) ||
    typeof value.version !== 'string' ||
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value.version) ||
    !Array.isArray(value.files)
  ) {
    throw new UpdatePortError('invalid-metadata')
  }
  const expectedName = `MyTracer-${value.version}-x64-setup.exe`
  // GitHubProvider returns { tag, ...latestYml }, not the private API assets array.
  // Exactly one full installer prevents the provider selecting a different executable.
  if (value.tag !== `v${value.version}` || value.files.length !== 1 || value.packages != null) {
    throw new UpdatePortError('invalid-metadata')
  }
  const file: unknown = value.files[0]
  if (!isRecord(file) || file.url !== expectedName) {
    throw new UpdatePortError('invalid-metadata')
  }
  if (
    (value.path != null && value.path !== expectedName) ||
    (value.sha512 != null && value.sha512 !== file.sha512)
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
