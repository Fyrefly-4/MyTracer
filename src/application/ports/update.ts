import type { UpdateFailureCode } from '../../contracts/updates'

export class UpdatePortError extends Error {
  constructor(readonly code: UpdateFailureCode) {
    super(code)
    this.name = 'UpdatePortError'
  }
}

export interface CheckedUpdate {
  readonly version: string
  readonly releaseNotes: string
  download(signal: AbortSignal, onProgress: (percent: number) => void): Promise<DownloadedUpdate>
}

export interface DownloadedUpdate {
  verify(): Promise<boolean>
  startInstall(): boolean
}

export interface UpdatePort {
  check(signal: AbortSignal): Promise<CheckedUpdate>
}
