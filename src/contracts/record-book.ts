/** Read-only projection of saved facts; never a restoration format. */
export interface RecordBookField {
  readonly label: string
  readonly text: string
}
export interface RecordBookEntry {
  readonly id: string
  readonly kind: 'action-record' | 'routine-record' | 'review'
  readonly date: string
  readonly title: string
  readonly fields: readonly RecordBookField[]
}
export interface RecordBookMonth {
  readonly key: string
  readonly days: readonly {
    readonly date: string
    readonly entries: readonly RecordBookEntry[]
  }[]
}
export interface RecordBook {
  readonly months: readonly RecordBookMonth[]
  readonly exclusions: readonly RecordBookField[]
}

export const RECORD_BOOK_CHANNELS = Object.freeze({
  read: 'record-book:read',
  export: 'record-book:export'
} as const)
export type RecordBookErrorCode =
  | 'validation'
  | 'read-failed'
  | 'busy'
  | 'write-failed'
  | 'destination-changed'
  | 'replace-not-supported'
  | 'export-validation-failed'
export type RecordBookResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: RecordBookErrorCode } }
export interface RecordBookSnapshot {
  readonly book: RecordBook
  readonly readAt: string
}
export type RecordBookExport =
  | { readonly kind: 'cancelled' }
  | {
      readonly kind: 'exported'
      readonly fileName: string
      readonly byteLength: number
      readonly exportedAt: string
    }
export interface RecordBookApi {
  readonly read: () => Promise<RecordBookResult<RecordBookSnapshot>>
  readonly export: () => Promise<RecordBookResult<RecordBookExport>>
}
