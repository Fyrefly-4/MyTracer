export interface ContinuityRow {
  readonly operationId: string
  readonly state: 'open' | 'saved' | 'discarded'
  readonly revision: number
  readonly payload: string | null
}
export interface RecordContinuityPort {
  list(): readonly ContinuityRow[]
  find(id: string): ContinuityRow | undefined
  write(row: ContinuityRow): void
  transaction<T>(work: () => T): T
}
