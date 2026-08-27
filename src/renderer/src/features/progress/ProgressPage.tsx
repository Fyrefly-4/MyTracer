import { type ReactNode, useEffect, useState } from 'react'
import type { GoalSummaryDto } from '../../../../contracts/goals'
import type { ProgressErrorCode, ProgressViewDto } from '../../../../contracts/progress'
import type { ActionRecordOutcomeDto } from '../../../../contracts/records'
import type { RoutineRecordOutcomeDto } from '../../../../contracts/routine-records'

const progressErrorText: Record<ProgressErrorCode, string> = {
  validation: '请检查目标或日期筛选；开始日期不能晚于结束日期。',
  'not-found': '所选目标已不存在，请重新选择。',
  'persistence-failed': '本地进展事实暂时无法读取。'
}

const recordOutcomeText: Record<ActionRecordOutcomeDto, string> = {
  completed: '本次达到预期',
  partial: '本次完成一部分',
  stopped: '本次在这里停下'
}

const routineRecordOutcomeText: Record<RoutineRecordOutcomeDto | 'unknown', string> = {
  target_met: '达到目标',
  acted: '有真实行动',
  intentional_rest: '有意休息',
  not_done: '明确未做',
  unknown: '尚无记录'
}

function ProgressWorkspace(): ReactNode {
  const [goals, setGoals] = useState<readonly GoalSummaryDto[]>([])
  const [goalId, setGoalId] = useState('')
  const [from, setFrom] = useState('')
  const [through, setThrough] = useState('')
  const [progress, setProgress] = useState<ProgressViewDto | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async (filter = { goalId, from, through }): Promise<void> => {
    setBusy(true)
    const result = await window.myTracer.progress.get({
      goalId: filter.goalId || null,
      from: filter.from || null,
      through: filter.through || null
    })
    setBusy(false)
    if (result.ok) {
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
      window.myTracer.progress.get({})
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
  }, [])

  return (
    <section className="progress-workspace" aria-label="进展事实">
      <form
        className="progress-filters"
        onSubmit={(event) => {
          event.preventDefault()
          void load()
        }}
      >
        <label>
          目标（可选）
          <select value={goalId} onChange={(event) => setGoalId(event.target.value)}>
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
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label>
          结束日期（包含）
          <input type="date" value={through} onChange={(event) => setThrough(event.target.value)} />
        </label>
        <button className="primary-button" type="submit" disabled={busy}>
          查看事实
        </button>
      </form>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {busy && !progress ? (
        <p className="empty-copy" role="status">
          正在读取本地事实…
        </p>
      ) : null}
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
              <span>Routine 达到目标次数</span>
              <strong>{progress.targetMetCount}</strong>
            </article>
            <article>
              <span>计划日达到目标次数</span>
              <strong>{progress.plannedTargetMetCount}</strong>
            </article>
          </div>

          {progress.routineRecords.length ? (
            <section aria-label="Routine 事实">
              <h2 className="progress-section-title">Routine 事实</h2>
              <ol className="progress-records routine-progress-records">
                {progress.routineRecords.map((record) => (
                  <li key={record.recordId}>
                    <div className="progress-record-heading">
                      <div>
                        <h2>{record.routineName}</h2>
                        <p>
                          {record.occurredOn} · {routineRecordOutcomeText[record.outcome]} ·{' '}
                          {record.plannedForDate ? '计划日快照' : '非计划日事实'}
                        </p>
                      </div>
                      <strong>
                        {record.durationMinutes === null
                          ? '时长未记录'
                          : `${record.durationMinutes} 分钟`}
                      </strong>
                    </div>
                    {record.note ? <p>{record.note}</p> : null}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {progress.records.length ? (
            <section aria-label="Action 事实">
              <h2 className="progress-section-title">Action 事实</h2>
              <ol className="progress-records">
                {progress.records.map((record) => (
                  <li key={record.recordId}>
                    <div className="progress-record-heading">
                      <div>
                        <h2>{record.actionTitle}</h2>
                        <p>
                          {record.occurredOn} · {recordOutcomeText[record.outcome]}
                        </p>
                      </div>
                      <strong>
                        {record.durationMinutes === 0
                          ? '少于 1 分钟'
                          : `${record.durationMinutes} 分钟`}
                      </strong>
                    </div>
                    {record.understandings.length ? (
                      <div className="progress-fact-group">
                        <h3>确认理解</h3>
                        {record.understandings.map((item) => (
                          <p key={item.id}>{item.text}</p>
                        ))}
                      </div>
                    ) : null}
                    {record.openConfusions.length ? (
                      <div className="progress-fact-group">
                        <h3>开放困惑</h3>
                        {record.openConfusions.map((item) => (
                          <p key={item.id}>{item.text}</p>
                        ))}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
          {!progress.records.length && !progress.routineRecords.length ? (
            <div className="progress-empty">
              <h2>这个范围内还没有已记录事实</h2>
              <p>
                空白不表示失败、未坚持或未掌握；它只表示当前筛选没有 ActionRecord 或 RoutineRecord。
              </p>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}

export { ProgressWorkspace as ProgressPage }
