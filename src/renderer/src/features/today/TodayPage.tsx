import { goalStatusText, actionStatusText, recordOutcomeText } from '../../app/ui-text'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import type {
  ActionDetailDto,
  ActionErrorCode,
  CurrentNextResolutionDto
} from '../../../../contracts/actions'
import type { GoalErrorCode, GoalSummaryDto } from '../../../../contracts/goals'
import type {
  ActionRecordDetailDto,
  ActionRecordOutcomeDto,
  ActionRecordSummaryDto,
  RecordErrorCode,
  RecordingDateChoiceDto
} from '../../../../contracts/records'
import type { TodayViewDto } from '../../../../contracts/today'
import type { GoalActivityViewDto } from '../../../../contracts/progress'
import {
  useUiSession,
  usePagePosition,
  revealStart,
  useUiLifetime,
  type PostRecordActionChoice,
  type RecordedNextMode
} from '../../app/ui-session'
import { RoutineRecordingPanel } from '../routines/RoutinesPage'
import { AiStartHelpPanel } from './AiStartHelpPanel'

const goalErrorText: Record<GoalErrorCode, string> = {
  validation: '请检查必填内容。',
  'not-found': '目标或行动已不存在，请刷新后重试。',
  'invalid-transition': '当前状态不能执行这个操作。',
  'invariant-violation': '这个行动不能作为该目标的当前下一步。',
  'persistence-failed': '本地数据暂时无法保存或读取。'
}

const actionErrorText: Record<ActionErrorCode, string> = {
  validation: '请检查行动的必填内容。',
  'not-found': '行动或目标已不存在，请刷新后重试。',
  'invalid-transition': '当前状态不能执行这个行动操作。',
  'invariant-violation': '当前行动、目标或下一步关系不允许这个操作。',
  'selection-conflict': '这个行动已有另一种今日选择；请使用明确的转换操作。',
  'persistence-failed': '本地行动数据暂时无法保存或读取。'
}

const recordErrorText: Record<RecordErrorCode, string> = {
  validation: '请检查记录内容；时长需为非负整数分钟。',
  'not-found': '行动或记录已不存在，请刷新后重试。',
  'invalid-transition': '该行动当前不能新增记录。',
  'invariant-violation': '记录后的行动或下一步选择当前不可用。',
  'invalid-recording-context': '这次记录连接已失效；草稿内容仍在，可以重新开始后继续保存。',
  'persistence-failed': '本地记录暂时无法保存或读取。'
}

