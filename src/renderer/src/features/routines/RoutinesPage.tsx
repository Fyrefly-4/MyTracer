import { useRoutineDayState } from './use-routine-day-state'
import { RecordContinuityNotice, UnavailableRecordInputs } from '../../app/RecordContinuityNotice'
import { hasRecordInput } from '../../../../contracts/record-drafts'
import { RecordSummaryInput, RecordNoteInput } from '../../app/RecordText'
import '../forms-workspace.css'
import '../object-workspace.css'
import './routine-search-context.css'
import {
  revealStart,
  usePagePosition,
  useUiLifetime,
  useUiSession,
  useRecordOperation,
  useUnsavedContent
} from '../../app/ui-session'
import { goalStatusText, routineRecordOutcomeText } from '../../app/ui-text'
import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore
} from 'react'
import type { GoalErrorCode, GoalSummaryDto } from '../../../../contracts/goals'
import type {
  RoutineErrorCode,
  RoutineStatusDto,
  RoutineSummaryDto
} from '../../../../contracts/routines'
import type {
  BeginRoutineRecordingDto,
  RoutineDayStateDto,
  RoutineRecordErrorCode,
  RoutineRecordOutcomeDto,
  RoutineRecordingDateChoiceDto
} from '../../../../contracts/routine-records'

const goalErrorText: Record<GoalErrorCode, string> = {
  validation: '请检查必填内容。',
  'not-found': '目标或行动已不存在，请刷新后重试。',
  'invalid-transition': '当前状态不能执行这个操作。',
  'invariant-violation': '这个行动不能作为该目标的当前下一步。',
  'persistence-failed': '本地数据暂时无法保存或读取。'
}

const routineStatusText: Record<RoutineStatusDto, string> = {
  active: '活跃',
  paused: '暂停',
  ended: '结束'
}

const routineErrorText: Record<RoutineErrorCode, string> = {
  validation: '请填写名称、最小行动，并至少选择一个星期日。',
  'not-found': '例行或关联目标已不存在，请刷新后重试。',
  'invalid-transition': '当前状态不能执行这个例行操作。',
  'invariant-violation': '这个例行当前不允许该操作。',
  'persistence-failed': '本地例行数据暂时无法保存或读取。'
}

const routineRecordErrorText: Record<RoutineRecordErrorCode, string> = {
  'already-saved': '这笔已保存，不会重复写入。',
  'context-changed': '对象或安排已变化，请核对后继续。',
  validation: '请检查记录内容；行动时长需为非负整数分钟。',
  'not-found': '例行已不存在，请刷新后重试。',
  'invalid-transition': '只有活跃例行可以新增记录。',
  'invariant-violation': '当前例行记录关系不可用。',
  'record-already-exists': '这个例行在所选日期已经有记录；不会覆盖已有事实。',
  'invalid-recording-context': '这次记录连接已失效；草稿内容仍在，可以重新开始后继续保存。',
  'persistence-failed': '本地例行记录暂时无法保存或读取。'
}

function ArrangementPicker(props: {
  value: 'weekly' | 'unscheduled'
  disabled?: boolean
  onChange: (mode: 'weekly' | 'unscheduled') => void
}) {
  return (
    <label>
      安排方式
      <select
        value={props.value}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.target.value as 'weekly' | 'unscheduled')}
      >
        <option value="weekly">按星期安排</option>
        <option value="unscheduled">无固定安排</option>
      </select>
    </label>
  )
}
const weekdayOptions = [
  { value: 1, label: '一' },
  { value: 2, label: '二' },
  { value: 3, label: '三' },
  { value: 4, label: '四' },
  { value: 5, label: '五' },
  { value: 6, label: '六' },
  { value: 7, label: '日' }
] as const

