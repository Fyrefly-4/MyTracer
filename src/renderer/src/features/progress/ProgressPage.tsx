import { RecordNote } from '../../app/RecordText'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import './progress-workspace.css'
import { ProgressActionNotes } from './ProgressActionNotes'
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

function ProgressWorkspace({ onOpenBook }: { onOpenBook: () => void }): ReactNode {
  const session = useUiSession()
  const initialDraft = session.progressDraftFilter
  const initialApplied = session.progressAppliedFilter
  const [goals, setGoals] = useState<readonly GoalSummaryDto[]>([])
  const [goalId, setGoalId] = useState(initialDraft.goalId)
  const [from, setFrom] = useState(initialDraft.from)
  const [through, setThrough] = useState(initialDraft.through)
  const [appliedFilter, setAppliedFilter] = useState(initialApplied)
  const [detailRevision, setDetailRevision] = useState(0)
  const [progress, setProgress] = useState<ProgressViewDto | null>(null)
  usePagePosition('progress', progress !== null)
  const [recordPage, updateRecordPage] = useState(session.progressRecordPage)
  const setRecordPage = (page: number): void => {
    updateRecordPage(page)
    session.setProgressRecordPage(page)
  }
  const timelineRef = useRef<HTMLDivElement>(null)
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
    setDetailRevision((revision) => revision + 1)
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
      setRecordPage(1)
      timelineRef.current?.scrollTo({ top: 0 })
      setProgress(result.value)
      // Rows can be reopened while the previous snapshot is still visible during a refresh.
      setDetailRevision((revision) => revision + 1)
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
          setDetailRevision((revision) => revision + 1)
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

  const pageCount = Math.max(1, Math.ceil(timeline.length / 8))
  const currentPage = Math.min(recordPage, pageCount)
  const visibleTimeline = timeline.slice((currentPage - 1) * 8, currentPage * 8)

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
      <details className="progress-more">
        <summary>更多</summary>
        <button type="button" onClick={onOpenBook}>
          阅读记录册
        </button>
      </details>
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
            <span>已记录时长合计（分钟）</span>
            <strong>
              {progress.unknownDurationCount === progress.realActionCount &&
              progress.unknownDurationCount > 0
                ? '时长未记录'
                : progress.totalDurationMinutes}
            </strong>
            <small>{progress.unknownDurationCount} 条行动事实未记时长；合计不含未知时长。</small>
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
      <details className="week-comparison" aria-label="本周与上周事实比较">
        <summary>本周与上周</summary>
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
                <caption>
                  已记录的事实；差值为本周减上周。时长覆盖可能不同，分钟差值不代表实际投入变化。
                </caption>
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
                    <th scope="row">未记时长的行动事实</th>
                    <td>
                      {week.current.unknownDurationCount} / {week.current.realActionCount}
                    </td>
                    <td>
                      {week.previous.unknownDurationCount} / {week.previous.realActionCount}
                    </td>
                    <td>—</td>
                  </tr>
                  <tr>
                    <th scope="row">已记录时长（分钟）</th>
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
      </details>
      {progress ? (
        <>
          {timeline.length ? (
            <section className="progress-history" aria-label="按时间排列的记录">
              <div className="progress-timeline-heading">
                <h2 className="progress-section-title">行动与例行记录</h2>
                <span>{timeline.length} 条 · 每页 8 条</span>
              </div>
              <div className="progress-history-scroll" data-scroll-key="records" ref={timelineRef}>
                <table className="progress-history-table">
                  <caption className="visually-hidden">当前筛选范围内的行动与例行记录</caption>
                  <thead>
                    <tr>
                      <th scope="col">日期 / 类型</th>
                      <th scope="col">行动内容</th>
                      <th scope="col">时长</th>
                      <th scope="col">详情</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTimeline.map((item) => {
                      const record = item.record
                      return (
                        <tr key={`${item.kind}-${record.recordId}`}>
                          <td>
                            <time dateTime={record.occurredOn}>{record.occurredOn}</time>
                            <small>{item.kind === 'action' ? '行动记录' : '例行记录'}</small>
                          </td>
                          <td>
                            <strong>
                              {item.kind === 'action'
                                ? item.record.actionTitle
                                : item.record.routineName}
                            </strong>
                            <p className="progress-record-meta">
                              {goalName(record.goalId)} ·{' '}
                              {item.kind === 'action'
                                ? recordOutcomeText[item.record.outcome]
                                : routineRecordOutcomeText[item.record.outcome]}
                              {item.kind === 'routine'
                                ? ` · ${item.record.plannedForDate ? '计划日记录' : '非计划日记录'}`
                                : ''}
                            </p>
                            {item.kind === 'action' ? (
                              <ProgressActionNotes
                                key={`${record.recordId}:${detailRevision}`}
                                record={item.record}
                                originalFirst
                              />
                            ) : item.record.note || item.record.summary ? (
                              <details className="progress-record-notes">
                                <summary>展开理解与记录</summary>
                                {item.record.summary ? (
                                  <p className="record-summary">简述：{item.record.summary}</p>
                                ) : null}
                                {item.record.note ? (
                                  <div>
                                    <h3>补充笔记</h3>
                                    <RecordNote text={item.record.note} />
                                  </div>
                                ) : null}
                              </details>
                            ) : null}
                          </td>
                          <td>
                            {record.durationMinutes === null
                              ? '时长未记录'
                              : record.durationMinutes === 0
                                ? '少于 1 分钟'
                                : `${record.durationMinutes} 分钟`}
                          </td>
                          <td>
                            <button
                              className="quiet-button record-open-button"
                              type="button"
                              onClick={() =>
                                session.openDataRecord(
                                  {
                                    type:
                                      item.kind === 'action' ? 'action-record' : 'routine-record',
                                    id: record.recordId
                                  },
                                  'progress'
                                )
                              }
                            >
                              查看完整记录或修改
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <nav className="progress-pagination" aria-label="进展记录分页">
                <button
                  type="button"
                  className="quiet-button"
                  disabled={currentPage === 1}
                  onClick={() => {
                    setRecordPage(currentPage - 1)
                    timelineRef.current?.scrollTo({ top: 0 })
                  }}
                >
                  上一页
                </button>
                <span aria-live="polite">
                  第 {currentPage} / {pageCount} 页
                </span>
                <button
                  type="button"
                  className="quiet-button"
                  disabled={currentPage === pageCount}
                  onClick={() => {
                    setRecordPage(currentPage + 1)
                    timelineRef.current?.scrollTo({ top: 0 })
                  }}
                >
                  下一页
                </button>
              </nav>
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
