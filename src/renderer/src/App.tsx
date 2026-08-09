import { Component, type ErrorInfo, type ReactNode, useEffect, useState } from 'react'
import type {
  GoalDetailDto,
  GoalErrorCode,
  GoalStatusDto,
  GoalSummaryDto
} from '../../contracts/goals'
import type { ShellStatus } from '../../contracts/shell'

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
    description: '此处将承载由你选择的今日重点、例行与非强制意向。T011 不会自动把行动选入今天。'
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

  const changeStatus = async (transition: 'pause' | 'resume' | 'end'): Promise<void> => {
    if (!detail) return
    if (
      transition === 'end' &&
      !window.confirm('结束后不能恢复，但已有下一步和历史会保留。确定结束这个目标吗？')
    ) {
      return
    }
    setBusy(true)
    const result = await window.myTracer.goals[transition]({ goalId: detail.id })
    setBusy(false)
    if (result.ok) {
      await reloadDetail(detail.id)
    } else {
      setError(goalErrorText[result.error.code])
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
                  <button className="end-button" type="button" disabled={busy} onClick={() => void changeStatus('end')}>
                    结束目标
                  </button>
                ) : (
                  <p className="terminal-copy">该目标已结束。已有下一步、行动与记录仍然保留。</p>
                )}
              </div>

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
