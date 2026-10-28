import type { RecordBookEntry, RecordBookExport } from './record-book'
export interface Booklet {
  readonly id: string
  readonly title: string
  readonly note: string
  readonly revision: number
  readonly createdAt: string
  readonly updatedAt: string
  readonly entries: readonly {
    readonly id: string
    readonly kind: 'action-record' | 'thought'
    readonly sourceId: string | null
  }[]
}
export interface BookletRead {
  readonly booklet: Booklet
  readonly contents: readonly (RecordBookEntry | null)[]
  readonly readAt: string
}
export interface BookletSave {
  readonly id: string
  readonly expectedRevision: number
  readonly title: string
  readonly note: string
  readonly entries: Booklet['entries']
}
export type BookletResult<T> = { ok: true; value: T } | { ok: false; error: { message: string } }
export const BOOKLET_CHANNELS = Object.freeze({
  list: 'booklets:list',
  read: 'booklets:read',
  sources: 'booklets:sources',
  save: 'booklets:save',
  delete: 'booklets:delete',
  export: 'booklets:export'
})
export interface BookletApi {
  list(): Promise<BookletResult<readonly Booklet[]>>
  read(input: { id: string }): Promise<BookletResult<BookletRead>>
  sources(): Promise<BookletResult<readonly RecordBookEntry[]>>
  save(input: BookletSave): Promise<BookletResult<Booklet>>
  delete(input: {
    id: string
    expectedRevision: number
    confirmed: true
  }): Promise<BookletResult<null>>
  export(input: { id: string }): Promise<BookletResult<RecordBookExport>>
}
