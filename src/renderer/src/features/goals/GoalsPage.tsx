import { chooseVisibleSelection } from '../../app/selection-preferences'
import '../forms-workspace.css'
import '../object-workspace.css'
import {
  type ReactNode,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore
} from 'react'
import type {
  GoalDetailDto,
  GoalErrorCode,
  GoalStatusDto,
  GoalSummaryDto
} from '../../../../contracts/goals'
import {
  useUiSession,
  useActiveUnsavedContent,
  usePagePosition,
  revealStart,
  useUiLifetime,
  useUnsavedContent
} from '../../app/ui-session'
import { goalStatusText, actionStatusText, recordOutcomeText } from '../../app/ui-text'
import { GoalCoverAppearance } from './GoalCoverAppearance'
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
  const session = useUiSession()
  const contentDraft = session.goalContentDraft
  useSyncExternalStore(contentDraft.subscribe, contentDraft.getVersion)
  const [pendingContentGoal, setPendingContentGoal] = useState<string | null>(() =>
    contentDraft.retained && session.goalId !== contentDraft.snapshot?.goalId
      ? session.goalId
      : null
  )
  const [contentMissing, setContentMissing] = useState(false)
  const shownGoalId = useRef<string | null>(null)
  const retainedContentRef = useRef<HTMLTextAreaElement | null>(null)
  const shownSelectionRequest = useRef(0)
  const [routeGoalId, setRouteGoalId] = useState(() => {
    const explicit = session.takeNavigationSelection('goals')
    return contentDraft.retained ? contentDraft.snapshot!.goalId : explicit ? session.goalId : null
  })
  const selectionRequest = useRef(0)
  const [loadedFilter, setLoadedFilter] = useState<string | null>(null)
  const [masterCollapsed, setMasterCollapsed] = useState(false)
  const expandMasterRef = useRef<HTMLButtonElement | null>(null)
  const collapseMasterRef = useRef<HTMLButtonElement | null>(null)
  const didToggleMaster = useRef(false)
  useEffect(() => {
    if (!didToggleMaster.current) return
    ;(masterCollapsed ? expandMasterRef : collapseMasterRef).current?.focus({ preventScroll: true })
  }, [masterCollapsed])
  const [listQuery, setListQuery] = useState('')
  const [listPage, updateListPage] = useState(() => session.getListPage('goals', 'master'))
  const setListPage = (page: number): void => {
    setRouteGoalId(null)
    session.setListPage('goals', 'master', page)
    updateListPage(page)
  }
  const [historyPosition, updateHistoryPosition] = useState(() => ({
    goalId: session.goalId ?? '',
    page: session.getListPage('goals', `history:${session.goalId ?? ''}`)
  }))
  const setHistoryPosition = (position: { goalId: string; page: number }): void => {
    session.setListPage('goals', `history:${position.goalId}`, position.page)
    updateHistoryPosition(position)
  }

  const activeRef = useUiLifetime()
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
  const editName = contentDraft.snapshot?.name ?? detail?.name ?? ''
  const editDescription = contentDraft.snapshot?.description ?? detail?.description ?? ''
  const [selectedActionId, setSelectedActionId] = useState(unsetNextActionOption)
  const [pendingGoalEnd, setPendingGoalEnd] = useState<PendingGoalEnd | null>(null)
  const [recoveryGoalId, setRecoveryGoalId] = useState<string | null>(session.recoveryGoalId)
  useUnsavedContent(
    'goal-form',
    Boolean(createName || createDescription || createNextAction) || contentDraft.retained
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
        setLoadedFilter(statusFilter)
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

  const showDetail = (nextDetail: GoalDetailDto, readVersion = contentDraft.savedVersion): void => {
    if (!activeRef.current) return
    if (contentDraft.retained && contentDraft.snapshot?.goalId !== nextDetail.id) {
      setPendingContentGoal(nextDetail.id)
      return
    }
    const content = contentDraft.read(nextDetail, readVersion)
    shownGoalId.current = nextDetail.id
    shownSelectionRequest.current = selectionRequest.current
    setContentMissing(false)
    setSelectionError(null)
    session.selectGoal(nextDetail.id)
    setDetail(
      readVersion < contentDraft.savedVersion
        ? {
            ...nextDetail,
            name: content.baselineName,
            description: content.baselineDescription || null
          }
        : nextDetail
    )
    setSelectedActionId(nextDetail.currentNextActionId ?? unsetNextActionOption)
    setPendingGoalEnd(null)
    if (session.recoveryGoalId !== nextDetail.id) {
      session.setRecoveryGoal(null)
      setRecoveryGoalId(null)
    }
  }

  const selectGoal = async (goalId: string, reveal = true): Promise<void> => {
    if (!activeRef.current) return
    if (contentDraft.retained && contentDraft.snapshot?.goalId !== goalId) {
      setPendingContentGoal(goalId)
      return
    }
    setRouteGoalId(null)
    const request = ++selectionRequest.current
    session.selectGoal(goalId)
    setBusy(true)
    const readVersion = contentDraft.savedVersion
    try {
      const result = await window.myTracer.goals.getDetail({ goalId })
      if (!activeRef.current || request !== selectionRequest.current) return
      if (result.ok) {
        showDetail(result.value, readVersion)
        if (reveal) requestAnimationFrame(() => revealStart(detailRef.current))
        setError(null)
      } else {
        if (result.error.code === 'not-found' && contentDraft.snapshot?.goalId === goalId) {
          setContentMissing(true)
          setDetail(null)
        }
        setError(goalErrorText[result.error.code])
      }
    } catch {
      if (activeRef.current && request === selectionRequest.current)
        setError(goalErrorText['persistence-failed'])
    } finally {
      if (activeRef.current && request === selectionRequest.current) setBusy(false)
    }
  }

  const reloadDetail = async (
    goalId: string,
    request = shownSelectionRequest.current
  ): Promise<void> => {
    if (!activeRef.current) return
    setRefreshVersion((version) => version + 1)
    if (shownGoalId.current !== goalId || request !== selectionRequest.current) return
    await selectGoal(goalId, false)
  }

  const refreshAfterRecoveryMutation = async (): Promise<void> => {
    if (detail) await reloadDetail(detail.id)
  }

  const refreshSavedContent = useEffectEvent((): void => {
    const saved = contentDraft.lastSaved
    if (!saved) return
    // A content acknowledgement updates only its own displayed metadata, never navigation.
    setGoals((current) =>
      current.map((goal) =>
        goal.id === saved.id ? { ...goal, name: saved.name, description: saved.description } : goal
      )
    )
    setDetail((current) =>
      current?.id === saved.id
        ? { ...current, name: saved.name, description: saved.description }
        : current
    )
  })
  useEffect(() => {
    let active = true
    void Promise.resolve().then(() => {
      if (active && contentDraft.savedVersion > 0) refreshSavedContent()
    })
    return () => {
      active = false
    }
  }, [contentDraft.savedVersion])
  useEffect(() => {
    if (contentDraft.retained) {
      const management = detailRef.current
        ?.querySelector('form.detail-form')
        ?.closest<HTMLDetailsElement>('details')
      if (management) management.open = true
    }
  }, [contentDraft, detail?.id])

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
      setRouteGoalId(result.value.id)
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
    if (!detail || contentMissing) return
    const submitted = contentDraft.beginSave()
    if (!submitted) return
    const request = selectionRequest.current
    try {
      const result = await window.myTracer.goals.updateDetails({
        goalId: submitted.goalId,
        name: submitted.name,
        description: submitted.description || null
      })
      contentDraft.finishSave(submitted, result.ok, result.ok ? result.value : undefined)
      if (!activeRef.current || request !== selectionRequest.current) return
      if (result.ok) {
        setError(null)
      } else {
        if (result.error.code === 'not-found') {
          setContentMissing(true)
          setDetail(null)
        }
        setError(goalErrorText[result.error.code])
      }
    } catch {
      contentDraft.finishSave(submitted, false)
      if (activeRef.current && request === selectionRequest.current)
        setError('目标内容未能保存，输入仍保留。请重试保存。')
    }
  }

  const changeStatus = async (transition: 'pause' | 'resume'): Promise<void> => {
    if (!detail) return
    const request = selectionRequest.current
    setBusy(true)
    const result = await window.myTracer.goals[transition]({ goalId: detail.id })
    if (!activeRef.current || request !== selectionRequest.current) return
    setBusy(false)
    if (result.ok) {
      await reloadDetail(detail.id, request)
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
    const selection = selectionRequest.current
    setBusy(true)
    try {
      const result = await window.myTracer.goals.end({ goalId: request.goalId })
      if (!activeRef.current || selection !== selectionRequest.current) return
      setPendingGoalEnd(null)
      if (result.ok) {
        await reloadDetail(request.goalId, selection)
      } else {
        setError(goalErrorText[result.error.code])
      }
    } catch {
      if (activeRef.current && selection === selectionRequest.current) {
        setPendingGoalEnd(null)
        setError(goalErrorText['persistence-failed'])
      }
    } finally {
      if (activeRef.current && selection === selectionRequest.current) setBusy(false)
    }
  }

  const saveCurrentNextAction = async (): Promise<void> => {
    if (
      !detail ||
      selectedActionId === newNextActionOption ||
      selectedActionId === unsetNextActionOption
    )
      return
    const request = selectionRequest.current
    setBusy(true)
    const result = await window.myTracer.goals.setCurrentNextAction({
      goalId: detail.id,
      actionId: selectedActionId || null
    })
    if (!activeRef.current || request !== selectionRequest.current) return
    setBusy(false)
    if (result.ok) {
      await reloadDetail(detail.id, request)
    } else {
      setError(goalErrorText[result.error.code])
    }
  }

  const filteredItems = goals.filter((item) =>
    item.name.toLocaleLowerCase().includes(listQuery.trim().toLocaleLowerCase())
  )
  const listPageCount = Math.max(1, Math.ceil(filteredItems.length / 6))
  const currentListPage = Math.min(listPage, listPageCount)
  const pageItems = filteredItems.slice((currentListPage - 1) * 6, currentListPage * 6)
  const visibleIds = pageItems.map((item) => item.id).join('|')
  const activeUnsaved = useActiveUnsavedContent()
  const selectionBlocked =
    activeUnsaved ||
    creating ||
    busy ||
    Boolean(pendingGoalEnd) ||
    Boolean(createName || createDescription || createNextAction) ||
    Boolean(detail && contentDraft.retained) ||
    Boolean(pendingContentGoal) ||
    Boolean(detail && selectedActionId !== (detail.currentNextActionId ?? unsetNextActionOption))
  const reconcileSelection = useEffectEvent(async (isActive: () => boolean): Promise<void> => {
    if (
      !loaded ||
      loadedFilter !== statusFilter ||
      (selectionBlocked && !(contentDraft.retained && !detail && !creating && !busy))
    )
      return
    const current = detail?.id
    if (current && pageItems.some((item) => item.id === current)) {
      setSelectionLoaded(true)
      return
    }
    const preferred = chooseVisibleSelection(pageItems, session.goalId, (item) => item.id)
    const requestedGoalId = contentDraft.retained ? contentDraft.snapshot!.goalId : routeGoalId
    const candidates = requestedGoalId
      ? [requestedGoalId, ...pageItems.map((item) => item.id)]
      : preferred
        ? [
            preferred.id,
            ...pageItems.filter((item) => item.id !== preferred.id).map((item) => item.id)
          ]
        : []
    const request = ++selectionRequest.current
    for (const goalId of candidates) {
      const readVersion = contentDraft.savedVersion
      try {
        const result = await window.myTracer.goals.getDetail({ goalId })
        if (!isActive() || request !== selectionRequest.current) return
        if (result.ok) {
          showDetail(result.value, readVersion)
          setSelectionLoaded(true)
          return
        }
        if (
          result.error.code === 'not-found' &&
          contentDraft.retained &&
          contentDraft.snapshot?.goalId === goalId
        ) {
          setContentMissing(true)
          setSelectionLoaded(true)
          return
        }
        if (result.error.code !== 'not-found') {
          setSelectionError(goalErrorText[result.error.code])
          setSelectionLoaded(true)
          return
        }
      } catch {
        if (isActive() && request === selectionRequest.current) {
          setSelectionError(goalErrorText['persistence-failed'])
          setSelectionLoaded(true)
        }
        return
      }
    }
    if (isActive() && request === selectionRequest.current) {
      setDetail(null)
      setSelectionLoaded(true)
    }
  })
  useEffect(() => {
    let active = true
    void Promise.resolve().then(() => {
      if (active) void reconcileSelection(() => active)
    })
    return () => {
      active = false
    }
  }, [
    goals,
    visibleIds,
    loaded,
    loadedFilter,
    statusFilter,
    selectionBlocked,
    routeGoalId,
    detail?.id
  ])

  const historyPageCount = Math.max(1, Math.ceil((detail?.records.length ?? 0) / 5))
  const historyPage = Math.min(
    historyPosition.goalId === detail?.id
      ? historyPosition.page
      : session.getListPage('goals', `history:${detail?.id ?? ''}`),
    historyPageCount
  )

  return (
    <section className="goal-workspace notebook-object-workspace" aria-label="目标管理">
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
      {contentDraft.saveFailed ? (
        <p role="alert">
          目标内容未能保存，草稿仍保留。请重试保存；若目标已不存在，可复制后放弃草稿。
        </p>
      ) : null}
      {pendingContentGoal ? (
        <div
          className="transition-confirmation"
          role="alertdialog"
          aria-label="切换目标前处理内容草稿"
        >
          <p>
            {contentMissing
              ? '原目标已不存在，草稿不能保存。请先复制需要保留的文字；放弃后将清除本次会话中的这份草稿并切换目标。'
              : contentDraft.saving
                ? '目标内容正在保存。离开不会撤销已提交的保存；放弃只清除本地草稿。'
                : contentDraft.dirty
                  ? '当前目标的名称或说明尚未保存。继续编辑，或放弃这两项修改后切换。'
                  : '目标内容已保存。可以继续查看或切换目标。'}
          </p>
          <button
            type="button"
            autoFocus
            onClick={() => {
              setPendingContentGoal(null)
              requestAnimationFrame(() => {
                if (contentMissing) retainedContentRef.current?.focus()
                else
                  detailRef.current
                    ?.querySelector<HTMLInputElement>('form.detail-form input')
                    ?.focus()
              })
            }}
          >
            {contentMissing ? '继续查看目标草稿' : '继续编辑目标内容'}
          </button>
          <button
            type="button"
            onClick={() => {
              const next = pendingContentGoal
              contentDraft.discard()
              setPendingContentGoal(null)
              void selectGoal(next)
            }}
          >
            {contentDraft.retained ? '放弃目标内容并切换' : '切换目标'}
          </button>
        </div>
      ) : null}
      {!detail && contentDraft.retained && contentDraft.snapshot ? (
        <section aria-label="保留的目标内容草稿" className="goal-card">
          <p role="status">
            {contentMissing
              ? '原目标已不存在。草稿仍可阅读和复制，不能保存，也不会重新创建目标。'
              : '尚未读到原目标，草稿仍保留。可以重试读取；读取成功前不能保存。'}
          </p>
          <label>
            草稿目标名称
            <input readOnly value={editName} />
          </label>
          <label>
            草稿目标说明
            <textarea ref={retainedContentRef} readOnly value={editDescription} />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void selectGoal(contentDraft.snapshot!.goalId)}
          >
            重试读取原目标
          </button>
          <button
            type="button"
            onClick={() => {
              contentDraft.discard()
              setRouteGoalId(null)
              setContentMissing(false)
              setRefreshVersion((version) => version + 1)
            }}
          >
            放弃保留的目标内容
          </button>
        </section>
      ) : null}
      <div className={`goal-grid object-grid${masterCollapsed ? ' master-collapsed' : ''}`}>
        <aside className="goal-column object-master" aria-label="目标列表">
          <button
            className="object-expand"
            ref={expandMasterRef}
            type="button"
            aria-label="展开目标列表"
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
                <h1>目标</h1>
                <button
                  type="button"
                  aria-label="收起目标列表"
                  ref={collapseMasterRef}
                  onClick={() => {
                    didToggleMaster.current = true
                    setMasterCollapsed(true)
                  }}
                >
                  ‹
                </button>
              </div>
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

              <label className="object-search">
                <span className="visually-hidden">搜索目标</span>
                <input
                  value={listQuery}
                  placeholder="搜索目标…"
                  onChange={(event) => {
                    setListQuery(event.target.value)
                    setListPage(1)
                  }}
                />
              </label>

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
                      setListPage(1)
                    }}
                  >
                    <option value="">全部</option>
                    <option value="active">活跃</option>
                    <option value="paused">暂停</option>
                    <option value="ended">结束</option>
                  </select>
                </label>
              </div>
              <div className="object-list-help">
                <p className="empty-copy">
                  可以先保留少量活跃目标，把注意力留给现在想做的事；数量由你决定。
                </p>
              </div>
              {activity ? (
                <p className="empty-copy">行动日期截至 {activity.asOfLocalDate}</p>
              ) : null}
              {activityError ? (
                <p role="status">
                  行动日期暂时无法读取。
                  <button type="button" onClick={() => setRefreshVersion((version) => version + 1)}>
                    重试行动日期
                  </button>
                </p>
              ) : null}
            </div>
            <div className="object-master-scroll" data-scroll-key="master">
              {filteredItems.length ? (
                <div className="goal-list">
                  {pageItems.map((goal) => (
                    <button
                      className={`goal-list-item ${detail?.id === goal.id ? 'selected' : ''}`}
                      key={goal.id}
                      type="button"
                      onClick={() => {
                        setCreating(false)
                        void selectGoal(goal.id)
                      }}
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
                <p className="empty-copy">这个筛选下没有匹配的目标。</p>
              )}
            </div>
            <div className="object-pager" aria-label="目标列表分页">
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
          aria-label="目标工作区"
        >
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
                  <span id="goal-create-description-label">说明（可选）</span>
                  <textarea
                    aria-labelledby="goal-create-description-label"
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
          <div className="object-selected-content" hidden={creating}>
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
                {detail.description ? (
                  <p className="goal-description">{detail.description}</p>
                ) : null}
                <div className="next-action-panel">
                  <span>当前下一步</span>
                  <strong>{detail.currentNextAction?.title ?? '暂未设置'}</strong>
                  {detail.currentNextAction?.selectedForToday ? <small>今日已选择</small> : null}
                  {detail.currentNextActionId ? (
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => {
                        if (detail.currentNextActionId)
                          session.openAction(detail.currentNextActionId)
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

                <details className="related-section object-actions">
                  <summary>关联行动 · {detail.actions.length}</summary>
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
                </details>
                <section className="related-section object-history" aria-label="目标已有记录">
                  <div className="object-history-heading">
                    <h3>已有记录</h3>
                    <span>{detail.records.length} 条 · 每页 5 条</span>
                  </div>
                  {detail.records.length ? (
                    <>
                      <div className="object-history-table-wrap">
                        <table className="object-history-table" aria-label="已有目标记录">
                          <thead>
                            <tr>
                              <th scope="col">日期</th>
                              <th scope="col">行动内容</th>
                              <th scope="col">时长</th>
                              <th scope="col">详情</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.records
                              .slice((historyPage - 1) * 5, historyPage * 5)
                              .map((record) => (
                                <tr key={record.id}>
                                  <td>{record.occurredOn}</td>
                                  <td>
                                    {record.actionTitle}
                                    <small>{recordOutcomeText[record.outcome]}</small>
                                  </td>
                                  <td>{record.durationMinutes} 分钟</td>
                                  <td>
                                    <button
                                      type="button"
                                      className="quiet-button"
                                      aria-label={`查看完整记录：${record.actionTitle} · ${record.occurredOn}`}
                                      onClick={() =>
                                        session.openDataRecord(
                                          { type: 'action-record', id: record.id },
                                          'goals'
                                        )
                                      }
                                    >
                                      查看
                                    </button>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="object-pager" aria-label="目标记录分页">
                        <button
                          type="button"
                          disabled={historyPage === 1}
                          onClick={() =>
                            setHistoryPosition({ goalId: detail.id, page: historyPage - 1 })
                          }
                        >
                          上一页
                        </button>
                        <span>
                          {historyPage} / {historyPageCount}
                        </span>
                        <button
                          type="button"
                          disabled={historyPage === historyPageCount}
                          onClick={() =>
                            setHistoryPosition({ goalId: detail.id, page: historyPage + 1 })
                          }
                        >
                          下一页
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="empty-copy">暂无记录。做过一点后，可以从行动入口留下记录。</p>
                  )}
                </section>
                <details className="disclosure" key={detail.id}>
                  <summary>编辑与管理目标</summary>
                  <form className="detail-form" onSubmit={(event) => void submitUpdate(event)}>
                    <label>
                      目标名称
                      <input
                        required
                        value={editName}
                        readOnly={contentMissing || contentDraft.snapshot?.goalId !== detail.id}
                        onChange={(event) =>
                          contentDraft.edit(detail.id, 'name', event.target.value)
                        }
                      />
                    </label>
                    <label>
                      <span id="goal-edit-description-label">说明（可选）</span>
                      <textarea
                        aria-labelledby="goal-edit-description-label"
                        rows={2}
                        value={editDescription}
                        readOnly={contentMissing || contentDraft.snapshot?.goalId !== detail.id}
                        onChange={(event) =>
                          contentDraft.edit(detail.id, 'description', event.target.value)
                        }
                      />
                    </label>
                    <button
                      className="secondary-button"
                      type="submit"
                      disabled={
                        busy ||
                        contentDraft.saving ||
                        contentMissing ||
                        contentDraft.snapshot?.goalId !== detail.id
                      }
                    >
                      保存修改
                    </button>
                    {contentDraft.retained ? (
                      <p className="empty-copy">
                        目标名称和说明的草稿仅保留在本次应用会话，关闭应用后不会恢复。
                      </p>
                    ) : null}
                    {contentDraft.retained ? (
                      <button
                        type="button"
                        disabled={contentDraft.saving}
                        onClick={() => {
                          contentDraft.discard()
                          contentDraft.read(detail)
                          setRefreshVersion((version) => version + 1)
                        }}
                      >
                        放弃目标内容修改
                      </button>
                    ) : null}
                  </form>

                  <GoalCoverAppearance key={detail.id} goalId={detail.id} />

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
                      <p className="terminal-copy">
                        该目标已结束。已有下一步、行动与记录仍然保留。
                      </p>
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
                <h2>{loaded ? '当前没有可查看的目标' : '正在读取目标…'}</h2>
                <p>可以创建第一个目标，或调整筛选条件。</p>
                {listQuery || statusFilter ? (
                  <button
                    type="button"
                    onClick={() => {
                      setListQuery('')
                      setStatusFilter('')
                      session.setGoalFilter('')
                      setListPage(1)
                    }}
                  >
                    清除筛选
                  </button>
                ) : (
                  <button type="button" onClick={() => setCreating(true)}>
                    创建第一个目标
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export { GoalWorkspace as GoalsPage }
