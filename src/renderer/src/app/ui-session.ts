import type { ReviewSummaryDto } from '../../../contracts/review'
import { GoalContentDraft } from '../features/goals/goal-content-draft'
import { browserSelectionPreferences, type SelectionPage } from './selection-preferences'
import { RoutineEditSession } from './routine-edit-session'
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useSyncExternalStore,
  useRef,
  type RefObject
} from 'react'
import type { GoalStatusDto } from '../../../contracts/goals'
import type {
  BeginActionRecordingDto,
  ActionRecordOutcomeDto,
  FirstActionRecordInputDto,
  RecordErrorCode
} from '../../../contracts/records'
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
  readonly summary: string
  readonly note: string
  readonly postExpanded: boolean
  readonly postAction: PostRecordActionChoice
  readonly nextMode: RecordedNextMode
  readonly replacementActionId: string
  readonly applyRecordedNextStep: boolean
}

export interface FirstActionRecordingDraft {
  readonly context: BeginActionRecordingDto
  readonly title: string
  readonly goalId: string
  readonly durationMinutes: string
  readonly unknownDuration: boolean
  readonly outcome: ActionRecordOutcomeDto | ''
  readonly lifecycle: 'keep-pending' | 'complete' | ''
  readonly summary: string
  readonly note: string
  // A transport failure must retry exactly the same request before editing/abandoning.
  readonly uncertainInput?: FirstActionRecordInputDto
}

export function firstRecordDraftAfterFailure(
  draft: FirstActionRecordingDraft,
  code: RecordErrorCode
): FirstActionRecordingDraft {
  // These service errors occur only before the first commit. A saved session
  // receipt is replayed before consulting the goal, even after pause/deletion.
  // Validation runs before receipt lookup; invalid context and storage errors
  // also cannot settle a previous lost reply, so retain those submission locks.
  if (code === 'not-found' || code === 'invalid-transition') {
    return { ...draft, uncertainInput: undefined }
  }
  return draft
}

export interface RoutineRecordingDraft {
  readonly context: BeginRoutineRecordingDto
  readonly outcome: RoutineRecordOutcomeDto
  readonly durationMinutes: string
  readonly summary: string
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

export interface ReviewWritingDraft {
  readonly summary: ReviewSummaryDto
  readonly loadedDraft: string
  readonly confirmedProgress: string
  readonly mainObstacle: string
  readonly nextAdjustment: string
  readonly relatedGoalId: string
  readonly nextStepKind: 'none' | 'use-existing' | 'create-and-use'
  readonly existingActionId: string
  readonly newActionTitle: string
}

export class UiSession {
  // Reading state only, retained across navigation within this app session.
  readonly expandedActionDescriptions = new Set<string>()
  readonly bookReading: { month: string | null; positions: Map<string, number> } = {
    month: null,
    positions: new Map()
  }

  setBookMonth(month: string | null): void {
    this.bookReading.month = month
  }
  setBookPosition(month: string, position: number): void {
    this.bookReading.positions.set(month, position)
  }
  private visitingBookOriginal = false
  /** Temporary explicit record visit. Restores the caller's complete Data reading context. */
  visitBookOriginal(selection: DataRecordSelection): () => void {
    this.visitingBookOriginal = true
    const history = this.historyState
    const selected = this.selectedDataRecord
    const position = this.getPosition('data')
    const panes = new Map(this.panePositions)
    this.selectedDataRecord = selection
    this.historyState = { kind: 'all', goalId: 'all', date: '', query: '', page: 1 }
    this.navigationSelection.add('data')
    this.positions.data = 0
    this.setPanePosition('data', 'detail', 0)
    this.setPanePosition('data', 'master', 0)
    return () => {
      this.visitingBookOriginal = false
      this.historyState = history
      this.selectedDataRecord = selected
      if (selected) this.preferences.remember('data', selected)
      this.positions.data = position
      for (const key of this.panePositions.keys())
        if (key.startsWith('data:')) this.panePositions.delete(key)
      for (const [key, value] of panes)
        if (key.startsWith('data:')) this.panePositions.set(key, value)
      this.navigationSelection.delete('data')
    }
  }

