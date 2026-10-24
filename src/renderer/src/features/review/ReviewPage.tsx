import { ProgressActionNotes } from '../progress/ProgressActionNotes'
import { RecordNote } from '../../app/RecordText'
import { recordDuration } from '../../app/ui-text'
import './review-reference.css'
import {
  appendCitation,
  referenceState,
  reviewReferences,
  type ReviewReference
} from './review-reference'
import {
  usePagePosition,
  useUiSession,
  useUnsavedContent,
  useUiLifetime
} from '../../app/ui-session'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import type {
  CompleteReviewInputDto,
  ReviewErrorCode,
  ReviewRoutineOutcomeFactsDto,
  ReviewSummaryDto
} from '../../../../contracts/review'
import type { GoalActionSummaryDto, GoalSummaryDto } from '../../../../contracts/goals'
import { PreviousAdjustment } from './PreviousAdjustment'

const errorText: Record<ReviewErrorCode, string> = {
  validation: '复盘请求无效，请重新进入复盘。',
  'context-invalid': '本次复盘已失效，请重新进入。',
  'context-stale': '复盘期间记录发生了变化，请重新读取。',
  'related-goal-invalid': '所选目标已不再处于活跃状态，请重新选择。',
  'next-step-invalid': '所选行动已不可作为当前下一步，请重新选择。',
  'persistence-failed': '本地周期记录暂时无法读取。'
}

const routineColumns: readonly {
  readonly key: keyof ReviewRoutineOutcomeFactsDto
  readonly title: string
  readonly description: string
}[] = [
  { key: 'targetMet', title: '达到目标', description: '本次达到了例行的最小行动' },
  { key: 'acted', title: '有所行动', description: '确实行动了，但未达到最小行动' },
  { key: 'intentionalRest', title: '主动休息', description: '当时主动决定休息' },
  { key: 'notDone', title: '未进行', description: '当时确认没有开始行动' }
]

interface ReviewFollowUp {
  readonly actionId: string
  readonly actionTitle: string
  readonly isInToday: boolean
}

