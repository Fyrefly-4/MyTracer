import '../forms-workspace.css'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import type {
  GoalDetailDto,
  GoalErrorCode,
  GoalStatusDto,
  GoalSummaryDto
} from '../../../../contracts/goals'
import {
  useUiSession,
  usePagePosition,
  revealStart,
  useUiLifetime,
  useUnsavedContent
} from '../../app/ui-session'
import { goalStatusText, actionStatusText, recordOutcomeText } from '../../app/ui-text'
import { RecoveryPanel } from './RecoveryPanel'
import type { GoalActivityViewDto } from '../../../../contracts/progress'

const goalErrorText: Record<GoalErrorCode, string> = {
  validation: '请检查必填内容。',
  'not-found': '目标或行动已不存在，请刷新后重试。',
  'invalid-transition': '当前状态不能执行这个操作。',
  'invariant-violation': '这个行动不能作为该目标的当前下一步。',
  'persistence-failed': '本地数据暂时无法保存或读取。'
}

interface PendingGoalEnd {
  readonly goalId: string
  readonly goalName: string
}

const newNextActionOption = '__new-next-action__'
const unsetNextActionOption = '__unset-next-action__'

function NewNextActionForm(props: {
  readonly goalId: string
  readonly visible: boolean
  readonly onSaved: () => Promise<void>
}): ReactNode {
  const activeRef = useUiLifetime()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useUnsavedContent(`goal-next-action-${props.goalId}`, Boolean(title || description))

  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (busy) return
    if (!title.trim()) {
      setError('请填写下一步名称。')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await window.myTracer.goals.createAndSetCurrentNextAction({
        goalId: props.goalId,
        title: title.trim(),
        description: description.trim() || null
      })
      if (!activeRef.current) return
      if (!result.ok) {
        setError(goalErrorText[result.error.code])
        return
      }
      setTitle('')
      setDescription('')
      await props.onSaved()
    } catch {
      if (activeRef.current) setError(goalErrorText['persistence-failed'])
    } finally {
      if (activeRef.current) setBusy(false)
    }
  }

  if (!props.visible) return null

  return (
    <form className="current-action-control" onSubmit={(event) => void submit(event)}>
      <h3>新建下一步</h3>
      <label>
        下一步名称
        <input
          required
          value={title}
          disabled={busy}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <label>
        下一步说明（选填）
        <textarea
          rows={2}
          value={description}
          disabled={busy}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <p className="empty-copy">创建后设为当前下一步，不会自动加入今天；已有行动和记录会保留。</p>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="secondary-button" type="submit" disabled={busy}>
        创建并设为当前下一步
      </button>
    </form>
  )
}

