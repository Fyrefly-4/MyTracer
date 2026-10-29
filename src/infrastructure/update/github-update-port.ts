import { session } from 'electron'
import { CancellationToken } from 'builder-util-runtime'
import electronUpdater, { type NsisUpdater } from 'electron-updater'
import {
  UpdatePortError,
  type CheckedUpdate,
  type DownloadedUpdate,
  type UpdatePort
} from '../../application/ports/update'
import type { UpdateFailureCode } from '../../contracts/updates'
import { validatePublicRelease, type ReleaseInfo } from './release-metadata'
import { isAllowedUpdaterUrl } from './request-policy'
import { verifyDownloadedPackage } from './package-integrity'
import {
  createUpdateDiagnostics,
  type UpdateDiagnostics,
  type UpdateStage
} from './update-diagnostics'

const SOURCE = Object.freeze({ owner: 'Fyrefly-4', repo: 'MyTracer' })

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function mapFailure(error: unknown, signal: AbortSignal): UpdatePortError {
  if (signal.aborted) return new UpdatePortError('cancelled')
  if (error instanceof UpdatePortError) return error
  const details = isRecord(error) ? error : {}
  const status = details.statusCode
  const code = details.code
  const message = typeof details.message === 'string' ? details.message : ''
  let failure: UpdateFailureCode = 'network'
  if (
    status === 401 ||
    status === 403 ||
    (code === 'ERR_UPDATER_LATEST_VERSION_NOT_FOUND' && /\b(?:401|403|404)\b/.test(message))
  )
    failure = 'authentication'
  else if (
    code === 'ERR_UPDATER_NO_CHECKSUM' ||
    code === 'ERR_UPDATER_INVALID_UPDATE_INFO' ||
    code === 'ERR_UPDATER_ASSET_NOT_FOUND' ||
    code === 'ERR_UPDATER_NO_FILES_PROVIDED' ||
    code === 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND'
  ) {
    failure = 'invalid-metadata'
  } else if (code === 'ERR_UPDATER_INVALID_SIGNATURE') {
    failure = 'integrity'
  } else if (code === 'ERR_UPDATER_LATEST_VERSION_NOT_FOUND') {
    failure = 'unavailable'
  }
  return new UpdatePortError(failure)
}

function restrictUpdaterRequests(diagnostics?: UpdateDiagnostics): void {
  const updaterSession = session.fromPartition('electron-updater', { cache: false })
  updaterSession.webRequest.onBeforeRequest((details, callback) => {
    const allowed = isAllowedUpdaterUrl(details.url)
    diagnostics?.request(allowed ? 'request' : 'blocked', details)
    callback({ cancel: !allowed })
  })
  if (diagnostics) {
    updaterSession.webRequest.onHeadersReceived((details, callback) => {
      diagnostics.request('response', details)
      callback({})
    })
    updaterSession.webRequest.onBeforeRedirect((details) =>
      diagnostics.request('redirect', details)
    )
    updaterSession.webRequest.onErrorOccurred((details) =>
      diagnostics.request('request-error', details)
    )
  }
}

export class GithubUpdatePort implements UpdatePort {
  constructor(options: { readonly isPackaged: boolean; readonly diagnostics?: UpdateDiagnostics }) {
    this.isPackaged = options.isPackaged
    this.diagnostics = options.diagnostics ?? createUpdateDiagnostics()
    if (options.isPackaged) restrictUpdaterRequests(this.diagnostics)
  }

  private readonly isPackaged: boolean
  private readonly diagnostics: UpdateDiagnostics | undefined

