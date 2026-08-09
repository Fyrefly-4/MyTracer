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

type Section = 'goals' | 'today' | 'progress' | 'review'

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
    id: 'today',
    label: 'Today',
    eyebrow: '轻量开始',
    title: '今天，从一个真实动作开始',
    description: '这里仅显示你明确选入今天的行动；旧日期不会自动搬运，也不会设置数量硬上限。'
  },
  {
    id: 'progress',
    label: 'Progress',
    eyebrow: '只看事实',
    title: '进展会来自已经记录的事实',
    description: '后续切片会展示投入时间、行动次数和你亲自确认的理解；当前不会推断得分、连续性或失败。'
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
          ) : activeSection === 'today' ? (
            <TodayWorkspace />
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
