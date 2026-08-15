import { Component, type ErrorInfo, type ReactNode, useEffect, useRef, useState } from 'react'
import type {
  GoalDetailDto,
  GoalErrorCode,
  GoalStatusDto,
  GoalSummaryDto
} from '../../contracts/goals'
import type { ShellStatus } from '../../contracts/shell'
import type {
  ActionDetailDto,
  ActionErrorCode,
  ActionStatusDto,
  CurrentNextResolutionDto
} from '../../contracts/actions'
import type { TodayViewDto } from '../../contracts/today'
import type {
  ActionRecordDetailDto,
  ActionRecordOutcomeDto,
  ActionRecordSummaryDto,
  BeginActionRecordingDto,
  RecordErrorCode,
  RecordingDateChoiceDto
} from '../../contracts/records'
import type {
  ProgressErrorCode,
  ProgressViewDto
} from '../../contracts/progress'
import type {
  RoutineDetailDto,
  RoutineErrorCode,
  RoutineStatusDto,
  RoutineSummaryDto
} from '../../contracts/routines'
import type {
  BeginRoutineRecordingDto,
  RoutineDayStateDto,
  RoutineRecordErrorCode,
  RoutineRecordOutcomeDto,
  RoutineRecordingDateChoiceDto
} from '../../contracts/routine-records'

type Section = 'goals' | 'routines' | 'today' | 'progress' | 'review'

const sections: ReadonlyArray<{
  readonly id: Section
  readonly label: string
  readonly eyebrow: string
  readonly title: string
  readonly description: string
}> = [
  {
    id: 'goals',
    label: 'Goals',
    eyebrow: '保留方向与下一步',
    title: '目标可以停下，也可以从一个小步骤继续',
    description: '创建一个目标和可直接开始的下一步；暂停或结束时，已有上下文与历史仍会保留。'
  },
  {
    id: 'routines',
    label: 'Routines',
    eyebrow: '按星期形成节奏',
    title: '让重复行动有清晰、可调整的节奏',
    description: '用星期安排例行事项；暂停、恢复或结束都保留历史，结束后不再恢复。'
  },
  {
    id: 'today',
    label: 'Today',
    eyebrow: '轻量开始',
    title: '今天，从一个真实动作开始',
    description: '这里显示你明确选入的行动，以及今天匹配的活跃 Routine；不会预生成记录或搬运历史。'
  },
  {
    id: 'progress',
    label: 'Progress',
    eyebrow: '只看事实',
    title: '进展会来自已经记录的事实',
    description: '查看已经记录的投入、行动次数、确认理解和开放困惑；不会推断得分、掌握度或失败。'
  },
  {
    id: 'review',
    label: 'Review',
    eyebrow: '温和复盘',
    title: '复盘将帮助你选择下一次调整',
    description: '后续切片会复用已有事实形成周期摘要；当前不会要求配置 AI。'
  }
]

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

const actionStatusText: Record<ActionStatusDto, string> = {
  pending: '待行动',
  completed: '已完成',
  cancelled: '已取消',
  rescheduled: '已重新安排'
}

const actionErrorText: Record<ActionErrorCode, string> = {
  validation: '请检查行动的必填内容。',
  'not-found': '行动或目标已不存在，请刷新后重试。',
  'invalid-transition': '当前状态不能执行这个行动操作。',
  'invariant-violation': '当前行动、目标或下一步关系不允许这个操作。',
  'persistence-failed': '本地行动数据暂时无法保存或读取。'
}

const recordErrorText: Record<RecordErrorCode, string> = {
  validation: '请检查记录内容；时长需为非负整数分钟。',
  'not-found': '行动或记录已不存在，请刷新后重试。',
  'invalid-transition': '该行动当前不能新增记录。',
  'invariant-violation': '记录后的行动或下一步选择当前不可用。',
  'invalid-recording-context': '这次记录表单已失效，请重新开始记录。',
  'persistence-failed': '本地记录暂时无法保存或读取。'
}

const recordOutcomeText: Record<ActionRecordOutcomeDto, string> = {
  completed: '本次达到预期',
  partial: '本次完成一部分',
  stopped: '本次在这里停下'
}

