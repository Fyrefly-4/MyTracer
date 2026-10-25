import { useState, useSyncExternalStore } from 'react'
import { useUiSession, useRecordOperation } from './ui-session'
import type { RecordDraft } from '../../../contracts/record-drafts'
export function RecordContinuityNotice(props: {
  kind: RecordDraft['kind']
  context: { recordingContextId: string; continuityIssue?: 'changed' | 'unavailable' }
  onReviewed(): void
  onReconciled?(): void
}) {
  const session = useUiSession()
  const operation = useRecordOperation(props.context.recordingContextId)
  const failed = useSyncExternalStore(session.subscribeUnsaved, session.hasRetentionError)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const review = async () => {
    setBusy(true)
    try {
      await window.myTracer.recordDrafts.review({
        kind: props.kind,
        contextId: props.context.recordingContextId
      })
      props.onReviewed()
      setError(false)
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      {operation.uncertain ? (
        <p role="alert">
          上次保存结果未确认，请先核对，再继续修改或放弃。
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setBusy(true)
              void session
                .reconcileRecord(props.kind, props.context.recordingContextId)
                .then((state) => {
                  if (state === 'open') props.onReconciled?.()
                  setError(false)
                })
                .catch(() => setError(true))
                .finally(() => setBusy(false))
            }}
          >
            核对上次保存
          </button>
        </p>
      ) : null}
      {failed ? (
        <p role="alert">
          最近的输入未能确认保留在本机，关闭可能丢失。请保持窗口打开，或完成正式保存。
          <button type="button" onClick={() => void session.retryRecordRetention()}>
            重试保留输入
          </button>
        </p>
      ) : null}
      {props.context.continuityIssue ? (
        <p role="alert">
          {props.context.continuityIssue === 'unavailable'
            ? '原来的对象已不可用，输入仍保留。请检查对象状态，或放弃这次输入。'
            : '对象、安排或当天记录已变化。请核对当前内容、日期和保存后的操作，再继续。'}
          <button type="button" disabled={busy} onClick={() => void review()}>
            已核对，继续填写
          </button>
        </p>
      ) : null}
      {error ? <p role="alert">对象仍不可用，请稍后重试或放弃这次输入。</p> : null}
    </>
  )
}

// Only inaccessible-object exceptions appear here; normal inputs stay in their own form.
export function UnavailableRecordInputs({ kind }: { kind: 'action' | 'routine' }) {
  const session = useUiSession()
  const [values, setValues] = useState(() => session.unavailableRecordInputs(kind))
  const [error, setError] = useState(false)
  const discard = async (value: RecordDraft) => {
    try {
      const input = { recordingContextId: value.draft.context.recordingContextId }
      const result =
        value.kind === 'routine'
          ? await window.myTracer.routines.cancelRecording(input)
          : await window.myTracer.records.cancel(input)
      if (!result.ok) {
        setError(true)
        return
      }
      if (value.kind === 'routine') session.clearRoutineDraft(value.draft.context.routineId)
      else if (value.kind === 'action') session.clearActionDraft(value.draft.context.actionId)
      setValues(session.unavailableRecordInputs(kind))
    } catch {
      setError(true)
    }
  }
  return (
    <>
      {values.map((value) => (
        <details key={value.draft.context.recordingContextId}>
          <summary>有一笔未完成输入的原对象已不存在</summary>
          <p>输入仍在本机，不会自动创建或替换记录。可选取文字，或放弃这次输入。</p>
          <p>记录日期：{value.draft.context.capturedOn}</p>
          <pre style={{ whiteSpace: 'pre-wrap' }}>
            {[
              value.draft.summary,
              value.draft.note,
              value.kind === 'action'
                ? [value.draft.understanding, value.draft.confusion, value.draft.nextStep]
                    .filter(Boolean)
                    .join('\n')
                : ''
            ]
              .filter(Boolean)
              .join('\n')}
          </pre>
          <button type="button" onClick={() => void discard(value)}>
            放弃这次输入
          </button>
        </details>
      ))}
      {error ? <p role="alert">暂时无法放弃，请重试。</p> : null}
    </>
  )
}
