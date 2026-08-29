import { type ReactNode, useEffect, useState } from 'react'
import type {
  ReviewErrorCode,
  ReviewRoutineOutcomeFactsDto,
  ReviewSummaryDto
} from '../../../../contracts/review'

const errorText: Record<ReviewErrorCode, string> = {
  validation: '复盘请求无效，请重新进入 Review。',
  'context-invalid': '本次复盘上下文无效，请重新进入。',
  'context-stale': '本次复盘上下文已失效，请重新进入。',
  'persistence-failed': '本地周期事实暂时无法读取。'
}

const routineColumns: readonly {
  readonly key: keyof ReviewRoutineOutcomeFactsDto
  readonly title: string
  readonly description: string
}[] = [
  { key: 'targetMet', title: '达到目标', description: '明确记录为 target_met' },
  { key: 'acted', title: '有所行动', description: '明确记录为 acted' },
  { key: 'intentionalRest', title: '有意休息', description: '明确记录为 intentional_rest' },
  { key: 'notDone', title: '明确未做', description: '明确记录为 not_done' }
]

export function ReviewPage(): ReactNode {
  const [entryKey, setEntryKey] = useState(0)
  const [contextId, setContextId] = useState<string | null>(null)
  const [summary, setSummary] = useState<ReviewSummaryDto | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
        const summaryResult = await window.myTracer.review.getSummary({
          reviewContextId: openedContextId
        })
        if (!active) return
        setBusy(false)
        if (summaryResult.ok) {
          setSummary(summaryResult.value)
          setError(null)
        } else {
          setError(errorText[summaryResult.error.code])
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

  return (
    <section className="review-workspace" aria-label="周期事实复盘">
      <div className="review-toolbar">
        <div>
          <p className="review-kicker">当前周期 · 周一至周日</p>
          <h2>
            {summary
              ? `${summary.periodStartedOn} 至 ${summary.periodEndedOn}`
              : '正在捕获本周周期…'}
          </h2>
          <p>周期在进入时固定；页面保持打开时不会因跨周而静默移动。</p>
        </div>
        <button
          className="secondary-button"
          type="button"
          disabled={busy || !contextId}
          onClick={() => void refresh()}
        >
          重新读取事实
        </button>
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

      {busy && !summary ? (
        <p className="empty-copy" role="status">
          正在读取本地周期事实…
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
              <span>确认理解</span>
              <strong>{summary.understandings.length}</strong>
            </article>
            <article>
              <span>开放困惑</span>
              <strong>{summary.openConfusions.length}</strong>
            </article>
          </div>

          <section aria-label="Routine 周期事实">
            <div className="review-section-heading">
              <div>
                <h2>Routine 事实</h2>
                <p>这里只分列已明确保存的事实；没有 Record 的日期保持 unknown。</p>
              </div>
            </div>
            <div className="review-routine-grid">
              {routineColumns.map((column) => {
                const facts = summary.routineOutcomeFacts[column.key]
                return (
                  <article key={column.key} aria-label={`${column.title} ${facts.length} 条`}>
                    <div className="review-routine-heading">
                      <div>
                        <h3>{column.title}</h3>
                        <p>{column.description}</p>
                      </div>
                      <strong>{summary.routineOutcomeCounts[column.key]}</strong>
                    </div>
                    {facts.length ? (
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
                      <p className="review-no-explicit-fact">本周期没有这类明确事实</p>
                    )}
                  </article>
                )
              })}
            </div>
          </section>

          <div className="review-learning-grid">
            <section aria-label="周期确认理解">
              <h2>确认理解</h2>
              {summary.understandings.length ? (
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
            <section aria-label="周期开放困惑">
              <h2>开放困惑</h2>
              {summary.openConfusions.length ? (
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
                <p className="review-no-explicit-fact">本周期没有开放困惑。</p>
              )}
            </section>
          </div>

          {!summary.actionRecords.length && !summary.routineRecords.length ? (
            <div className="review-empty">
              <h2>本周期还没有已记录事实</h2>
              <p>空白只表示没有 ActionRecord 或 RoutineRecord；unknown 不会被转换成未做或失败。</p>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