const progressErrorText: Record<ProgressErrorCode, string> = {
  validation: '请检查目标或日期筛选；开始日期不能晚于结束日期。',
  'not-found': '所选目标已不存在，请重新选择。',
  'persistence-failed': '本地进展事实暂时无法读取。'
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

const unavailableReasonText: Record<NonNullable<ActionDetailDto['unavailableReason']>, string> = {
  'action-completed': '行动已完成，不能再次开始。',
  'action-cancelled': '行动已取消，不能再次开始。',
  'action-rescheduled': '行动已移出今天；再次明确选入后才恢复待行动。',
  'goal-paused': '关联目标已暂停；恢复目标后才能开始或重新选入。',
  'goal-ended': '关联目标已结束，不能开始或重新选入。'
}

interface PendingGoalEnd {
  readonly goalId: string
  readonly goalName: string
}

function GoalWorkspace(): ReactNode {
  const [statusFilter, setStatusFilter] = useState<GoalStatusDto | ''>('')
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [goals, setGoals] = useState<readonly GoalSummaryDto[]>([])
  const [detail, setDetail] = useState<GoalDetailDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [createNextAction, setCreateNextAction] = useState('')
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [selectedActionId, setSelectedActionId] = useState('')
  const [pendingGoalEnd, setPendingGoalEnd] = useState<PendingGoalEnd | null>(null)
  const goalEndTriggerRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    let active = true
    window.myTracer.goals.list({ status: statusFilter || null }).then((result) => {
      if (!active) return
      if (result.ok) {
        setGoals(result.value)
        setError(null)
      } else {
        setError(goalErrorText[result.error.code])
      }
    })
    return () => {
      active = false
    }
  }, [statusFilter, refreshVersion])

  const showDetail = (nextDetail: GoalDetailDto): void => {
    setDetail(nextDetail)
    setEditName(nextDetail.name)
    setEditDescription(nextDetail.description ?? '')
    setSelectedActionId(nextDetail.currentNextActionId ?? '')
    setPendingGoalEnd(null)
  }

  const selectGoal = async (goalId: string): Promise<void> => {
    setBusy(true)
    const result = await window.myTracer.goals.getDetail({ goalId })
    setBusy(false)
    if (result.ok) {
      showDetail(result.value)
      setError(null)
    } else {
      setError(goalErrorText[result.error.code])
    }
  }

  const reloadDetail = async (goalId: string): Promise<void> => {
    await selectGoal(goalId)
    setRefreshVersion((version) => version + 1)
  }

  const submitCreate = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setBusy(true)
    const result = await window.myTracer.goals.create({
      name: createName,
      description: createDescription || null,
      initialNextAction: createNextAction ? { title: createNextAction } : null
    })
    setBusy(false)
    if (result.ok) {
      showDetail(result.value)
      setCreateName('')
      setCreateDescription('')
      setCreateNextAction('')
      setStatusFilter('')
      setRefreshVersion((version) => version + 1)
      setError(null)
    } else {
      setError(goalErrorText[result.error.code])
    }
  }

  const submitUpdate = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (!detail) return
    setBusy(true)
    const result = await window.myTracer.goals.updateDetails({
      goalId: detail.id,
      name: editName,
      description: editDescription || null
    })
    setBusy(false)
    if (result.ok) {
      await reloadDetail(detail.id)
    } else {
      setError(goalErrorText[result.error.code])
    }
  }

  const changeStatus = async (transition: 'pause' | 'resume'): Promise<void> => {
    if (!detail) return
    setBusy(true)
    const result = await window.myTracer.goals[transition]({ goalId: detail.id })
    setBusy(false)
    if (result.ok) {
      await reloadDetail(detail.id)
    } else {
      setError(goalErrorText[result.error.code])
    }
  }

  const requestGoalEnd = (trigger: HTMLButtonElement): void => {
    if (!detail) return
    goalEndTriggerRef.current = trigger
    setPendingGoalEnd({ goalId: detail.id, goalName: detail.name })
    setError(null)
  }

  const dismissGoalEnd = (): void => {
    setPendingGoalEnd(null)
    requestAnimationFrame(() => goalEndTriggerRef.current?.focus())
  }

  const confirmGoalEnd = async (): Promise<void> => {
    if (!pendingGoalEnd) return
    const request = pendingGoalEnd
    setBusy(true)
    try {
      const result = await window.myTracer.goals.end({ goalId: request.goalId })
      setPendingGoalEnd(null)
      if (result.ok) {
        await reloadDetail(request.goalId)
      } else {
        setError(goalErrorText[result.error.code])
      }
    } catch {
      setPendingGoalEnd(null)
      setError(goalErrorText['persistence-failed'])
    } finally {
      setBusy(false)
    }
  }

  const saveCurrentNextAction = async (): Promise<void> => {
    if (!detail) return
    setBusy(true)
    const result = await window.myTracer.goals.setCurrentNextAction({
      goalId: detail.id,
      actionId: selectedActionId || null
    })
    setBusy(false)
    if (result.ok) {
      await reloadDetail(detail.id)
    } else {
      setError(goalErrorText[result.error.code])
    }
  }

  return (
    <section className="goal-workspace" aria-label="目标管理">
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="goal-grid">
        <div className="goal-column">
          <form className="goal-card goal-create" onSubmit={(event) => void submitCreate(event)}>
            <div className="card-heading">
              <p className="eyebrow">新目标</p>
              <h2>留下方向与一个可开始的步骤</h2>
            </div>
            <label>
              目标名称
              <input required value={createName} onChange={(event) => setCreateName(event.target.value)} />
            </label>
            <label>
              说明（可选）
              <textarea rows={2} value={createDescription} onChange={(event) => setCreateDescription(event.target.value)} />
            </label>
            <label>
              当前下一步（可选）
              <input
                value={createNextAction}
                onChange={(event) => setCreateNextAction(event.target.value)}
                placeholder="例如：运行一个 React 状态更新示例"
              />
            </label>
            <button className="primary-button" type="submit" disabled={busy}>
              创建目标
            </button>
          </form>

          <div className="goal-card goal-list-card">
            <div className="card-heading inline-heading">
              <div>
                <p className="eyebrow">目标列表</p>
                <h2>按当前状态查看</h2>
              </div>
              <label className="compact-field">
                状态
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as GoalStatusDto | '')}>
                  <option value="">全部</option>
                  <option value="active">活跃</option>
                  <option value="paused">暂停</option>
                  <option value="ended">结束</option>
                </select>
              </label>
            </div>
            {goals.length ? (
              <div className="goal-list">
                {goals.map((goal) => (
                  <button
                    className={`goal-list-item ${detail?.id === goal.id ? 'selected' : ''}`}
                    key={goal.id}
                    type="button"
                    onClick={() => void selectGoal(goal.id)}
                  >
                    <span>{goal.name}</span>
                    <small>
                      {goalStatusText[goal.status]} · {goal.currentNextActionId ? '有下一步' : '下一步为空'}
                    </small>
                  </button>
                ))}
              </div>
            ) : (
              <p className="empty-copy">这个筛选下还没有目标。</p>
            )}
          </div>
        </div>

        <div className="goal-column">
          {detail ? (
            <article className="goal-card goal-detail" aria-label={`${detail.name} 详情`}>
              <div className="detail-title-row">
                <div>
                  <p className="eyebrow">{goalStatusText[detail.status]}</p>
                  <h2>{detail.name}</h2>
                </div>
                <span className={`status-badge status-${detail.status}`}>{goalStatusText[detail.status]}</span>
              </div>
              <div className="next-action-panel">
                <span>当前下一步</span>
                <strong>{detail.currentNextAction?.title ?? '暂未设置'}</strong>
                {detail.currentNextAction?.selectedForToday ? <small>今日已选择</small> : null}
              </div>

              <form className="detail-form" onSubmit={(event) => void submitUpdate(event)}>
                <label>
                  目标名称
                  <input required value={editName} onChange={(event) => setEditName(event.target.value)} />
                </label>
                <label>
                  说明（可选）
                  <textarea rows={2} value={editDescription} onChange={(event) => setEditDescription(event.target.value)} />
                </label>
                <button className="secondary-button" type="submit" disabled={busy}>
                  保存修改
                </button>
              </form>

              {detail.status === 'active' ? (
                <div className="current-action-control">
                  <label>
                    选择当前下一步
                    <select value={selectedActionId} onChange={(event) => setSelectedActionId(event.target.value)}>
                      <option value="">清空当前下一步</option>
                      {detail.actions
                        .filter((action) => action.status === 'pending')
                        .map((action) => (
                          <option key={action.id} value={action.id}>
                            {action.title}
                          </option>
                        ))}
                    </select>
                  </label>
                  <button className="secondary-button" type="button" disabled={busy} onClick={() => void saveCurrentNextAction()}>
                    保存当前下一步
                  </button>
                </div>
              ) : null}

              <div className="lifecycle-actions">
                {detail.status === 'active' ? (
                  <button type="button" disabled={busy} onClick={() => void changeStatus('pause')}>
                    暂停目标
                  </button>
                ) : null}
                {detail.status === 'paused' ? (
                  <button type="button" disabled={busy} onClick={() => void changeStatus('resume')}>
                    恢复目标
                  </button>
                ) : null}
                {detail.status !== 'ended' ? (
                  <button className="end-button" type="button" disabled={busy} onClick={(event) => requestGoalEnd(event.currentTarget)}>
                    结束目标
                  </button>
                ) : (
                  <p className="terminal-copy">该目标已结束。已有下一步、行动与记录仍然保留。</p>
                )}
              </div>
              {pendingGoalEnd ? (
                <div className="transition-confirmation" role="alertdialog" aria-labelledby="goal-end-confirmation-title">
                  <div>
                    <h3 id="goal-end-confirmation-title">确认结束目标</h3>
                    <p>结束“{pendingGoalEnd.goalName}”后不能恢复，但已有下一步和历史会保留。</p>
                  </div>
                  <div className="transition-confirmation-actions">
                    <button type="button" autoFocus disabled={busy} onClick={() => void confirmGoalEnd()}>
                      确认结束
                    </button>
                    <button type="button" disabled={busy} onClick={dismissGoalEnd}>返回</button>
                  </div>
                </div>
              ) : null}

              <div className="related-section">
                <h3>关联行动</h3>
                {detail.actions.length ? (
                  detail.actions.map((action) => (
                    <div className="related-row" key={action.id}>
                      <span>{action.title}</span>
                      <small>{action.status === 'pending' ? '待行动' : action.status}</small>
                    </div>
                  ))
                ) : (
                  <p className="empty-copy">暂无关联行动。</p>
                )}
              </div>
              <div className="related-section">
                <h3>已有记录</h3>
                {detail.records.length ? (
                  detail.records.map((record) => (
                    <div className="related-row" key={record.id}>
                      <span>{record.actionTitle} · {record.durationMinutes} 分钟</span>
                      <small>{record.occurredOn} · {record.outcome}</small>
                    </div>
                  ))
                ) : (
                  <p className="empty-copy">暂无记录；T011 不会为了填满这里自动创建事实。</p>
                )}
              </div>
            </article>
          ) : (
            <div className="goal-card detail-empty">
              <div className="placeholder-icon" aria-hidden="true">◎</div>
              <h2>选择一个目标查看详情</h2>
              <p>暂停或结束只改变目标状态，不会清除已有下一步和历史。</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

type ResolutionMode = CurrentNextResolutionDto['kind']
type TransitionKind = 'complete' | 'cancel' | 'reschedule'

interface PendingTransition {
  readonly kind: TransitionKind
  readonly actionId: string
  readonly actionTitle: string
  readonly currentNextResolution?: CurrentNextResolutionDto
}

const transitionLabels: Record<TransitionKind, string> = {
  complete: '完成',
  cancel: '取消',
  reschedule: '重新安排'
}

type PostRecordActionChoice = 'keep-pending' | TransitionKind
type RecordedNextMode = 'clear' | 'use-existing' | 'recorded-next'

function ActionRecordingPanel(props: {
  readonly action: ActionDetailDto
  readonly replacementCandidates: readonly ActionDetailDto[]
  readonly onSaved: (action: ActionDetailDto) => Promise<void>
}): ReactNode {
  const [context, setContext] = useState<BeginActionRecordingDto | null>(null)
  const contextRef = useRef<BeginActionRecordingDto | null>(null)
  const [records, setRecords] = useState<readonly ActionRecordSummaryDto[]>([])
  const [recordDetail, setRecordDetail] = useState<ActionRecordDetailDto | null>(null)
  const [durationMinutes, setDurationMinutes] = useState('0')
  const [outcome, setOutcome] = useState<ActionRecordOutcomeDto>('partial')
  const [deepExpanded, setDeepExpanded] = useState(false)
  const [understanding, setUnderstanding] = useState('')
  const [confusion, setConfusion] = useState('')
  const [nextStep, setNextStep] = useState('')
  const [note, setNote] = useState('')
  const [postAction, setPostAction] = useState<PostRecordActionChoice>('keep-pending')
  const [nextMode, setNextMode] = useState<RecordedNextMode>('clear')
  const [replacementActionId, setReplacementActionId] = useState('')
  const [applyRecordedNextStep, setApplyRecordedNextStep] = useState(false)
  const [dateConfirmation, setDateConfirmation] = useState<{
    readonly capturedOn: string
    readonly currentLocalDate: string
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadRecords = async (): Promise<void> => {
    const result = await window.myTracer.records.listForAction({ actionId: props.action.id })
    if (result.ok) {
      setRecords(result.value)
      setError(null)
    } else {
      setError(recordErrorText[result.error.code])
    }
  }

  useEffect(() => {
    let active = true
    void window.myTracer.records
      .listForAction({ actionId: props.action.id })
      .then((result) => {
        if (!active) return
        if (result.ok) {
          setRecords(result.value)
          setError(null)
        } else {
          setError(recordErrorText[result.error.code])
        }
      })
    return () => {
      active = false
      const activeContext = contextRef.current
      contextRef.current = null
      if (activeContext) {
        void window.myTracer.records.cancel({
          recordingContextId: activeContext.recordingContextId
        })
      }
    }
  }, [props.action.id])

  const resetForm = (): void => {
    contextRef.current = null
    setContext(null)
    setDurationMinutes('0')
    setOutcome('partial')
    setDeepExpanded(false)
    setUnderstanding('')
    setConfusion('')
    setNextStep('')
    setNote('')
    setPostAction('keep-pending')
    setNextMode('clear')
    setReplacementActionId('')
    setApplyRecordedNextStep(false)
    setDateConfirmation(null)
  }

  const begin = async (): Promise<void> => {
    setBusy(true)
    const result = await window.myTracer.records.begin({ actionId: props.action.id })
    setBusy(false)
    if (!result.ok) {
      setError(recordErrorText[result.error.code])
      return
    }
    contextRef.current = result.value
    setContext(result.value)
    setError(null)
  }

  const cancel = async (): Promise<void> => {
    if (!context) return
    setBusy(true)
    const result = await window.myTracer.records.cancel({
      recordingContextId: context.recordingContextId
    })
    setBusy(false)
    if (!result.ok) {
      setError(recordErrorText[result.error.code])
      return
    }
    resetForm()
    setError(null)
  }

  const showRecordDetail = async (recordId: string): Promise<void> => {
    const result = await window.myTracer.records.getDetail({ recordId })
    if (result.ok) {
      setRecordDetail(result.value)
      setError(null)
    } else {
      setError(recordErrorText[result.error.code])
    }
  }

  const save = async (dateChoice?: RecordingDateChoiceDto): Promise<void> => {
    if (!context) return
    const minutes = Number(durationMinutes)
    if (!Number.isInteger(minutes) || minutes < 0) {
      setError('时长必须是非负整数分钟；0 表示不足一分钟但确有行动。')
      return
    }
    const changingCurrentAction = postAction !== 'keep-pending' && props.action.isCurrentNextAction
    if (
      changingCurrentAction &&
      nextMode === 'use-existing' &&
      !replacementActionId
    ) {
      setError('请选择一个同目标的待行动作为新的当前下一步。')
      return
    }
    const needsRecordedNext =
      (changingCurrentAction && nextMode === 'recorded-next') ||
      (!changingCurrentAction && applyRecordedNextStep)
    if (needsRecordedNext && !nextStep.trim()) {
      setError('请先填写记录中的下一步，再明确应用到目标。')
      return
    }

    const currentNextResolution = changingCurrentAction
      ? nextMode === 'use-existing'
        ? ({ kind: 'use-existing', actionId: replacementActionId } as const)
        : nextMode === 'recorded-next'
          ? ({ kind: 'create-from-recorded-next-step' } as const)
          : ({ kind: 'clear' } as const)
      : undefined
    setBusy(true)
    const result = await window.myTracer.records.record({
      actionId: props.action.id,
      recordingContextId: context.recordingContextId,
      dateChoice,
      durationMinutes: minutes,
      outcome,
      understanding: deepExpanded && understanding.trim() ? understanding : null,
      confusion: deepExpanded && confusion.trim() ? confusion : null,
      nextStep: deepExpanded && nextStep.trim() ? nextStep : null,
      note: deepExpanded && note.trim() ? note : null,
      postRecord: {
        action: postAction,
        currentNextResolution,
        applyRecordedNextStep: !changingCurrentAction && applyRecordedNextStep
      }
    })
    setBusy(false)
    if (!result.ok) {
      setError(recordErrorText[result.error.code])
      return
    }
    if (result.value.kind === 'date-confirmation-required') {
      setDateConfirmation(result.value)
      setError(null)
      return
    }
    const saved = result.value
    resetForm()
    setRecordDetail(saved.record)
    await loadRecords()
    await props.onSaved(saved.action)
  }

  const canApplyNextStep = props.action.goal?.status === 'active'
  const changingCurrentAction = postAction !== 'keep-pending' && props.action.isCurrentNextAction

  return (
    <section className="recording-panel" aria-label={`${props.action.title} 行动记录`}>
      <div className="recording-heading">
        <div>
          <p className="eyebrow">真实行动记录</p>
          <h3>先完成快速记录，再按需展开</h3>
        </div>
        {!context && props.action.canStart ? (
          <button type="button" disabled={busy} onClick={() => void begin()}>
            开始记录
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {context ? (
        <form
          className="recording-form"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <p className="captured-date">发生日已由应用捕获：{context.capturedOn}</p>
          <div className="quick-record-grid">
            <label>
              投入分钟
              <input
                required
                min="0"
                step="1"
                type="number"
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(event.target.value)}
              />
              <small>0 表示不足 1 分钟但确有行动</small>
            </label>
            <label>
              本次结果
              <select
                value={outcome}
                onChange={(event) => setOutcome(event.target.value as ActionRecordOutcomeDto)}
              >
                <option value="completed">本次达到预期</option>
                <option value="partial">本次完成一部分</option>
                <option value="stopped">本次在这里停下</option>
              </select>
            </label>
          </div>
          <button
            className="quiet-button deep-toggle"
            type="button"
            onClick={() => setDeepExpanded((value) => !value)}
          >
            {deepExpanded ? '收起深入记录' : '添加理解、困惑、下一步或备注'}
          </button>
          {deepExpanded ? (
            <div className="deep-record-fields">
              <label>
                我理解了（可选）
                <textarea
                  rows={2}
                  value={understanding}
                  onChange={(event) => setUnderstanding(event.target.value)}
                />
              </label>
              <label>
                我仍困惑（可选）
                <textarea
                  rows={2}
                  value={confusion}
                  onChange={(event) => setConfusion(event.target.value)}
                />
              </label>
              <label>
                记录中的下一步（可选）
                <input value={nextStep} onChange={(event) => setNextStep(event.target.value)} />
              </label>
              <label>
                备注（可选）
                <textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
              </label>
            </div>
          ) : null}

          <div className="post-record-panel">
            <label>
              保存记录后
              <select
                value={postAction}
                onChange={(event) =>
                  setPostAction(event.target.value as PostRecordActionChoice)
                }
              >
                <option value="keep-pending">保持行动为待行动（默认）</option>
                <option value="complete">另行确认行动已完成</option>
                <option value="cancel">另行确认取消行动</option>
                <option value="reschedule">另行确认重新安排</option>
              </select>
            </label>
            <p>本次结果不会自动改变行动状态；这里是独立选择。</p>
            {changingCurrentAction ? (
              <label>
                当前下一步处理
                <select
                  value={nextMode}
                  onChange={(event) => setNextMode(event.target.value as RecordedNextMode)}
                >
                  <option value="clear">清空目标当前下一步</option>
                  <option value="use-existing">改用已有待行动</option>
                  <option value="recorded-next">用记录中的下一步创建新行动</option>
                </select>
              </label>
            ) : null}
            {changingCurrentAction && nextMode === 'use-existing' ? (
              <label>
                已有待行动
                <select
                  value={replacementActionId}
                  onChange={(event) => setReplacementActionId(event.target.value)}
                >
                  <option value="">请选择</option>
                  {props.replacementCandidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.title}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {canApplyNextStep && !changingCurrentAction ? (
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={applyRecordedNextStep}
                  onChange={(event) => setApplyRecordedNextStep(event.target.checked)}
                />
                明确将记录中的下一步创建为目标当前下一步
              </label>
            ) : null}
          </div>

          {dateConfirmation ? (
            <div className="date-confirmation" role="alertdialog" aria-label="确认记录发生日">
              <p>
                保存时已经跨日。请选择保留开始日 {dateConfirmation.capturedOn}，或使用当前日{' '}
                {dateConfirmation.currentLocalDate}。
              </p>
              <div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void save('keep-captured-on')}
                >
                  保留开始日
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void save('use-current-on')}
                >
                  使用当前日
                </button>
              </div>
            </div>
          ) : null}
          <div className="recording-actions">
            <button className="primary-button" type="submit" disabled={busy || Boolean(dateConfirmation)}>
              保存记录
            </button>
            <button type="button" disabled={busy} onClick={() => void cancel()}>
              取消记录
            </button>
          </div>
        </form>
      ) : !props.action.canStart ? (
        <p className="empty-copy">该行动当前不可开始，因此不能新增记录。</p>
      ) : null}

      <div className="record-list" aria-label="行动记录列表">
        <h3>已有记录</h3>
        {records.length ? (
          records.map((record) => (
            <button type="button" key={record.id} onClick={() => void showRecordDetail(record.id)}>
              <span>{record.occurredOn} · {recordOutcomeText[record.outcome]}</span>
              <small>{record.durationMinutes === 0 ? '少于 1 分钟' : `${record.durationMinutes} 分钟`}</small>
            </button>
          ))
        ) : (
          <p className="empty-copy">还没有记录；没有记录不代表没有行动。</p>
        )}
      </div>
      {recordDetail ? (
        <div className="record-detail" aria-label="记录详情">
          <p>{recordDetail.occurredOn} · {recordOutcomeText[recordDetail.outcome]}</p>
          <strong>{recordDetail.durationMinutes === 0 ? '少于 1 分钟' : `${recordDetail.durationMinutes} 分钟`}</strong>
          {recordDetail.understandings.map((item) => <span key={item.id}>理解：{item.text}</span>)}
          {recordDetail.confusions.map((item) => <span key={item.id}>开放困惑：{item.text}</span>)}
          {recordDetail.nextStep ? <span>记录中的下一步：{recordDetail.nextStep}</span> : null}
          {recordDetail.note ? <span>备注：{recordDetail.note}</span> : null}
        </div>
      ) : null}
    </section>
  )
}

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
        <button type="button" onClick={() => props.onChange([1, 2, 3, 4, 5, 6, 7])}>每天</button>
        <button type="button" onClick={() => props.onChange([1, 2, 3, 4, 5])}>工作日</button>
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

function RoutineRecordingPanel(props: {
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
    if (actionOutcome && parsedDuration !== null && (!Number.isInteger(parsedDuration) || parsedDuration < 0)) {
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
            <select value={outcome} onChange={(event) => setOutcome(event.target.value as RoutineRecordOutcomeDto)}>
              <option value="target_met">达到目标</option>
              <option value="acted">有真实行动</option>
              <option value="intentional_rest">有意休息</option>
              <option value="not_done">明确未做</option>
            </select>
          </label>
          {outcome === 'target_met' || outcome === 'acted' ? (
            <label>
              行动分钟（可空）
              <input type="number" min="0" step="1" value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} />
            </label>
          ) : null}
          <label>
            备注（可选）
            <textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          {dateConfirmation ? (
            <div className="date-confirmation" role="alertdialog" aria-label="确认 Routine 记录发生日">
              <p>保存时已经跨日。请选择保留开始日 {dateConfirmation.capturedOn}，或使用当前日 {dateConfirmation.currentLocalDate}。</p>
              <button type="button" disabled={busy} onClick={() => void save('keep-captured-on')}>保留开始日</button>
              <button type="button" disabled={busy} onClick={() => void save('use-current-on')}>使用当前日</button>
            </div>
          ) : null}
          <div className="recording-actions">
            <button className="primary-button" type="submit" disabled={busy || Boolean(dateConfirmation)}>保存 Routine 记录</button>
            <button type="button" disabled={busy} onClick={() => void cancel()}>取消</button>
          </div>
        </form>
      ) : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
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
    Promise.all([window.myTracer.routines.list({}), window.myTracer.goals.list({ status: null })]).then(
      ([routineResult, goalResult]) => {
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
      }
    )
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
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="goal-grid">
        <div className="goal-column">
          <form className="goal-card goal-create" onSubmit={(event) => void submitCreate(event)}>
            <div className="card-heading">
              <p className="eyebrow">新 Routine</p>
              <h2>定义一个最小行动和星期节奏</h2>
            </div>
            <label>
              名称
              <input required value={createName} onChange={(event) => setCreateName(event.target.value)} />
            </label>
            <label>
              最小行动
              <input required value={createMinimumAction} onChange={(event) => setCreateMinimumAction(event.target.value)} />
            </label>
            <label>
              说明（可选）
              <textarea rows={2} value={createDescription} onChange={(event) => setCreateDescription(event.target.value)} />
            </label>
            <label>
              关联目标（可选，创建后不可改）
              <select value={createGoalId} onChange={(event) => setCreateGoalId(event.target.value)}>
                <option value="">不关联目标</option>
                {goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.name} · {goalStatusText[goal.status]}</option>)}
              </select>
            </label>
            <RoutineWeekdayPicker label="计划星期" value={createWeekdays} onChange={setCreateWeekdays} disabled={busy} />
            <button className="primary-button" type="submit" disabled={busy}>创建 Routine</button>
          </form>

          <div className="goal-card goal-list-card">
            <div className="card-heading">
              <p className="eyebrow">Routine 列表</p>
              <h2>暂停与结束的项目仍保留</h2>
            </div>
            <div className="goal-list">
              {routines.length ? routines.map((routine) => (
                <button
                  className={`goal-list-item${detail?.id === routine.id ? ' selected' : ''}`}
                  type="button"
                  key={routine.id}
                  onClick={() => void openRoutine(routine.id)}
                >
                  <span>{routine.name}</span>
                  <small>{routineStatusText[routine.status]} · 周{routine.weekdays.join('、')}</small>
                </button>
              )) : <p className="empty-copy">还没有 Routine。</p>}
            </div>
          </div>
        </div>

        <div className="goal-column">
          {detail ? (
            <article className="goal-card goal-detail" aria-label={`${detail.name} Routine 详情`}>
              <div className="detail-title-row">
                <div>
                  <p className="eyebrow">{detail.goal ? `${detail.goal.name} · ${goalStatusText[detail.goal.status]}` : '未关联目标'}</p>
                  <h2>{detail.name}</h2>
                </div>
                <span className={`status-badge status-${detail.status}`}>{routineStatusText[detail.status]}</span>
              </div>

              <form className="detail-form" onSubmit={(event) => void submitDetails(event)}>
                <label>
                  名称
                  <input required value={editName} onChange={(event) => setEditName(event.target.value)} />
                </label>
                <label>
                  最小行动
                  <input required value={editMinimumAction} onChange={(event) => setEditMinimumAction(event.target.value)} />
                </label>
                <label>
                  说明（可选）
                  <textarea rows={3} value={editDescription} onChange={(event) => setEditDescription(event.target.value)} />
                </label>
                <button className="secondary-button" type="submit" disabled={busy}>保存内容修改</button>
              </form>

              <div className="schedule-editor">
                <RoutineWeekdayPicker label="星期节奏" value={editWeekdays} onChange={setEditWeekdays} disabled={busy} />
                <button className="secondary-button" type="button" disabled={busy} onClick={() => void replaceSchedule()}>整组替换星期</button>
              </div>

              <div className="lifecycle-actions">
                {detail.status === 'active' ? <button type="button" disabled={busy} onClick={() => void transition('pause')}>暂停</button> : null}
                {detail.status === 'paused' ? <button type="button" disabled={busy} onClick={() => void transition('resume')}>恢复</button> : null}
                {detail.status !== 'ended' ? <button type="button" disabled={busy} onClick={() => setConfirmEnd(true)}>结束 Routine</button> : null}
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
                    <button type="button" disabled={busy} onClick={() => void transition('end')}>确认结束</button>
                    <button type="button" disabled={busy} onClick={() => setConfirmEnd(false)}>取消</button>
                  </div>
                </div>
              ) : null}
              {detail.status === 'ended' ? <p className="empty-copy">这个 Routine 已结束且不能恢复；当前内容、节奏与历史仍会保留。</p> : null}
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

function TodayWorkspace(): ReactNode {
  const [today, setToday] = useState<TodayViewDto | null>(null)
  const [activeGoals, setActiveGoals] = useState<readonly GoalSummaryDto[]>([])
  const [detail, setDetail] = useState<ActionDetailDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [createTitle, setCreateTitle] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [createGoalId, setCreateGoalId] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [resolutionMode, setResolutionMode] = useState<ResolutionMode>('clear')
  const [replacementActionId, setReplacementActionId] = useState('')
  const [replacementTitle, setReplacementTitle] = useState('')
  const [pendingTransition, setPendingTransition] = useState<PendingTransition | null>(null)
  const transitionTriggerRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([window.myTracer.today.get({}), window.myTracer.goals.list({ status: 'active' })]).then(
      ([todayResult, goalResult]) => {
        if (!active) return
        if (!todayResult.ok) {
          setError(actionErrorText[todayResult.error.code])
          return
        }
        if (!goalResult.ok) {
          setError(goalErrorText[goalResult.error.code])
          return
        }
        setToday(todayResult.value)
        setActiveGoals(goalResult.value)
        setError(null)
      }
    )
    return () => {
      active = false
    }
  }, [refreshVersion])

  const showDetail = (action: ActionDetailDto): void => {
    setDetail(action)
    setEditTitle(action.title)
    setEditDescription(action.description ?? '')
    setResolutionMode('clear')
    setReplacementActionId('')
    setReplacementTitle('')
    setPendingTransition(null)
  }

  const refresh = async (actionId?: string): Promise<void> => {
    const todayResult = await window.myTracer.today.get({})
    if (!todayResult.ok) {
      setError(actionErrorText[todayResult.error.code])
      return
    }
    setToday(todayResult.value)
    if (actionId) {
      const detailResult = await window.myTracer.actions.getDetail({ actionId })
      if (!detailResult.ok) {
        setError(actionErrorText[detailResult.error.code])
        return
      }
      showDetail(detailResult.value)
    }
    setError(null)
  }

  const submitCreate = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setBusy(true)
    const result = await window.myTracer.actions.create({
      goalId: createGoalId || null,
      title: createTitle,
      description: createDescription || null
    })
    setBusy(false)
    if (!result.ok) {
      setError(actionErrorText[result.error.code])
      return
    }
    setCreateTitle('')
    setCreateDescription('')
    setCreateGoalId('')
    showDetail(result.value)
    await refresh(result.value.id)
    setRefreshVersion((version) => version + 1)
  }

  const submitUpdate = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (!detail) return
    setBusy(true)
    const result = await window.myTracer.actions.updateDetails({
      actionId: detail.id,
      title: editTitle,
      description: editDescription || null
    })
    setBusy(false)
    if (result.ok) {
      await refresh(detail.id)
    } else {
      setError(actionErrorText[result.error.code])
    }
  }

  const selectForToday = async (actionId: string): Promise<void> => {
    setBusy(true)
    const result = await window.myTracer.today.selectAction({ actionId })
    setBusy(false)
    if (result.ok) {
      await refresh(actionId)
    } else {
      setError(actionErrorText[result.error.code])
    }
  }

  const removeFromToday = async (actionId: string): Promise<void> => {
    setBusy(true)
    const result = await window.myTracer.today.removeAction({ actionId })
    setBusy(false)
    if (result.ok) {
      setToday(result.value)
      if (detail?.id === actionId) await refresh(actionId)
    } else {
      setError(actionErrorText[result.error.code])
    }
  }

  const currentNextResolution = (): CurrentNextResolutionDto | undefined => {
    if (!detail?.isCurrentNextAction) return undefined
    if (detail.goal?.status !== 'active' || resolutionMode === 'clear') return { kind: 'clear' }
    if (resolutionMode === 'use-existing') {
      return { kind: 'use-existing', actionId: replacementActionId }
    }
    return { kind: 'create-and-use', title: replacementTitle }
  }

  const requestTransition = (kind: TransitionKind, trigger: HTMLButtonElement): void => {
    if (!detail) return
    const resolution = currentNextResolution()
    if (resolution?.kind === 'use-existing' && !resolution.actionId) {
      setError('请选择一个同目标的待行动作为新的当前下一步。')
      return
    }
    if (resolution?.kind === 'create-and-use' && !resolution.title.trim()) {
      setError('请填写新的当前下一步。')
      return
    }
    transitionTriggerRef.current = trigger
    setPendingTransition({
      kind,
      actionId: detail.id,
      actionTitle: detail.title,
      currentNextResolution: resolution
    })
    setError(null)
  }

  const dismissTransition = (): void => {
    setPendingTransition(null)
    requestAnimationFrame(() => transitionTriggerRef.current?.focus())
  }

  const confirmTransition = async (): Promise<void> => {
    if (!pendingTransition) return
    const request = pendingTransition
    setBusy(true)
    try {
      const result = await window.myTracer.actions[request.kind]({
        actionId: request.actionId,
        currentNextResolution: request.currentNextResolution
      })
      setPendingTransition(null)
      if (result.ok) {
        await refresh(request.actionId)
      } else {
        setError(actionErrorText[result.error.code])
      }
    } catch {
      setPendingTransition(null)
      setError(actionErrorText['persistence-failed'])
    } finally {
      setBusy(false)
    }
  }

  const replacementCandidates =
    today?.availableActions.filter(
      (action) =>
        action.id !== detail?.id &&
        action.goalId === detail?.goalId &&
        action.status === 'pending'
    ) ?? []

  return (
    <section className="today-workspace" aria-label="今日行动">
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="today-date-row">
        <span>当前本地日期</span>
        <strong>{today?.localDate ?? '读取中'}</strong>
      </div>
      <section className="goal-card planned-routines" aria-label="今日 Routine 计划">
        <div className="card-heading">
          <p className="eyebrow">今日 Routine</p>
          <h2>当天匹配的活跃节奏</h2>
        </div>
        <div className="planned-routine-list">
          {today?.plannedRoutines.length ? today.plannedRoutines.map((routine) => (
            <article key={routine.id}>
              <div>
                <strong>{routine.name}</strong>
                <span>最小行动：{routine.minimumAction}</span>
                <small>
                  {routine.goal
                    ? `目标：${routine.goal.name} · ${goalStatusText[routine.goal.status]}`
                    : '未关联目标'}
                </small>
              </div>
              <span className="status-badge status-active">
                {routineRecordOutcomeText[routine.recordState]}
              </span>
              <RoutineRecordingPanel
                routineId={routine.id}
                routineName={routine.name}
                initialState={{
                  routineId: routine.id,
                  localDate: today.localDate,
                  plannedByCurrentSchedule: true,
                  recordState: routine.recordState,
                  record: routine.record
                }}
                onSaved={async () => refresh()}
              />
            </article>
          )) : <p className="empty-copy">今天没有匹配的活跃 Routine。</p>}
        </div>
      </section>
      <div className="today-grid">
        <div className="goal-column">
          <form className="goal-card goal-create" onSubmit={(event) => void submitCreate(event)}>
            <div className="card-heading">
              <p className="eyebrow">新行动</p>
              <h2>留下一个可以直接开始的小步骤</h2>
            </div>
            <label>
              行动标题
              <input required value={createTitle} onChange={(event) => setCreateTitle(event.target.value)} />
            </label>
            <label>
              说明（可选）
              <textarea rows={2} value={createDescription} onChange={(event) => setCreateDescription(event.target.value)} />
            </label>
            <label>
              关联目标（可选）
              <select value={createGoalId} onChange={(event) => setCreateGoalId(event.target.value)}>
                <option value="">不关联目标</option>
                {activeGoals.map((goal) => (
                  <option key={goal.id} value={goal.id}>{goal.name}</option>
                ))}
              </select>
            </label>
            <button className="primary-button" type="submit" disabled={busy}>创建行动</button>
          </form>

          <div className="goal-card goal-list-card">
            <div className="card-heading">
              <p className="eyebrow">今日重点</p>
              <h2>只显示你明确选入的行动</h2>
            </div>
            <div className="action-list">
              {today?.focuses.length ? (
                today.focuses.map((action) => (
                  <div className="focus-row" key={action.id}>
                    <button type="button" onClick={() => showDetail(action)}>
                      <span>{action.title}</span>
                      <small>{actionStatusText[action.status]}{action.goal ? ` · ${action.goal.name}` : ''}</small>
                    </button>
                    <button className="quiet-button" type="button" disabled={busy} onClick={() => void removeFromToday(action.id)}>移出今天</button>
                  </div>
                ))
              ) : (
                <p className="empty-copy">今天还没有重点；系统不会自动搬运旧行动。</p>
              )}
            </div>
          </div>

          <div className="goal-card goal-list-card">
            <div className="card-heading">
              <p className="eyebrow">行动列表</p>
              <h2>由你决定哪些进入今天</h2>
            </div>
            <div className="action-list">
              {today?.availableActions.length ? (
                today.availableActions.map((action) => (
                  <button className="goal-list-item" type="button" key={action.id} onClick={() => showDetail(action)}>
                    <span>{action.title}</span>
                    <small>{actionStatusText[action.status]}{action.selectedForToday ? ' · 今日已选择' : ''}</small>
                  </button>
                ))
              ) : (
                <p className="empty-copy">还没有行动。</p>
              )}
            </div>
          </div>
        </div>

        <div className="goal-column">
          {detail ? (
            <article className="goal-card action-detail" aria-label={`${detail.title} 行动详情`}>
              <div className="detail-title-row">
                <div>
                  <p className="eyebrow">{detail.goal?.name ?? '独立行动'}</p>
                  <h2>{detail.title}</h2>
                </div>
                <span className={`status-badge action-status-${detail.status}`}>{actionStatusText[detail.status]}</span>
              </div>
              <p className="availability-copy">
                {detail.unavailableReason
                  ? unavailableReasonText[detail.unavailableReason]
                  : detail.selectedForToday
                    ? '已由你选入今天，可以从这里继续。'
                    : '当前可行动；是否选入今天由你决定。'}
              </p>

              <ActionRecordingPanel
                key={detail.id}
                action={detail}
                replacementCandidates={replacementCandidates}
                onSaved={async (action) => refresh(action.id)}
              />

              <form className="detail-form" onSubmit={(event) => void submitUpdate(event)}>
                <label>
                  行动标题
                  <input required value={editTitle} onChange={(event) => setEditTitle(event.target.value)} />
                </label>
                <label>
                  说明（可选）
                  <textarea rows={2} value={editDescription} onChange={(event) => setEditDescription(event.target.value)} />
                </label>
                <button className="secondary-button" type="submit" disabled={busy}>保存行动修改</button>
              </form>

              {detail.isCurrentNextAction ? (
                <div className="resolution-panel">
                  <h3>处理目标的当前下一步</h3>
                  {detail.goal?.status === 'active' ? (
                    <>
                      <label>
                        状态转换后
                        <select value={resolutionMode} onChange={(event) => setResolutionMode(event.target.value as ResolutionMode)}>
                          <option value="clear">清空当前下一步</option>
                          <option value="use-existing">改用已有待行动</option>
                          <option value="create-and-use">创建并使用新行动</option>
                        </select>
                      </label>
                      {resolutionMode === 'use-existing' ? (
                        <label>
                          已有待行动
                          <select required value={replacementActionId} onChange={(event) => setReplacementActionId(event.target.value)}>
                            <option value="">请选择</option>
                            {replacementCandidates.map((action) => (
                              <option key={action.id} value={action.id}>{action.title}</option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                      {resolutionMode === 'create-and-use' ? (
                        <label>
                          新的当前下一步
                          <input required value={replacementTitle} onChange={(event) => setReplacementTitle(event.target.value)} />
                        </label>
                      ) : null}
                    </>
                  ) : (
                    <p className="empty-copy">目标不是活跃状态，本次只能清空当前下一步。</p>
                  )}
                </div>
              ) : null}

              <div className="action-controls">
                {detail.canSelectForToday && !detail.selectedForToday ? (
                  <button type="button" disabled={busy} onClick={() => void selectForToday(detail.id)}>选入今天</button>
                ) : null}
                {detail.selectedForToday ? (
                  <button type="button" disabled={busy} onClick={() => void removeFromToday(detail.id)}>移出今天</button>
                ) : null}
                {detail.status === 'pending' ? (
                  <>
                    <button type="button" disabled={busy} onClick={(event) => requestTransition('complete', event.currentTarget)}>标记完成</button>
                    <button type="button" disabled={busy} onClick={(event) => requestTransition('cancel', event.currentTarget)}>取消行动</button>
                    <button type="button" disabled={busy} onClick={(event) => requestTransition('reschedule', event.currentTarget)}>重新安排</button>
                  </>
                ) : null}
              </div>
              {pendingTransition ? (
                <div className="transition-confirmation" role="alertdialog" aria-labelledby="transition-confirmation-title">
                  <div>
                    <h3 id="transition-confirmation-title">确认{transitionLabels[pendingTransition.kind]}</h3>
                    <p>确定{transitionLabels[pendingTransition.kind]}“{pendingTransition.actionTitle}”吗？</p>
                  </div>
                  <div className="transition-confirmation-actions">
                    <button type="button" autoFocus disabled={busy} onClick={() => void confirmTransition()}>
                      确认{transitionLabels[pendingTransition.kind]}
                    </button>
                    <button type="button" disabled={busy} onClick={dismissTransition}>返回</button>
                  </div>
                </div>
              ) : null}
            </article>
          ) : (
            <div className="goal-card detail-empty">
              <div className="placeholder-icon" aria-hidden="true">◎</div>
              <h2>选择一个行动查看详情</h2>
              <p>完成或取消会保留当天选择；重新安排会移出今天并保留历史。</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function ProgressWorkspace(): ReactNode {
  const [goals, setGoals] = useState<readonly GoalSummaryDto[]>([])
  const [goalId, setGoalId] = useState('')
  const [from, setFrom] = useState('')
  const [through, setThrough] = useState('')
  const [progress, setProgress] = useState<ProgressViewDto | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async (filter = { goalId, from, through }): Promise<void> => {
    setBusy(true)
    const result = await window.myTracer.progress.get({
      goalId: filter.goalId || null,
      from: filter.from || null,
      through: filter.through || null
    })
    setBusy(false)
    if (result.ok) {
      setProgress(result.value)
      setError(null)
    } else {
      setError(progressErrorText[result.error.code])
    }
  }

  useEffect(() => {
    let active = true
    void Promise.all([window.myTracer.goals.list({ status: null }), window.myTracer.progress.get({})])
      .then(([goalResult, progressResult]) => {
        if (!active) return
        setBusy(false)
        if (goalResult.ok) setGoals(goalResult.value)
        if (progressResult.ok) {
          setProgress(progressResult.value)
          setError(null)
        } else {
          setError(progressErrorText[progressResult.error.code])
        }
      })
      .catch(() => {
        if (active) {
          setBusy(false)
          setError(progressErrorText['persistence-failed'])
        }
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <section className="progress-workspace" aria-label="进展事实">
      <form
        className="progress-filters"
        onSubmit={(event) => {
          event.preventDefault()
          void load()
        }}
      >
        <label>
          目标（可选）
          <select value={goalId} onChange={(event) => setGoalId(event.target.value)}>
            <option value="">全部目标与无目标行动</option>
            {goals.map((goal) => (
              <option key={goal.id} value={goal.id}>{goal.name}</option>
            ))}
          </select>
        </label>
        <label>
          开始日期（包含）
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label>
          结束日期（包含）
          <input type="date" value={through} onChange={(event) => setThrough(event.target.value)} />
        </label>
        <button className="primary-button" type="submit" disabled={busy}>查看事实</button>
      </form>

      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {busy && !progress ? <p className="empty-copy" role="status">正在读取本地事实…</p> : null}
      {progress ? (
        <>
          <div className="progress-summary" aria-label="进展汇总">
            <article>
              <span>累计行动分钟</span>
              <strong>{progress.totalDurationMinutes}</strong>
            </article>
            <article>
              <span>记录到的行动次数</span>
              <strong>{progress.realActionCount}</strong>
            </article>
            <article>
              <span>Routine 达到目标次数</span>
              <strong>{progress.targetMetCount}</strong>
            </article>
            <article>
              <span>计划日达到目标次数</span>
              <strong>{progress.plannedTargetMetCount}</strong>
            </article>
          </div>

          {progress.routineRecords.length ? (
            <section aria-label="Routine 事实">
              <h2 className="progress-section-title">Routine 事实</h2>
              <ol className="progress-records routine-progress-records">
                {progress.routineRecords.map((record) => (
                  <li key={record.recordId}>
                    <div className="progress-record-heading">
                      <div>
                        <h2>{record.routineName}</h2>
                        <p>
                          {record.occurredOn} · {routineRecordOutcomeText[record.outcome]} ·{' '}
                          {record.plannedForDate ? '计划日快照' : '非计划日事实'}
                        </p>
                      </div>
                      <strong>
                        {record.durationMinutes === null ? '时长未记录' : `${record.durationMinutes} 分钟`}
                      </strong>
                    </div>
                    {record.note ? <p>{record.note}</p> : null}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {progress.records.length ? (
            <section aria-label="Action 事实">
              <h2 className="progress-section-title">Action 事实</h2>
              <ol className="progress-records">
              {progress.records.map((record) => (
                <li key={record.recordId}>
                  <div className="progress-record-heading">
                    <div>
                      <h2>{record.actionTitle}</h2>
                      <p>{record.occurredOn} · {recordOutcomeText[record.outcome]}</p>
                    </div>
                    <strong>{record.durationMinutes === 0 ? '少于 1 分钟' : `${record.durationMinutes} 分钟`}</strong>
                  </div>
                  {record.understandings.length ? (
                    <div className="progress-fact-group">
                      <h3>确认理解</h3>
                      {record.understandings.map((item) => <p key={item.id}>{item.text}</p>)}
                    </div>
                  ) : null}
                  {record.openConfusions.length ? (
                    <div className="progress-fact-group">
                      <h3>开放困惑</h3>
                      {record.openConfusions.map((item) => <p key={item.id}>{item.text}</p>)}
                    </div>
                  ) : null}
                </li>
              ))}
              </ol>
            </section>
          ) : null}
          {!progress.records.length && !progress.routineRecords.length ? (
            <div className="progress-empty">
              <h2>这个范围内还没有已记录事实</h2>
              <p>空白不表示失败、未坚持或未掌握；它只表示当前筛选没有 ActionRecord 或 RoutineRecord。</p>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}

class ShellErrorBoundary extends Component<{ readonly children: ReactNode }, { readonly failed: boolean }> {
  public state = { failed: false }

  public static getDerivedStateFromError(): { readonly failed: boolean } {
    return { failed: true }
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Renderer boundary caught an error.', { message: error.message, componentStack: info.componentStack })
  }

  public render(): ReactNode {
    if (this.state.failed) {
      return (
        <main className="fatal-state">
          <p className="eyebrow">界面暂时不可用</p>
          <h1>MyTracer 没有修改任何数据</h1>
          <p>请关闭并重新打开应用。此状态不会绕过应用命令写入业务数据。</p>
        </main>
      )
    }
    return this.props.children
  }
}

function Shell(): ReactNode {
  const [activeSection, setActiveSection] = useState<Section>('today')
  const [status, setStatus] = useState<ShellStatus | null>(null)
  const [statusError, setStatusError] = useState(false)

  useEffect(() => {
    let active = true
    window.myTracer.shell
      .getStatus()
      .then((nextStatus) => {
        if (active) setStatus(nextStatus)
      })
      .catch(() => {
        if (active) setStatusError(true)
      })
    return () => {
      active = false
    }
  }, [])

  const selected = sections.find((section) => section.id === activeSection) ?? sections[0]

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true">M</span>
          <div>
            <p className="brand">MyTracer</p>
            <p className="brand-note">事实、行动与温和恢复</p>
          </div>
        </div>
        <div className={`connection ${statusError ? 'connection-error' : ''}`} role="status">
          <span aria-hidden="true" />
          {statusError ? '安全边界响应失败' : status ? '本地安全边界已连接' : '正在连接本地边界'}
        </div>
      </header>

      <div className="workspace">
        <nav className="sidebar" aria-label="主要视图">
          <p className="nav-label">空间</p>
          {sections.map((section) => (
            <button
              className={section.id === activeSection ? 'nav-item active' : 'nav-item'}
              key={section.id}
              type="button"
              aria-pressed={section.id === activeSection}
              onClick={() => setActiveSection(section.id)}
            >
              <span className="nav-dot" aria-hidden="true" />
              {section.label}
            </button>
          ))}
          <div className="sidebar-note">
            <p>本地优先</p>
            <span>目标和下一步保存在本机；AI 未配置也不影响使用。</span>
          </div>
        </nav>

        <main className="content">
          <section className="hero" aria-labelledby="section-title">
            <p className="eyebrow">{selected.eyebrow}</p>
            <h1 id="section-title">{selected.title}</h1>
            <p className="lede">{selected.description}</p>
          </section>

          {activeSection === 'goals' ? (
            <GoalWorkspace />
          ) : activeSection === 'routines' ? (
            <RoutineWorkspace />
          ) : activeSection === 'today' ? (
            <TodayWorkspace />
          ) : activeSection === 'progress' ? (
            <ProgressWorkspace />
          ) : (
            <section className="placeholder-card" aria-label={`${selected.label} 占位内容`}>
              <div className="placeholder-icon" aria-hidden="true">◎</div>
              <div>
                <h2>{selected.label} 空壳已就绪</h2>
                <p>业务能力会在后续获批任务中逐步加入。这里不会因 AI 未配置而阻塞。</p>
              </div>
            </section>
          )}

          <footer className="status-strip">
            <div>
              <span>应用版本</span>
              <strong>{status?.appVersion ?? '读取中'}</strong>
            </div>
            <div>
              <span>运行边界</span>
              <strong>{status ? 'Windows · Main / Preload / Renderer' : '验证中'}</strong>
            </div>
            <div>
              <span>AI 状态</span>
              <strong>{status?.ai.availability === 'not-configured' ? '未配置 · 不影响使用' : '读取中'}</strong>
            </div>
          </footer>
        </main>
      </div>
    </div>
  )
}

export function App(): ReactNode {
  return (
    <ShellErrorBoundary>
      <Shell />
    </ShellErrorBoundary>
  )
}
