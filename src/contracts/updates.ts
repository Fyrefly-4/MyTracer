export type UpdateFailureCode =
  | 'not-configured'
  | 'unavailable'
  | 'authentication'
  | 'network'
  | 'timeout'
  | 'cancelled'
  | 'invalid-metadata'
  | 'integrity'
  | 'unsupported-version'
  | 'internal'

export const UPDATE_CHANNELS = Object.freeze({
  status: 'updates:status',
  check: 'updates:check',
  download: 'updates:download',
  cancel: 'updates:cancel',
  changed: 'updates:changed'
} as const)

export type UpdateState =
  'idle' | 'checking' | 'upToDate' | 'available' | 'downloading' | 'downloaded' | 'error'

export interface UpdateStatusDto {
  readonly state: UpdateState
  readonly currentVersion: string
  readonly operationId?: string
  readonly candidate?: {
    readonly version: string
    readonly releaseNotes: string
  }
  readonly progressPercent?: number
  readonly error?: {
    readonly code: UpdateFailureCode
    readonly retryable: boolean
    readonly retryAction: 'check' | 'download'
  }
}

export interface DownloadUpdateInputDto {
  readonly operationId: string
  readonly version: string
}

export interface CancelUpdateInputDto {
  readonly operationId: string
}

export interface UpdateApi {
  readonly getStatus: () => Promise<UpdateStatusDto>
  readonly check: () => Promise<UpdateStatusDto>
  readonly download: (input: DownloadUpdateInputDto) => Promise<UpdateStatusDto>
  readonly cancel: (input: CancelUpdateInputDto) => Promise<UpdateStatusDto>
  readonly subscribe: (listener: (status: UpdateStatusDto) => void) => () => void
}
