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
