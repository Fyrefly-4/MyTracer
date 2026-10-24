export const EXPORT_CHANNELS = Object.freeze({ generate: 'exports:generate' } as const)

export type CompleteExportErrorCode =
  | 'validation'
  | 'snapshot-failed'
  | 'serialization-failed'
  | 'export-validation-failed'
  | 'write-failed'
  | 'destination-changed'
  | 'replace-not-supported'

export type CompleteExportResult =
  | { readonly ok: true; readonly value: { readonly kind: 'cancelled' } }
  | {
      readonly ok: true
      readonly value: {
        readonly kind: 'exported'
        readonly fileName: string
        readonly byteLength: number
        readonly exportVersion: 6
        readonly exportedAt: string
      }
    }
  | {
      readonly ok: false
      readonly error: { readonly code: CompleteExportErrorCode; readonly message: string }
    }

export interface CompleteExportApi {
  readonly generate: () => Promise<CompleteExportResult>
}
