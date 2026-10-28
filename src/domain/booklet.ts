export interface BookletReference {
  readonly id: string
  readonly kind: 'action-record' | 'thought'
  readonly sourceId: string | null
}
export interface Booklet {
  readonly id: string
  readonly title: string
  readonly note: string
  readonly revision: number
  readonly createdAt: string
  readonly updatedAt: string
  readonly entries: readonly BookletReference[]
}
export function validateBookletContent(
  title: string,
  note: string,
  entries: readonly BookletReference[]
): void {
  if (
    typeof title !== 'string' ||
    title.length > 200 ||
    typeof note !== 'string' ||
    note.length > 4000 ||
    entries.length > 1000
  )
    throw new TypeError('标题最多 200 字，自己的话最多 4000 字，每册最多 1000 条。')
  const ids = new Set<string>()
  const sources = new Set<string>()
  for (const entry of entries) {
    const key = `${entry.kind}:${entry.sourceId}`
    if (ids.has(entry.id) || (entry.sourceId !== null && sources.has(key)))
      throw new TypeError('同一来源不能重复加入。')
    ids.add(entry.id)
    if (entry.sourceId !== null) sources.add(key)
  }
}