  async check(signal: AbortSignal): Promise<CheckedUpdate> {
    if (!this.isPackaged) throw new UpdatePortError('unavailable')
    let stage: UpdateStage = 'check-provider'
    this.diagnostics?.phase(stage, 'started')
    try {
      const updater = this.createUpdater()
      const result = await updater.checkForUpdates()
      if (signal.aborted) throw new UpdatePortError('cancelled')
      if (!result) throw new UpdatePortError('unavailable')
      this.diagnostics?.phase(stage, 'succeeded')
      stage = 'check-metadata'
      this.diagnostics?.phase(stage, 'started')
      const info = validatePublicRelease(result.updateInfo)
      this.diagnostics?.phase(stage, 'succeeded')
      return {
        version: info.version,
        releaseNotes: info.releaseNotes,
        download: (downloadSignal, onProgress) => this.download(info, downloadSignal, onProgress)
      }
    } catch (error) {
      this.diagnostics?.phase(stage, 'failed', error)
      throw mapFailure(error, signal)
    }
  }

  private createUpdater(): NsisUpdater {
    // Public-only: never pass a token; private:false also disables GH_TOKEN/GITHUB_TOKEN lookup.
    const updater = new electronUpdater.NsisUpdater({
      provider: 'github',
      owner: SOURCE.owner,
      repo: SOURCE.repo,
      private: false
    })
    updater.logger = null
    updater.autoDownload = false
    updater.autoInstallOnAppQuit = false
    updater.allowPrerelease = false
    updater.allowDowngrade = false
    updater.disableWebInstaller = true
    updater.disableDifferentialDownload = true
    return updater
  }

  private async download(
    expected: ReleaseInfo,
    signal: AbortSignal,
    onProgress: (percent: number) => void
  ): Promise<DownloadedUpdate> {
    let stage: UpdateStage = 'download-recheck'
    this.diagnostics?.phase(stage, 'started')
    const updater = this.createUpdater()
    const cancellation = new CancellationToken()
    const cancel = (): void => cancellation.cancel()
    signal.addEventListener('abort', cancel, { once: true })
    updater.on('download-progress', (progress) => onProgress(progress.percent))
    try {
      if (signal.aborted) throw new UpdatePortError('cancelled')
      const result = await updater.checkForUpdates()
      if (!result) throw new UpdatePortError('unavailable')
      this.diagnostics?.phase(stage, 'succeeded')
      stage = 'download-metadata'
      this.diagnostics?.phase(stage, 'started')
      const actual = validatePublicRelease(result.updateInfo)
      if (
        actual.version !== expected.version ||
        actual.file.name !== expected.file.name ||
        actual.file.sha512 !== expected.file.sha512
      ) {
        throw new UpdatePortError('invalid-metadata')
      }
      if (signal.aborted) throw new UpdatePortError('cancelled')
      this.diagnostics?.phase(stage, 'succeeded')
      stage = 'download-file'
      this.diagnostics?.phase(stage, 'started')
      const paths = await updater.downloadUpdate(cancellation)
      if (signal.aborted) throw new UpdatePortError('cancelled')
      this.diagnostics?.phase(stage, 'succeeded')
      stage = 'download-integrity'
      this.diagnostics?.phase(stage, 'started')
      if (paths.length !== 1 || !(await verifyDownloadedPackage(paths[0], expected.file.sha512))) {
        throw new UpdatePortError('integrity')
      }
      this.diagnostics?.phase(stage, 'succeeded')
      const installerPath = paths[0]
      return {
        verify: async () => {
          this.diagnostics?.phase('install-integrity', 'started')
          try {
            const valid = await verifyDownloadedPackage(installerPath, expected.file.sha512)
            this.diagnostics?.phase('install-integrity', valid ? 'succeeded' : 'failed')
            return valid
          } catch (error) {
            this.diagnostics?.phase('install-integrity', 'failed', error)
            throw error
          }
        },
        startInstall: () => {
          this.diagnostics?.phase('install-start', 'started')
          try {
            const result = updater.install(false, true)
            this.diagnostics?.phase('install-start', result ? 'succeeded' : 'failed')
            return result
          } catch (error) {
            this.diagnostics?.phase('install-start', 'failed', error)
            throw error
          }
        }
      }
    } catch (error) {
      this.diagnostics?.phase(stage, 'failed', error)
      throw mapFailure(error, signal)
    } finally {
      signal.removeEventListener('abort', cancel)
      updater.removeAllListeners('download-progress')
    }
  }
}
