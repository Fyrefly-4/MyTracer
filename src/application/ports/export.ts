import type { CorePersistenceSnapshot } from './persistence'

export interface CompleteExportDocumentPort {
  readonly format: 'mytracer-core-export'
  readonly exportVersion: 1 | 2
  readonly sourceDataVersion: number
  readonly appVersion?: string
  readonly exportedAt: string
  readonly localTimeZone: string
  readonly enumValues: Readonly<Record<string, readonly string[]>>
  readonly data: CorePersistenceSnapshot
}

export interface DeliveredCompleteExport {
  readonly fileName: string
  readonly byteLength: number
}

export type ExportDeliveryFailureCode =
  'write-failed' | 'destination-changed' | 'replace-not-supported' | 'export-validation-failed'

export class ExportDeliveryError extends Error {
  public constructor(
    readonly code: ExportDeliveryFailureCode,
    message: string
  ) {
    super(message)
    this.name = 'ExportDeliveryError'
  }
}

export interface ExportPort {
  deliverCompleteExport(
    document: CompleteExportDocumentPort,
    suggestedName: string
  ): Promise<
    { readonly kind: 'cancelled' } | ({ readonly kind: 'exported' } & DeliveredCompleteExport)
  >
}
