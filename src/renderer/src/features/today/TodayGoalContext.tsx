import { type ReactNode, useEffect, useState } from 'react'
import type { RecoveryContextDto } from '../../../../contracts/recovery'
import { factOutcomeText } from '../../app/ui-text'
import { useUiSession } from '../../app/ui-session'
import './today-goal-context.css'

interface ContextRead {
  readonly key: string
  readonly context: RecoveryContextDto | null
}

export function TodayGoalContext(props: {
  readonly actionId: string
  readonly goalId: string
  readonly goalName: string
  readonly refreshVersion: number
}): ReactNode {
  const session = useUiSession()
  const readingKey = JSON.stringify([props.actionId, props.goalId])
  const [expanded, setExpanded] = useState(() => session.expandedTodayGoalContexts.has(readingKey))
  const [readVersion, setReadVersion] = useState(0)
  const [read, setRead] = useState<ContextRead | null>(null)
  const requestKey = `${props.goalId}:${props.refreshVersion}:${readVersion}`
  const currentRead = read?.key === requestKey ? read : null
  const context = currentRead?.context

  useEffect(() => {
    if (!expanded) return
    let active = true
    void window.myTracer.recovery.getContext({ goalId: props.goalId }).then(
      (result) => {
        if (!active) return
        const context = result.ok && result.value.goal.id === props.goalId ? result.value : null
        // Remember only verified history, never a deleted/unavailable or empty goal.
        if (
          context &&
          (context.latestRealRecord ||
            context.confirmedUnderstandings.length ||
            context.openConfusions.length)
        )
          session.expandedTodayGoalContexts.add(readingKey)
        else session.expandedTodayGoalContexts.delete(readingKey)
        setRead({ key: requestKey, context })
      },
      () => {
        if (active) {
          session.expandedTodayGoalContexts.delete(readingKey)
          setRead({ key: requestKey, context: null })
        }
      }
    )
    return () => {
      active = false
    }
  }, [expanded, props.goalId, requestKey, readingKey, session])

  const latest = context?.latestRealRecord
  return (
    <details
      className="today-goal-context"
      open={expanded}
      onToggle={(event) => {
        const open = event.currentTarget.open
        if (open === expanded) return
        setExpanded(open)
        if (!open) session.expandedTodayGoalContexts.delete(readingKey)
        if (open) setReadVersion((version) => version + 1)
      }}
    >
      <summary>接着上次继续 · 目标历史</summary>
      {expanded ? (
        <section className="today-goal-context-body" aria-label="目标历史上下文">
          <div className="today-goal-context-heading">
            <p>来自目标「{props.goalName}」的已有记录，与本次行动记录分开。</p>
            <button
              type="button"
              className="quiet-button"
              aria-disabled={!currentRead}
              onClick={() => {
                if (currentRead) setReadVersion((version) => version + 1)
              }}
            >
              重新读取目标上下文
            </button>
          </div>
          {!currentRead ? <p role="status">正在读取目标历史…</p> : null}
          {currentRead && !context ? (
            <p role="alert">目标历史暂时无法读取。可以重新读取，也可以直接继续当前行动。</p>
          ) : null}
          {context ? (
            <>
              <div className="today-goal-last-record">
                <h3>上次留下的记录</h3>
                {latest ? (
                  <>
                    <p className="today-goal-context-date">
                      {latest.occurredOn} · {factOutcomeText[latest.outcome]}
                    </p>
                    <button
                      type="button"
                      className="quiet-button today-goal-record-link"
                      onClick={() =>
                        session.openDataRecord(
                          {
                            type: latest.kind === 'action' ? 'action-record' : 'routine-record',
                            id: latest.recordId
                          },
                          'today'
                        )
                      }
                    >
                      <strong>{latest.title}</strong>
                      <span>查看上次完整记录 →</span>
                    </button>
                  </>
                ) : (
                  <p>这个目标还没有实际行动记录。可以从当前这一小步开始，不必补齐过去。</p>
                )}
              </div>
              {context.confirmedUnderstandings.length || context.openConfusions.length ? (
                <div className="today-goal-context-facts">
                  <p>各显示最近两条摘要，完整内容可在恢复与整理中查看。</p>
                  {context.confirmedUnderstandings.length ? (
                    <section aria-label="目标已有理解">
                      <h3>最近留下的理解</h3>
                      <ul>
                        {context.confirmedUnderstandings
                          .slice(-2)
                          .reverse()
                          .map((fact) => (
                            <li key={fact.id}>{fact.text}</li>
                          ))}
                      </ul>
                      {context.confirmedUnderstandings.length > 2 ? (
                        <p>
                          另有 {context.confirmedUnderstandings.length - 2}{' '}
                          条理解，可在恢复与整理中查看。
                        </p>
                      ) : null}
                    </section>
                  ) : null}
                  {context.openConfusions.length ? (
                    <section aria-label="目标未解决的困惑">
                      <h3>最近留下的未解决困惑</h3>
                      <ul>
                        {context.openConfusions
                          .slice(-2)
                          .reverse()
                          .map((fact) => (
                            <li key={fact.id}>{fact.text}</li>
                          ))}
                      </ul>
                      {context.openConfusions.length > 2 ? (
                        <p>
                          另有 {context.openConfusions.length - 2} 条困惑，可在恢复与整理中查看。
                        </p>
                      ) : null}
                    </section>
                  ) : null}
                </div>
              ) : latest ? (
                <p>还没有已确认的理解或未解决的困惑。</p>
              ) : null}
              <button
                type="button"
                className="quiet-button"
                onClick={() => {
                  session.setRecoveryGoal(props.goalId)
                  session.openGoal(props.goalId, 'today')
                }}
              >
                查看目标的恢复与整理 →
              </button>
            </>
          ) : null}
        </section>
      ) : null}
    </details>
  )
}
