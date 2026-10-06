import { type ReactNode, useEffect, useMemo, useState } from 'react'
import type { GoalSummaryDto } from '../../../../contracts/goals'
import type {
  ProgressErrorCode,
  ProgressRecordFactDto,
  ProgressViewDto,
  WeekComparisonDto,
  RoutineProgressRecordFactDto
} from '../../../../contracts/progress'
import { usePagePosition, useUiSession, type ProgressFilterState } from '../../app/ui-session'
import { recordOutcomeText, routineRecordOutcomeText } from '../../app/ui-text'

const progressErrorText: Record<ProgressErrorCode, string> = {
  validation: '请检查目标或日期筛选；开始日期不能晚于结束日期。',
  'not-found': '所选目标已不存在，请重新选择。',
  'persistence-failed': '本地进展记录暂时无法读取。'
}

type TimelineItem =
  | { readonly kind: 'action'; readonly record: ProgressRecordFactDto }
  | { readonly kind: 'routine'; readonly record: RoutineProgressRecordFactDto }

function ProgressWorkspace(): ReactNode {
  const session = useUiSession()
  const initialDraft = session.progressDraftFilter
  const initialApplied = session.progressAppliedFilter
  const [goals, setGoals] = useState<readonly GoalSummaryDto[]>([])
  const [goalId, setGoalId] = useState(initialDraft.goalId)
  const [from, setFrom] = useState(initialDraft.from)
  const [through, setThrough] = useState(initialDraft.through)
  const [appliedFilter, setAppliedFilter] = useState(initialApplied)
  const [progress, setProgress] = useState<ProgressViewDto | null>(null)
  usePagePosition('progress', progress !== null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [comparison, setComparison] = useState<{
    goalId: string
    value: WeekComparisonDto | null
    error: string | null
  } | null>(null)
  const [comparisonVersion, setComparisonVersion] = useState(0)

  useEffect(() => {
    let active = true
    const queryGoalId = appliedFilter.goalId
    void window.myTracer.progress
      .compareWeeks({ goalId: queryGoalId || null })
      .then((result) => {
        if (!active) return
        setComparison({
          goalId: queryGoalId,
          value: result.ok ? result.value : null,
          error: result.ok ? null : progressErrorText[result.error.code]
        })
      })
      .catch(() => {
        if (active)
          setComparison({
            goalId: queryGoalId,
            value: null,
            error: progressErrorText['persistence-failed']
          })
      })
    return () => {
      active = false
    }
  }, [appliedFilter.goalId, comparisonVersion])

  const updateDraft = (next: ProgressFilterState): void => {
    setGoalId(next.goalId)
    setFrom(next.from)
    setThrough(next.through)
    session.setProgressDraftFilter(next)
  }

  const load = async (filter: ProgressFilterState): Promise<void> => {
    setBusy(true)
    const result = await window.myTracer.progress.get({
      goalId: filter.goalId || null,
      from: filter.from || null,
      through: filter.through || null
    })
    setBusy(false)
    if (result.ok) {
      session.applyProgressFilter(filter)
      setAppliedFilter(filter)
      setProgress(result.value)
      setComparisonVersion((version) => version + 1)
      setError(null)
    } else {
      setError(progressErrorText[result.error.code])
    }
  }

  useEffect(() => {
    let active = true
    void Promise.all([
      window.myTracer.goals.list({ status: null }),
      window.myTracer.progress.get({
        goalId: initialApplied.goalId || null,
        from: initialApplied.from || null,
        through: initialApplied.through || null
      })
    ])
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
  }, [initialApplied.from, initialApplied.goalId, initialApplied.through])

  const timeline = useMemo<readonly TimelineItem[]>(() => {
    if (!progress) return []
    return [
      ...progress.records.map((record) => ({ kind: 'action' as const, record })),
      ...progress.routineRecords.map((record) => ({ kind: 'routine' as const, record }))
    ].sort(
      (left, right) =>
        right.record.occurredOn.localeCompare(left.record.occurredOn) ||
        right.record.createdAt.localeCompare(left.record.createdAt)
    )
  }, [progress])

  const filtersChanged =
    goalId !== appliedFilter.goalId ||
    from !== appliedFilter.from ||
    through !== appliedFilter.through
  const goalName = (id: string | null): string =>
    id ? (goals.find((goal) => goal.id === id)?.name ?? '关联目标') : '未关联目标'
  const displayedComparison = comparison?.goalId === appliedFilter.goalId ? comparison : null
  const week = displayedComparison?.value
  const signed = (value: number): string => (value > 0 ? `+${value}` : String(value))

  return (
    <section className="progress-workspace" aria-label="进展记录">
      <form
        className="progress-filters"
        onSubmit={(event) => {
          event.preventDefault()
          void load({ goalId, from, through })
        }}
      >
        <label>
          目标（可选）
          <select
            value={goalId}
            onChange={(event) => updateDraft({ goalId: event.target.value, from, through })}
          >
            <option value="">全部目标与无目标行动</option>
            {goals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          开始日期（包含）
          <input
            type="date"
            value={from}
            onChange={(event) => updateDraft({ goalId, from: event.target.value, through })}
          />
        </label>
        <label>
          结束日期（包含）
          <input
            type="date"
            value={through}
            onChange={(event) => updateDraft({ goalId, from, through: event.target.value })}
          />
        </label>
        <button className="primary-button" type="submit" disabled={busy}>
          查看记录
        </button>
      </form>

      {filtersChanged ? (
        <p className="filter-notice" role="status">
          筛选条件已更改；点击“查看记录”后，下方内容才会更新。
        </p>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {busy && !progress ? <p role="status">正在读取本地记录…</p> : null}
      {progress ? (
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
            <span>例行达标次数</span>
            <strong>{progress.targetMetCount}</strong>
          </article>
          <article>
            <span>计划日达标次数</span>
            <strong>{progress.plannedTargetMetCount}</strong>
          </article>
        </div>
      ) : null}
      <section className="goal-card week-comparison" aria-label="本周与上周事实比较">
        <h2>本周与上周</h2>
        <p className="empty-copy">
          {appliedFilter.goalId ? goalName(appliedFilter.goalId) : '全部目标与无目标行动'} ·
          周比较按本周/上周，不使用历史日期范围。
        </p>
        {!displayedComparison ? <p role="status">正在读取周期间事实…</p> : null}
        {displayedComparison?.error ? (
          <p role="status">
            {displayedComparison.error}
            <button type="button" onClick={() => setComparisonVersion((version) => version + 1)}>
              重试周比较
            </button>
          </p>
        ) : null}
        {week ? (
          <>
            <p>
              截至 {week.asOfLocalDate} 的记录
              {week.asOfLocalDate < week.currentWeekEndedOn
                ? '，本周尚未结束；两个统计区间可能不等长。'
                : '。'}
            </p>
            <div className="week-comparison-scroll">
              <table>
                <caption>已记录的事实；差值为本周减上周</caption>
                <thead>
                  <tr>
                    <th scope="col">事实</th>
                    <th scope="col">
                      本周 {week.current.from} 至 {week.current.through}
                    </th>
                    <th scope="col">
                      上周 {week.previous.from} 至 {week.previous.through}
                    </th>
                    <th scope="col">差值</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">记录到的投入分钟</th>
                    <td>{week.current.totalDurationMinutes}</td>
                    <td>{week.previous.totalDurationMinutes}</td>
                    <td>{signed(week.difference.totalDurationMinutes)}</td>
                  </tr>
                  <tr>
                    <th scope="row">记录到的行动次数</th>
                    <td>{week.current.realActionCount}</td>
                    <td>{week.previous.realActionCount}</td>
                    <td>{signed(week.difference.realActionCount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {!week.current.hasRecordedFacts && !week.previous.hasRecordedFacts ? (
              <p>这两个区间尚无记录；没有记录不表示没有行动。</p>
            ) : (
              <>
                {!week.current.hasRecordedFacts ? <p>本周统计区间尚无记录。</p> : null}
                {!week.previous.hasRecordedFacts ? <p>上周统计区间尚无记录。</p> : null}
              </>
            )}
            <p className="empty-copy">
              0 只表示已记录的合计为 0；这些事实不评价行动质量，也不要求补齐记录。
            </p>
          </>
        ) : null}
      </section>
      {progress ? (
        <>
          {timeline.length ? (
            <section aria-label="按时间排列的记录">
              <div className="progress-timeline-heading">
                <div>
                  <p className="eyebrow">最近发生</p>
                  <h2 className="progress-section-title">行动与例行记录</h2>
                </div>
                <span>{timeline.length} 条</span>
              </div>
              <ol className="progress-records progress-timeline">
                {timeline.map((item) => {
                  const record = item.record
                  return (
                    <li key={`${item.kind}-${record.recordId}`}>
                      <div className="progress-record-heading">
                        <div>
                          <span className="record-kind">
                            {item.kind === 'action' ? '行动记录' : '例行记录'}
                          </span>
                          <h2>
                            {item.kind === 'action'
                              ? item.record.actionTitle
                              : item.record.routineName}
                          </h2>
                          <p>
                            {record.occurredOn} · {goalName(record.goalId)} ·{' '}
                            {item.kind === 'action'
                              ? recordOutcomeText[item.record.outcome]
                              : routineRecordOutcomeText[item.record.outcome]}
                            {item.kind === 'routine'
                              ? ` · ${item.record.plannedForDate ? '计划日记录' : '非计划日记录'}`
                              : ''}
                          </p>
                        </div>
                        <strong>
                          {record.durationMinutes === null
                            ? '时长未记录'
                            : record.durationMinutes === 0
                              ? '少于 1 分钟'
                              : `${record.durationMinutes} 分钟`}
                        </strong>
                      </div>
                      {item.kind === 'action' && item.record.understandings.length ? (
                        <div className="progress-fact-group">
                          <h3>已确认的理解</h3>
                          {item.record.understandings.map((fact) => (
                            <p key={fact.id}>{fact.text}</p>
                          ))}
                        </div>
                      ) : null}
                      {item.kind === 'action' && item.record.openConfusions.length ? (
                        <div className="progress-fact-group">
                          <h3>尚未解决的困惑</h3>
                          {item.record.openConfusions.map((fact) => (
                            <p key={fact.id}>{fact.text}</p>
                          ))}
                        </div>
                      ) : null}
                      {item.kind === 'routine' && item.record.note ? (
                        <p>{item.record.note}</p>
                      ) : null}
                      <button
                        className="quiet-button record-open-button"
                        type="button"
                        onClick={() =>
                          session.openDataRecord(
                            {
                              type: item.kind === 'action' ? 'action-record' : 'routine-record',
                              id: record.recordId
                            },
                            'progress'
                          )
                        }
                      >
                        查看完整记录或修改
                      </button>
                    </li>
                  )
                })}
              </ol>
            </section>
          ) : (
            <div className="progress-empty">
              <h2>这个范围内还没有记录</h2>
              <p>没有记录不表示失败或未坚持，只表示当前筛选下没有已保存内容。</p>
            </div>
          )}
        </>
      ) : null}
    </section>
  )
}

export { ProgressWorkspace as ProgressPage }
