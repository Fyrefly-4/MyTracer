import type { RoutineDetailDto } from '../../../contracts/routines'

type Part = 'content' | 'schedule' | 'status'
export interface RoutineEditState {
  readonly detail: RoutineDetailDto
  readonly name: string
  readonly description: string
  readonly minimumAction: string
  readonly weekdays: readonly number[]
  readonly identity: number
  readonly contentRevision: number
  readonly scheduleRevision: number
  readonly availability: 'ready' | 'checking' | 'missing' | 'error'
  readonly pending: boolean
}
export interface RoutineEditSave {
  readonly state: RoutineEditState
  readonly part: Part
}

export const contentChanged = (state: RoutineEditState): boolean =>
  state.name !== state.detail.name ||
  state.description !== (state.detail.description ?? '') ||
  state.minimumAction !== state.detail.minimumAction
export const scheduleChanged = (state: RoutineEditState): boolean =>
  state.weekdays.join(',') !== state.detail.weekdays.join(',')

/** One in-memory editor, separate from routine recording contexts. */
export class RoutineEditSession {
  private state: RoutineEditState | null = null
  private identity = 0
  private readSequence = 0
  private pendingSave: RoutineEditSave | null = null
  private pendingPromise: Promise<void> | null = null
  private finishPending: (() => void) | null = null
  private listeners = new Set<() => void>()
  getSnapshot = (): RoutineEditState | null => this.state
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  private publish(state: RoutineEditState | null): void {
    this.state = state
    for (const listener of this.listeners) listener()
  }
  hasDraft(): boolean {
    return Boolean(
      this.state &&
      (this.state.pending || contentChanged(this.state) || scheduleChanged(this.state))
    )
  }
  waitForSave(): Promise<void> | null {
    return this.pendingPromise
  }
  editContent(
    patch: Partial<Pick<RoutineEditState, 'name' | 'description' | 'minimumAction'>>
  ): void {
    if (!this.state || this.state.availability === 'missing') return
    this.publish({ ...this.state, ...patch, contentRevision: this.state.contentRevision + 1 })
  }
  editSchedule(weekdays: readonly number[]): void {
    if (!this.state || this.state.availability === 'missing') return
    this.publish({
      ...this.state,
      weekdays: [...weekdays],
      scheduleRevision: this.state.scheduleRevision + 1
    })
  }
  beginRead(checking = true): number {
    const sequence = ++this.readSequence
    if (checking && this.state) this.publish({ ...this.state, availability: 'checking' })
    return sequence
  }
  invalidateRead(): void {
    this.readSequence += 1
  }
  acceptRead(sequence: number, detail: RoutineDetailDto, routineId = detail.id): boolean {
    if (sequence !== this.readSequence || this.pendingSave) return false
    if (detail.id !== routineId) {
      this.failRead(sequence, false, routineId)
      return false
    }
    if (this.state?.detail.id !== detail.id && this.hasDraft()) return false
    this.install(detail)
    return true
  }
  failRead(sequence: number, missing: boolean, routineId: string): boolean {
    if (sequence !== this.readSequence || this.pendingSave) return false
    if (this.state)
      this.publish({
        ...this.state,
        availability: this.state.detail.id !== routineId ? 'ready' : missing ? 'missing' : 'error'
      })
    return true
  }
  private install(detail: RoutineDetailDto, saved?: RoutineEditSave): void {
    const previous = this.state?.detail.id === detail.id ? this.state : null
    const keepContent =
      previous &&
      (saved?.part === 'content'
        ? saved.state.contentRevision !== previous.contentRevision
        : contentChanged(previous))
    const keepSchedule =
      previous &&
      (saved?.part === 'schedule'
        ? saved.state.scheduleRevision !== previous.scheduleRevision
        : scheduleChanged(previous))
    this.publish({
      detail,
      name: keepContent ? previous.name : detail.name,
      description: keepContent ? previous.description : (detail.description ?? ''),
      minimumAction: keepContent ? previous.minimumAction : detail.minimumAction,
      weekdays: keepSchedule ? previous.weekdays : detail.weekdays,
      identity: previous?.identity ?? ++this.identity,
      contentRevision: previous?.contentRevision ?? 0,
      scheduleRevision: previous?.scheduleRevision ?? 0,
      availability: 'ready',
      pending: false
    })
  }
  beginSave(part: Part): RoutineEditSave | null {
    if (!this.state || this.state.availability !== 'ready' || this.pendingSave) return null
    const token = { state: this.state, part }
    this.pendingSave = token
    this.pendingPromise = new Promise((resolve) => {
      this.finishPending = resolve
    })
    this.invalidateRead()
    this.publish({ ...this.state, pending: true })
    return token
  }
  finishSave(token: RoutineEditSave, detail?: RoutineDetailDto, missing = false): void {
    if (this.pendingSave !== token) return
    if (this.state?.identity === token.state.identity) {
      if (detail?.id === token.state.detail.id) this.install(detail, token)
      else
        this.publish({
          ...this.state,
          pending: false,
          availability: missing ? 'missing' : this.state.availability
        })
    }
    this.pendingSave = null
    const finish = this.finishPending
    this.finishPending = null
    this.pendingPromise = null
    finish?.()
  }
  discard(): void {
    if (this.pendingSave) return
    this.invalidateRead()
    if (!this.state) return
    const { detail, availability } = this.state
    this.publish(null)
    if (availability !== 'missing') {
      this.install(detail)
      this.publish({ ...this.state!, availability })
    }
  }
}
