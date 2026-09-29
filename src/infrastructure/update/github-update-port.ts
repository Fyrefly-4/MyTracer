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
import { validatePrivateRelease, type ReleaseInfo } from './release-metadata'
import { isAllowedUpdaterUrl } from './request-policy'
import { verifyDownloadedPackage } from './package-integrity'

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

function restrictUpdaterRequests(): void {
  const updaterSession = session.fromPartition('electron-updater', { cache: false })
  updaterSession.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: !isAllowedUpdaterUrl(details.url) })
  })
}

export class GithubUpdatePort implements UpdatePort {
  private readonly token: string | null

  constructor(options: { readonly token: string | undefined; readonly isPackaged: boolean }) {
    this.token = options.token?.trim() || null
    this.isPackaged = options.isPackaged
    if (options.isPackaged) restrictUpdaterRequests()
  }

  private readonly isPackaged: boolean

  async check(signal: AbortSignal): Promise<CheckedUpdate> {
    if (!this.isPackaged) throw new UpdatePortError('unavailable')
    if (!this.token) throw new UpdatePortError('not-configured')
    try {
      const updater = this.createUpdater()
      const result = await updater.checkForUpdates()
      if (signal.aborted) throw new UpdatePortError('cancelled')
      if (!result) throw new UpdatePortError('unavailable')
      const info = validatePrivateRelease(result.updateInfo)
      return {
        version: info.version,
        releaseNotes: info.releaseNotes,
        download: (downloadSignal, onProgress) => this.download(info, downloadSignal, onProgress)
      }
    } catch (error) {
      throw mapFailure(error, signal)
    }
  }

  private createUpdater(): NsisUpdater {
    // Passing the dedicated token through runtime options avoids using GH_TOKEN or writing it to app-update.yml.
    const updater = new electronUpdater.NsisUpdater({
      provider: 'github',
      owner: SOURCE.owner,
      repo: SOURCE.repo,
      token: this.token!,
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
    const updater = this.createUpdater()
    const cancellation = new CancellationToken()
    const cancel = (): void => cancellation.cancel()
    signal.addEventListener('abort', cancel, { once: true })
    updater.on('download-progress', (progress) => onProgress(progress.percent))
    try {
      if (signal.aborted) throw new UpdatePortError('cancelled')
      const result = await updater.checkForUpdates()
      if (!result) throw new UpdatePortError('unavailable')
      const actual = validatePrivateRelease(result.updateInfo)
      if (
        actual.version !== expected.version ||
        actual.file.name !== expected.file.name ||
        actual.file.sha512 !== expected.file.sha512
      ) {
        throw new UpdatePortError('invalid-metadata')
      }
      if (signal.aborted) throw new UpdatePortError('cancelled')
      const paths = await updater.downloadUpdate(cancellation)
      if (signal.aborted) throw new UpdatePortError('cancelled')
      if (paths.length !== 1 || !(await verifyDownloadedPackage(paths[0], expected.file.sha512))) {
        throw new UpdatePortError('integrity')
      }
      const installerPath = paths[0]
      return {
        verify: () => verifyDownloadedPackage(installerPath, expected.file.sha512),
        startInstall: () => updater.install(false, true)
      }
    } catch (error) {
      throw mapFailure(error, signal)
    } finally {
      signal.removeEventListener('abort', cancel)
      updater.removeAllListeners('download-progress')
    }
  }
}
