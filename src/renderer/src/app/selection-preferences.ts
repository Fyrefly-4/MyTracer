export type SelectionPage = 'goals' | 'today' | 'data'
export interface ViewedSelection {
  readonly type: 'goal' | 'action' | 'routine' | 'action-record' | 'routine-record'
  readonly id: string
}
const types: Record<SelectionPage, readonly ViewedSelection['type'][]> = {
  goals: ['goal'],
  today: ['action', 'routine'],
  data: ['action-record', 'routine-record']
}
const key = 'mytracer.viewed-selection.v1'
export class SelectionPreferences {
  private values: Partial<Record<SelectionPage, ViewedSelection>> = {}
  constructor(private readonly storage?: Pick<Storage, 'getItem' | 'setItem'>) {
    try {
      const parsed: unknown = JSON.parse(storage?.getItem(key) ?? '{}')
      if (!parsed || typeof parsed !== 'object') return
      for (const page of Object.keys(types) as SelectionPage[]) {
        const value: unknown = (parsed as Record<string, unknown>)[page]
        if (!value || typeof value !== 'object') continue
        const { type, id } = value as Record<string, unknown>
        if (
          typeof type === 'string' &&
          types[page].includes(type as ViewedSelection['type']) &&
          typeof id === 'string' &&
          id.length > 0 &&
          id.length <= 256 &&
          id.trim() === id
        ) {
          this.values[page] = { type: type as ViewedSelection['type'], id }
        }
      }
    } catch {
      /* Preferences must never prevent opening the app. */
    }
  }
  get(page: SelectionPage): ViewedSelection | null {
    return this.values[page] ?? null
  }
  remember(page: SelectionPage, value: ViewedSelection): void {
    this.values[page] = value
    try {
      this.storage?.setItem(key, JSON.stringify(this.values))
    } catch {
      /* Keep session memory. */
    }
  }
}
export function browserSelectionPreferences(): SelectionPreferences {
  try {
    return new SelectionPreferences(window.localStorage)
  } catch {
    return new SelectionPreferences()
  }
}
export function chooseVisibleSelection<T>(
  items: readonly T[],
  remembered: string | null,
  keyOf: (item: T) => string
): T | null {
  return items.find((item) => keyOf(item) === remembered) ?? items[0] ?? null
}