const unavailableReasonText: Record<NonNullable<ActionDetailDto['unavailableReason']>, string> = {
  'action-completed': '行动已完成，不能再次开始。',
  'action-cancelled': '行动已取消，不能再次开始。',
  'action-rescheduled': '行动已移出今天；再次明确选入后才恢复待行动。',
  'goal-paused': '关联目标已暂停；恢复目标后才能开始或重新选入。',
  'goal-ended': '关联目标已结束，不能开始或重新选入。'
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

function ActionRecordingPanel(props: {
  readonly action: ActionDetailDto
  readonly replacementCandidates: readonly ActionDetailDto[]
  readonly onSaved: (action: ActionDetailDto) => Promise<void>
}): ReactNode {
  const activeRef = useUiLifetime()
  const session = useUiSession()
  const [restoredDraft] = useState(() => session.getActionDraft(props.action.id))
  const [restoredNotice, setRestoredNotice] = useState(Boolean(restoredDraft))
  const panelRef = useRef<HTMLElement | null>(null)
  const beginRef = useRef<HTMLButtonElement | null>(null)
  const restoreBeginFocus = useRef(false)
  const [savedMessage, setSavedMessage] = useState('')
  const [postExpanded, setPostExpanded] = useState(restoredDraft?.postExpanded ?? false)
  const [context, setContext] = useState(restoredDraft?.context ?? null)
  const contextRef = useRef(restoredDraft?.context ?? null)
  const [records, setRecords] = useState<readonly ActionRecordSummaryDto[]>([])
  const [recordDetail, setRecordDetail] = useState<ActionRecordDetailDto | null>(null)
  const [durationMinutes, setDurationMinutes] = useState(restoredDraft?.durationMinutes ?? '0')
  const [outcome, setOutcome] = useState<ActionRecordOutcomeDto>(
    restoredDraft?.outcome ?? 'partial'
  )
  const [deepExpanded, setDeepExpanded] = useState(restoredDraft?.deepExpanded ?? false)
  const [understanding, setUnderstanding] = useState(restoredDraft?.understanding ?? '')
  const [confusion, setConfusion] = useState(restoredDraft?.confusion ?? '')
  const [nextStep, setNextStep] = useState(restoredDraft?.nextStep ?? '')
  const [note, setNote] = useState(restoredDraft?.note ?? '')
  const [postAction, setPostAction] = useState<PostRecordActionChoice>(
    restoredDraft?.postAction ?? 'keep-pending'
  )
  const [nextMode, setNextMode] = useState<RecordedNextMode>(restoredDraft?.nextMode ?? 'clear')
  const [replacementActionId, setReplacementActionId] = useState(
    restoredDraft?.replacementActionId ?? ''
  )
  const [applyRecordedNextStep, setApplyRecordedNextStep] = useState(
    restoredDraft?.applyRecordedNextStep ?? false
  )
  const [dateConfirmation, setDateConfirmation] = useState<{
    readonly capturedOn: string
    readonly currentLocalDate: string
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invalidContext, setInvalidContext] = useState(false)

  useEffect(() => {
    if (!context) return
    session.setActionDraft(props.action.id, {
      context,
      durationMinutes,
      outcome,
      deepExpanded,
      understanding,
      confusion,
      nextStep,
      note,
      postExpanded,
      postAction,
      nextMode,
      replacementActionId,
      applyRecordedNextStep
    })
  }, [
    applyRecordedNextStep,
    confusion,
    context,
    deepExpanded,
    durationMinutes,
    nextMode,
    nextStep,
    note,
    outcome,
    postAction,
    postExpanded,
    props.action.id,
    replacementActionId,
    session,
    understanding
  ])

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
    panelRef.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true })
  }, [context])

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
    void window.myTracer.records.listForAction({ actionId: props.action.id }).then((result) => {
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
      contextRef.current = null
    }
  }, [props.action.id])

  const resetForm = (): void => {
    setRestoredNotice(false)
    session.clearActionDraft(props.action.id)
    contextRef.current = null
    setContext(null)
    setDurationMinutes('0')
    setOutcome('partial')
    setDeepExpanded(false)
    setUnderstanding('')
    setConfusion('')
    setNextStep('')
    setNote('')
    setPostExpanded(false)
    setPostAction('keep-pending')
    setNextMode('clear')
    setReplacementActionId('')
    setApplyRecordedNextStep(false)
    setDateConfirmation(null)
    setInvalidContext(false)
  }

  const begin = async (): Promise<void> => {
    setBusy(true)
    const result = await window.myTracer.records.begin({ actionId: props.action.id })
    if (!activeRef.current) {
      if (result.ok)
        await window.myTracer.records.cancel({
          recordingContextId: result.value.recordingContextId
        })
      return
    }
    setBusy(false)
    if (!result.ok) {
      setError(recordErrorText[result.error.code])
      return
    }
    setSavedMessage('')
    contextRef.current = result.value
    setContext(result.value)
    session.setActionDraft(props.action.id, {
      context: result.value,
      durationMinutes,
      outcome,
      deepExpanded,
      understanding,
      confusion,
      nextStep,
      note,
      postExpanded,
      postAction,
      nextMode,
      replacementActionId,
      applyRecordedNextStep
    })
    setInvalidContext(false)
    setError(null)
  }

  const restartContext = async (): Promise<void> => {
    setBusy(true)
    const result = await window.myTracer.records.begin({ actionId: props.action.id })
    if (!activeRef.current) return
    setBusy(false)
    if (!result.ok) {
      setError(recordErrorText[result.error.code])
      return
    }
    contextRef.current = result.value
    setContext(result.value)
    setInvalidContext(false)
    setError(null)
  }

  const cancel = async (): Promise<void> => {
    if (!context) return
    setBusy(true)
    const result = await window.myTracer.records.cancel({
      recordingContextId: context.recordingContextId
    })
    if (!activeRef.current) return
    setBusy(false)
    if (!result.ok) {
      if (result.error.code === 'invalid-recording-context') {
        resetForm()
        setSavedMessage('已放弃未保存草稿。')
        return
      }
      setError(recordErrorText[result.error.code])
      return
    }
    restoreBeginFocus.current = true
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
    if (changingCurrentAction && nextMode === 'use-existing' && !replacementActionId) {
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
      understanding: understanding.trim() ? understanding : null,
      confusion: confusion.trim() ? confusion : null,
      nextStep: nextStep.trim() ? nextStep : null,
      note: note.trim() ? note : null,
      postRecord: {
        action: postAction,
        currentNextResolution,
        applyRecordedNextStep: !changingCurrentAction && applyRecordedNextStep
      }
    })
    if (!activeRef.current) return
    setBusy(false)
    if (!result.ok) {
      setInvalidContext(result.error.code === 'invalid-recording-context')
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
    const actionState = `行动现在为${actionStatusText[saved.action.status]}`
    const nextState = changingCurrentAction
      ? saved.appliedNextActionId
        ? '目标的当前下一步已按你的选择更新'
        : '目标的当前下一步已按你的选择清空'
      : saved.appliedNextActionId
        ? '目标的当前下一步已按你的选择更新'
        : '没有更改目标的当前下一步'
    const todayState = saved.action.todayCommitment
      ? `仍保留为${saved.action.todayCommitment === 'focus' ? '今日重点' : '今日意向'}`
      : '没有自动加入今天'
    setSavedMessage(
      `记录已保存：${saved.record.durationMinutes} 分钟 · ${recordOutcomeText[saved.record.outcome]}。${actionState}；${nextState}；${todayState}。`
    )
    requestAnimationFrame(() => revealStart(panelRef.current))
    setRecordDetail(saved.record)
    await loadRecords()
    await props.onSaved(saved.action)
  }

  const canApplyNextStep = props.action.goal?.status === 'active'
  const changingCurrentAction = postAction !== 'keep-pending' && props.action.isCurrentNextAction
  const nextChangeSummary = changingCurrentAction
    ? nextMode === 'clear'
      ? '清空目标当前下一步'
      : nextMode === 'use-existing'
        ? `改用“${props.replacementCandidates.find((candidate) => candidate.id === replacementActionId)?.title ?? '尚未选择'}”作为当前下一步`
        : `用“${nextStep}”创建目标当前下一步`
    : applyRecordedNextStep
      ? `用“${nextStep}”创建目标当前下一步`
      : null
  const saveImpact =
    postAction === 'keep-pending' && !nextChangeSummary
      ? '仅保存记录，行动状态和当前下一步保持不变。'
      : `保存时将${postAction === 'keep-pending' ? '保持行动状态' : transitionLabels[postAction] + '行动'}${nextChangeSummary ? `，并${nextChangeSummary}` : ''}。`

  return (
    <section
      ref={panelRef}
      className="recording-panel"
      aria-label={`${props.action.title} 行动记录`}
    >
      <div className="recording-heading">
        <div>
          <p className="eyebrow">行动记录</p>
          <h3>{props.action.title}</h3>
        </div>
        {!context && props.action.canStart ? (
          <button
            ref={beginRef}
            className="primary-button"
            type="button"
            disabled={busy}
            onClick={() => void begin()}
          >
            开始记录
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {savedMessage ? (
        <p className="success-message" role="status">
          {savedMessage}
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
          <fieldset className="recording-fields" disabled={busy}>
            <p className="draft-notice" role="status">
              {restoredNotice
                ? '未保存的记录草稿已恢复。它仍未写入记录，你可以继续填写、保存或放弃。'
                : '未保存草稿会在本次应用会话中保留，直到你保存或明确放弃。'}
            </p>
            <p className="captured-date">记录日期：{context.capturedOn}</p>
            <div className="quick-record-grid">
              <label>
                投入时长（分钟，必填）
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
              aria-expanded={deepExpanded}
              onClick={() => setDeepExpanded((value) => !value)}
            >
              {deepExpanded ? '收起深入记录' : '添加理解、困惑、下一步或备注'}
            </button>
            {!deepExpanded &&
            [understanding, confusion, nextStep, note].some((value) => value.trim()) ? (
              <p className="empty-copy">已填写的补充内容会随记录保存，可展开修改。</p>
            ) : null}
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
                  <input
                    value={nextStep}
                    onChange={(event) => {
                      const value = event.target.value
                      setNextStep(value)
                      if (!value.trim()) {
                        setApplyRecordedNextStep(false)
                        if (nextMode === 'recorded-next') setNextMode('clear')
                      }
                    }}
                  />
                </label>
                <label>
                  备注（可选）
                  <textarea
                    rows={2}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </label>
              </div>
            ) : null}

            <button
              type="button"
              className="quiet-button"
              aria-expanded={postExpanded}
              onClick={() => setPostExpanded(!postExpanded)}
            >
              调整行动状态或当前下一步（可选）
            </button>
            {postExpanded ? (
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
                <p>本次结果不会自动改变行动状态，请明确选择是否调整。</p>
                {changingCurrentAction ? (
                  <label>
                    当前下一步处理
                    <select
                      value={nextMode}
                      onChange={(event) => setNextMode(event.target.value as RecordedNextMode)}
                    >
                      <option value="clear">清空目标当前下一步</option>
                      <option value="use-existing">改用已有待行动</option>
                      {nextStep.trim() ? (
                        <option value="recorded-next">用记录中的下一步创建新行动</option>
                      ) : null}
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
                {canApplyNextStep && !changingCurrentAction && nextStep.trim() ? (
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
            ) : null}
            <p className="save-impact">{saveImpact}</p>

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
                  <button type="button" disabled={busy} onClick={() => void save('use-current-on')}>
                    使用当前日
                  </button>
                </div>
              </div>
            ) : null}
            <div className="recording-actions">
              <button
                className="primary-button"
                type="submit"
                disabled={busy || Boolean(dateConfirmation)}
              >
                保存记录
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
      ) : !props.action.canStart ? (
        <p className="empty-copy">该行动当前不可开始，因此不能新增记录。</p>
      ) : null}

      <div className="record-list" aria-label="行动记录列表">
        <h3>已有记录</h3>
        {records.length ? (
          records.map((record) => (
            <button type="button" key={record.id} onClick={() => void showRecordDetail(record.id)}>
              <span>
                {record.occurredOn} · {recordOutcomeText[record.outcome]}
              </span>
              <small>
                {record.durationMinutes === 0 ? '少于 1 分钟' : `${record.durationMinutes} 分钟`}
              </small>
            </button>
          ))
        ) : (
          <p className="empty-copy">还没有记录；没有记录不代表没有行动。</p>
        )}
      </div>
      {recordDetail ? (
        <div className="record-detail" aria-label="记录详情">
          <p>
            {recordDetail.occurredOn} · {recordOutcomeText[recordDetail.outcome]}
          </p>
          <strong>
            {recordDetail.durationMinutes === 0
              ? '少于 1 分钟'
              : `${recordDetail.durationMinutes} 分钟`}
          </strong>
          {recordDetail.understandings.map((item) => (
            <span key={item.id}>理解：{item.text}</span>
          ))}
          {recordDetail.confusions.map((item) => (
            <span key={item.id}>尚未解决的困惑：{item.text}</span>
          ))}
          {recordDetail.nextStep ? <span>记录中的下一步：{recordDetail.nextStep}</span> : null}
          {recordDetail.note ? <span>备注：{recordDetail.note}</span> : null}
        </div>
      ) : null}
    </section>
  )
}

function TodayWorkspace(): ReactNode {
  const activeRef = useUiLifetime()
  const session = useUiSession()
  const [selectionLoaded, setSelectionLoaded] = useState(false)
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const detailRef = useRef<HTMLElement | null>(null)
  const [today, setToday] = useState<TodayViewDto | null>(null)
  const [activity, setActivity] = useState<GoalActivityViewDto | null>(null)
  const [activityError, setActivityError] = useState(false)
  const [activityVersion, setActivityVersion] = useState(0)
  const [activeGoals, setActiveGoals] = useState<readonly GoalSummaryDto[]>([])
  const [detail, setDetail] = useState<ActionDetailDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
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
  const availableCandidates =
    today?.availableActions.filter(
      (action) => action.canSelectForToday && action.todayCommitment === null
    ) ?? []
  usePagePosition('today', today !== null && selectionLoaded)
  const transitionTriggerRef = useRef<HTMLButtonElement | null>(null)

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
  }, [refreshVersion, activityVersion])

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
    Promise.all([
      window.myTracer.today.get({}),
      window.myTracer.goals.list({ status: 'active' })
    ]).then(([todayResult, goalResult]) => {
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
    })
    return () => {
      active = false
    }
  }, [refreshVersion])

  useEffect(() => {
    let active = true
    const actionId = session.actionId
    if (!actionId) {
      Promise.resolve().then(() => {
        if (active) setSelectionLoaded(true)
      })
    } else {
      void window.myTracer.actions
        .getDetail({ actionId })
        .then((result) => {
          if (!active) return
          if (session.actionId !== actionId) {
            setSelectionLoaded(true)
            return
          }
          if (result.ok) {
            setDetail(result.value)
            setEditTitle(result.value.title)
            setEditDescription(result.value.description ?? '')
          } else {
            if (result.error.code === 'not-found') session.selectAction(null)
            setSelectionError(actionErrorText[result.error.code])
          }
          setSelectionLoaded(true)
        })
        .catch(() => {
          if (active) {
            setSelectionError(actionErrorText['persistence-failed'])
            setSelectionLoaded(true)
          }
        })
    }
    return () => {
      active = false
    }
  }, [session])

  const showDetail = (action: ActionDetailDto): void => {
    if (!activeRef.current) return
    setSelectionError(null)
    session.selectAction(action.id)
    setDetail(action)
    setEditTitle(action.title)
    setEditDescription(action.description ?? '')
    setResolutionMode('clear')
    setReplacementActionId('')
    setReplacementTitle('')
    setPendingTransition(null)
  }

  const selectAction = (action: ActionDetailDto): void => {
    showDetail(action)
    requestAnimationFrame(() => revealStart(detailRef.current))
  }

  const refresh = async (actionId?: string): Promise<void> => {
    setActivityVersion((version) => version + 1)
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
    setCreating(false)
    setCreateTitle('')
    setCreateDescription('')
    setCreateGoalId('')
    showDetail(result.value)
    await refresh(result.value.id)
    requestAnimationFrame(() => revealStart(detailRef.current))
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
      setNotice('已设为今日重点；目标的当前下一步没有自动改变。')
      await refresh(actionId)
    } else {
      setError(actionErrorText[result.error.code])
    }
  }

  const selectAsIntention = async (actionId: string): Promise<void> => {
    setBusy(true)
    const result = await window.myTracer.today.selectActionAsIntention({ actionId })
    setBusy(false)
    if (result.ok) {
      setNotice('已加入今日意向；它不构成承诺，未发生时不会产生失败记录。')
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
      setNotice('已移出今日重点；行动和历史记录仍然保留。')
      setToday(result.value)
      if (detail?.id === actionId) await refresh(actionId)
    } else {
      setError(actionErrorText[result.error.code])
    }
  }

  const removeIntention = async (actionId: string): Promise<void> => {
    setBusy(true)
    const result = await window.myTracer.today.removeActionIntention({ actionId })
    setBusy(false)
    if (result.ok) {
      setNotice('已移出今日意向；行动和历史记录仍然保留。')
      setToday(result.value)
      if (detail?.id === actionId) await refresh(actionId)
    } else {
      setError(actionErrorText[result.error.code])
    }
  }

  const renderActionCandidates = (): ReactNode => (
    <details className="goal-card action-candidates" open={!today?.focuses.length}>
      <summary>其它行动（{availableCandidates.length}）</summary>
      <p className="empty-copy">浏览候选不会自动改变今日重点或目标的当前下一步。</p>
      {activity ? <p className="empty-copy">目标行动日期截至 {activity.asOfLocalDate}</p> : null}
      {activityError ? (
        <p role="status">
          行动日期暂时无法读取。
          <button type="button" onClick={() => setActivityVersion((version) => version + 1)}>
            重试行动日期
          </button>
        </p>
      ) : null}
      <div className="action-list">
        {availableCandidates.length ? (
          availableCandidates.map((action) => (
            <div className="candidate-row" key={action.id}>
              <button
                className={`goal-list-item ${detail?.id === action.id ? 'selected' : ''}`}
                aria-pressed={detail?.id === action.id}
                type="button"
                onClick={() => {
                  if (!activeRef.current) return
                  setSelectionError(null)
                  session.selectAction(action.id)
                  setDetail(action)
                  setEditTitle(action.title)
                  setEditDescription(action.description ?? '')
                  setResolutionMode('clear')
                  setReplacementActionId('')
                  setReplacementTitle('')
                  setPendingTransition(null)
                  requestAnimationFrame(() =>
                    revealStart(document.querySelector<HTMLElement>('.action-detail'))
                  )
                }}
              >
                <span>{action.title}</span>
                <small>
                  {actionStatusText[action.status]}
                  {action.goal ? ` · ${action.goal.name}` : ' · 独立行动'}
                  {action.isCurrentNextAction ? ' · 目标当前下一步' : ''}
                  {session.hasActionDraft(action.id) ? ' · 有未保存草稿' : ''}
                </small>
                {action.goal ? <small>{activityText(action.goal.id)}</small> : null}
              </button>
              <div className="candidate-actions">
                <button
                  className="secondary-button"
                  type="button"
                  disabled={busy}
                  onClick={() => void selectForToday(action.id)}
                >
                  选为今日重点
                </button>
                <button
                  className="quiet-button"
                  type="button"
                  disabled={busy}
                  onClick={() => void selectAsIntention(action.id)}
                >
                  加入今日意向
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="empty-copy">还没有可加入今天的行动。</p>
        )}
      </div>
    </details>
  )

  const changeCommitment = async (
    actionId: string,
    commitment: 'focus' | 'intention'
  ): Promise<void> => {
    setBusy(true)
    const result = await window.myTracer.today.changeActionCommitment({
      actionId,
      commitment
    })
    setBusy(false)
    if (result.ok) {
      setNotice(
        commitment === 'focus'
          ? '已改为今日重点；目标的当前下一步没有自动改变。'
          : '已改为今日意向；它不构成承诺。'
      )
      await refresh(actionId)
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
        action.id !== detail?.id && action.goalId === detail?.goalId && action.status === 'pending'
    ) ?? []

  return (
    <section className="today-workspace" aria-label="今日行动">
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
      {notice ? (
        <p className="success-message" role="status">
          {notice}
        </p>
      ) : null}
      <div className="today-date-row">
        <span>当前本地日期</span>
        <strong>{today?.localDate ?? '读取中'}</strong>
        <button
          type="button"
          className="secondary-button"
          aria-expanded={creating}
          onClick={() => setCreating(!creating)}
        >
          新建行动
        </button>
      </div>
      {creating ? (
        <form className="goal-card goal-create" onSubmit={(event) => void submitCreate(event)}>
          <div className="card-heading">
            <p className="eyebrow">新行动</p>
            <h2>留下一个可以直接开始的小步骤</h2>
          </div>
          <label>
            行动标题
            <input
              autoFocus
              required
              value={createTitle}
              onChange={(event) => setCreateTitle(event.target.value)}
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
            关联目标（可选）
            <select value={createGoalId} onChange={(event) => setCreateGoalId(event.target.value)}>
              <option value="">不关联目标</option>
              {activeGoals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.name}
                </option>
              ))}
            </select>
          </label>
          <button className="primary-button" type="submit" disabled={busy}>
            创建行动
          </button>
          <button type="button" onClick={() => setCreating(false)}>
            取消新建
          </button>
        </form>
      ) : null}
      <div className="today-grid">
        <div className="goal-column">
          <section className="goal-card goal-list-card today-priority" aria-label="今日重点">
            <div className="card-heading">
              <p className="eyebrow">今日重点</p>
              <p className="empty-copy">先选少量重点就好，也可以按需要继续添加。</p>
              <h2>现在可以继续什么</h2>
            </div>
            <div className="action-list">
              {today?.focuses.length ? (
                today.focuses.map((action) => (
                  <div
                    className={`focus-row ${detail?.id === action.id ? 'selected' : ''}`}
                    key={action.id}
                  >
                    <button
                      type="button"
                      aria-pressed={detail?.id === action.id}
                      onClick={() => selectAction(action)}
                    >
                      <span>{action.title}</span>
                      <small>
                        {actionStatusText[action.status]}
                        {action.goal ? ` · ${action.goal.name}` : ' · 独立行动'}
                        {action.isCurrentNextAction ? ' · 目标当前下一步' : ''}
                        {session.hasActionDraft(action.id) ? ' · 有未保存草稿' : ''}
                      </small>
                    </button>
                    <button
                      className="quiet-button"
                      type="button"
                      disabled={busy}
                      onClick={() => void removeFromToday(action.id)}
                    >
                      移出今天
                    </button>
                  </div>
                ))
              ) : (
                <p className="empty-copy">还没有今日重点。可以从下方其它行动中明确选择。</p>
              )}
            </div>
          </section>

          {!today?.focuses.length ? renderActionCandidates() : null}

          <section className="goal-card planned-routines" aria-label="今日例行计划">
            <div className="card-heading">
              <p className="eyebrow">今日例行</p>
              <h2>今天安排的例行事项</h2>
            </div>
            <div className="planned-routine-list">
              {today?.plannedRoutines.length ? (
                today.plannedRoutines.map((routine) => (
                  <article key={routine.id}>
                    <div>
                      <strong>{routine.name}</strong>
                      <span>最小行动：{routine.minimumAction}</span>
                      <small>
                        {routine.goal
                          ? `目标：${routine.goal.name} · ${goalStatusText[routine.goal.status]}`
                          : '未关联目标'}
                        {session.hasRoutineDraft(routine.id) ? ' · 有未保存草稿' : ''}
                      </small>
                    </div>
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
                ))
              ) : (
                <p className="empty-copy">今天没有匹配的活跃例行。</p>
              )}
            </div>
          </section>

          {today?.intentions.length ? (
            <div className="goal-card goal-list-card intention-card">
              <div className="card-heading">
                <p className="eyebrow">今日意向</p>
                <h2>今天也想做，但不构成承诺</h2>
              </div>
              <div className="action-list">
                {today?.intentions.length ? (
                  today.intentions.map((action) => (
                    <div
                      className={`focus-row intention-row ${detail?.id === action.id ? 'selected' : ''}`}
                      key={action.id}
                    >
                      <button
                        type="button"
                        aria-pressed={detail?.id === action.id}
                        onClick={() => selectAction(action)}
                      >
                        <span>{action.title}</span>
                        <small>
                          {actionStatusText[action.status]}
                          {action.goal ? ` · ${action.goal.name}` : ' · 独立行动'}
                          {action.isCurrentNextAction ? ' · 目标当前下一步' : ''}
                          {session.hasActionDraft(action.id) ? ' · 有未保存草稿' : ''}
                        </small>
                      </button>
                      <button
                        className="quiet-button"
                        type="button"
                        disabled={busy}
                        onClick={() => void removeIntention(action.id)}
                      >
                        移出今日意向
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="empty-copy">尚未选择今日意向，不必每天安排。</p>
                )}
              </div>
            </div>
          ) : null}
          {today?.focuses.length ? renderActionCandidates() : null}
        </div>

        <div className="goal-column">
          {detail ? (
            <article
              ref={detailRef}
              className="goal-card action-detail"
              aria-label={`${detail.title} 行动详情`}
            >
              <div className="detail-title-row">
                <div>
                  <p className="eyebrow">{detail.goal?.name ?? '独立行动'}</p>
                  <h2>{detail.title}</h2>
                </div>
                <span className={`status-badge action-status-${detail.status}`}>
                  {actionStatusText[detail.status]}
                </span>
              </div>
              <p className="availability-copy">
                {detail.unavailableReason
                  ? unavailableReasonText[detail.unavailableReason]
                  : detail.todayCommitment === 'focus'
                    ? '已由你选为今日重点，可以从这里继续。'
                    : detail.todayCommitment === 'intention'
                      ? '这是今天可能想做的意向，不构成承诺；未发生不会产生失败或记录。'
                      : '当前可行动；可由你选择为今日重点或今日意向。'}
              </p>

              <div className="today-commitment-actions" aria-label="今天的安排">
                {detail.canSelectForToday && detail.todayCommitment === null ? (
                  <>
                    <button
                      className="primary-button"
                      type="button"
                      disabled={busy}
                      onClick={() => void selectForToday(detail.id)}
                    >
                      选为今日重点
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={busy}
                      onClick={() => void selectAsIntention(detail.id)}
                    >
                      加入今日意向
                    </button>
                  </>
                ) : null}
                {detail.todayCommitment === 'focus' ? (
                  <>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={busy}
                      onClick={() => void removeFromToday(detail.id)}
                    >
                      移出今日重点
                    </button>
                    {detail.canSelectForToday ? (
                      <button
                        className="quiet-button"
                        type="button"
                        disabled={busy}
                        onClick={() => void changeCommitment(detail.id, 'intention')}
                      >
                        改为今日意向
                      </button>
                    ) : null}
                  </>
                ) : null}
                {detail.todayCommitment === 'intention' ? (
                  <>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={busy}
                      onClick={() => void removeIntention(detail.id)}
                    >
                      移出今日意向
                    </button>
                    {detail.canSelectForToday ? (
                      <button
                        className="primary-button"
                        type="button"
                        disabled={busy}
                        onClick={() => void changeCommitment(detail.id, 'focus')}
                      >
                        改为今日重点
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>

              <ActionRecordingPanel
                key={detail.id}
                action={detail}
                replacementCandidates={replacementCandidates}
                onSaved={async (action) => refresh(action.id)}
              />

              {detail.status === 'pending' &&
              detail.goal?.status === 'active' &&
              detail.todayCommitment !== null ? (
                <AiStartHelpPanel key={`ai-${detail.id}`} action={detail} />
              ) : null}

              <details className="disclosure" key={`management-${detail.id}`}>
                <summary>编辑与管理行动</summary>
                <form className="detail-form" onSubmit={(event) => void submitUpdate(event)}>
                  <label>
                    行动标题
                    <input
                      required
                      value={editTitle}
                      onChange={(event) => setEditTitle(event.target.value)}
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
                    保存行动修改
                  </button>
                </form>

                {detail.isCurrentNextAction ? (
                  <div className="resolution-panel">
                    <h3>处理目标的当前下一步</h3>
                    {detail.goal?.status === 'active' ? (
                      <>
                        <label>
                          结束这个行动后，目标的当前下一步
                          <select
                            value={resolutionMode}
                            onChange={(event) =>
                              setResolutionMode(event.target.value as ResolutionMode)
                            }
                          >
                            <option value="clear">清空当前下一步</option>
                            <option value="use-existing">选择已有行动</option>
                            <option value="create-and-use">创建并使用新行动</option>
                          </select>
                        </label>
                        {resolutionMode === 'use-existing' ? (
                          <label>
                            已有待行动
                            <select
                              required
                              value={replacementActionId}
                              onChange={(event) => setReplacementActionId(event.target.value)}
                            >
                              <option value="">请选择</option>
                              {replacementCandidates.map((action) => (
                                <option key={action.id} value={action.id}>
                                  {action.title}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : null}
                        {resolutionMode === 'create-and-use' ? (
                          <label>
                            新的当前下一步
                            <input
                              required
                              value={replacementTitle}
                              onChange={(event) => setReplacementTitle(event.target.value)}
                            />
                          </label>
                        ) : null}
                      </>
                    ) : (
                      <p className="empty-copy">目标不是活跃状态，本次只能清空当前下一步。</p>
                    )}
                  </div>
                ) : null}

                <div className="action-controls">
                  {detail.status === 'pending' ? (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={(event) => requestTransition('complete', event.currentTarget)}
                      >
                        标记完成
                      </button>
                      <button
                        className="danger-button"
                        type="button"
                        disabled={busy}
                        onClick={(event) => requestTransition('cancel', event.currentTarget)}
                      >
                        取消行动
                      </button>
                      <button
                        className="warning-button"
                        type="button"
                        disabled={busy}
                        onClick={(event) => requestTransition('reschedule', event.currentTarget)}
                      >
                        重新安排
                      </button>
                    </>
                  ) : null}
                </div>
                {pendingTransition ? (
                  <div
                    className={`transition-confirmation ${
                      pendingTransition.kind === 'cancel'
                        ? 'is-danger'
                        : pendingTransition.kind === 'reschedule'
                          ? 'is-warning'
                          : ''
                    }`}
                    role="alertdialog"
                    aria-labelledby="transition-confirmation-title"
                  >
                    <div>
                      <h3 id="transition-confirmation-title">
                        确认{transitionLabels[pendingTransition.kind]}
                      </h3>
                      <p>
                        确定{transitionLabels[pendingTransition.kind]}“
                        {pendingTransition.actionTitle}
                        ”吗？
                      </p>
                    </div>
                    <div className="transition-confirmation-actions">
                      <button
                        type="button"
                        autoFocus
                        disabled={busy}
                        onClick={() => void confirmTransition()}
                      >
                        确认{transitionLabels[pendingTransition.kind]}
                      </button>
                      <button type="button" disabled={busy} onClick={dismissTransition}>
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
              <h2>选择一个行动查看详情</h2>
              <p>完成或取消会保留当天选择；重新安排会移出今天并保留历史。</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export { TodayWorkspace as TodayPage }
