import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { ActionRecordDataDto, DataControlListDto } from '../../../../contracts/data-control'
import { RecordNote } from '../../app/RecordText'
import { recordOutcomeText } from '../../app/ui-text'
import { sameGoalReading } from './same-goal-reading'
import './same-goal-reading.css'

function Original({
  record,
  title,
  data,
  label
}: {
  record: ActionRecordDataDto
  title: string
  data: DataControlListDto
  label: string
}): ReactNode {
  return (
    <article aria-label={label}>
      <h3>{label}</h3>
      <p>来源：行动 · {title}</p>
      <p>
        <time dateTime={record.occurredOn}>{record.occurredOn}</time> ·{' '}
        {recordOutcomeText[record.outcome]} ·{' '}
        {record.durationMinutes === null
          ? '时长未记录'
          : record.durationMinutes === 0
            ? '少于 1 分钟'
            : `${record.durationMinutes} 分钟`}
      </p>
      <h4>简述</h4>
      <p className="record-summary">{record.summary || '未填写'}</p>
      <h4>补充笔记</h4>
      {record.note ? <RecordNote text={record.note} /> : <p>未填写</p>}
      <h4>记录中的下一步</h4>
      <p className="record-summary">{record.nextStep || '未填写'}</p>
      {data.understandings
        .filter((fact) => fact.actionRecordId === record.id)
        .map((fact) => (
          <section key={fact.id}>
            <h4>
              理解 · {fact.revokedAt ? '已撤销' : '保留'} ·{' '}
              {fact.source === 'manual' ? '手动记录' : 'AI 候选经确认'}
            </h4>
            <p className="record-summary">{fact.text}</p>
          </section>
        ))}
      {data.confusions
        .filter((fact) => fact.actionRecordId === record.id)
        .map((fact) => (
          <section key={fact.id}>
            <h4>困惑 · {fact.status === 'resolved' ? '已解决' : '未解决'}</h4>
            <p className="record-summary">{fact.text}</p>
            {fact.resolution ? <p className="record-summary">解决说明：{fact.resolution}</p> : null}
          </section>
        ))}
    </article>
  )
}

function ReadingDialog({
  recordId,
  onClose
}: {
  recordId: string
  onClose: () => void
}): ReactNode {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const requests = useRef({ sequence: 0 })
  const [data, setData] = useState<DataControlListDto | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [selectedId, setSelectedId] = useState('')
  const read = useCallback(async () => {
    const request = ++requests.current.sequence
    setState('loading')
    try {
      const result = await window.myTracer.dataControl.list()
      if (request !== requests.current.sequence) return
      if (!result.ok) {
        setState('error')
        return
      }
      setData(result.value)
      setState('ready')
    } catch {
      if (request === requests.current.sequence) setState('error')
    }
  }, [])
  useEffect(() => {
    const pending = requests.current
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const positions: { element: HTMLElement; top: number; left: number }[] = []
    for (let element = trigger?.parentElement; element; element = element.parentElement) {
      positions.push({ element, top: element.scrollTop, left: element.scrollLeft })
    }
    const dialog = dialogRef.current!
    dialog.showModal()
    return () => {
      pending.sequence++
      dialog.close()
      if (trigger?.isConnected) trigger.focus({ preventScroll: true })
      for (const { element, top, left } of positions)
        element.scrollTo({ top, left, behavior: 'instant' })
    }
  }, [])
  useEffect(() => {
    const pending = requests.current
    let active = true
    void Promise.resolve().then(() => {
      if (active) void read()
    })
    const refresh = (): void => {
      void read()
    }
    window.addEventListener('focus', refresh)
    return () => {
      active = false
      pending.sequence++
      window.removeEventListener('focus', refresh)
    }
  }, [read, selectedId])
  const view = data ? sameGoalReading(data, recordId) : null
  const selected = view?.candidates.find((item) => item.record.id === selectedId)
  return (
    <dialog
      ref={dialogRef}
      className="confirmation-dialog same-goal-reading"
      aria-label="同目标对读"
      onCancel={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onClose()
      }}
    >
      <header>
        <h2>同目标对读</h2>
        <button type="button" autoFocus onClick={onClose}>
          返回原记录
        </button>
      </header>
      <p>
        只读当前保存的原文，不还原修改前或已删除的文字。仅查找同目标、不晚于当前发生日期的行动记录；同日不表示先后。
      </p>
      <button type="button" className="quiet-button" onClick={() => void read()}>
        重新读取对读
      </button>
      {state === 'loading' ? <p role="status">正在读取原文…</p> : null}
      {state === 'error' ? (
        <p role="alert">原文暂时无法读取，这不表示记录不存在。请重新读取。</p>
      ) : null}
      {view && data ? (
        !view.current || !view.action ? (
          state === 'ready' ? (
            <p role="status">当前记录或来源行动已不存在，请返回后重新读取记录列表。</p>
          ) : null
        ) : (
          <>
            <p>
              {state !== 'ready' ? '上次读取的范围 · ' : ''}目标：{view.goal?.title ?? '未关联目标'}
            </p>
            {!view.goal ? (
              state === 'ready' ? (
                <p role="status">当前行动未关联可用目标，无法查找同目标记录。</p>
              ) : null
            ) : (
              <label>
                选择另一条记录
                <select
                  aria-label="选择另一条记录"
                  value={selected ? selectedId : ''}
                  onChange={(event) => {
                    setState('loading')
                    requests.current.sequence++
                    setSelectedId(event.target.value)
                  }}
                >
                  <option value="">请选择记录</option>
                  {view.candidates.map(({ record, action }, index) => (
                    <option key={record.id} value={record.id}>
                      {record.occurredOn}
                      {record.occurredOn === view.current!.occurredOn ? '（同日）' : ''} ·{' '}
                      {action.title} · {record.summary || '未填写简述'} · 候选 {index + 1}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {state === 'ready' && view.goal && !view.candidates.length ? (
              <p role="status">此目标下没有符合日期范围的其他行动记录。</p>
            ) : null}
            {state === 'ready' && selectedId && !selected ? (
              <p role="status">
                所选记录已不在当前对读范围，可能已修改、删除或关联变化。请重新选择。
              </p>
            ) : null}
            {state === 'ready' ? (
              <div className="same-goal-originals">
                <Original
                  key={`current:${view.current.id}`}
                  record={view.current}
                  title={view.action.title}
                  data={data}
                  label="当前记录"
                />
                {selected ? (
                  <Original
                    key={selected.record.id}
                    record={selected.record}
                    title={selected.action.title}
                    data={data}
                    label="对读记录"
                  />
                ) : null}
              </div>
            ) : null}
          </>
        )
      ) : null}
    </dialog>
  )
}

export function SameGoalReading({ recordId }: { recordId: string }): ReactNode {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="quiet-button" onClick={() => setOpen(true)}>
        同目标对读
      </button>
      {open ? <ReadingDialog recordId={recordId} onClose={() => setOpen(false)} /> : null}
    </>
  )
}
