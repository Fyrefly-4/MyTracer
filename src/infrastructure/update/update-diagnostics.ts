import { appendFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export type UpdateStage =
  | 'check-provider'
  | 'check-metadata'
  | 'download-recheck'
  | 'download-metadata'
  | 'download-file'
  | 'download-integrity'
  | 'install-integrity'
  | 'install-start'

const knownCodes = new Set([
  'cancelled',
  'unavailable',
  'invalid-metadata',
  'integrity',
  'ERR_UPDATER_INVALID_RELEASE_FEED',
  'ERR_UPDATER_LATEST_VERSION_NOT_FOUND',
  'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND',
  'ERR_UPDATER_NO_PUBLISHED_VERSIONS',
  'ERR_UPDATER_INVALID_UPDATE_INFO',
  'ERR_UPDATER_NO_CHECKSUM',
  'ERR_UPDATER_NO_FILES_PROVIDED',
  'ERR_UPDATER_ASSET_NOT_FOUND',
  'ERR_UPDATER_INVALID_SIGNATURE',
  'ERR_UPDATER_INVALID_VERSION',
  'ERR_UPDATER_INVALID_CHANNEL',
  'ERR_UPDATER_INVALID_PROVIDER_CONFIGURATION',
  'ERR_UPDATER_UNSUPPORTED_PROVIDER',
  'ERR_UPDATER_WEB_INSTALLER_DISABLED',
  'ERR_ABORTED',
  'ERR_BLOCKED_BY_CLIENT',
  'ERR_FAILED',
  'ERR_NAME_NOT_RESOLVED',
  'ERR_INTERNET_DISCONNECTED',
  'ERR_CONNECTION_REFUSED',
  'ERR_CONNECTION_RESET',
  'ERR_CONNECTION_CLOSED',
  'ERR_CONNECTION_TIMED_OUT',
  'ERR_TIMED_OUT',
  'ERR_PROXY_CONNECTION_FAILED',
  'ERR_TUNNEL_CONNECTION_FAILED',
  'ERR_NO_SUPPORTED_PROXIES',
  'ERR_PROXY_AUTH_REQUESTED',
  'ERR_CERT_AUTHORITY_INVALID',
  'ERR_CERT_COMMON_NAME_INVALID',
  'ERR_CERT_DATE_INVALID',
  'ERR_SSL_PROTOCOL_ERROR',
  'ERR_TOO_MANY_REDIRECTS',
  'ERR_INVALID_RESPONSE',
  'ERR_HTTP_RESPONSE_CODE_FAILURE',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EACCES',
  'ENOENT',
  'ENOSPC'
])

const assetHosts = new Set([
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com',
  'github-releases.githubusercontent.com'
])
const version = '(?:0|[1-9]\\d{0,8})\\.(?:0|[1-9]\\d{0,8})\\.(?:0|[1-9]\\d{0,8})'
const releasePath = new RegExp(
  `^/Fyrefly-4/MyTracer/releases(?:\\.atom|/latest|/tag/v${version}|/download/v${version}/(?:latest\\.yml|MyTracer-${version}-x64-setup\\.exe))$`
)

// Arbitrary path segments can themselves be credentials. Only known public paths survive.
export function describeUpdateUrl(raw: string): Record<string, unknown> {
  try {
    const url = new URL(raw)
    const github = url.hostname === 'github.com'
    const cdn = assetHosts.has(url.hostname)
    const path = github && releasePath.test(url.pathname) ? url.pathname : '[redacted]'
    const requestStage = cdn
      ? 'asset-cdn'
      : path.endsWith('.atom')
        ? 'release-feed'
        : path.endsWith('/latest')
          ? 'latest-release'
          : path.endsWith('/latest.yml')
            ? 'channel-metadata'
            : path.endsWith('.exe')
              ? 'installer'
              : 'other'
    return {
      host: github || cdn ? url.hostname : '[other-host]',
      path,
      requestStage,
      https: url.protocol === 'https:',
      hasQuery: Boolean(url.search),
      hasFragment: Boolean(url.hash),
      hasCredentials: Boolean(url.username || url.password),
      hasPort: Boolean(url.port)
    }
  } catch {
    return { host: '[invalid-url]', path: '[redacted]', requestStage: 'other' }
  }
}

function httpStatus(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 599
    ? value
    : null
}

export function describeUpdateError(error: unknown): Record<string, unknown> {
  const details = typeof error === 'object' && error !== null ? error : {}
  const code = 'code' in details ? details.code : undefined
  const message = 'message' in details && typeof details.message === 'string' ? details.message : ''
  // Extract only recognized network symbols from wrapper text; never emit message/stack/body.
  const networkCodes = [...new Set(message.slice(0, 64_000).match(/net::(ERR_[A-Z_]+)/g) ?? [])]
    .map((value) => value.slice(5))
    .filter((value) => knownCodes.has(value))
  return {
    code: typeof code === 'string' && knownCodes.has(code) ? code : '[unclassified]',
    httpStatus: httpStatus('statusCode' in details ? details.statusCode : undefined),
    networkCodes: networkCodes.slice(0, 16)
  }
}

export class UpdateDiagnostics {
  private count = 0

  constructor(private readonly writeLine: (line: string) => void) {}

  private record(fields: Record<string, unknown>): void {
    try {
      // Bounded to 1,000 short records per process. A broken sink must never affect updating.
      if (this.count++ >= 1000) return
      this.writeLine(JSON.stringify({ time: new Date().toISOString(), ...fields }) + '\n')
    } catch {
      // Best effort only, with no fallback that might print an unsafe filesystem error.
    }
  }

  phase(stage: UpdateStage, result: 'started' | 'succeeded' | 'failed', error?: unknown): void {
    this.record({
      event: 'phase',
      stage,
      result,
      ...(result === 'failed' ? describeUpdateError(error) : {})
    })
  }

  request(
    event: 'request' | 'blocked' | 'response' | 'redirect' | 'request-error',
    details: { id: number; url: string; statusCode?: number; error?: string; redirectURL?: string }
  ): void {
    this.record({
      event,
      requestId: details.id,
      ...describeUpdateUrl(details.url),
      httpStatus: httpStatus(details.statusCode),
      ...(details.error ? describeUpdateError({ message: details.error }) : {}),
      ...(details.redirectURL ? { redirect: describeUpdateUrl(details.redirectURL) } : {})
    })
  }
}

export function createUpdateDiagnostics(): UpdateDiagnostics | undefined {
  if (process.env.MYTRACER_UPDATE_DIAGNOSTICS !== '1') return undefined
  const file = join(tmpdir(), `mytracer-update-diagnostics-${process.pid}-${randomUUID()}.jsonl`)
  let created = false
  return new UpdateDiagnostics((line) => {
    if (!created) {
      writeFileSync(file, line, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
      created = true
    } else {
      appendFileSync(file, line, 'utf8')
    }
  })
}
