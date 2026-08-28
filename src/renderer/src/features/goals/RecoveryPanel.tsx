import { type ReactNode, useEffect, useState } from 'react'
import type { RecoveryContextDto } from '../../../../contracts/recovery'

export function RecoveryPanel(props: {
  readonly goalId: string
  readonly onClose: () => void
}): ReactNode {
  const [context, setContext] = useState<RecoveryContextDto | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    window.myTracer.recovery.getContext({ goalId: props.goalId }).then((result) => {
      if (!active) return
      if (result.ok) setContext(result.value)
      else
        setError(
          result.error.code === 'not-found' ? '这个目标已不存在。' : '暂时无法读取 Recovery 事实。'
        )
    })
    return () => {
      active = false
    }
  }, [props.goalId])

  return (
    <article className="goal-card recovery-panel" aria-label="Recovery 页面">
      <div className="detail-title-row">
        <div>
          <p className="eyebrow">只读 Recovery</p>
          <h2>{context?.goal.name ?? '正在读取事实…'}</h2>
        </div>
        <button className="secondary-button" type="button" onClick={props.onClose}>
          返回目标
        </button>
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {context ? (
        <>
          <div className="recovery-fact">
            <span>距上次真实行动</span>
            <strong>
              {context.daysSinceLastRealAction === null
                ? '尚无真实行动'
                : `${context.daysSinceLastRealAction} 天`}
            </strong>
            <small>
              截至 {context.asOfLocalDate}
              {context.lastRealActionOn ? ` · 上次行动 ${context.lastRealActionOn}` : ''}
            </small>
          </div>
          <section className="related-section">
            <h3>此前真实行动</h3>
            {context.latestRealRecord ? (
              <div className="related-row">
                <span>
                  {context.latestRealRecord.title} ·{' '}
                  {context.latestRealRecord.durationMinutes === null
                    ? '未记录分钟'
                    : `${context.latestRealRecord.durationMinutes} 分钟`}
                </span>
                <small>
                  {context.latestRealRecord.occurredOn} · {context.latestRealRecord.outcome}
                </small>
              </div>
            ) : (
              <p className="empty-copy">还没有真实行动记录。</p>
            )}
          </section>
          <section className="related-section">
            <h3>当前下一步</h3>
            <p>{context.currentNextAction?.title ?? '暂未设置'}</p>
            {context.pendingActions
              .filter((item) => item.id !== context.currentNextAction?.id)
              .map((item) => (
                <div className="related-row" key={item.id}>
                  <span>{item.title}</span>
                  <small>待行动</small>
                </div>
              ))}
          </section>
          <section className="related-section">
            <h3>确认的理解</h3>
            {context.confirmedUnderstandings.length ? (
              context.confirmedUnderstandings.map((item) => (
                <div className="related-row" key={item.id}>
                  <span>{item.text}</span>
                </div>
              ))
            ) : (
              <p className="empty-copy">暂无已确认理解。</p>
            )}
          </section>
          <section className="related-section">
            <h3>开放困惑</h3>
            {context.openConfusions.length ? (
              context.openConfusions.map((item) => (
                <div className="related-row" key={item.id}>
                  <span>{item.text}</span>
                </div>
              ))
            ) : (
              <p className="empty-copy">暂无开放困惑。</p>
            )}
          </section>
        </>
      ) : null}
    </article>
  )
}