function shiftLocalDate(localDate: string, days: number): string {
  const [year, month, day] = localDate.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

export function ReviewPage(): ReactNode {
  const session = useUiSession()
  const activeRef = useUiLifetime()
  const [initialDraft] = useState(() => session.getReviewDraft())
  const [periodConflict, setPeriodConflict] = useState(false)
  const [selectedReference, setSelectedReference] = useState<ReviewReference | null>(null)
  const [citationTarget, setCitationTarget] = useState<'progress' | 'obstacle' | 'adjustment'>(
    'progress'
  )
  const composerRef = useRef<HTMLFormElement>(null)
  const factsRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLTextAreaElement>(null)
  const obstacleRef = useRef<HTMLTextAreaElement>(null)
  const adjustmentRef = useRef<HTMLTextAreaElement>(null)
  const [entryKey, setEntryKey] = useState(0)
  const [contextId, setContextId] = useState<string | null>(null)
  const [summary, setSummary] = useState<ReviewSummaryDto | null>(initialDraft?.summary ?? null)
  usePagePosition('review', summary !== null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmedProgress, setConfirmedProgress] = useState(initialDraft?.confirmedProgress ?? '')
  const [mainObstacle, setMainObstacle] = useState(initialDraft?.mainObstacle ?? '')
  const [nextAdjustment, setNextAdjustment] = useState(initialDraft?.nextAdjustment ?? '')
  const [goals, setGoals] = useState<readonly GoalSummaryDto[]>([])
  const [relatedGoalId, setRelatedGoalId] = useState(initialDraft?.relatedGoalId ?? '')
  const [pendingActions, setPendingActions] = useState<readonly GoalActionSummaryDto[]>([])
  const [nextStepKind, setNextStepKind] = useState<'none' | 'use-existing' | 'create-and-use'>(
    initialDraft?.nextStepKind ?? 'none'
  )
  const [existingActionId, setExistingActionId] = useState(initialDraft?.existingActionId ?? '')
  const [newActionTitle, setNewActionTitle] = useState(initialDraft?.newActionTitle ?? '')
  const [followUp, setFollowUp] = useState<ReviewFollowUp | null>(null)
  const [loadedDraft, setLoadedDraft] = useState(initialDraft?.loadedDraft ?? '')
  const currentDraft = JSON.stringify([
    confirmedProgress,
    mainObstacle,
    nextAdjustment,
    relatedGoalId,
    nextStepKind,
    existingActionId,
    newActionTitle
  ])
  useUnsavedContent('review-form', Boolean(loadedDraft && currentDraft !== loadedDraft))

  useEffect(() => {
    session.setReviewDraft(
      summary && loadedDraft && currentDraft !== loadedDraft
        ? {
            summary,
            loadedDraft,
            confirmedProgress,
            mainObstacle,
            nextAdjustment,
            relatedGoalId,
            nextStepKind,
            existingActionId,
            newActionTitle
          }
        : null
    )
  }, [
    session,
    summary,
    loadedDraft,
    currentDraft,
    confirmedProgress,
    mainObstacle,
    nextAdjustment,
    relatedGoalId,
    nextStepKind,
    existingActionId,
    newActionTitle
  ])

  const references = summary ? reviewReferences(summary) : []
  const selectedState = selectedReference ? referenceState(selectedReference, references) : null
  const targetText =
    citationTarget === 'progress'
      ? confirmedProgress
      : citationTarget === 'obstacle'
        ? mainObstacle
        : nextAdjustment
  const alreadyCited = Boolean(selectedReference && targetText.includes(selectedReference.citation))
  const cite = (): void => {
    if (!contextId || !selectedReference || selectedState !== 'current' || busy || periodConflict)
      return
    const setter =
      citationTarget === 'progress'
        ? setConfirmedProgress
        : citationTarget === 'obstacle'
          ? setMainObstacle
          : setNextAdjustment
    setter((text) => appendCitation(text, selectedReference.citation))
    const field =
      citationTarget === 'progress'
        ? progressRef
        : citationTarget === 'obstacle'
          ? obstacleRef
          : adjustmentRef
    field.current?.focus()
    setNotice('已追加引用；原有草稿保持不变，请按自己的意思编辑。')
  }
  const referenceButton = (key: string): ReactNode => {
    const fact = references.find((item) => item.key === key)
    return fact ? (
      <button
        type="button"
        className="quiet-button"
        aria-pressed={selectedReference?.key === key}
        onClick={() => setSelectedReference(fact)}
      >
        选择作参考
      </button>
    ) : null
  }

  useEffect(() => {
    let active = true
    let openedContextId: string | null = null

    void Promise.resolve(session.getPendingReviewSave())
      .then(() => window.myTracer.review.begin({}))
      .then(async (beginResult) => {
        if (!beginResult.ok) {
          if (active) {
            setBusy(false)
            setError(errorText[beginResult.error.code])
          }
          return
        }
        openedContextId = beginResult.value.reviewContextId
        if (!active) {
          await window.myTracer.review.cancel({ reviewContextId: openedContextId })
          return
        }
        const retainedPeriod = session.getReviewDraft()?.summary.periodStartedOn
        if (retainedPeriod && retainedPeriod !== beginResult.value.periodStartedOn) {
          setPeriodConflict(true)
          setContextId(null)
          setBusy(false)
          await window.myTracer.review.cancel({ reviewContextId: openedContextId })
          return
        }
        const [summaryResult, reviewResult, goalsResult] = await Promise.all([
          window.myTracer.review.getSummary({ reviewContextId: openedContextId }),
          window.myTracer.review.getResult({ reviewContextId: openedContextId }),
          window.myTracer.goals.list({ status: 'active' })
        ])
        if (!active) return
        setBusy(false)
        if (summaryResult.ok && reviewResult.ok && goalsResult.ok) {
          const retained = session.getReviewDraft()
          if (
            retained &&
            retained.summary.periodStartedOn !== summaryResult.value.periodStartedOn
          ) {
            setPeriodConflict(true)
            setContextId(null)
            await window.myTracer.review.cancel({ reviewContextId: openedContextId })
            return
          }
          setPeriodConflict(false)
          setContextId(openedContextId)
          setSummary(summaryResult.value)
          setGoals(goalsResult.value)
          if (!retained) {
            setConfirmedProgress(reviewResult.value?.confirmedProgress ?? '')
            setMainObstacle(reviewResult.value?.mainObstacle ?? '')
            setNextAdjustment(reviewResult.value?.nextAdjustment ?? '')
            setRelatedGoalId(reviewResult.value?.relatedGoalId ?? '')
            setNextStepKind('none')
            setExistingActionId('')
            setNewActionTitle('')
            setLoadedDraft(
              JSON.stringify([
                reviewResult.value?.confirmedProgress ?? '',
                reviewResult.value?.mainObstacle ?? '',
                reviewResult.value?.nextAdjustment ?? '',
                reviewResult.value?.relatedGoalId ?? '',
                'none',
                '',
                ''
              ])
            )
          }
          setError(null)
        } else {
          const failed = !summaryResult.ok
            ? summaryResult
            : !reviewResult.ok
              ? reviewResult
              : goalsResult
          setError(
            !failed.ok ? errorText[failed.error.code as ReviewErrorCode] : errorText.validation
          )
        }
      })
      .catch(() => {
        if (active) {
          setBusy(false)
          setError(errorText['persistence-failed'])
        }
      })

    return () => {
      active = false
      if (openedContextId) {
        void window.myTracer.review.cancel({ reviewContextId: openedContextId })
      }
    }
  }, [entryKey, session])

  useEffect(() => {
    if (!relatedGoalId) return
    let active = true
    void window.myTracer.goals.getDetail({ goalId: relatedGoalId }).then((result) => {
      if (!active || !result.ok) return
      setPendingActions(result.value.actions.filter((action) => action.status === 'pending'))
    })
    return () => {
      active = false
    }
  }, [relatedGoalId])

  const selectRelatedGoal = (goalId: string): void => {
    setRelatedGoalId(goalId)
    setPendingActions([])
    setExistingActionId('')
    setNextStepKind('none')
  }

  const refresh = async (): Promise<void> => {
    if (!contextId) return
    setBusy(true)
    try {
      const result = await window.myTracer.review.getSummary({ reviewContextId: contextId })
      if (!activeRef.current) return
      setBusy(false)
      if (result.ok) {
        setSummary(result.value)
        setError(null)
      } else {
        setError(errorText[result.error.code])
      }
    } catch {
      setBusy(false)
      setError(errorText['persistence-failed'])
    }
  }

  const cancelDraft = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    try {
      if (contextId) await window.myTracer.review.cancel({ reviewContextId: contextId })
    } catch {
      if (activeRef.current) {
        setBusy(false)
        setError(errorText['persistence-failed'])
      }
      return
    }
    if (!activeRef.current) return
    session.setReviewDraft(null)
    setLoadedDraft('')
    setSummary(null)
    setSelectedReference(null)
    setPeriodConflict(false)
    setContextId(null)
    setConfirmedProgress('')
    setMainObstacle('')
    setNextAdjustment('')
    setRelatedGoalId('')
    setNextStepKind('none')
    setNotice('已取消，本次填写没有保存。')
    setEntryKey((value) => value + 1)
  }

  const save = async (): Promise<void> => {
    if (!contextId || busy) return
    const nextStepChange: CompleteReviewInputDto['nextStepChange'] =
      nextStepKind === 'use-existing'
        ? { kind: 'use-existing', actionId: existingActionId }
        : nextStepKind === 'create-and-use'
          ? { kind: 'create-and-use', title: newActionTitle }
          : { kind: 'none' }
    setBusy(true)
    setError(null)
    const completion = window.myTracer.review
      .complete({
        reviewContextId: contextId,
        confirmedProgress,
        mainObstacle,
        nextAdjustment,
        relatedGoalId: relatedGoalId || null,
        nextStepChange
      })
      .catch(() => ({ ok: false, error: { code: 'persistence-failed' } }) as const)
    const pending = completion.then((result) => {
      // Re-entry waits for this acknowledgement before restoring a draft or reading the result.
      // A successful creation must never remain in the draft as a command to replay.
      if (result.ok) session.setReviewDraft(null)
    })
    session.setPendingReviewSave(pending)
    const result = await completion
    await pending
    if (session.getPendingReviewSave() === pending) session.setPendingReviewSave(null)
    if (!activeRef.current) return
    if (!result.ok) {
      setBusy(false)
      setError(errorText[result.error.code])
      return
    }
    if (relatedGoalId && nextStepKind !== 'none') {
      const [goalResult, todayResult] = await Promise.all([
        window.myTracer.goals.getDetail({ goalId: relatedGoalId }).catch(() => null),
        window.myTracer.today.get({}).catch(() => null)
      ])
      if (!activeRef.current) return
      if (goalResult?.ok && goalResult.value.currentNextAction) {
        const action = goalResult.value.currentNextAction
        setFollowUp({
          actionId: action.id,
          actionTitle: action.title,
          isInToday:
            todayResult !== null &&
            todayResult.ok &&
            [...todayResult.value.focuses, ...todayResult.value.intentions].some(
              (todayAction) => todayAction.id === action.id
            )
        })
      } else {
        setFollowUp(null)
      }
    } else {
      setFollowUp(null)
    }
    setBusy(false)
    setLoadedDraft(currentDraft)
    setSelectedReference(null)
    setNotice('本周期复盘已保存。')
    setContextId(null)
    setEntryKey((value) => value + 1)
  }

  return (
    <section className="review-workspace" aria-label="周期复盘">
      <div className="review-toolbar">
        <div>
          <p className="review-kicker">当前周期 · 周一至周日</p>
          <h2>
            {summary
              ? `${summary.periodStartedOn} 至 ${summary.periodEndedOn}`
              : '正在捕获本周周期…'}
          </h2>
          <p>本次复盘会保持在当前日期范围；跨周后可由你主动重新读取。</p>
        </div>
        <button
          className="secondary-button"
          type="button"
          disabled={busy || !contextId}
          onClick={() => void refresh()}
        >
          重新读取记录
        </button>
        {summary ? (
          <button
            className="secondary-button"
            type="button"
            onClick={() =>
              session.openProgressPeriod(
                shiftLocalDate(summary.periodStartedOn, -7),
                shiftLocalDate(summary.periodEndedOn, -7)
              )
            }
          >
            查看前一周记录
          </button>
        ) : null}
      </div>

      {contextId && summary ? <PreviousAdjustment key={contextId} contextId={contextId} /> : null}

      {error ? (
        <div className="review-error" role="alert">
          <p>{error}</p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              setContextId(null)
              setBusy(true)
              setError(null)
              setEntryKey((value) => value + 1)
            }}
          >
            重新进入本周复盘
          </button>
        </div>
      ) : null}

      {notice ? (
        <p className="review-notice" role="status">
          {notice}
        </p>
      ) : null}

      {followUp ? (
        <div className="review-notice" aria-label="复盘后的下一步">
          <p>
            当前下一步：<strong>{followUp.actionTitle}</strong> ·{' '}
            {followUp.isInToday ? '已在今天' : '尚未加入今天'}
          </p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => session.openAction(followUp.actionId, 'review')}
          >
            前往今天确认
          </button>
        </div>
      ) : null}

      {busy && !summary ? (
        <p className="empty-copy" role="status">
          正在读取本地周期记录…
        </p>
      ) : null}

      {summary ? (
        <>
          <nav className="review-writing-nav" aria-label="复盘填写与参考">
            <span>事实辅助复盘 · 实验</span>
            <button
              type="button"
              onClick={() => {
                composerRef.current?.scrollIntoView({ block: 'start' })
                progressRef.current?.focus()
              }}
            >
              前往填写
            </button>
            <button
              type="button"
              onClick={() => {
                factsRef.current?.scrollIntoView({ block: 'start' })
                factsRef.current?.focus()
              }}
            >
              查看参考事实
            </button>
          </nav>
          <div className="review-summary" aria-label="周期汇总">
            <article>
              <span>已记录时长合计</span>
              <strong>
                {summary.unknownDurationCount === summary.realActionCount &&
                summary.unknownDurationCount > 0
                  ? '时长未记录'
                  : `${summary.totalDurationMinutes} 分钟`}
              </strong>
              <small>{summary.unknownDurationCount} 条行动事实未记时长；合计不含未知时长。</small>
            </article>
            <article>
              <span>真实行动次数</span>
              <strong>{summary.realActionCount}</strong>
            </article>
            <article>
              <span>已确认的理解</span>
              <strong>{summary.confirmedUnderstandingCount}</strong>
            </article>
            <article>
              <span>尚未解决的困惑</span>
              <strong>{summary.openConfusionCount}</strong>
            </article>
          </div>

          {periodConflict ? (
            <div className="review-error" role="alert">
              <p>
                已进入新的周期。这里保留上一周期的未保存草稿，不会自动带入本周。你可以先复制文字，再决定是否放弃。
              </p>
              <button type="button" onClick={() => void cancelDraft()}>
                放弃草稿并进入新周期
              </button>
            </div>
          ) : null}
          <div className="review-writing-grid">
            <form
              className="review-form"
              ref={composerRef}
              tabIndex={-1}
              aria-label="复盘填写"
              onSubmit={(event) => {
                event.preventDefault()
                void save()
              }}
            >
              <fieldset
                className="review-composer-fields"
                disabled={busy || (!contextId && !periodConflict)}
              >
                <div className="review-section-heading">
                  <h2>确认本周期复盘</h2>
                  <p>记录摘要会随已有内容更新；下面三段由你确认的文字会保持原样保存。</p>
                </div>
                <label>
                  一个真实进展
                  <textarea
                    ref={progressRef}
                    aria-label="一个真实进展"
                    readOnly={periodConflict}
                    value={confirmedProgress}
                    onChange={(event) => setConfirmedProgress(event.target.value)}
                    required
                  />
                </label>
                <label>
                  一个主要阻力
                  <textarea
                    ref={obstacleRef}
                    aria-label="一个主要阻力"
                    readOnly={periodConflict}
                    value={mainObstacle}
                    onChange={(event) => setMainObstacle(event.target.value)}
                    required
                  />
                </label>
                <label>
                  下一周期的一个调整
                  <textarea
                    ref={adjustmentRef}
                    aria-label="下一周期的一个调整"
                    readOnly={periodConflict}
                    value={nextAdjustment}
                    onChange={(event) => setNextAdjustment(event.target.value)}
                    required
                  />
                </label>
                <label>
                  关联活跃目标（可选）
                  <select
                    disabled={!contextId}
                    value={relatedGoalId}
                    onChange={(event) => selectRelatedGoal(event.target.value)}
                  >
                    <option value="">不关联目标</option>
                    {goals.map((goal) => (
                      <option key={goal.id} value={goal.id}>
                        {goal.name}
                      </option>
                    ))}
                  </select>
                </label>
                {relatedGoalId ? (
                  <fieldset disabled={!contextId}>
                    <legend>当前下一步（可选、明确更新）</legend>
                    <label>
                      <input
                        type="radio"
                        checked={nextStepKind === 'none'}
                        onChange={() => setNextStepKind('none')}
                      />
                      不修改
                    </label>
                    <label>
                      <input
                        type="radio"
                        checked={nextStepKind === 'use-existing'}
                        onChange={() => setNextStepKind('use-existing')}
                      />
                      使用已有待行动
                    </label>
                    {nextStepKind === 'use-existing' ? (
                      <select
                        aria-label="选择已有下一步行动"
                        required
                        value={existingActionId}
                        onChange={(event) => setExistingActionId(event.target.value)}
                      >
                        <option value="">请选择行动</option>
                        {pendingActions.map((action) => (
                          <option key={action.id} value={action.id}>
                            {action.title}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    <label>
                      <input
                        type="radio"
                        checked={nextStepKind === 'create-and-use'}
                        onChange={() => setNextStepKind('create-and-use')}
                      />
                      创建并使用
                    </label>
                    {nextStepKind === 'create-and-use' ? (
                      <input
                        aria-label="新的下一步行动"
                        required
                        value={newActionTitle}
                        onChange={(event) => setNewActionTitle(event.target.value)}
                        placeholder="新的轻量行动"
                      />
                    ) : null}
                  </fieldset>
                ) : null}
                <div className="review-form-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={busy || !contextId}
                    onClick={() => void cancelDraft()}
                  >
                    取消
                  </button>
                  <button className="primary-button" type="submit" disabled={busy || !contextId}>
                    保存复盘
                  </button>
                </div>
              </fieldset>
            </form>
            <aside className="review-reference-panel" aria-label="复盘事实参考">
              <div className="review-reference-selection" aria-live="polite">
                <h2>事实参考</h2>
                {selectedReference ? (
                  <>
                    <div className="review-reference-controls">
                      <label>
                        引用到
                        <select
                          value={citationTarget}
                          onChange={(event) =>
                            setCitationTarget(event.target.value as typeof citationTarget)
                          }
                        >
                          <option value="progress">一个真实进展</option>
                          <option value="obstacle">一个主要阻力</option>
                          <option value="adjustment">下一周期的一个调整</option>
                        </select>
                      </label>
                      <button
                        type="button"
                        disabled={
                          busy ||
                          !contextId ||
                          periodConflict ||
                          selectedState !== 'current' ||
                          alreadyCited
                        }
                        onClick={cite}
                      >
                        {alreadyCited ? '此处已引用' : '追加引用到草稿'}
                      </button>
                      <button
                        type="button"
                        className="quiet-button"
                        onClick={() => setSelectedReference(null)}
                      >
                        清除参考
                      </button>
                    </div>
                    <div
                      className="review-reference-preview"
                      tabIndex={0}
                      aria-label="参考正文与完整引文"
                    >
                      {selectedState !== 'current' ? (
                        <p role="status">
                          {selectedState === 'missing'
                            ? '此事实已不在当前摘要中，不能继续引用。'
                            : '此事实已变化，请重新选择后再引用。'}{' '}
                          已写入的草稿不会改变。
                        </p>
                      ) : null}
                      <details key={selectedReference.citation}>
                        <summary>查看来源与完整引文</summary>
                        <p className="review-reference-fulltext">{selectedReference.citation}</p>
                      </details>
                      <blockquote>{selectedReference.text}</blockquote>
                    </div>
                  </>
                ) : (
                  <p>先选一条事实，再决定是否引用到自己的复盘。选择不会自动填写。</p>
                )}
              </div>
              <div
                className="review-fact-browser"
                data-scroll-key="review-facts"
                ref={factsRef}
                tabIndex={0}
                aria-label="可选择的周期事实"
              >
                <section aria-label="周期行动记录">
                  <div className="review-section-heading">
                    <div>
                      <h2>行动记录</h2>
                    </div>
                    <span>{summary.actionRecords.length} 条</span>
                  </div>
                  {summary.actionRecords.length ? (
                    <ol className="progress-records">
                      {summary.actionRecords.map((record) => (
                        <li key={record.recordId}>
                          <div className="progress-record-heading">
                            <div>
                              <h3>{record.actionTitle}</h3>
                              <p>
                                {record.occurredOn} · {recordDuration(record.durationMinutes)}
                              </p>
                            </div>
                          </div>
                          <ProgressActionNotes record={record} />
                          {referenceButton(`action:${record.recordId}`)}
                          <button
                            className="quiet-button record-open-button"
                            type="button"
                            onClick={() =>
                              session.openDataRecord(
                                { type: 'action-record', id: record.recordId },
                                'review'
                              )
                            }
                          >
                            查看完整记录或修改
                          </button>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="review-no-explicit-fact">本周期没有行动记录。</p>
                  )}
                </section>

                <section aria-label="例行周期记录">
                  <div className="review-section-heading">
                    <div>
                      <h2>例行记录</h2>
                      <p>这里只分列已明确保存的记录；未记录的日期保持未知。</p>
                    </div>
                  </div>
                  <div className="review-routine-grid">
                    {routineColumns.map((column) => {
                      const facts = summary.routineOutcomeFacts[column.key]
                      return (
                        <article
                          key={column.key}
                          aria-label={`${column.title} ${summary.routineOutcomeCounts[column.key]} 条`}
                        >
                          <div className="review-routine-heading">
                            <div>
                              <h3>{column.title}</h3>
                              <p>{column.description}</p>
                            </div>
                            <strong>{summary.routineOutcomeCounts[column.key]}</strong>
                          </div>
                          {summary.routineOutcomeCounts[column.key] > 0 ? (
                            <ol>
                              {facts.map((fact) => (
                                <li key={fact.recordId}>
                                  <strong>{fact.routineName}</strong>
                                  <span>
                                    {fact.occurredOn}
                                    {fact.durationMinutes === null
                                      ? ''
                                      : ` · ${fact.durationMinutes} 分钟`}
                                  </span>
                                  {fact.summary ? (
                                    <p className="record-summary">简述：{fact.summary}</p>
                                  ) : null}
                                  {fact.note ? (
                                    <div>
                                      补充笔记
                                      <RecordNote text={fact.note} />
                                    </div>
                                  ) : null}
                                  {referenceButton(`routine:${fact.recordId}`)}
                                </li>
                              ))}
                            </ol>
                          ) : (
                            <p className="review-no-explicit-fact">本周期没有这类明确记录</p>
                          )}
                        </article>
                      )
                    })}
                  </div>
                </section>

                <div className="review-learning-grid">
                  <section aria-label="周期已确认理解">
                    <h2>已确认的理解</h2>
                    {summary.confirmedUnderstandingCount > 0 ? (
                      <ol>
                        {summary.understandings.map((fact) => (
                          <li key={fact.id}>
                            <p>{fact.text}</p>
                            <span>
                              {fact.occurredOn} · {fact.actionTitle}
                            </span>
                            {referenceButton(`understanding:${fact.id}`)}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="review-no-explicit-fact">本周期没有已确认理解。</p>
                    )}
                  </section>
                  <section aria-label="周期未解决困惑">
                    <h2>尚未解决的困惑</h2>
                    {summary.openConfusionCount > 0 ? (
                      <ol>
                        {summary.openConfusions.map((fact) => (
                          <li key={fact.id}>
                            <p>{fact.text}</p>
                            <span>
                              {fact.occurredOn} · {fact.actionTitle}
                            </span>
                            {referenceButton(`confusion:${fact.id}`)}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="review-no-explicit-fact">本周期没有尚未解决的困惑。</p>
                    )}
                  </section>
                </div>

                {!summary.hasRecordedFacts ? (
                  <div className="review-empty">
                    <h2>本周期还没有记录</h2>
                    <p>空白只表示没有行动记录或例行记录；未记录不等于未进行或失败。</p>
                  </div>
                ) : null}
              </div>
            </aside>
          </div>
        </>
      ) : null}
    </section>
  )
}