  private historyState: {
    kind: 'all' | 'action-record' | 'routine-record'
    goalId: string
    date: string
    query: string
    page: number
  } = {
    kind: 'all',
    goalId: 'all',
    date: '',
    query: '',
    page: 1
  }

  get dataHistory() {
    return this.historyState
  }
  setDataHistory(state: typeof this.historyState): void {
    this.historyState = state
  }
  private firstActionDraft: FirstActionRecordingDraft | null = null
  private firstActionBeginGeneration = 0
  beginFirstActionDraftRequest(): number {
    return ++this.firstActionBeginGeneration
  }
  ownsFirstActionDraftRequest(generation: number): boolean {
    return generation === this.firstActionBeginGeneration
  }
  getFirstActionDraft(): FirstActionRecordingDraft | null {
    return this.firstActionDraft
  }
  setFirstActionDraft(draft: FirstActionRecordingDraft | null): void {
    this.firstActionBeginGeneration++
    this.firstActionDraft = draft
    for (const listener of this.unsavedListeners) listener()
  }
  private pendingReviewSave: Promise<void> | null = null
  getPendingReviewSave(): Promise<void> | null {
    return this.pendingReviewSave
  }
  setPendingReviewSave(pending: Promise<void> | null): void {
    this.pendingReviewSave = pending
  }
  private reviewWritingDraft: ReviewWritingDraft | null = null
  getReviewDraft(): ReviewWritingDraft | null {
    return this.reviewWritingDraft
  }
  setReviewDraft(draft: ReviewWritingDraft | null): void {
    this.reviewWritingDraft = draft
  }
  readonly goalContentDraft = new GoalContentDraft()
  readonly routineEditor = new RoutineEditSession()
  private selectedGoal: string | null = null
  private selectedAction: string | null = null
  private selectedToday: { type: 'action' | 'routine'; id: string } | null = null
  private selectedRoutine: string | null = null
  private recoveryGoal: string | null = null
  private selectedDataRecord: DataRecordSelection | null = null
  private filter: GoalStatusDto | '' = ''
  private goalQuery = ''
  private progressHistoryPage = 1
  private progressDraft: ProgressFilterState = { goalId: '', from: '', through: '' }
  private progressApplied: ProgressFilterState = { goalId: '', from: '', through: '' }
  private positions: Partial<Record<AppSectionId, number>> = {}
  private panePositions = new Map<string, number>()
  private listPages = new Map<string, number>()
  private actionDrafts = new Map<string, ActionRecordingDraft>()
  private routineDrafts = new Map<string, RoutineRecordingDraft>()
  private goalCoverDrafts = new Map<string, string>()
  private unsavedContent = new Set<string>()
  private unsavedListeners = new Set<() => void>()
  subscribeUnsaved = (listener: () => void): (() => void) => {
    this.unsavedListeners.add(listener)
    return () => {
      this.unsavedListeners.delete(listener)
    }
  }
  hasActiveUnsavedContent = (): boolean =>
    this.unsavedContent.size > 0 || this.goalCoverDrafts.size > 0

  hasDataUnsavedContent = (): boolean =>
    [...this.unsavedContent].some((source) => source.startsWith('data-'))

