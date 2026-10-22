import '../forms-workspace.css'
import '../object-workspace.css'
import {
  revealStart,
  usePagePosition,
  useUiLifetime,
  useUiSession,
  useUnsavedContent
} from '../../app/ui-session'
import { goalStatusText, routineRecordOutcomeText } from '../../app/ui-text'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import type { GoalErrorCode, GoalSummaryDto } from '../../../../contracts/goals'
import type {
  RoutineDetailDto,
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
  validation: '请检查记录内容；行动时长需为非负整数分钟。',
  'not-found': '例行已不存在，请刷新后重试。',
  'invalid-transition': '只有活跃例行可以新增记录。',
  'invariant-violation': '当前例行记录关系不可用。',
  'record-already-exists': '这个例行在所选日期已经有记录；不会覆盖已有事实。',
  'invalid-recording-context': '这次记录连接已失效；草稿内容仍在，可以重新开始后继续保存。',
  'persistence-failed': '本地例行记录暂时无法保存或读取。'
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
  const [restoredNotice, setRestoredNotice] = useState(Boolean(restoredDraft))
  const panelRef = useRef<HTMLElement | null>(null)
  const beginRef = useRef<HTMLButtonElement | null>(null)
  const restoreBeginFocus = useRef(false)
  const [savedMessage, setSavedMessage] = useState('')
  const [context, setContext] = useState<BeginRoutineRecordingDto | null>(
    restoredDraft?.context ?? null
  )
  const contextRef = useRef<BeginRoutineRecordingDto | null>(restoredDraft?.context ?? null)
  const [dayState, setDayState] = useState<RoutineDayStateDto | null>(props.initialState ?? null)
  const [outcome, setOutcome] = useState<RoutineRecordOutcomeDto>(restoredDraft?.outcome ?? 'acted')
  const [durationMinutes, setDurationMinutes] = useState(restoredDraft?.durationMinutes ?? '')
  const [note, setNote] = useState(restoredDraft?.note ?? '')
  const [dateConfirmation, setDateConfirmation] = useState<{
    readonly capturedOn: string
    readonly currentLocalDate: string
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invalidContext, setInvalidContext] = useState(false)
  useUnsavedContent(`routine-record-${props.routineId}`, Boolean(context))

  useEffect(() => {
    if (!context) return
    session.setRoutineDraft(props.routineId, { context, outcome, durationMinutes, note })
  }, [context, durationMinutes, note, outcome, props.routineId, session])

  useEffect(() => {
    if (!context) {
      if (restoreBeginFocus.current) {
        restoreBeginFocus.current = false
        revealStart(panelRef.current)
        beginRef.current?.focus({ preventScroll: true })
      }
      return
    }
    revealStart(panelRef.current)
    panelRef.current?.querySelector<HTMLSelectElement>('select')?.focus({ preventScroll: true })
  }, [context])

  useEffect(() => {
    return () => {
      contextRef.current = null
    }
  }, [props.routineId])

  const begin = async (): Promise<void> => {
    setBusy(true)
    const result = await window.myTracer.routines.beginRecording({ routineId: props.routineId })
    if (!activeRef.current) {
      if (result.ok)
        await window.myTracer.routines.cancelRecording({
          recordingContextId: result.value.recordingContextId
        })
      return
    }
    setBusy(false)
    if (!result.ok) {
      setError(routineRecordErrorText[result.error.code])
      return
    }
    setSavedMessage('')
    contextRef.current = result.value
    setContext(result.value)
    session.setRoutineDraft(props.routineId, {
      context: result.value,
      outcome,
      durationMinutes,
      note
    })
    setInvalidContext(false)
    const stateResult = await window.myTracer.routines.getDayState({
      routineId: props.routineId,
      localDate: result.value.capturedOn
    })
    if (!activeRef.current) return
    if (stateResult.ok) {
      setDayState(stateResult.value)
      if (stateResult.value.record) {
        await window.myTracer.routines.cancelRecording({
          recordingContextId: result.value.recordingContextId
        })
        contextRef.current = null
        setContext(null)
        session.clearRoutineDraft(props.routineId)
      }
    }
    setError(null)
  }

  const cancel = async (): Promise<void> => {
    if (!context) return
    setBusy(true)
    const result = await window.myTracer.routines.cancelRecording({
      recordingContextId: context.recordingContextId
    })
    if (!activeRef.current) return
    setBusy(false)
    if (!result.ok) {
      if (result.error.code === 'invalid-recording-context') {
        setRestoredNotice(false)
        session.clearRoutineDraft(props.routineId)
        contextRef.current = null
        setContext(null)
        setSavedMessage('已放弃未保存草稿。')
        setInvalidContext(false)
        setError(null)
        return
      }
      setError(routineRecordErrorText[result.error.code])
      return
    }
    restoreBeginFocus.current = true
    setRestoredNotice(false)
    contextRef.current = null
    setContext(null)
    session.clearRoutineDraft(props.routineId)
    setDateConfirmation(null)
    setOutcome('acted')
    setDurationMinutes('')
    setNote('')
    setError(null)
  }

  const restartContext = async (): Promise<void> => {
    setBusy(true)
    const result = await window.myTracer.routines.beginRecording({ routineId: props.routineId })
    if (!activeRef.current) return
    setBusy(false)
    if (!result.ok) {
      setError(routineRecordErrorText[result.error.code])
      return
    }
    contextRef.current = result.value
    setContext(result.value)
    setInvalidContext(false)
    setError(null)
  }

  const save = async (dateChoice?: RoutineRecordingDateChoiceDto): Promise<void> => {
    if (!context) return
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
    setBusy(true)
    const result = await window.myTracer.routines.record({
      routineId: props.routineId,
      recordingContextId: context.recordingContextId,
      dateChoice,
      outcome,
      durationMinutes: actionOutcome ? parsedDuration : null,
      note: note.trim() || null
    })
    if (!activeRef.current) return
    setBusy(false)
    if (!result.ok) {
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
    setRestoredNotice(false)
    setContext(null)
    session.clearRoutineDraft(props.routineId)
    setDateConfirmation(null)
    setSavedMessage(
      `已保存：${routineRecordOutcomeText[result.value.record.outcome]} · ${result.value.record.occurredOn}`
    )
    requestAnimationFrame(() => revealStart(panelRef.current))
    setDayState({
      routineId: props.routineId,
      localDate: result.value.record.occurredOn,
      plannedByCurrentSchedule: result.value.record.plannedForDate,
      recordState: result.value.record.outcome,
      record: result.value.record
    })
    setError(null)
    await props.onSaved?.()
  }

  const displayedDayState = props.initialState ?? dayState
  const state = displayedDayState?.recordState ?? 'unknown'
  return (
    <section
      ref={panelRef}
      className="routine-recording-panel"
      aria-label={`${props.routineName} 例行记录`}
    >
      <div className="routine-record-state">
        <span>{props.routineName} · 记录</span>
        <strong>{routineRecordOutcomeText[state]}</strong>
        {displayedDayState?.record ? (
          <small>
            {displayedDayState.record.occurredOn} ·{' '}
            {displayedDayState.record.plannedForDate ? '计划日记录' : '非计划日事实'}
            {displayedDayState.record.durationMinutes === null
              ? ''
              : ` · ${displayedDayState.record.durationMinutes} 分钟`}
          </small>
        ) : (
          <small>未记录表示情况未知，不等于未进行。</small>
        )}
      </div>
      {!context && state === 'unknown' ? (
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
          <fieldset className="recording-fields" disabled={busy}>
            <p className="draft-notice" role="status">
              {restoredNotice
                ? '未保存的例行记录草稿已恢复。它仍未写入记录，你可以继续填写、保存或放弃。'
                : '未保存草稿会在本次应用会话中保留，直到你保存或明确放弃。'}
            </p>
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
            <label>
              备注（可选）
              <textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
            </label>
            {dateConfirmation ? (
              <div className="date-confirmation" role="alertdialog" aria-label="确认例行记录发生日">
                <p>
                  保存时已经跨日。请选择保留开始日 {dateConfirmation.capturedOn}，或使用当前日{' '}
                  {dateConfirmation.currentLocalDate}。
                </p>
                <button type="button" disabled={busy} onClick={() => void save('keep-captured-on')}>
                  保留开始日
                </button>
                <button type="button" disabled={busy} onClick={() => void save('use-current-on')}>
                  使用当前日
                </button>
              </div>
            ) : null}
            <div className="recording-actions">
              <button
                className="primary-button"
                type="submit"
                disabled={busy || Boolean(dateConfirmation)}
              >
                保存例行记录
              </button>
              <button type="button" disabled={busy} onClick={() => void cancel()}>
                放弃草稿
              </button>
              {invalidContext ? (
                <button
                  className="secondary-button"
                  type="button"
                  disabled={busy}
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
  const [masterCollapsed, setMasterCollapsed] = useState(false)
  const expandMasterRef = useRef<HTMLButtonElement | null>(null)
  const collapseMasterRef = useRef<HTMLButtonElement | null>(null)
  const didToggleMaster = useRef(false)
  useEffect(() => {
    if (!didToggleMaster.current) return
    ;(masterCollapsed ? expandMasterRef : collapseMasterRef).current?.focus({ preventScroll: true })
  }, [masterCollapsed])
  const [listQuery, setListQuery] = useState('')
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
  const [detail, setDetail] = useState<RoutineDetailDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [createName, setCreateName] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [createMinimumAction, setCreateMinimumAction] = useState('')
  const [createGoalId, setCreateGoalId] = useState('')
  const [createWeekdays, setCreateWeekdays] = useState<readonly number[]>([1, 2, 3, 4, 5])
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editMinimumAction, setEditMinimumAction] = useState('')
  const [editWeekdays, setEditWeekdays] = useState<readonly number[]>([])
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [creating, setCreating] = useState<boolean | null>(null)
  const createOpen = creating ?? (loaded && routines.length === 0)
  useUnsavedContent(
    'routine-form',
    Boolean(
      createName ||
      createDescription ||
      createMinimumAction ||
      createGoalId ||
      createWeekdays.join(',') !== '1,2,3,4,5'
    ) ||
      (detail !== null &&
        (editName !== detail.name ||
          editDescription !== (detail.description ?? '') ||
          editMinimumAction !== detail.minimumAction ||
          editWeekdays.join(',') !== detail.weekdays.join(',')))
  )

  const showDetail = (
    routine: RoutineDetailDto,
    savedSection: 'all' | 'content' | 'schedule' = 'all'
  ): void => {
    session.selectRoutine(routine.id)
    setDetail(routine)
    // A section save must not discard the other section's unsaved input.
    if (savedSection !== 'schedule') {
      setEditName(routine.name)
      setEditDescription(routine.description ?? '')
      setEditMinimumAction(routine.minimumAction)
    }
    if (savedSection !== 'content') setEditWeekdays(routine.weekdays)
    setConfirmEnd(false)
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
    const routineId = session.routineId
    if (!routineId || detail?.id === routineId) {
      Promise.resolve().then(() => {
        if (active) setSelectionLoaded(true)
      })
    } else {
      void window.myTracer.routines
        .getDetail({ routineId })
        .then((result) => {
          if (!active || session.routineId !== routineId) return
          if (result.ok) {
            const routine = result.value
            setDetail(routine)
            setEditName(routine.name)
            setEditDescription(routine.description ?? '')
            setEditMinimumAction(routine.minimumAction)
            setEditWeekdays(routine.weekdays)
            setConfirmEnd(false)
          } else {
            if (result.error.code === 'not-found') session.selectRoutine(null)
            setError(routineErrorText[result.error.code])
          }
          setSelectionLoaded(true)
        })
        .catch(() => {
          if (!active) return
          setError('例行详情暂时无法读取，请稍后重试。')
          setSelectionLoaded(true)
        })
    }
    return () => {
      active = false
    }
  }, [detail?.id, loaded, session])

  const refresh = async (
    routineId?: string,
    savedSection: 'all' | 'content' | 'schedule' = 'all'
  ): Promise<void> => {
    const listResult = await window.myTracer.routines.list({})
    if (!listResult.ok) {
      setError(routineErrorText[listResult.error.code])
      return
    }
    setRoutines(listResult.value)
    if (routineId) {
      const detailResult = await window.myTracer.routines.getDetail({ routineId })
      if (!detailResult.ok) {
        setError(routineErrorText[detailResult.error.code])
        return
      }
      showDetail(detailResult.value, savedSection)
    }
    setError(null)
  }

  const submitCreate = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setBusy(true)
    const result = await window.myTracer.routines.create({
      goalId: createGoalId || null,
      name: createName,
      description: createDescription || null,
      minimumAction: createMinimumAction,
      weekdays: createWeekdays
    })
    setBusy(false)
    if (!result.ok) {
      setError(routineErrorText[result.error.code])
      return
    }
    setCreateName('')
    setCreateDescription('')
    setCreateMinimumAction('')
    setCreateGoalId('')
    setCreateWeekdays([1, 2, 3, 4, 5])
    setCreating(false)
    showDetail(result.value)
    await refresh(result.value.id)
    setRefreshVersion((version) => version + 1)
  }

  const submitDetails = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (!detail) return
    setBusy(true)
    const result = await window.myTracer.routines.updateDetails({
      routineId: detail.id,
      name: editName,
      description: editDescription || null,
      minimumAction: editMinimumAction
    })
    setBusy(false)
    if (!result.ok) {
      setError(routineErrorText[result.error.code])
      return
    }
    await refresh(detail.id, 'content')
  }

  const replaceSchedule = async (): Promise<void> => {
    if (!detail) return
    setBusy(true)
    const result = await window.myTracer.routines.replaceSchedule({
      routineId: detail.id,
      weekdays: editWeekdays
    })
    setBusy(false)
    if (!result.ok) {
      setError(routineErrorText[result.error.code])
      return
    }
    await refresh(detail.id, 'schedule')
  }

  const transition = async (kind: 'pause' | 'resume' | 'end'): Promise<void> => {
    if (!detail) return
    setBusy(true)
    const result = await window.myTracer.routines[kind]({ routineId: detail.id })
    setBusy(false)
    setConfirmEnd(false)
    if (!result.ok) {
      setError(routineErrorText[result.error.code])
      return
    }
    await refresh(detail.id)
  }

  const openRoutine = async (routineId: string): Promise<void> => {
    const result = await window.myTracer.routines.getDetail({ routineId })
    if (!result.ok) {
      setError(routineErrorText[result.error.code])
      return
    }
    showDetail(result.value)
    setError(null)
  }

  const filteredItems = routines.filter((item) =>
    item.name.toLocaleLowerCase().includes(listQuery.trim().toLocaleLowerCase())
  )
  const listPageCount = Math.max(1, Math.ceil(filteredItems.length / 6))
  const currentListPage = Math.min(listPage, listPageCount)
  const pageItems = filteredItems.slice((currentListPage - 1) * 6, currentListPage * 6)

  return (
    <section className="routine-workspace notebook-object-workspace" aria-label="例行管理">
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
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
                  onClick={() => setCreating(!createOpen)}
                >
                  {createOpen ? '收起新建表单' : '新建例行'}
                </button>
              </div>

              <label className="object-search">
                <span className="visually-hidden">搜索例行</span>
                <input
                  value={listQuery}
                  placeholder="搜索例行…"
                  onChange={(event) => {
                    setListQuery(event.target.value)
                    setListPage(1)
                  }}
                />
              </label>

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
                        {routineStatusText[routine.status]} · 周{routine.weekdays.join('、')}
                        {session.hasRoutineDraft(routine.id) ? ' · 有未保存草稿' : ''}
                      </small>
                    </button>
                  ))
                ) : (
                  <p className="empty-copy">还没有例行。</p>
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
                <h2>定义一个最小行动和每周安排</h2>
              </div>
              <div className="workspace-form-fields">
                <label>
                  名称
                  <input
                    required
                    value={createName}
                    onChange={(event) => setCreateName(event.target.value)}
                  />
                </label>
                <label>
                  最小行动
                  <input
                    required
                    value={createMinimumAction}
                    onChange={(event) => setCreateMinimumAction(event.target.value)}
                  />
                </label>
                <label className="form-field-wide">
                  <span id="routine-create-description-label">说明（可选）</span>
                  <textarea
                    aria-labelledby="routine-create-description-label"
                    rows={2}
                    value={createDescription}
                    onChange={(event) => setCreateDescription(event.target.value)}
                  />
                </label>
                <label>
                  关联目标（可选，创建后不可改）
                  <select
                    value={createGoalId}
                    onChange={(event) => setCreateGoalId(event.target.value)}
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
                  <RoutineWeekdayPicker
                    label="每周安排"
                    value={createWeekdays}
                    onChange={setCreateWeekdays}
                    disabled={busy}
                  />
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
                    <span>每周安排</span>
                    <p>
                      {detail.weekdays.length === 7
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
                  disabled={detail.status !== 'active'}
                />

                <details className="disclosure">
                  <summary>编辑内容和每周安排</summary>
                  <form className="detail-form" onSubmit={(event) => void submitDetails(event)}>
                    <label>
                      名称
                      <input
                        required
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                      />
                    </label>
                    <label>
                      最小行动
                      <input
                        required
                        value={editMinimumAction}
                        onChange={(event) => setEditMinimumAction(event.target.value)}
                      />
                    </label>
                    <label>
                      <span id="routine-edit-description-label">说明（可选）</span>
                      <textarea
                        aria-labelledby="routine-edit-description-label"
                        rows={3}
                        value={editDescription}
                        onChange={(event) => setEditDescription(event.target.value)}
                      />
                    </label>
                    <button className="secondary-button" type="submit" disabled={busy}>
                      保存内容修改
                    </button>
                  </form>

                  <div className="schedule-editor">
                    <p className="form-section-note">
                      星期安排与内容分别保存，另一处未保存的修改会保留；已有记录不受影响。
                    </p>
                    <RoutineWeekdayPicker
                      label="每周安排"
                      value={editWeekdays}
                      onChange={setEditWeekdays}
                      disabled={busy}
                    />
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={busy}
                      onClick={() => void replaceSchedule()}
                    >
                      保存星期安排
                    </button>
                  </div>
                </details>

                <div className="lifecycle-actions">
                  {detail.status === 'active' ? (
                    <button
                      className="warning-button"
                      type="button"
                      disabled={busy}
                      onClick={() => void transition('pause')}
                    >
                      暂停
                    </button>
                  ) : null}
                  {detail.status === 'paused' ? (
                    <button type="button" disabled={busy} onClick={() => void transition('resume')}>
                      恢复
                    </button>
                  ) : null}
                  {detail.status !== 'ended' ? (
                    <button
                      className="danger-button"
                      type="button"
                      disabled={busy}
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
                        disabled={busy}
                        onClick={() => void transition('end')}
                      >
                        确认结束
                      </button>
                      <button type="button" disabled={busy} onClick={() => setConfirmEnd(false)}>
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
