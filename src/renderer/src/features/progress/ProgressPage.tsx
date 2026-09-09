import { type ReactNode, useEffect, useMemo, useState } from 'react'
import type { GoalSummaryDto } from '../../../../contracts/goals'
import type {
  ProgressErrorCode,
  ProgressRecordFactDto,
  ProgressViewDto,
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
              <span>例行达标次数</span>
              <strong>{progress.targetMetCount}</strong>
            </article>
            <article>
              <span>计划日达标次数</span>
              <strong>{progress.plannedTargetMetCount}</strong>
            </article>
          </div>

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
