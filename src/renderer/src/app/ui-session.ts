import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  type RefObject
} from 'react'
import type { GoalStatusDto } from '../../../contracts/goals'
import type { BeginActionRecordingDto, ActionRecordOutcomeDto } from '../../../contracts/records'
import type {
  BeginRoutineRecordingDto,
  RoutineRecordOutcomeDto
} from '../../../contracts/routine-records'
import type { AppSectionId } from './navigation'

export type PostRecordActionChoice = 'keep-pending' | 'complete' | 'cancel' | 'reschedule'
export type RecordedNextMode = 'clear' | 'use-existing' | 'recorded-next'

export interface ActionRecordingDraft {
  readonly context: BeginActionRecordingDto
  readonly durationMinutes: string
  readonly outcome: ActionRecordOutcomeDto
  readonly deepExpanded: boolean
  readonly understanding: string
  readonly confusion: string
  readonly nextStep: string
  readonly note: string
  readonly postExpanded: boolean
  readonly postAction: PostRecordActionChoice
  readonly nextMode: RecordedNextMode
  readonly replacementActionId: string
  readonly applyRecordedNextStep: boolean
}

export interface RoutineRecordingDraft {
  readonly context: BeginRoutineRecordingDto
  readonly outcome: RoutineRecordOutcomeDto
  readonly durationMinutes: string
  readonly note: string
}

export interface ProgressFilterState {
  readonly goalId: string
  readonly from: string
  readonly through: string
}

export interface DataRecordSelection {
  readonly type: 'action-record' | 'routine-record'
  readonly id: string
}

export class UiSession {
  private selectedGoal: string | null = null
  private selectedAction: string | null = null
  private selectedRoutine: string | null = null
  private recoveryGoal: string | null = null
  private selectedDataRecord: DataRecordSelection | null = null
  private filter: GoalStatusDto | '' = ''
  private progressHistoryPage = 1
  private progressDraft: ProgressFilterState = { goalId: '', from: '', through: '' }
  private progressApplied: ProgressFilterState = { goalId: '', from: '', through: '' }
  private positions: Partial<Record<AppSectionId, number>> = {}
  private panePositions = new Map<string, number>()
  private listPages = new Map<string, number>()
  private actionDrafts = new Map<string, ActionRecordingDraft>()
  private routineDrafts = new Map<string, RoutineRecordingDraft>()
  private unsavedContent = new Set<string>()

