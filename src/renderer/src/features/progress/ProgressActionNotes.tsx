import { type ReactNode, useEffect, useState } from 'react'
import type { ProgressRecordFactDto } from '../../../../contracts/progress'

type TextRead =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ready'; readonly note: string | null; readonly nextStep: string | null }

// Mounted only while this row is expanded. Closing or replacing the row releases its text.
function RecordedText({ record }: { readonly record: ProgressRecordFactDto }): ReactNode {
  const [read, setRead] = useState<TextRead>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    void window.myTracer.records.getDetail({ recordId: record.recordId }).then(
      (result) => {
        if (!active) return
        if (!result.ok) {
          setRead({
            status: 'error',
            message:
              result.error.code === 'not-found'
                ? '这条记录已不存在，请重新查看记录列表。'
                : '原文暂时无法读取，不表示没有补充文字。'
          })
          return
        }
        const detail = result.value
        if (
          detail.id !== record.recordId ||
          detail.actionId !== record.actionId ||
          detail.occurredOn !== record.occurredOn ||
          detail.durationMinutes !== record.durationMinutes ||
          detail.outcome !== record.outcome
        ) {
          setRead({ status: 'error', message: '记录内容已变化或不匹配，请重新查看记录列表。' })
          return
        }
        setRead({ status: 'ready', note: detail.note, nextStep: detail.nextStep })
      },
      () => {
        if (active) setRead({ status: 'error', message: '原文暂时无法读取，不表示没有补充文字。' })
      }
    )
    return () => {
      active = false
    }
  }, [
    record.recordId,
    record.actionId,
    record.occurredOn,
    record.durationMinutes,
    record.outcome,
    attempt
  ])

  return (
    <div aria-label="行动补充原文">
      {read.status === 'loading' ? <p role="status">正在读取原文…</p> : null}
      {read.status === 'error' ? <p role="status">{read.message}</p> : null}
      {read.status === 'error' || (read.status === 'loading' && attempt > 0) ? (
        <button
          type="button"
          className="quiet-button"
          aria-disabled={read.status === 'loading'}
          onClick={() => {
            if (read.status !== 'error') return
            setRead({ status: 'loading' })
            setAttempt((value) => value + 1)
          }}
        >
          重新读取原文
        </button>
      ) : null}
      {read.status === 'ready' ? (
        <>
          {read.note ? (
            <div className="progress-fact-group">
              <h3>备注</h3>
              <p>{read.note}</p>
            </div>
          ) : null}
          {read.nextStep ? (
            <div className="progress-fact-group">
              <h3>记录中的下一步</h3>
              <p>{read.nextStep}</p>
              <small>这是当时写下的内容，不代表当前计划。</small>
            </div>
          ) : null}
          {!read.note && !read.nextStep ? <p>当前没有补充文字；内容可能已被清空。</p> : null}
        </>
      ) : null}
    </div>
  )
}

export function ProgressActionNotes({
  record
}: {
  readonly record: ProgressRecordFactDto
}): ReactNode {
  const [expanded, setExpanded] = useState(false)
  if (!record.hasRecordedText && !record.understandings.length && !record.openConfusions.length)
    return null
  return (
    <details
      className="progress-record-notes"
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>展开理解与记录</summary>
      {record.understandings.length ? (
        <div className="progress-fact-group">
          <h3>已确认的理解</h3>
          {record.understandings.map((fact) => (
            <p key={fact.id}>{fact.text}</p>
          ))}
        </div>
      ) : null}
      {record.openConfusions.length ? (
        <div className="progress-fact-group">
          <h3>尚未解决的困惑</h3>
          {record.openConfusions.map((fact) => (
            <p key={fact.id}>{fact.text}</p>
          ))}
        </div>
      ) : null}
      {expanded && record.hasRecordedText ? <RecordedText record={record} /> : null}
    </details>
  )
}
