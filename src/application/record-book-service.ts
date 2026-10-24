import type { RecordBookExport, RecordBookSnapshot } from '../contracts/record-book'
import type { ClockPort } from './ports/clock'
import { asCompleteExportRepository, type RepositoryPort } from './ports/persistence'
import { buildCompleteExport } from './complete-export'
import { buildRecordBook } from './record-book'

export interface RecordBookDeliveryPort {
  deliverRecordBook(
    snapshot: RecordBookSnapshot,
    suggestedName: string
  ): Promise<
    | Omit<Extract<RecordBookExport, { kind: 'exported' }>, 'exportedAt'>
    | { readonly kind: 'cancelled' }
  >
}
export class RecordBookService {
  private exporting = false
  constructor(
    private readonly dependencies: {
      repository: RepositoryPort
      clock: ClockPort
      delivery: RecordBookDeliveryPort
    }
  ) {}
  read(): RecordBookSnapshot {
    const document = buildCompleteExport(
      asCompleteExportRepository(this.dependencies.repository).readCompleteCoreSnapshot(),
      this.dependencies.clock
    )
    return { book: buildRecordBook(document.data), readAt: document.exportedAt }
  }
  async export(): Promise<RecordBookExport> {
    if (this.exporting) throw new RecordBookBusyError()
    this.exporting = true
    try {
      const snapshot = this.read()
      const result = await this.dependencies.delivery.deliverRecordBook(
        snapshot,
        `mytracer-record-book-${snapshot.readAt.slice(0, 10)}.html`
      )
      return result.kind === 'cancelled' ? result : { ...result, exportedAt: snapshot.readAt }
    } finally {
      this.exporting = false
    }
  }
}
export class RecordBookBusyError extends Error {}
