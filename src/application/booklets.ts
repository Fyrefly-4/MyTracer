import type { Booklet } from '../domain/booklet'
import { validateBookletContent } from '../domain/booklet'
import type { BookletRead, BookletSave } from '../contracts/booklets'
import type { RecordBookEntry, RecordBookExport } from '../contracts/record-book'
import type { ClockPort } from './ports/clock'
export interface BookletRepository {
  list(): readonly Booklet[]
  find(id: string): Booklet | null
  write(booklet: Booklet): void
  remove(id: string): void
  sources(): readonly RecordBookEntry[]
  transaction<T>(work: () => T): T
}
export interface BookletDelivery {
  deliverBooklet(
    snapshot: BookletRead,
    suggestedName: string
  ): Promise<
    Omit<Extract<RecordBookExport, { kind: 'exported' }>, 'exportedAt'> | { kind: 'cancelled' }
  >
}
export class BookletConflict extends Error {}
export class BookletService {
  private exporting = false
  constructor(
    private readonly repository: BookletRepository,
    private readonly clock: ClockPort,
    private readonly delivery: BookletDelivery
  ) {}
  list() {
    return this.repository.list()
  }
  sources() {
    return this.repository.transaction(() => this.repository.sources())
  }
  read(id: string): BookletRead {
    return this.repository.transaction(() => {
      const booklet = this.repository.find(id)
      if (!booklet) throw new BookletConflict('小册子已不存在，请返回列表。')
      const sources = new Map(
        this.repository.sources().map((entry) => [`${entry.kind}:${entry.id}`, entry])
      )
      return {
        booklet,
        contents: booklet.entries.map((entry) => {
          if (entry.sourceId === null) return null
          const source = sources.get(`${entry.kind}:${entry.sourceId}`)
          if (!source) throw new Error('Source read failed')
          return source
        }),
        readAt: this.clock.snapshot().instant
      }
    })
  }
  save(input: BookletSave): Booklet {
    validateBookletContent(input.title, input.note, input.entries)
    return this.repository.transaction(() => {
      const old = this.repository.find(input.id)
      const same =
        old &&
        old.title === input.title &&
        old.note === input.note &&
        JSON.stringify(old.entries) === JSON.stringify(input.entries)
      if (same) return old
      if ((old?.revision ?? 0) !== input.expectedRevision)
        throw new BookletConflict('小册子已变化，请重新读取后再操作。')
      const sources = new Set(this.repository.sources().map((entry) => `${entry.kind}:${entry.id}`))
      for (const entry of input.entries) {
        const previous = old?.entries.find((item) => item.id === entry.id)
        if (previous && (previous.kind !== entry.kind || previous.sourceId !== entry.sourceId))
          throw new BookletConflict('来源已变化，请重新读取。')
        if (entry.sourceId === null ? !previous : !sources.has(`${entry.kind}:${entry.sourceId}`))
          throw new BookletConflict('来源已删除，请重新读取后再加入。')
      }
      const now = this.clock.snapshot().instant
      const booklet: Booklet = {
        id: input.id,
        title: input.title,
        note: input.note,
        entries: input.entries,
        revision: (old?.revision ?? 0) + 1,
        createdAt: old?.createdAt ?? now,
        updatedAt: now
      }
      this.repository.write(booklet)
      return booklet
    })
  }
  delete(input: { id: string; expectedRevision: number; confirmed: true }): null {
    if (input.confirmed !== true) throw new TypeError('删除需要确认。')
    return this.repository.transaction(() => {
      const old = this.repository.find(input.id)
      if (old && old.revision !== input.expectedRevision)
        throw new BookletConflict('小册子已变化，请重新读取后再删除。')
      this.repository.remove(input.id)
      return null
    })
  }
  async export(id: string): Promise<RecordBookExport> {
    if (this.exporting) throw new BookletConflict('另一次导出仍在进行，请先完成或取消。')
    this.exporting = true
    try {
      const snapshot = this.read(id)
      const result = await this.delivery.deliverBooklet(
        snapshot,
        `mytracer-booklet-${snapshot.readAt.slice(0, 10)}.html`
      )
      return result.kind === 'cancelled' ? result : { ...result, exportedAt: snapshot.readAt }
    } finally {
      this.exporting = false
    }
  }
}