function RoutineWeekdayPicker(props: {
  readonly value: readonly number[]
  readonly onChange: (weekdays: readonly number[]) => void
  readonly disabled?: boolean
  readonly label: string
}): ReactNode {
  const toggle = (weekday: number): void => {
    props.onChange(
      props.value.includes(weekday)
        ? props.value.filter((candidate) => candidate !== weekday)
        : [...props.value, weekday].sort((left, right) => left - right)
    )
  }

  return (
    <fieldset className="weekday-fieldset" disabled={props.disabled}>
      <legend>{props.label}</legend>
      <div className="weekday-shortcuts">
        <button type="button" onClick={() => props.onChange([1, 2, 3, 4, 5, 6, 7])}>
          每天
        </button>
        <button type="button" onClick={() => props.onChange([1, 2, 3, 4, 5])}>
          工作日
        </button>
      </div>
      <div className="weekday-options">
        {weekdayOptions.map((weekday) => (
          <label key={weekday.value}>
            <input
              type="checkbox"
              checked={props.value.includes(weekday.value)}
              onChange={() => toggle(weekday.value)}
            />
            周{weekday.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function RoutineRecordingPanel(props: {
  readonly routineId: string
  readonly routineName: string
  readonly disabled?: boolean
  readonly initialState?: RoutineDayStateDto | null
  readonly onSaved?: () => Promise<void>
}): ReactNode {
  const activeRef = useUiLifetime()
  const session = useUiSession()
  const [restoredDraft] = useState(() => session.getRoutineDraft(props.routineId))
  const panelRef = useRef<HTMLElement | null>(null)
  const beginRef = useRef<HTMLButtonElement | null>(null)
  const restoreBeginFocus = useRef(false)
  const [savedMessage, setSavedMessage] = useState('')
  const [context, setContext] = useState<BeginRoutineRecordingDto | null>(
    restoredDraft?.context ?? null
  )
  const contextRef = useRef<BeginRoutineRecordingDto | null>(restoredDraft?.context ?? null)
  const dayRead = useRoutineDayState(props.routineId, context?.capturedOn, props.initialState)
  const [outcome, setOutcome] = useState<RoutineRecordOutcomeDto>(restoredDraft?.outcome ?? 'acted')
  const [durationMinutes, setDurationMinutes] = useState(restoredDraft?.durationMinutes ?? '')
  const [summary, setSummary] = useState(restoredDraft?.summary ?? '')
  const [note, setNote] = useState(restoredDraft?.note ?? '')
  const [dateConfirmation, setDateConfirmation] = useState<{
    readonly capturedOn: string
    readonly currentLocalDate: string
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invalidContext, setInvalidContext] = useState(false)
  const operation = useRecordOperation(context?.recordingContextId)
  useUnsavedContent(
    `routine-record-${props.routineId}`,
    Boolean(
      context &&
      hasRecordInput({
        kind: 'routine',
        draft: { context, outcome, durationMinutes, summary, note }
      })
    )
  )

  useLayoutEffect(() => {
    if (!context) return
    session.setRoutineDraft(props.routineId, { context, outcome, durationMinutes, summary, note })
  }, [context, durationMinutes, summary, note, outcome, props.routineId, session])

  // A previous instance can finish saving after this panel restores its draft.
  // Refresh exposes the committed fact; only discard the consumed context,
  // never a genuinely newer recording context still owned by the session.
  if (
    context &&
    props.initialState?.record?.occurredOn === context.capturedOn &&
    session.getRoutineDraft(props.routineId)?.context.recordingContextId !==
      context.recordingContextId
  ) {
    setContext(null)
    setDateConfirmation(null)
    setInvalidContext(false)
    setError(null)
  }

  useEffect(() => {
    if (!context) {
      contextRef.current = null
      if (!busy && restoreBeginFocus.current) {
        restoreBeginFocus.current = false
        revealStart(panelRef.current)
        beginRef.current?.focus({ preventScroll: true })
      }
      return
    }
    revealStart(panelRef.current)
    panelRef.current?.querySelector<HTMLSelectElement>('select')?.focus({ preventScroll: true })
  }, [busy, context])

  useEffect(() => {
    return () => {
      contextRef.current = null
    }
  }, [props.routineId])

  const begin = async (): Promise<void> => {
    if (session.loadFailed) {
      setError('请先重试读取本机未完成输入，再开始记录。')
      return
    }
    setBusy(true)
    const result = await window.myTracer.routines.beginRecording({ routineId: props.routineId })
    if (!activeRef.current) {
      if (result.ok)
        await window.myTracer.routines.cancelRecording({
          recordingContextId: result.value.recordingContextId
        })
      return
    }
    if (!result.ok) {
      setBusy(false)
      setError(routineRecordErrorText[result.error.code])
      return
    }
    // Resolve the captured day's fact before exposing editable inputs. A late
    // read must never clear text typed into a newly opened recording form.
    try {
      const stateResult = await window.myTracer.routines.getDayState({
        routineId: props.routineId,
        localDate: result.value.capturedOn
      })
      if (!activeRef.current || !stateResult.ok || stateResult.value.record) {
        await window.myTracer.routines.cancelRecording({
          recordingContextId: result.value.recordingContextId
        })
        if (!activeRef.current) return
        dayRead.refresh()
        setError(stateResult.ok ? null : routineRecordErrorText[stateResult.error.code])
        if (stateResult.ok && stateResult.value.record) await props.onSaved?.()
        return
      }
      setSavedMessage('')
      contextRef.current = result.value
      setContext(result.value)
      session.setRoutineDraft(props.routineId, {
        context: result.value,
        outcome,
        durationMinutes,
        summary,
        note
      })
      setInvalidContext(false)
      setError(null)
    } catch {
      if (activeRef.current) setError('记录状态暂时无法读取，请重试。')
      await window.myTracer.routines
        .cancelRecording({
          recordingContextId: result.value.recordingContextId
        })
        .catch(() => undefined)
    } finally {
      if (activeRef.current) setBusy(false)
    }
  }

  const cancel = async (): Promise<void> => {
    if (!context || operation.pending || operation.uncertain) return
    setBusy(true)
    const result = await session
      .trackRecordOperation(context.recordingContextId, () =>
        window.myTracer.routines.cancelRecording({ recordingContextId: context.recordingContextId })
      )
      .catch(() => ({
        ok: false as const,
        error: { code: 'persistence-failed' as const, message: 'Discard result unavailable.' }
      }))
    if (!activeRef.current) return
    setBusy(false)
    if (!result.ok) {
      if (result.error.code === 'already-saved') {
        session.clearRoutineDraft(props.routineId)
        setContext(null)
        setSavedMessage('上次提交已完成，已有记录未被删除。')
        return
      }
      setError(routineRecordErrorText[result.error.code])
      return
    }
    restoreBeginFocus.current = true
    contextRef.current = null
    setContext(null)
    session.clearRoutineDraft(props.routineId)
    setDateConfirmation(null)
    setOutcome('acted')
    setDurationMinutes('')
    setSummary('')
    setNote('')
    setError(null)
  }

  const restartContext = async (): Promise<void> => {
    if (!context) return
    setBusy(true)
    try {
      await window.myTracer.recordDrafts.review({
        kind: 'routine',
        contextId: context.recordingContextId
      })
      setContext({ ...context, continuityIssue: undefined })
      setInvalidContext(false)
      setError(null)
    } catch {
      setError('这次输入的对象暂不可用，请重新打开应用核对；输入不会被当作新的一笔重放。')
    } finally {
      setBusy(false)
    }
  }

  const save = async (dateChoice?: RoutineRecordingDateChoiceDto): Promise<void> => {
    if (!context || context.continuityIssue || operation.pending || operation.uncertain) return
    const actionOutcome = outcome === 'target_met' || outcome === 'acted'
    const parsedDuration = durationMinutes === '' ? null : Number(durationMinutes)
    if (
      actionOutcome &&
      parsedDuration !== null &&
      (!Number.isInteger(parsedDuration) || parsedDuration < 0)
    ) {
      setError('时长必须留空或填写非负整数分钟；0 表示不足一分钟但确有行动。')
      return
    }
    const submittedContextId = context.recordingContextId
    setBusy(true)
    const result = await session
      .trackRecordOperation(context.recordingContextId, () =>
        window.myTracer.routines.record({
          routineId: props.routineId,
          recordingContextId: context.recordingContextId,
          dateChoice,
          outcome,
          durationMinutes: actionOutcome ? parsedDuration : null,
          summary: summary.trim() ? summary : null,
          note: note.trim() ? note : null
        })
      )
      .catch(() => ({
        ok: false as const,
        error: { code: 'persistence-failed' as const, message: 'Save result unavailable.' }
      }))
    // Persistence belongs to the submitted operation, not the panel lifetime.
    // Selection can unmount this panel while Main is committing the record.
    if (result.ok && result.value.kind !== 'date-confirmation-required') {
      if (
        session.getRoutineDraft(props.routineId)?.context.recordingContextId === submittedContextId
      )
        session.clearRoutineDraft(props.routineId)
      if (!activeRef.current) {
        await props.onSaved?.()
        return
      }
    }
    if (!activeRef.current) return
    setBusy(false)
    if (!result.ok) {
      if (result.error.code === 'already-saved') {
        session.clearRoutineDraft(props.routineId)
        setContext(null)
        setSavedMessage('这笔已保存。')
        return
      }
      if (result.error.code === 'context-changed')
        setContext({ ...context, continuityIssue: 'changed' })
      setInvalidContext(result.error.code === 'invalid-recording-context')
      setError(routineRecordErrorText[result.error.code])
      return
    }
    if (result.value.kind === 'date-confirmation-required') {
      setDateConfirmation(result.value)
      setError(null)
      return
    }
    contextRef.current = null
    setContext(null)
    setDateConfirmation(null)
    setSavedMessage(
      `已保存：${routineRecordOutcomeText[result.value.record.outcome]} · ${result.value.record.occurredOn}`
    )
    requestAnimationFrame(() => revealStart(panelRef.current))
    dayRead.refresh()
    setError(null)
    await props.onSaved?.()
  }

  const displayedDayState = dayRead.data
  const state = displayedDayState?.recordState ?? 'unknown'
  if (operation.consumed && context) {
    setContext(null)
    setOutcome('acted')
    setDurationMinutes('')
    setSummary('')
    setNote('')
  }

  return (
    <section
      ref={panelRef}
      className="routine-recording-panel"
      aria-label={`${props.routineName} 例行记录`}
    >
      <div className="routine-record-state">
        <span>{props.routineName} · 记录</span>
        <strong>
          {dayRead.status === 'loading'
            ? '正在读取记录…'
            : dayRead.status === 'error'
              ? '记录状态暂时无法读取'
              : routineRecordOutcomeText[state]}
        </strong>
        {displayedDayState?.record ? (
          <small>
            {displayedDayState.record.occurredOn} ·{' '}
            {displayedDayState.record.plannedForDate ? '计划日记录' : '非计划日事实'}
            {displayedDayState.record.durationMinutes === null
              ? ''
              : ` · ${displayedDayState.record.durationMinutes} 分钟`}
          </small>
        ) : dayRead.status === 'ready' ? (
          <small>未记录表示情况未知，不等于未进行。</small>
        ) : null}
      </div>
      {dayRead.status === 'error' ? (
        <p role="alert">
          无法确认这一天是否已有记录。
          <button type="button" onClick={dayRead.refresh}>
            重试读取记录
          </button>
        </p>
      ) : null}
      {!context && dayRead.status === 'ready' && state === 'unknown' ? (
        <button
          ref={beginRef}
          className="primary-button"
          type="button"
          disabled={busy || props.disabled}
          onClick={() => void begin()}
        >
          记录例行
        </button>
      ) : null}
      {savedMessage ? (
        <p className="success-message" role="status">
          {savedMessage}
        </p>
      ) : null}
      {context ? (
        <form
          className="routine-recording-form"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <RecordContinuityNotice
            kind="routine"
            context={context}
            onReconciled={async (result) => {
              if (result.state !== 'saved') return
              setSavedMessage(`这笔已保存 · ${result.occurredOn}`)
              try {
                const current = await window.myTracer.routines.getDayState({
                  routineId: props.routineId,
                  localDate: result.occurredOn
                })
                if (current.ok) dayRead.refresh()
                else setError('这笔已保存，但对象已不可用。请重新打开例行查看。')
                await props.onSaved?.()
              } catch {
                setError('这笔已保存，但列表刷新失败。请重新打开例行查看。')
              }
            }}
            onReviewed={() => setContext({ ...context, continuityIssue: undefined })}
          />
          <fieldset
            className="recording-fields"
            disabled={busy || operation.pending || operation.uncertain}
          >
            <p>记录日期： {context.capturedOn}</p>
            <label>
              本次结果
              <select
                value={outcome}
                onChange={(event) => setOutcome(event.target.value as RoutineRecordOutcomeDto)}
              >
                <option value="target_met">达到目标</option>
                <option value="acted">有所行动</option>
                <option value="intentional_rest">主动休息</option>
                <option value="not_done">未进行</option>
              </select>
            </label>
            {outcome === 'target_met' || outcome === 'acted' ? (
              <label>
                投入时长（分钟，可选）
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={durationMinutes}
                  onChange={(event) => setDurationMinutes(event.target.value)}
                />
                <small>留空表示未记录时长；0 表示不足 1 分钟但确有行动。</small>
              </label>
            ) : null}
            <RecordSummaryInput value={summary} onChange={setSummary} />
            <RecordNoteInput value={note} onChange={setNote} />
            {dateConfirmation ? (
              <div className="date-confirmation" role="alertdialog" aria-label="确认例行记录发生日">
                <p>
                  保存时已经跨日。请选择保留开始日 {dateConfirmation.capturedOn}，或使用当前日{' '}
                  {dateConfirmation.currentLocalDate}。
                </p>
                <button
                  type="button"
                  disabled={busy || operation.pending}
                  onClick={() => void save('keep-captured-on')}
                >
                  保留开始日
                </button>
                <button
                  type="button"
                  disabled={busy || operation.pending}
                  onClick={() => void save('use-current-on')}
                >
                  使用当前日
                </button>
              </div>
            ) : null}
            <div className="recording-actions">
              <button
                className="primary-button"
                type="submit"
                disabled={
                  busy || operation.pending || operation.uncertain || Boolean(dateConfirmation)
                }
              >
                保存例行记录
              </button>
              <button
                type="button"
                disabled={busy || operation.pending}
                onClick={() => void cancel()}
              >
                放弃草稿
              </button>
              {invalidContext ? (
                <button
                  className="secondary-button"
                  type="button"
                  disabled={busy || operation.pending}
                  onClick={() => void restartContext()}
                >
                  保留内容并重新开始记录
                </button>
              ) : null}
            </div>
          </fieldset>
        </form>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}

function RoutineWorkspace(): ReactNode {
  const session = useUiSession()
  const editor = session.routineEditor
  const edit = useSyncExternalStore(editor.subscribe, editor.getSnapshot)
  const activeRef = useUiLifetime()
  const detail = edit?.detail ?? null
  const editName = edit?.name ?? ''
  const editDescription = edit?.description ?? ''
  const editMinimumAction = edit?.minimumAction ?? ''
  const editWeekdays = edit?.weekdays ?? []
  const [pendingSwitch, setPendingSwitch] = useState<string | 'create' | null>(null)
  const [discardRequested, setDiscardRequested] = useState(false)
  const [verified, setVerified] = useState(false)
  const editable = verified && edit?.availability === 'ready'
  const blocked = !editable || Boolean(edit?.pending)
  const editTriggerRef = useRef<HTMLElement | null>(null)
  const [masterCollapsed, setMasterCollapsed] = useState(false)
  const expandMasterRef = useRef<HTMLButtonElement | null>(null)
  const collapseMasterRef = useRef<HTMLButtonElement | null>(null)
  const didToggleMaster = useRef(false)
  useEffect(() => {
    if (!didToggleMaster.current) return
    ;(masterCollapsed ? expandMasterRef : collapseMasterRef).current?.focus({ preventScroll: true })
  }, [masterCollapsed])
  const [listQuery, setListQuery] = useState('')
  const searchRef = useRef<HTMLInputElement | null>(null)
  const [listPage, updateListPage] = useState(() => session.getListPage('routines', 'master'))
  const setListPage = (page: number): void => {
    session.setListPage('routines', 'master', page)
    updateListPage(page)
  }

  const [loaded, setLoaded] = useState(false)
  const [selectionLoaded, setSelectionLoaded] = useState(!session.routineId)
  usePagePosition('routines', loaded && selectionLoaded)
  const [routines, setRoutines] = useState<readonly RoutineSummaryDto[]>([])
  const [goals, setGoals] = useState<readonly GoalSummaryDto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const createRevision = useRef(0)
  const [createName, setCreateName] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [createMinimumAction, setCreateMinimumAction] = useState('')
  const [createGoalId, setCreateGoalId] = useState('')
  const [createMode, setCreateMode] = useState<'weekly' | 'unscheduled'>('weekly')
  const [createWeekdays, setCreateWeekdays] = useState<readonly number[]>([1, 2, 3, 4, 5])
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [creating, setCreating] = useState<boolean | null>(null)
  const createOpen = creating ?? (loaded && routines.length === 0 && !detail)
  useUnsavedContent(
    'routine-form',
    Boolean(
      createName ||
      createDescription ||
      createMinimumAction ||
      createGoalId ||
      createMode !== 'weekly' ||
      createWeekdays.join(',') !== '1,2,3,4,5'
    ) ||
      (detail !== null &&
        (editName !== detail.name ||
          editDescription !== (detail.description ?? '') ||
          editMinimumAction !== detail.minimumAction ||
          edit?.arrangementMode !== detail.arrangementMode ||
          editWeekdays.join(',') !== detail.weekdays.join(',')))
  )

  const readRoutine = async (routineId: string): Promise<void> => {
    const sequence = editor.beginRead()
    setVerified(false)
    try {
      const result = await window.myTracer.routines.getDetail({ routineId })
      if (!activeRef.current) return
      if (result.ok) {
        if (!editor.acceptRead(sequence, result.value, routineId)) return
        session.selectRoutine(routineId)
        setVerified(true)
        setConfirmEnd(false)
        setError(null)
      } else {
        if (!editor.failRead(sequence, result.error.code === 'not-found', routineId)) return
        setError(routineErrorText[result.error.code])
        if (result.error.code === 'not-found' && !editor.getSnapshot()) session.selectRoutine(null)
      }
    } catch {
      if (!activeRef.current) return
      if (!editor.failRead(sequence, false, routineId)) return
      setError('例行详情暂时无法读取；未保存输入仍保留。')
    }
  }

  useEffect(() => {
    let active = true
    Promise.all([
      window.myTracer.routines.list({}),
      window.myTracer.goals.list({ status: null })
    ]).then(([routineResult, goalResult]) => {
      if (!active) return
      if (!routineResult.ok) {
        setError(routineErrorText[routineResult.error.code])
        return
      }
      if (!goalResult.ok) {
        setError(goalErrorText[goalResult.error.code])
        return
      }
      setLoaded(true)
      setRoutines(routineResult.value)
      setGoals(goalResult.value)
      setError(null)
    })
    return () => {
      active = false
    }
  }, [refreshVersion])

  useEffect(() => {
    if (!loaded) return
    let active = true
    void Promise.resolve(editor.waitForSave()).then(async () => {
      if (!active) return
      const routineId = editor.getSnapshot()?.detail.id ?? session.routineId
      if (routineId) {
        const sequence = editor.beginRead()
        try {
          const result = await window.myTracer.routines.getDetail({ routineId })
          if (!active) return
          if (result.ok && editor.acceptRead(sequence, result.value, routineId)) {
            session.selectRoutine(routineId)
            setVerified(true)
            setError(null)
          } else if (!result.ok) {
            if (!editor.failRead(sequence, result.error.code === 'not-found', routineId)) return
            if (!editor.getSnapshot() && result.error.code === 'not-found')
              session.selectRoutine(null)
            setError(routineErrorText[result.error.code])
          }
        } catch {
          if (active) {
            if (!editor.failRead(sequence, false, routineId)) return
            setError('例行详情暂时无法读取；未保存输入仍保留。')
          }
        }
      }
      if (active) setSelectionLoaded(true)
    })
    return () => {
      active = false
      editor.invalidateRead()
    }
  }, [loaded, editor, session])

  const refreshList = async (): Promise<void> => {
    const result = await window.myTracer.routines.list({})
    if (!activeRef.current) return
    if (result.ok) setRoutines(result.value)
    else setError(routineErrorText[result.error.code])
  }

  const submitCreate = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const sequence = editor.beginRead(false)
    const submittedRevision = createRevision.current
    setBusy(true)
    const result = await window.myTracer.routines.create({
      goalId: createGoalId || null,
      name: createName,
      description: createDescription || null,
      minimumAction: createMinimumAction,
      arrangementMode: createMode,
      weekdays: createMode === 'unscheduled' ? [] : createWeekdays
    })
    if (!activeRef.current) return
    setBusy(false)
    if (!result.ok) {
      setError(routineErrorText[result.error.code])
      return
    }
    // Acknowledge the write even if a later selection superseded this request.
    // Only the submitted form revision can be cleared; newer input belongs to the user.
    if (createRevision.current === submittedRevision) {
      setCreateName('')
      setCreateDescription('')
      setCreateMinimumAction('')
      setCreateGoalId('')
      setCreateMode('weekly')
      setCreateWeekdays([1, 2, 3, 4, 5])
      setCreating(false)
    }
    if (editor.acceptRead(sequence, result.value)) {
      session.selectRoutine(result.value.id)
      setVerified(true)
    }
    await refreshList()
    setRefreshVersion((version) => version + 1)
  }

  const saveEdit = async (
    part: 'content' | 'schedule' | 'status',
    status?: 'pause' | 'resume' | 'end'
  ): Promise<void> => {
    if (blocked) return
    const token = editor.beginSave(part)
    if (!token) return
    const value = token.state
    try {
      const result =
        part === 'content'
          ? await window.myTracer.routines.updateDetails({
              routineId: value.detail.id,
              name: value.name,
              description: value.description || null,
              minimumAction: value.minimumAction
            })
          : part === 'schedule'
            ? await window.myTracer.routines.replaceSchedule({
                routineId: value.detail.id,
                arrangementMode: value.arrangementMode,
                weekdays: value.arrangementMode === 'unscheduled' ? [] : value.weekdays
              })
            : await window.myTracer.routines[status!]({ routineId: value.detail.id })
      editor.finishSave(
        token,
        result.ok ? result.value : undefined,
        !result.ok && result.error.code === 'not-found'
      )
      if (!activeRef.current) return
      setConfirmEnd(false)
      if (!result.ok) {
        setError(routineErrorText[result.error.code])
        return
      }
      setError(null)
      await refreshList()
    } catch {
      editor.finishSave(token)
      if (activeRef.current) setError('暂时无法保存；未保存输入仍保留，请确认后重试。')
    }
  }
  const submitDetails = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    await saveEdit('content')
  }
  const replaceSchedule = (): Promise<void> => saveEdit('schedule')
  const transition = (kind: 'pause' | 'resume' | 'end'): Promise<void> => saveEdit('status', kind)

  const openRoutine = async (routineId: string): Promise<void> => {
    if (editor.getSnapshot()?.pending) return
    if (detail?.id !== routineId && editor.hasDraft()) {
      setPendingSwitch(routineId)
      return
    }
    await readRoutine(routineId)
  }
  const confirmDiscard = (): void => {
    editor.discard()
    setDiscardRequested(false)
    const destination = pendingSwitch
    setPendingSwitch(null)
    if (destination === 'create') setCreating(true)
    else if (destination) void readRoutine(destination)
    else if (!editor.getSnapshot()) {
      session.selectRoutine(null)
      setVerified(false)
    } else editTriggerRef.current?.focus()
  }

  const filteredItems = routines.filter((item) =>
    item.name.toLocaleLowerCase().includes(listQuery.trim().toLocaleLowerCase())
  )
  const listPageCount = Math.max(1, Math.ceil(filteredItems.length / 6))
  const currentListPage = Math.min(listPage, listPageCount)
  const pageItems = filteredItems.slice((currentListPage - 1) * 6, currentListPage * 6)

  const detailOutsideResults =
    detail !== null && !filteredItems.some((item) => item.id === detail.id)
  const detailOutsidePage = detail !== null && !pageItems.some((item) => item.id === detail.id)

  return (
    <section className="routine-workspace notebook-object-workspace" aria-label="例行管理">
      <UnavailableRecordInputs kind="routine" />
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {pendingSwitch || discardRequested ? (
        <div className="data-switch-warning" role="alert" aria-label="未保存的例行修改">
          <p>
            {edit?.availability === 'missing'
              ? '例行已不存在，不能保存。请先复制需要保留的文字，再决定是否放弃。'
              : '当前例行有未保存修改。先保存，或明确放弃后继续。'}
          </p>
          <button
            type="button"
            onClick={() => {
              setPendingSwitch(null)
              setDiscardRequested(false)
              editTriggerRef.current?.focus()
            }}
          >
            {edit?.availability === 'missing' ? '返回查看或复制' : '继续编辑当前例行'}
          </button>
          <button type="button" disabled={Boolean(edit?.pending)} onClick={confirmDiscard}>
            {pendingSwitch ? '放弃修改并切换' : '放弃修改'}
          </button>
        </div>
      ) : null}
      <div className={`goal-grid object-grid${masterCollapsed ? ' master-collapsed' : ''}`}>
        <aside className="goal-column object-master" aria-label="例行列表">
          <button
            className="object-expand"
            ref={expandMasterRef}
            type="button"
            aria-label="展开例行列表"
            onClick={() => {
              didToggleMaster.current = true
              setMasterCollapsed(false)
            }}
            hidden={!masterCollapsed}
          >
            ›
          </button>
          <div className="goal-card goal-list-card" hidden={masterCollapsed}>
            <div className="object-master-heading">
              <div className="object-heading-row">
                <h1>例行</h1>
                <button
                  type="button"
                  aria-label="收起例行列表"
                  ref={collapseMasterRef}
                  onClick={() => {
                    didToggleMaster.current = true
                    setMasterCollapsed(true)
                  }}
                >
                  ‹
                </button>
              </div>
              <div className="workspace-toolbar">
                <p className="workspace-count">
                  {routines.length
                    ? `${routines.length} 个例行 · 按自己的节奏继续`
                    : '从一个轻量、可重复的行动开始'}
                </p>
                <button
                  className="secondary-button create-disclosure-button"
                  type="button"
                  aria-expanded={createOpen}
                  onClick={() => {
                    if (!createOpen && editor.hasDraft()) setPendingSwitch('create')
                    else setCreating(!createOpen)
                  }}
                  disabled={Boolean(edit?.pending)}
                >
                  {createOpen ? '收起新建表单' : '新建例行'}
                </button>
              </div>

              <div className="routine-search-controls">
                <label className="object-search">
                  <span className="visually-hidden">搜索例行</span>
                  <input
                    ref={searchRef}
                    value={listQuery}
                    placeholder="搜索例行…"
                    onChange={(event) => {
                      setListQuery(event.target.value)
                      setListPage(1)
                    }}
                  />
                </label>

                {listQuery ? (
                  <button
                    type="button"
                    className="quiet-button routine-clear-search"
                    aria-label="清除例行搜索"
                    onClick={() => {
                      setListQuery('')
                      setListPage(1)
                      searchRef.current?.focus()
                    }}
                  >
                    清除
                  </button>
                ) : null}
              </div>
              <div className="card-heading">
                <p className="eyebrow">例行列表</p>
                <h2>我的例行</h2>
              </div>
            </div>
            <div className="object-master-scroll" data-scroll-key="master">
              <div className="goal-list">
                {filteredItems.length ? (
                  pageItems.map((routine) => (
                    <button
                      className={`goal-list-item${detail?.id === routine.id ? ' selected' : ''}`}
                      type="button"
                      key={routine.id}
                      onClick={() => {
                        setCreating(false)
                        void openRoutine(routine.id)
                      }}
                    >
                      <span>{routine.name}</span>
                      <small>
                        {routineStatusText[routine.status]} ·{' '}
                        {routine.arrangementMode === 'unscheduled'
                          ? '无固定安排'
                          : `周${routine.weekdays.join('、')}`}
                      </small>
                    </button>
                  ))
                ) : (
                  <p className="empty-copy">
                    {routines.length
                      ? '没有匹配的例行。试试其他关键词，或清除搜索。'
                      : '还没有例行。'}
                  </p>
                )}
              </div>
            </div>
            <div className="object-pager" aria-label="例行列表分页">
              <button
                type="button"
                disabled={currentListPage === 1}
                onClick={() => setListPage(currentListPage - 1)}
              >
                上一页
              </button>
              <span>
                {currentListPage} / {listPageCount} · {filteredItems.length} 项
              </span>
              <button
                type="button"
                disabled={currentListPage === listPageCount}
                onClick={() => setListPage(currentListPage + 1)}
              >
                下一页
              </button>
            </div>
          </div>
        </aside>

        <div
          className="goal-column object-detail-scroll"
          data-scroll-key="detail"
          aria-label="例行工作区"
        >
          {createOpen ? (
            <form
              className="goal-card goal-create workspace-form"
              aria-label="新建例行表单"
              onSubmit={(event) => void submitCreate(event)}
            >
              <div className="card-heading">
                <p className="eyebrow">新例行</p>
                <h2>留下一件想重复做的小事</h2>
              </div>
              <div className="workspace-form-fields">
                <label>
                  名称
                  <input
                    required
                    value={createName}
                    onChange={(event) => {
                      createRevision.current += 1
                      setCreateName(event.target.value)
                    }}
                  />
                </label>
                <label>
                  最小行动
                  <input
                    required
                    value={createMinimumAction}
                    onChange={(event) => {
                      createRevision.current += 1
                      setCreateMinimumAction(event.target.value)
                    }}
                  />
                </label>
                <label className="form-field-wide">
                  <span id="routine-create-description-label">说明（可选）</span>
                  <textarea
                    aria-labelledby="routine-create-description-label"
                    rows={2}
                    value={createDescription}
                    onChange={(event) => {
                      createRevision.current += 1
                      setCreateDescription(event.target.value)
                    }}
                  />
                </label>
                <label>
                  关联目标（可选，创建后不可改）
                  <select
                    value={createGoalId}
                    onChange={(event) => {
                      createRevision.current += 1
                      setCreateGoalId(event.target.value)
                    }}
                  >
                    <option value="">不关联目标</option>
                    {goals.map((goal) => (
                      <option key={goal.id} value={goal.id}>
                        {goal.name} · {goalStatusText[goal.status]}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="form-field-wide">
                  <ArrangementPicker
                    value={createMode}
                    disabled={busy}
                    onChange={(mode) => {
                      createRevision.current += 1
                      setCreateMode(mode)
                    }}
                  />
                  {createMode === 'weekly' ? (
                    <RoutineWeekdayPicker
                      label="每周安排"
                      value={createWeekdays}
                      onChange={(weekdays) => {
                        createRevision.current += 1
                        setCreateWeekdays(weekdays)
                      }}
                      disabled={busy}
                    />
                  ) : (
                    <p className="form-section-note">随时可记，不会自动成为每天的计划。</p>
                  )}
                </div>
              </div>
              <div className="workspace-form-actions">
                <button className="primary-button" type="submit" disabled={busy}>
                  创建例行
                </button>
                <button type="button" disabled={busy} onClick={() => setCreating(false)}>
                  收起表单
                </button>
                <span>创建后可继续调整内容和星期安排。</span>
              </div>
            </form>
          ) : null}
          <div className="object-selected-content" hidden={createOpen}>
            {detail ? (
              <article className="goal-card goal-detail" aria-label={`${detail.name} 例行详情`}>
                {detailOutsidePage ? (
                  <p className="routine-detail-context" role="status">
                    {detailOutsideResults
                      ? '当前详情不在搜索结果中。'
                      : '当前详情不在这一列表页中。'}
                    仍保留你正在查看的例行，选择列表中的其他例行才会切换。
                  </p>
                ) : null}
                <div className="detail-title-row">
                  <div>
                    <p className="eyebrow">
                      {detail.goal
                        ? `${detail.goal.name} · ${goalStatusText[detail.goal.status]}`
                        : '未关联目标'}
                    </p>
                    <h2>{detail.name}</h2>
                  </div>
                  <span className={`status-badge status-${detail.status}`}>
                    {routineStatusText[detail.status]}
                  </span>
                </div>

                <div className="routine-overview" aria-label="例行安排">
                  <div>
                    <span>最小行动</span>
                    <p>{detail.minimumAction}</p>
                  </div>
                  <div>
                    <span>安排</span>
                    <p>
                      {detail.arrangementMode === 'unscheduled'
                        ? '无固定安排'
                        : detail.weekdays.length === 7
                          ? '每天'
                          : `周${detail.weekdays.map((day) => weekdayOptions.find((option) => option.value === day)?.label).join('、')}`}
                    </p>
                  </div>
                  {detail.description ? (
                    <p className="form-field-wide routine-description">{detail.description}</p>
                  ) : null}
                </div>

                <RoutineRecordingPanel
                  key={detail.id}
                  routineId={detail.id}
                  routineName={detail.name}
                  disabled={detail.status !== 'active' || !editable}
                />

                {edit && (editor.hasDraft() || !editable) ? (
                  <div className="form-section-note" role="status">
                    <p>
                      {edit.availability === 'missing'
                        ? '例行已不存在。未保存输入仅供查看或复制，不能保存；不会重新创建例行。'
                        : !editable
                          ? '正在确认例行或暂时无法读取；未保存输入仍保留，确认前不能保存。'
                          : '未保存修改仅保留在当前应用会话；关闭应用后不保留。'}
                    </p>
                    {!editable && edit.availability !== 'missing' ? (
                      <button
                        type="button"
                        disabled={Boolean(edit.pending)}
                        onClick={() => void readRoutine(detail.id)}
                      >
                        重新读取例行
                      </button>
                    ) : null}
                    {editor.hasDraft() || edit.availability === 'missing' ? (
                      <button
                        type="button"
                        disabled={Boolean(edit.pending)}
                        onClick={() => setDiscardRequested(true)}
                      >
                        放弃未保存修改
                      </button>
                    ) : null}
                  </div>
                ) : null}
                <details className="disclosure">
                  <summary ref={editTriggerRef}>编辑内容和安排</summary>
                  <form className="detail-form" onSubmit={(event) => void submitDetails(event)}>
                    <label>
                      名称
                      <input
                        required
                        value={editName}
                        onChange={(event) => editor.editContent({ name: event.target.value })}
                        readOnly={!editable}
                      />
                    </label>
                    <label>
                      最小行动
                      <input
                        required
                        value={editMinimumAction}
                        onChange={(event) =>
                          editor.editContent({ minimumAction: event.target.value })
                        }
                        readOnly={!editable}
                      />
                    </label>
                    <label>
                      <span id="routine-edit-description-label">说明（可选）</span>
                      <textarea
                        aria-labelledby="routine-edit-description-label"
                        rows={3}
                        value={editDescription}
                        onChange={(event) =>
                          editor.editContent({ description: event.target.value })
                        }
                        readOnly={!editable}
                      />
                    </label>
                    <button className="secondary-button" type="submit" disabled={busy || blocked}>
                      保存内容修改
                    </button>
                  </form>

                  <div className="schedule-editor">
                    <p className="form-section-note">
                      安排与内容分别保存，另一处未保存的修改会保留；已有记录不受影响。
                    </p>
                    <ArrangementPicker
                      value={edit?.arrangementMode ?? detail.arrangementMode}
                      disabled={!editable}
                      onChange={(mode) =>
                        editor.editSchedule(mode === 'unscheduled' ? [] : editWeekdays, mode)
                      }
                    />
                    {edit?.arrangementMode === 'weekly' ? (
                      <RoutineWeekdayPicker
                        label="每周安排"
                        value={editWeekdays}
                        onChange={(days) => editor.editSchedule(days)}
                        disabled={!editable}
                      />
                    ) : (
                      <p className="form-section-note">
                        随时可记，不产生每日计划；已有记录的计划日依据保留。
                      </p>
                    )}
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={busy || blocked}
                      onClick={() => void replaceSchedule()}
                    >
                      保存安排
                    </button>
                  </div>
                </details>

                <div className="lifecycle-actions">
                  {detail.status === 'active' ? (
                    <button
                      className="warning-button"
                      type="button"
                      disabled={busy || blocked}
                      onClick={() => void transition('pause')}
                    >
                      暂停
                    </button>
                  ) : null}
                  {detail.status === 'paused' ? (
                    <button
                      type="button"
                      disabled={busy || blocked}
                      onClick={() => void transition('resume')}
                    >
                      恢复
                    </button>
                  ) : null}
                  {detail.status !== 'ended' ? (
                    <button
                      className="danger-button"
                      type="button"
                      disabled={busy || blocked}
                      onClick={() => setConfirmEnd(true)}
                    >
                      结束例行
                    </button>
                  ) : null}
                </div>
                {confirmEnd ? (
                  <div className="inline-confirm" role="alertdialog" aria-label="确认结束例行">
                    <p>结束后不能恢复；已有历史会保留。</p>
                    <div className="lifecycle-actions">
                      <button
                        className="danger-button"
                        type="button"
                        disabled={busy || blocked}
                        onClick={() => void transition('end')}
                      >
                        确认结束
                      </button>
                      <button
                        type="button"
                        disabled={busy || blocked}
                        onClick={() => setConfirmEnd(false)}
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : null}
                {detail.status === 'ended' ? (
                  <p className="empty-copy">
                    这个例行已结束且不能恢复；当前内容、节奏与历史仍会保留。
                  </p>
                ) : null}
              </article>
            ) : (
              <section className="goal-card empty-detail" aria-label="例行详情占位">
                <p className="eyebrow">选择一个例行</p>
                <h2>查看节奏、目标状态与生命周期</h2>
                <p>星期安排只决定今天是否匹配，不会预生成任何记录。</p>
              </section>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export { RoutineWorkspace as RoutinesPage }