  constructor(private readonly onNavigate: (section: AppSectionId) => void) {}
  get goalId(): string | null {
    return this.selectedGoal
  }
  get actionId(): string | null {
    return this.selectedAction
  }
  get goalFilter(): GoalStatusDto | '' {
    return this.filter
  }
  get routineId(): string | null {
    return this.selectedRoutine
  }
  get recoveryGoalId(): string | null {
    return this.recoveryGoal
  }
  get dataRecord(): DataRecordSelection | null {
    return this.selectedDataRecord
  }
  get progressRecordPage(): number {
    return this.progressHistoryPage
  }
  setProgressRecordPage(page: number): void {
    this.progressHistoryPage = Math.max(1, Math.floor(page))
  }
  get progressDraftFilter(): ProgressFilterState {
    return this.progressDraft
  }
  get progressAppliedFilter(): ProgressFilterState {
    return this.progressApplied
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
  selectRoutine(id: string | null): void {
    this.selectedRoutine = id
  }
  setRecoveryGoal(id: string | null): void {
    this.recoveryGoal = id
  }
  selectDataRecord(selection: DataRecordSelection | null): void {
    this.selectedDataRecord = selection
  }
  setProgressDraftFilter(filter: ProgressFilterState): void {
    this.progressDraft = filter
  }
  applyProgressFilter(filter: ProgressFilterState): void {
    this.progressDraft = filter
    this.progressApplied = filter
  }
  getActionDraft(actionId: string): ActionRecordingDraft | null {
    return this.actionDrafts.get(actionId) ?? null
  }
  setActionDraft(actionId: string, draft: ActionRecordingDraft): void {
    this.actionDrafts.set(actionId, draft)
  }
  clearActionDraft(actionId: string): void {
    this.actionDrafts.delete(actionId)
  }
  hasActionDraft(actionId: string): boolean {
    return this.actionDrafts.has(actionId)
  }
  getRoutineDraft(routineId: string): RoutineRecordingDraft | null {
    return this.routineDrafts.get(routineId) ?? null
  }
  setRoutineDraft(routineId: string, draft: RoutineRecordingDraft): void {
    this.routineDrafts.set(routineId, draft)
  }
  clearRoutineDraft(routineId: string): void {
    this.routineDrafts.delete(routineId)
  }
  hasRoutineDraft(routineId: string): boolean {
    return this.routineDrafts.has(routineId)
  }
  setUnsavedContent(source: string, unsaved: boolean): void {
    if (unsaved) this.unsavedContent.add(source)
    else this.unsavedContent.delete(source)
  }
  hasUnsavedContent(): boolean {
    return this.unsavedContent.size > 0 || this.actionDrafts.size > 0 || this.routineDrafts.size > 0
  }
  getListPage(section: AppSectionId, list: string): number {
    return this.listPages.get(`${section}:${list}`) ?? 1
  }
  setListPage(section: AppSectionId, list: string, page: number): void {
    this.listPages.set(
      `${section}:${list}`,
      Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1
    )
  }
  setPanePosition(section: AppSectionId, pane: string, position: number): void {
    this.panePositions.set(`${section}:${pane}`, position)
  }
  getPanePosition(section: AppSectionId, pane: string): number {
    return this.panePositions.get(`${section}:${pane}`) ?? 0
  }
  setPosition(section: AppSectionId, position: number): void {
    this.positions[section] = position
  }
  getPosition(section: AppSectionId): number {
    return this.positions[section] ?? 0
  }
  openAction(actionId: string, source: 'goals' | 'review' = 'goals'): void {
    this.selectedAction = actionId
    this.positions[source] = document.querySelector('main')?.scrollTop ?? 0
    this.positions.today = 0
    this.setPanePosition('today', 'detail', 0)
    this.onNavigate('today')
  }
  openProgressPeriod(from: string, through: string): void {
    this.applyProgressFilter({ goalId: '', from, through })
    this.positions.review = document.querySelector('main')?.scrollTop ?? 0
    this.positions.progress = 0
    this.progressHistoryPage = 1
    this.setPanePosition('progress', 'records', 0)
    this.onNavigate('progress')
  }
  openDataRecord(selection: DataRecordSelection, source: 'goals' | 'progress' | 'review'): void {
    this.selectedDataRecord = selection
    this.positions[source] = document.querySelector('main')?.scrollTop ?? 0
    this.positions.data = 0
    this.setPanePosition('data', 'detail', 0)
    this.onNavigate('data')
  }
}

export const UiSessionContext = createContext<UiSession | null>(null)

export function useUiSession(): UiSession {
  const session = useContext(UiSessionContext)
  if (!session) throw new Error('UI session is unavailable')
  return session
}

export function useUnsavedContent(source: string, unsaved: boolean): void {
  const session = useUiSession()
  useLayoutEffect(() => {
    session.setUnsavedContent(source, unsaved)
    return () => session.setUnsavedContent(source, false)
  }, [session, source, unsaved])
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
        for (const pane of main.querySelectorAll<HTMLElement>('[data-scroll-key]')) {
          pane.scrollTop = session.getPanePosition(section, pane.dataset.scrollKey ?? '')
        }
      }
      restored.current = true
    })
    return () => cancelAnimationFrame(frame)
  }, [ready, section, session])
}

export function revealStart(element: HTMLElement | null): void {
  if (!element) return
  const main = element.closest<HTMLElement>('[data-scroll-key]') ?? element.closest('main')
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
