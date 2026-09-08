import { createContext, useContext, useEffect, useRef, type RefObject } from 'react'
import type { GoalStatusDto } from '../../../contracts/goals'
import type { AppSectionId } from './navigation'

export class UiSession {
  private selectedGoal: string | null = null
  private selectedAction: string | null = null
  private filter: GoalStatusDto | '' = ''
  private positions: Partial<Record<AppSectionId, number>> = {}

  constructor(private readonly onOpenAction: () => void) {}
  get goalId(): string | null {
    return this.selectedGoal
  }
  get actionId(): string | null {
    return this.selectedAction
  }
  get goalFilter(): GoalStatusDto | '' {
    return this.filter
  }
  selectGoal(id: string | null): void {
    this.selectedGoal = id
  }
  selectAction(id: string | null): void {
    this.selectedAction = id
  }
  setGoalFilter(filter: GoalStatusDto | ''): void {
    this.filter = filter
  }
  setPosition(section: AppSectionId, position: number): void {
    this.positions[section] = position
  }
  getPosition(section: AppSectionId): number {
    return this.positions[section] ?? 0
  }
  openAction(actionId: string): void {
    this.selectedAction = actionId
    this.positions.goals = document.querySelector('main')?.scrollTop ?? 0
    this.positions.today = 0
    this.onOpenAction()
  }
}

export const UiSessionContext = createContext<UiSession | null>(null)

export function useUiSession(): UiSession {
  const session = useContext(UiSessionContext)
  if (!session) throw new Error('UI session is unavailable')
  return session
}

export function useUiLifetime(): RefObject<boolean> {
  const active = useRef(false)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  return active
}

export function usePagePosition(section: AppSectionId, ready: boolean): void {
  const session = useUiSession()
  const restored = useRef(false)
  useEffect(() => {
    if (!ready || restored.current) return
    const frame = requestAnimationFrame(() => {
      const main = document.querySelector('main')
      if (main) {
        main.scrollTop = session.getPosition(section)
        const selected = main.querySelector<HTMLElement>('.goal-detail, .action-detail')
        if (selected) revealStart(selected)
      }
      restored.current = true
    })
    return () => cancelAnimationFrame(frame)
  }, [ready, section, session])
}

export function revealStart(element: HTMLElement | null): void {
  if (!element) return
  const main = element.closest('main')
  if (!main) return
  const bounds = element.getBoundingClientRect()
  const viewport = main.getBoundingClientRect()
  if (
    bounds.top < viewport.top + 16 ||
    bounds.top + Math.min(bounds.height, 260) > viewport.bottom
  ) {
    main.scrollTop += bounds.top - viewport.top - 16
  }
}