  private readonly preferences = browserSelectionPreferences()
  private navigationSelection = new Set<SelectionPage>()
  constructor(private readonly onNavigate: (section: AppSectionId) => void) {
    this.selectedGoal = this.preferences.get('goals')?.id ?? null
    const today = this.preferences.get('today')
    if (today && (today.type === 'action' || today.type === 'routine')) {
      this.selectedToday = { type: today.type, id: today.id }
      this.selectedAction = today.type === 'action' ? today.id : null
    }
    const data = this.preferences.get('data')
    if (data && (data.type === 'action-record' || data.type === 'routine-record')) {
      this.selectedDataRecord = { type: data.type, id: data.id }
    }
  }
  takeNavigationSelection(page: SelectionPage): boolean {
    const explicit = this.navigationSelection.has(page)
    this.navigationSelection.delete(page)
    return explicit
  }
  get goalId(): string | null {
    return this.selectedGoal
  }
  get todaySelection(): { type: 'action' | 'routine'; id: string } | null {
    return this.selectedToday
  }
  selectTodayRoutine(id: string | null): void {
    this.selectedToday = id ? { type: 'routine', id } : null
    if (id) this.preferences.remember('today', { type: 'routine', id })
  }
  get actionId(): string | null {
    return this.selectedAction
  }
  get goalFilter(): GoalStatusDto | '' {
    return this.filter
  }
  get goalSearchQuery(): string {
    return this.goalQuery
  }
  setGoalSearchQuery(query: string): void {
    this.goalQuery = query
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
    if (id) this.preferences.remember('goals', { type: 'goal', id })
  }
  selectAction(id: string | null): void {
    this.selectedAction = id
    this.selectedToday = id ? { type: 'action', id } : null
    if (id) this.preferences.remember('today', { type: 'action', id })
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
    if (selection && !this.visitingBookOriginal) this.preferences.remember('data', selection)
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
  getGoalCoverDraft(goalId: string): string | null {
    return this.goalCoverDrafts.get(goalId) ?? null
  }
  setGoalCoverDraft(goalId: string, draft: string): void {
    const added = !this.goalCoverDrafts.has(goalId)
    this.goalCoverDrafts.set(goalId, draft)
    if (added) for (const listener of this.unsavedListeners) listener()
  }
  clearGoalCoverDraft(goalId: string): void {
    if (this.goalCoverDrafts.delete(goalId)) {
      for (const listener of this.unsavedListeners) listener()
    }
  }
  setUnsavedContent(source: string, unsaved: boolean): void {
    const changed = this.unsavedContent.has(source) !== unsaved
    if (unsaved) this.unsavedContent.add(source)
    else this.unsavedContent.delete(source)
    if (changed) for (const listener of this.unsavedListeners) listener()
  }
  hasUnsavedContent(): boolean {
    return (
      this.firstActionDraft !== null ||
      this.routineEditor.hasDraft() ||
      this.unsavedContent.size > 0 ||
      this.reviewWritingDraft !== null ||
      this.goalContentDraft.dirty ||
      this.goalContentDraft.saving ||
      this.actionDrafts.size > 0 ||
      this.routineDrafts.size > 0 ||
      this.goalCoverDrafts.size > 0
    )
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
  openSection(section: AppSectionId, source: AppSectionId = 'home'): void {
    this.positions[source] = document.querySelector('main')?.scrollTop ?? 0
    this.onNavigate(section)
  }
  openGoal(goalId: string, source: 'home' | 'today' = 'home'): void {
    this.selectGoal(goalId)
    this.navigationSelection.add('goals')
    this.filter = ''
    this.goalQuery = ''
    this.setPanePosition('goals', 'detail', 0)
    this.openSection('goals', source)
  }
  openTodayRoutine(routineId: string): void {
    this.navigationSelection.add('today')
    this.selectTodayRoutine(routineId)
    this.setPanePosition('today', 'detail', 0)
    this.openSection('today')
  }
  openAction(actionId: string, source: 'goals' | 'review' | 'home' = 'goals'): void {
    this.navigationSelection.add('today')
    this.selectAction(actionId)
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
  openDataRecord(
    selection: DataRecordSelection,
    source: 'goals' | 'progress' | 'review' | 'home' | 'today'
  ): void {
    this.selectedDataRecord = selection
    if (selection) this.preferences.remember('data', selection)
    this.historyState = { kind: 'all', goalId: 'all', date: '', query: '', page: 1 }
    this.navigationSelection.add('data')
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

export function useActiveUnsavedContent(): boolean {
  const session = useUiSession()
  return useSyncExternalStore(session.subscribeUnsaved, session.hasActiveUnsavedContent)
}

export function useDataUnsavedContent(): boolean {
  const session = useUiSession()
  return useSyncExternalStore(session.subscribeUnsaved, session.hasDataUnsavedContent)
}
