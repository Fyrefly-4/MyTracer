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
  install: 'updates:install',
  cancelPreparation: 'updates:cancel-preparation',
  draftRequest: 'updates:draft-request',
  draftReply: 'updates:draft-reply',
  changed: 'updates:changed'
} as const)

export type UpdateState =
  | 'idle'
  | 'checking'
  | 'upToDate'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'preparing'
  | 'installing'
  | 'restartRequired'
  | 'error'

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

export interface DraftRequestDto {
  readonly requestId: string
}

export interface DraftReplyDto extends DraftRequestDto {
  readonly hasUnsavedContent: boolean
}

export interface InstallPreparationResultDto {
  readonly status: UpdateStatusDto
  readonly blocker?:
    | 'unsaved-content'
    | 'renderer-unavailable'
    | 'busy'
    | 'cancelled'
    | 'timeout'
    | 'restart-required'
}

export interface UpdateApi {
  readonly getStatus: () => Promise<UpdateStatusDto>
  readonly check: () => Promise<UpdateStatusDto>
  readonly download: (input: DownloadUpdateInputDto) => Promise<UpdateStatusDto>
  readonly cancel: (input: CancelUpdateInputDto) => Promise<UpdateStatusDto>
  readonly install: (input: DownloadUpdateInputDto) => Promise<InstallPreparationResultDto>
  readonly cancelPreparation: (input: CancelUpdateInputDto) => Promise<UpdateStatusDto>
  readonly subscribe: (listener: (status: UpdateStatusDto) => void) => () => void
  readonly subscribeDraftRequests: (listener: (request: DraftRequestDto) => void) => () => void
  readonly replyToDraftRequest: (input: DraftReplyDto) => Promise<void>
}
