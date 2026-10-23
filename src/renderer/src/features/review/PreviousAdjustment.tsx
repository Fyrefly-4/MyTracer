import { type ReactNode, useEffect, useId, useState } from 'react'
import type { PreviousReviewAdjustmentDto } from '../../../../contracts/review'
import './previous-adjustment.css'

type ReadState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ready'; readonly value: PreviousReviewAdjustmentDto }

function AdjustmentRead({ contextId }: { readonly contextId: string }): ReactNode {
  const [read, setRead] = useState<ReadState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [full, setFull] = useState(false)
  const textId = useId()
  useEffect(() => {
    let active = true
    void window.myTracer.review.getPreviousAdjustment({ reviewContextId: contextId }).then(
      (result) => {
        if (!active) return
        if (result.ok) setRead({ status: 'ready', value: result.value })
        else
          setRead({
            status: 'error',
            message:
              result.error.code === 'context-invalid' || result.error.code === 'context-stale'
                ? '本次复盘上下文已失效，暂时无法读取上一周；当前填写未被修改。'
                : '上一周的调整暂时无法读取，不表示没有保存。'
          })
      },
      () => {
        if (active)
          setRead({ status: 'error', message: '上一周的调整暂时无法读取，不表示没有保存。' })
      }
    )
    return () => {
      active = false
    }
  }, [contextId, attempt])

  if (read.status !== 'ready')
    return (
      <div>
        <p role="status">{read.status === 'loading' ? '正在读取上一周的调整…' : read.message}</p>
        {read.status === 'error' || attempt > 0 ? (
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
            重试读取上一周
          </button>
        ) : null}
      </div>
    )
  const { periodStartedOn, periodEndedOn, nextAdjustment } = read.value
  const preview = Array.from(nextAdjustment?.split('\n').slice(0, 4).join('\n') ?? '')
    .slice(0, 240)
    .join('')
  const shortened = preview !== nextAdjustment
  return (
    <div>
      <p>
        {periodStartedOn} 至 {periodEndedOn} · 上一自然周
      </p>
      {nextAdjustment === null ? (
        <p>上一自然周没有已保存的复盘。可以直接继续本次填写。</p>
      ) : (
        <>
          <p id={textId} className="previous-adjustment-text">
            {full ? nextAdjustment : preview}
            {shortened && !full ? '…' : ''}
          </p>
          {shortened ? (
            <button
              type="button"
              className="quiet-button"
              aria-expanded={full}
              aria-controls={textId}
              onClick={() => setFull((value) => !value)}
            >
              {full ? '收起完整原文' : '查看完整原文'}
            </button>
          ) : null}
          <p className="previous-adjustment-hint">
            这是当时写下的想法，仅供回看，不表示本周需要完成。
          </p>
        </>
      )}
    </div>
  )
}

export function PreviousAdjustment({ contextId }: { readonly contextId: string }): ReactNode {
  const [expanded, setExpanded] = useState(false)
  return (
    <details
      className="previous-adjustment"
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>回看上一周的调整（可选）</summary>
      {expanded ? <AdjustmentRead key={contextId} contextId={contextId} /> : null}
    </details>
  )
}
