import { type ReactNode, useEffect, useRef, useState } from 'react'
import type { GoalErrorCode, GoalStatusDto, GoalSummaryDto } from '../../../../contracts/goals'
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

const goalStatusText: Record<GoalStatusDto, string> = {
  active: '活跃',
  paused: '暂停',
  ended: '结束'
}

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
  'not-found': 'Routine 或关联目标已不存在，请刷新后重试。',
  'invalid-transition': '当前状态不能执行这个 Routine 操作。',
  'invariant-violation': '这个 Routine 当前不允许该操作。',
  'persistence-failed': '本地 Routine 数据暂时无法保存或读取。'
}

const routineRecordErrorText: Record<RoutineRecordErrorCode, string> = {
  validation: '请检查记录内容；行动时长需为非负整数分钟。',
  'not-found': 'Routine 已不存在，请刷新后重试。',
  'invalid-transition': '只有活跃 Routine 可以新增记录。',
  'invariant-violation': '当前 Routine 记录关系不可用。',
  'record-already-exists': '这个 Routine 在所选日期已经有记录；不会覆盖已有事实。',
  'invalid-recording-context': '这次记录表单已失效，请重新开始记录。',
  'persistence-failed': '本地 Routine 记录暂时无法保存或读取。'
}

const routineRecordOutcomeText: Record<RoutineRecordOutcomeDto | 'unknown', string> = {
  target_met: '达到目标',
  acted: '有真实行动',
  intentional_rest: '有意休息',
  not_done: '明确未做',
  unknown: '尚无记录'
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
  const [context, setContext] = useState<BeginRoutineRecordingDto | null>(null)
  const contextRef = useRef<BeginRoutineRecordingDto | null>(null)
  const [dayState, setDayState] = useState<RoutineDayStateDto | null>(props.initialState ?? null)
  const [outcome, setOutcome] = useState<RoutineRecordOutcomeDto>('acted')
  const [durationMinutes, setDurationMinutes] = useState('')
  const [note, setNote] = useState('')
  const [dateConfirmation, setDateConfirmation] = useState<{
    readonly capturedOn: string
    readonly currentLocalDate: string
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      const activeContext = contextRef.current
      if (activeContext) {
        void window.myTracer.routines.cancelRecording({
          recordingContextId: activeContext.recordingContextId
        })
      }
    }
  }, [props.routineId])

  const begin = async (): Promise<void> => {
    setBusy(true)
    const result = await window.myTracer.routines.beginRecording({ routineId: props.routineId })
    setBusy(false)
    if (!result.ok) {
      setError(routineRecordErrorText[result.error.code])
      return
    }
    contextRef.current = result.value
    setContext(result.value)
    const stateResult = await window.myTracer.routines.getDayState({
      routineId: props.routineId,
      localDate: result.value.capturedOn
    })
    if (stateResult.ok) {
      setDayState(stateResult.value)
      if (stateResult.value.record) {
        await window.myTracer.routines.cancelRecording({
          recordingContextId: result.value.recordingContextId
        })
        contextRef.current = null
        setContext(null)
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
    setBusy(false)
    if (!result.ok) {
      setError(routineRecordErrorText[result.error.code])
      return
    }
    contextRef.current = null
    setContext(null)
    setDateConfirmation(null)
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
    setBusy(false)
    if (!result.ok) {
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
    <section className="routine-recording-panel" aria-label={`${props.routineName} Routine 记录`}>
      <div className="routine-record-state">
        <span>当前日期事实</span>
        <strong>{routineRecordOutcomeText[state]}</strong>
        {displayedDayState?.record ? (
          <small>
            {displayedDayState.record.occurredOn} ·{' '}
            {displayedDayState.record.plannedForDate ? '计划日快照' : '非计划日事实'}
            {displayedDayState.record.durationMinutes === null
              ? ''
              : ` · ${displayedDayState.record.durationMinutes} 分钟`}
          </small>
        ) : (
          <small>缺少记录保持 unknown，不会自动记为未做。</small>
        )}
      </div>
      {!context && state === 'unknown' ? (
        <button type="button" disabled={busy || props.disabled} onClick={() => void begin()}>
          记录 Routine
        </button>
      ) : null}
      {context ? (
        <form
          className="routine-recording-form"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <p>发生日期固定为 {context.capturedOn}</p>
          <label>
            本次结果
            <select
              value={outcome}
              onChange={(event) => setOutcome(event.target.value as RoutineRecordOutcomeDto)}
            >
              <option value="target_met">达到目标</option>
              <option value="acted">有真实行动</option>
              <option value="intentional_rest">有意休息</option>
              <option value="not_done">明确未做</option>
            </select>
          </label>
          {outcome === 'target_met' || outcome === 'acted' ? (
            <label>
              行动分钟（可空）
              <input
                type="number"
                min="0"
                step="1"
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(event.target.value)}
              />
            </label>
          ) : null}
          <label>
            备注（可选）
            <textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          {dateConfirmation ? (
            <div
              className="date-confirmation"
              role="alertdialog"
              aria-label="确认 Routine 记录发生日"
            >
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
              保存 Routine 记录
            </button>
            <button type="button" disabled={busy} onClick={() => void cancel()}>
              取消
            </button>
          </div>
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

  const showDetail = (routine: RoutineDetailDto): void => {
    setDetail(routine)
    setEditName(routine.name)
    setEditDescription(routine.description ?? '')
    setEditMinimumAction(routine.minimumAction)
    setEditWeekdays(routine.weekdays)
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
      setRoutines(routineResult.value)
      setGoals(goalResult.value)
      setError(null)
    })
    return () => {
      active = false
    }
  }, [refreshVersion])

  const refresh = async (routineId?: string): Promise<void> => {
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
      showDetail(detailResult.value)
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
    await refresh(detail.id)
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
    await refresh(detail.id)
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

  return (
    <section className="routine-workspace" aria-label="Routine 管理">
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="goal-grid">
        <div className="goal-column">
          <form className="goal-card goal-create" onSubmit={(event) => void submitCreate(event)}>
            <div className="card-heading">
              <p className="eyebrow">新 Routine</p>
              <h2>定义一个最小行动和星期节奏</h2>
            </div>
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
            <label>
              说明（可选）
              <textarea
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
            <RoutineWeekdayPicker
              label="计划星期"
              value={createWeekdays}
              onChange={setCreateWeekdays}
              disabled={busy}
            />
            <button className="primary-button" type="submit" disabled={busy}>
              创建 Routine
            </button>
          </form>

          <div className="goal-card goal-list-card">
            <div className="card-heading">
              <p className="eyebrow">Routine 列表</p>
              <h2>暂停与结束的项目仍保留</h2>
            </div>
            <div className="goal-list">
              {routines.length ? (
                routines.map((routine) => (
                  <button
                    className={`goal-list-item${detail?.id === routine.id ? ' selected' : ''}`}
                    type="button"
                    key={routine.id}
                    onClick={() => void openRoutine(routine.id)}
                  >
                    <span>{routine.name}</span>
                    <small>
                      {routineStatusText[routine.status]} · 周{routine.weekdays.join('、')}
                    </small>
                  </button>
                ))
              ) : (
                <p className="empty-copy">还没有 Routine。</p>
              )}
            </div>
          </div>
        </div>

        <div className="goal-column">
          {detail ? (
            <article className="goal-card goal-detail" aria-label={`${detail.name} Routine 详情`}>
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
                  说明（可选）
                  <textarea
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
                <RoutineWeekdayPicker
                  label="星期节奏"
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
                  整组替换星期
                </button>
              </div>

              <div className="lifecycle-actions">
                {detail.status === 'active' ? (
                  <button type="button" disabled={busy} onClick={() => void transition('pause')}>
                    暂停
                  </button>
                ) : null}
                {detail.status === 'paused' ? (
                  <button type="button" disabled={busy} onClick={() => void transition('resume')}>
                    恢复
                  </button>
                ) : null}
                {detail.status !== 'ended' ? (
                  <button type="button" disabled={busy} onClick={() => setConfirmEnd(true)}>
                    结束 Routine
                  </button>
                ) : null}
              </div>
              <RoutineRecordingPanel
                key={detail.id}
                routineId={detail.id}
                routineName={detail.name}
                disabled={detail.status !== 'active'}
              />
              {confirmEnd ? (
                <div className="inline-confirm" role="alertdialog" aria-label="确认结束 Routine">
                  <p>结束后不能恢复；已有历史会保留。</p>
                  <div className="lifecycle-actions">
                    <button type="button" disabled={busy} onClick={() => void transition('end')}>
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
                  这个 Routine 已结束且不能恢复；当前内容、节奏与历史仍会保留。
                </p>
              ) : null}
            </article>
          ) : (
            <section className="goal-card empty-detail" aria-label="Routine 详情占位">
              <p className="eyebrow">选择一个 Routine</p>
              <h2>查看节奏、目标状态与生命周期</h2>
              <p>星期安排只决定 Today 是否匹配，不会预生成任何记录。</p>
            </section>
          )}
        </div>
      </div>
    </section>
  )
}

export { RoutineWorkspace as RoutinesPage }
