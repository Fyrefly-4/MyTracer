import { usePagePosition, useUiSession, useUnsavedContent } from '../../app/ui-session'
import { type ReactNode, useEffect, useState } from 'react'
import type {
  CompleteReviewInputDto,
  ReviewErrorCode,
  ReviewRoutineOutcomeFactsDto,
  ReviewSummaryDto
} from '../../../../contracts/review'
import type { GoalActionSummaryDto, GoalSummaryDto } from '../../../../contracts/goals'

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
  const [entryKey, setEntryKey] = useState(0)
  const [contextId, setContextId] = useState<string | null>(null)
  const [summary, setSummary] = useState<ReviewSummaryDto | null>(null)
  usePagePosition('review', summary !== null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmedProgress, setConfirmedProgress] = useState('')
  const [mainObstacle, setMainObstacle] = useState('')
  const [nextAdjustment, setNextAdjustment] = useState('')
  const [goals, setGoals] = useState<readonly GoalSummaryDto[]>([])
  const [relatedGoalId, setRelatedGoalId] = useState('')
  const [pendingActions, setPendingActions] = useState<readonly GoalActionSummaryDto[]>([])
  const [nextStepKind, setNextStepKind] = useState<'none' | 'use-existing' | 'create-and-use'>(
    'none'
  )
  const [existingActionId, setExistingActionId] = useState('')
  const [newActionTitle, setNewActionTitle] = useState('')
  const [followUp, setFollowUp] = useState<ReviewFollowUp | null>(null)
  const [loadedDraft, setLoadedDraft] = useState('')
  const currentDraft = JSON.stringify([
    confirmedProgress,
    mainObstacle,
    nextAdjustment,
    relatedGoalId,
    nextStepKind,
    existingActionId,
    newActionTitle
  ])
  useUnsavedContent('review-form', Boolean(contextId && !busy && currentDraft !== loadedDraft))

  useEffect(() => {
    let active = true
    let openedContextId: string | null = null

    void window.myTracer.review
      .begin({})
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
        setContextId(openedContextId)
        const [summaryResult, reviewResult, goalsResult] = await Promise.all([
          window.myTracer.review.getSummary({ reviewContextId: openedContextId }),
          window.myTracer.review.getResult({ reviewContextId: openedContextId }),
          window.myTracer.goals.list({ status: 'active' })
        ])
        if (!active) return
        setBusy(false)
        if (summaryResult.ok && reviewResult.ok && goalsResult.ok) {
          setSummary(summaryResult.value)
          setGoals(goalsResult.value)
          if (reviewResult.value) {
            setConfirmedProgress(reviewResult.value.confirmedProgress)
            setMainObstacle(reviewResult.value.mainObstacle)
            setNextAdjustment(reviewResult.value.nextAdjustment)
            setRelatedGoalId(reviewResult.value.relatedGoalId ?? '')
          }
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
  }, [entryKey])

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
    if (contextId) await window.myTracer.review.cancel({ reviewContextId: contextId })
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
    if (!contextId) return
    const nextStepChange: CompleteReviewInputDto['nextStepChange'] =
      nextStepKind === 'use-existing'
        ? { kind: 'use-existing', actionId: existingActionId }
        : nextStepKind === 'create-and-use'
          ? { kind: 'create-and-use', title: newActionTitle }
          : { kind: 'none' }
    setBusy(true)
    setError(null)
    const result = await window.myTracer.review.complete({
      reviewContextId: contextId,
      confirmedProgress,
      mainObstacle,
      nextAdjustment,
      relatedGoalId: relatedGoalId || null,
      nextStepChange
    })
    setBusy(false)
    if (!result.ok) {
      setError(errorText[result.error.code])
      return
    }
    if (relatedGoalId && nextStepKind !== 'none') {
      const [goalResult, todayResult] = await Promise.all([
        window.myTracer.goals.getDetail({ goalId: relatedGoalId }).catch(() => null),
        window.myTracer.today.get({}).catch(() => null)
      ])
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

      {error ? (
        <div className="review-error" role="alert">
          <p>{error}</p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              setSummary(null)
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
          <div className="review-summary" aria-label="周期汇总">
            <article>
              <span>投入时间</span>
              <strong>{summary.totalDurationMinutes} 分钟</strong>
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
                          {record.occurredOn} · {record.durationMinutes} 分钟
                        </p>
                      </div>
                    </div>
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

          <form
            className="review-form"
            onSubmit={(event) => {
              event.preventDefault()
              void save()
            }}
          >
            <div className="review-section-heading">
              <h2>确认本周期复盘</h2>
              <p>记录摘要会随已有内容更新；下面三段由你确认的文字会保持原样保存。</p>
            </div>
            <label>
              一个真实进展
              <textarea
                value={confirmedProgress}
                onChange={(event) => setConfirmedProgress(event.target.value)}
                required
              />
            </label>
            <label>
              一个主要阻力
              <textarea
                value={mainObstacle}
                onChange={(event) => setMainObstacle(event.target.value)}
                required
              />
            </label>
            <label>
              下一周期的一个调整
              <textarea
                value={nextAdjustment}
                onChange={(event) => setNextAdjustment(event.target.value)}
                required
              />
            </label>
            <label>
              关联活跃目标（可选）
              <select
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
              <fieldset>
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
          </form>
        </>
      ) : null}
    </section>
  )
}