function GoalWorkspace(): ReactNode {
  const activeRef = useUiLifetime()
  const session = useUiSession()
  const [statusFilter, setStatusFilter] = useState<GoalStatusDto | ''>(session.goalFilter)
  const [loaded, setLoaded] = useState(false)
  const [selectionLoaded, setSelectionLoaded] = useState(false)
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const detailRef = useRef<HTMLElement | null>(null)
  usePagePosition('goals', loaded && selectionLoaded)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [goals, setGoals] = useState<readonly GoalSummaryDto[]>([])
  const [activity, setActivity] = useState<GoalActivityViewDto | null>(null)
  const [activityError, setActivityError] = useState(false)
  const [detail, setDetail] = useState<GoalDetailDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [createNextAction, setCreateNextAction] = useState('')
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [selectedActionId, setSelectedActionId] = useState(unsetNextActionOption)
  const [pendingGoalEnd, setPendingGoalEnd] = useState<PendingGoalEnd | null>(null)
  const [recoveryGoalId, setRecoveryGoalId] = useState<string | null>(session.recoveryGoalId)
  useUnsavedContent(
    'goal-form',
    Boolean(createName || createDescription || createNextAction) ||
      (detail !== null &&
        (editName !== detail.name || editDescription !== (detail.description ?? '')))
  )
  const goalEndTriggerRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    let active = true
    void window.myTracer.progress
      .goalActivity({})
      .then((result) => {
        if (!active) return
        setActivity(result.ok ? result.value : null)
        setActivityError(!result.ok)
      })
      .catch(() => {
        if (active) {
          setActivity(null)
          setActivityError(true)
        }
      })
    return () => {
      active = false
    }
  }, [refreshVersion])

  const activityText = (goalId: string): string => {
    const fact = activity?.goals.find((item) => item.goalId === goalId)
    if (!fact) return activityError ? '行动日期暂时无法读取' : '正在读取行动日期…'
    if (fact.daysSinceLastRealAction === null) return '尚无行动记录'
    return fact.daysSinceLastRealAction < 0
      ? `最近行动记录日期 ${fact.lastRealActionOn}（晚于今天）`
      : `距上次真实行动 ${fact.daysSinceLastRealAction} 天`
  }

  useEffect(() => {
    let active = true
    window.myTracer.goals.list({ status: statusFilter || null }).then((result) => {
      if (!active) return
      setLoaded(true)
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

  useEffect(() => {
    let active = true
    const goalId = session.goalId
    if (!goalId) {
      Promise.resolve().then(() => {
        if (active) setSelectionLoaded(true)
      })
    } else {
      void window.myTracer.goals
        .getDetail({ goalId })
        .then((result) => {
          if (!active) return
          if (session.goalId !== goalId) {
            setSelectionLoaded(true)
            return
          }
          if (result.ok) {
            setDetail(result.value)
            setEditName(result.value.name)
            setEditDescription(result.value.description ?? '')
            setSelectedActionId(result.value.currentNextActionId ?? unsetNextActionOption)
          } else {
            if (result.error.code === 'not-found') session.selectGoal(null)
            setSelectionError(goalErrorText[result.error.code])
          }
          setSelectionLoaded(true)
        })
        .catch(() => {
          if (active) {
            setSelectionError(goalErrorText['persistence-failed'])
            setSelectionLoaded(true)
          }
        })
    }
    return () => {
      active = false
    }
  }, [session])

  const showDetail = (nextDetail: GoalDetailDto): void => {
    if (!activeRef.current) return
    setSelectionError(null)
    session.selectGoal(nextDetail.id)
    setDetail(nextDetail)
    setEditName(nextDetail.name)
    setEditDescription(nextDetail.description ?? '')
    setSelectedActionId(nextDetail.currentNextActionId ?? unsetNextActionOption)
    setPendingGoalEnd(null)
    if (session.recoveryGoalId !== nextDetail.id) {
      session.setRecoveryGoal(null)
      setRecoveryGoalId(null)
    }
  }

  const selectGoal = async (goalId: string, reveal = true): Promise<void> => {
    if (!activeRef.current) return
    session.selectGoal(goalId)
    setBusy(true)
    const result = await window.myTracer.goals.getDetail({ goalId })
    setBusy(false)
    if (!activeRef.current || session.goalId !== goalId) return
    if (result.ok) {
      showDetail(result.value)
      if (reveal) requestAnimationFrame(() => revealStart(detailRef.current))
      setError(null)
    } else {
      setError(goalErrorText[result.error.code])
    }
  }

  const reloadDetail = async (goalId: string): Promise<void> => {
    await selectGoal(goalId, false)
    setRefreshVersion((version) => version + 1)
  }

  const refreshAfterRecoveryMutation = async (): Promise<void> => {
    if (!detail) return
    const result = await window.myTracer.goals.getDetail({ goalId: detail.id })
    if (result.ok) {
      setDetail(result.value)
      setEditName(result.value.name)
      setEditDescription(result.value.description ?? '')
      setSelectedActionId(result.value.currentNextActionId ?? unsetNextActionOption)
      setRefreshVersion((version) => version + 1)
      setError(null)
    } else {
      setError(goalErrorText[result.error.code])
    }
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
      setCreating(false)
      requestAnimationFrame(() => revealStart(detailRef.current))
      setCreateName('')
      setCreateDescription('')
      setCreateNextAction('')
      if (activeRef.current) session.setGoalFilter('')
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
    if (
      !detail ||
      selectedActionId === newNextActionOption ||
      selectedActionId === unsetNextActionOption
    )
      return
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
      {selectionError ? (
        <p className="form-error" role="alert">
          {selectionError}
        </p>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="page-actions workspace-toolbar">
        <p className="workspace-count">
          {goals.length
            ? `${goals.length} 个目标 · 留下方向，也留一点余地`
            : '从一个想继续的方向开始'}
        </p>
        <button
          type="button"
          className="secondary-button"
          aria-expanded={creating}
          onClick={() => setCreating(!creating)}
        >
          新建目标
        </button>
      </div>
      {creating ? (
        <form
          className="goal-card goal-create workspace-form"
          aria-label="新建目标表单"
          onSubmit={(event) => void submitCreate(event)}
        >
          <div className="card-heading">
            <p className="eyebrow">新目标</p>
            <h2>留下方向与一个可开始的步骤</h2>
          </div>
          <div className="workspace-form-fields">
            <label>
              目标名称
              <input
                autoFocus
                required
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
              />
            </label>
            <label>
              当前下一步（可选）
              <input
                value={createNextAction}
                onChange={(event) => setCreateNextAction(event.target.value)}
                placeholder="例如：运行一个 React 状态更新示例"
              />
            </label>
            <label className="form-field-wide">
              说明（可选）
              <textarea
                rows={2}
                value={createDescription}
                onChange={(event) => setCreateDescription(event.target.value)}
              />
            </label>
          </div>
          <div className="workspace-form-actions">
            <button className="primary-button" type="submit" disabled={busy}>
              创建目标
            </button>
            <button type="button" disabled={busy} onClick={() => setCreating(false)}>
              取消新建
            </button>
            <span>先留下方向，下一步可以稍后再补。</span>
          </div>
        </form>
      ) : null}
      <div className="goal-grid">
        <div className="goal-column">
          <div className="goal-card goal-list-card">
            <div className="card-heading inline-heading">
              <div>
                <p className="eyebrow">目标列表</p>
                <h2>我的目标</h2>
              </div>
              <label className="compact-field">
                状态
                <select
                  aria-label="状态"
                  value={statusFilter}
                  onChange={(event) => {
                    const value = event.target.value as GoalStatusDto | ''
                    session.setGoalFilter(value)
                    setStatusFilter(value)
                  }}
                >
                  <option value="">全部</option>
                  <option value="active">活跃</option>
                  <option value="paused">暂停</option>
                  <option value="ended">结束</option>
                </select>
              </label>
            </div>
            <p className="empty-copy">
              可以先保留少量活跃目标，把注意力留给现在想做的事；数量由你决定。
            </p>
            {activity ? <p className="empty-copy">行动日期截至 {activity.asOfLocalDate}</p> : null}
            {activityError ? (
              <p role="status">
                行动日期暂时无法读取。
                <button type="button" onClick={() => setRefreshVersion((version) => version + 1)}>
                  重试行动日期
                </button>
              </p>
            ) : null}
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
                      {goalStatusText[goal.status]} ·{' '}
                      {goal.currentNextActionId ? '有下一步' : '下一步为空'}
                    </small>
                    <small>{activityText(goal.id)}</small>
                  </button>
                ))}
              </div>
            ) : (
              <p className="empty-copy">这个筛选下还没有目标。</p>
            )}
          </div>
        </div>

        <div className="goal-column">
          {detail && recoveryGoalId ? (
            <RecoveryPanel
              goalId={recoveryGoalId}
              onClose={() => {
                session.setRecoveryGoal(null)
                setRecoveryGoalId(null)
              }}
              onMutation={refreshAfterRecoveryMutation}
            />
          ) : detail ? (
            <article
              ref={detailRef}
              className="goal-card goal-detail"
              aria-label={`${detail.name} 详情`}
            >
              <div className="detail-title-row">
                <div>
                  <p className="eyebrow">目标详情</p>
                  <h2>{detail.name}</h2>
                </div>
                <span className={`status-badge status-${detail.status}`}>
                  {goalStatusText[detail.status]}
                </span>
              </div>
              {detail.description ? <p className="goal-description">{detail.description}</p> : null}
              <div className="next-action-panel">
                <span>当前下一步</span>
                <strong>{detail.currentNextAction?.title ?? '暂未设置'}</strong>
                {detail.currentNextAction?.selectedForToday ? <small>今日已选择</small> : null}
                {detail.currentNextActionId ? (
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => {
                      if (detail.currentNextActionId) session.openAction(detail.currentNextActionId)
                    }}
                  >
                    去今天处理
                  </button>
                ) : null}
              </div>
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  session.setRecoveryGoal(detail.id)
                  setRecoveryGoalId(detail.id)
                }}
              >
                查看恢复与整理
              </button>

              <div className="related-section">
                <h3>关联行动</h3>
                {detail.actions.length ? (
                  detail.actions.map((action) => (
                    <div className="related-row" key={action.id}>
                      <span>{action.title}</span>
                      <small>{actionStatusText[action.status]}</small>
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
                    <button
                      className="related-row related-record-button"
                      type="button"
                      key={record.id}
                      onClick={() =>
                        session.openDataRecord({ type: 'action-record', id: record.id }, 'goals')
                      }
                    >
                      <span>
                        {record.actionTitle} · {record.durationMinutes} 分钟
                      </span>
                      <small>
                        {record.occurredOn} · {recordOutcomeText[record.outcome]} · 查看完整记录
                      </small>
                    </button>
                  ))
                ) : (
                  <p className="empty-copy">暂无记录。做过一点后，可以从行动入口留下记录。</p>
                )}
              </div>
              <details className="disclosure" key={detail.id}>
                <summary>编辑与管理目标</summary>
                <form className="detail-form" onSubmit={(event) => void submitUpdate(event)}>
                  <label>
                    目标名称
                    <input
                      required
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                    />
                  </label>
                  <label>
                    说明（可选）
                    <textarea
                      rows={2}
                      value={editDescription}
                      onChange={(event) => setEditDescription(event.target.value)}
                    />
                  </label>
                  <button className="secondary-button" type="submit" disabled={busy}>
                    保存修改
                  </button>
                </form>

                {detail.status === 'active' ? (
                  <div className="current-action-control">
                    <label>
                      选择当前下一步
                      <select
                        value={selectedActionId}
                        disabled={busy}
                        onChange={(event) => setSelectedActionId(event.target.value)}
                      >
                        {!detail.currentNextActionId ? (
                          <option value={unsetNextActionOption} disabled>
                            暂未设置当前下一步
                          </option>
                        ) : null}
                        <option value="">清空当前下一步</option>
                        {detail.actions
                          .filter((action) => action.status === 'pending')
                          .map((action) => (
                            <option key={action.id} value={action.id}>
                              {action.title}
                            </option>
                          ))}
                        <option value={newNextActionOption}>新建下一步…</option>
                      </select>
                    </label>
                    {!detail.actions.some((action) => action.status === 'pending') ? (
                      <p className="empty-copy">暂无待行动，可以在下拉框中选择“新建下一步…”。</p>
                    ) : null}
                    {selectedActionId !== newNextActionOption ? (
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={
                          busy ||
                          selectedActionId === unsetNextActionOption ||
                          selectedActionId === (detail.currentNextActionId ?? '')
                        }
                        onClick={() => void saveCurrentNextAction()}
                      >
                        保存当前下一步
                      </button>
                    ) : null}
                    <NewNextActionForm
                      key={detail.id}
                      goalId={detail.id}
                      visible={selectedActionId === newNextActionOption}
                      onSaved={() => reloadDetail(detail.id)}
                    />
                  </div>
                ) : null}

                <div className="lifecycle-actions">
                  {detail.status === 'active' ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void changeStatus('pause')}
                    >
                      暂停目标
                    </button>
                  ) : null}
                  {detail.status === 'paused' ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void changeStatus('resume')}
                    >
                      恢复目标
                    </button>
                  ) : null}
                  {detail.status !== 'ended' ? (
                    <button
                      className="end-button"
                      type="button"
                      disabled={busy}
                      onClick={(event) => requestGoalEnd(event.currentTarget)}
                    >
                      结束目标
                    </button>
                  ) : (
                    <p className="terminal-copy">该目标已结束。已有下一步、行动与记录仍然保留。</p>
                  )}
                </div>
                {pendingGoalEnd ? (
                  <div
                    className="transition-confirmation is-danger"
                    role="alertdialog"
                    aria-labelledby="goal-end-confirmation-title"
                  >
                    <div>
                      <h3 id="goal-end-confirmation-title">确认结束目标</h3>
                      <p>结束“{pendingGoalEnd.goalName}”后不能恢复，但已有下一步和历史会保留。</p>
                    </div>
                    <div className="transition-confirmation-actions">
                      <button
                        type="button"
                        autoFocus
                        disabled={busy}
                        onClick={() => void confirmGoalEnd()}
                      >
                        确认结束
                      </button>
                      <button type="button" disabled={busy} onClick={dismissGoalEnd}>
                        返回
                      </button>
                    </div>
                  </div>
                ) : null}
              </details>
            </article>
          ) : (
            <div className="goal-card detail-empty">
              <div className="placeholder-icon" aria-hidden="true">
                ◎
              </div>
              <h2>选择一个目标查看详情</h2>
              <p>暂停或结束只改变目标状态，不会清除已有下一步和历史。</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export { GoalWorkspace as GoalsPage }
