import { useEffect, useRef, useState } from 'react'
import type { ThoughtDto, ThoughtResult } from '../../../../contracts/thoughts'
import { useUnsavedContent } from '../../app/ui-session'
import './thoughts.css'

/** Unsaved input is local to this view. Only an explicit submit writes a thought. */
export function ThoughtDay({ date }: { date: string }) {
  const [rows, setRows] = useState<readonly ThoughtDto[] | null>(null)
  const [reload, setReload] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editor, setEditor] = useState<{ id: string; original: ThoughtDto | null } | null>(null)
  const [text, setText] = useState('')
  const [deleting, setDeleting] = useState<ThoughtDto | null>(null)
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const alive = useRef(true)
  const dialog = useRef<HTMLDialogElement>(null)
  useUnsavedContent(
    `thought-${date}`,
    Boolean(editor && text !== (editor.original?.text ?? '')) || busy
  )
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  useEffect(() => {
    let active = true
    void window.myTracer.thoughts
      .list({ date })
      .then((result) => {
        if (!active) return
        if (result.ok) {
          setRows(result.value)
          setError('')
        } else setError(result.error.message)
      })
      .catch(() => {
        if (active) setError('想法暂时无法读取，请重试。')
      })
    return () => {
      active = false
    }
  }, [date, reload])
  useEffect(() => {
    if (!deleting) return
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const element = dialog.current!
    element.showModal()
    return () => {
      element.close()
      if (trigger?.isConnected) trigger.focus()
    }
  }, [deleting])
  async function run(work: () => Promise<ThoughtResult<unknown>>, success: string) {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await work()
      if (!alive.current) return
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      setEditor(null)
      setText('')
      setDeleting(null)
      setNotice(success)
      setReload((value) => value + 1)
    } catch {
      if (alive.current)
        setError('未能确认保存结果。内容仍在这里；重试同一次保存不会新增重复想法。')
    } finally {
      pending.current = false
      if (alive.current) setBusy(false)
    }
  }
  return (
    <section className="thought-day" aria-label={`${date} 的独立想法`}>
      <header>
        <h3>独立想法</h3>
        <time dateTime={date}>{date}</time>
      </header>
      <p className="empty-copy">一句或一段，保存就成立。不必安排下一步。</p>
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button type="button" disabled={busy} onClick={() => setReload((value) => value + 1)}>
            重新读取想法
          </button>
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      {rows === null ? (
        <p role="status">正在读取想法…</p>
      ) : (
        <>
          {!editor && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setEditor({ id: crypto.randomUUID(), original: null })
                setText('')
                setNotice('')
              }}
            >
              留个想法
            </button>
          )}
          {editor && (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                if (!text.trim() || pending.current) return
                void run(
                  () =>
                    editor.original
                      ? window.myTracer.thoughts.update({
                          id: editor.id,
                          text,
                          expectedText: editor.original.text
                        })
                      : window.myTracer.thoughts.create({ id: editor.id, text, occurredOn: date }),
                  '想法已保存。'
                )
              }}
            >
              <label>
                想法正文
                <textarea
                  autoFocus
                  rows={6}
                  value={text}
                  disabled={busy}
                  onChange={(event) => setText(event.target.value)}
                />
              </label>
              <p className="empty-copy">
                保存到 {date}。取消、切换日期或离开此页会丢弃未保存的内容。
              </p>
              <div className="thought-actions">
                <button type="submit" disabled={busy || !text.trim()}>
                  保存想法
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setEditor(null)
                    setText('')
                    setError('')
                  }}
                >
                  取消
                </button>
              </div>
            </form>
          )}
          {!rows.length && <p className="empty-copy">这一天还没有想法。</p>}
          {rows.map((row) => (
            <article key={row.id} aria-label="已保存的独立想法">
              <p className="thought-text">{row.text}</p>
              <div className="thought-actions">
                <button
                  type="button"
                  disabled={busy || editor !== null}
                  onClick={() => {
                    setEditor({ id: row.id, original: row })
                    setText(row.text)
                    setNotice('')
                  }}
                >
                  修改想法
                </button>
                <button
                  type="button"
                  disabled={busy || editor !== null}
                  onClick={() => setDeleting(row)}
                >
                  删除想法
                </button>
              </div>
            </article>
          ))}
        </>
      )}
      <dialog
        ref={dialog}
        className="confirmation-dialog"
        aria-label="确认删除独立想法"
        onCancel={(event) => {
          event.preventDefault()
          if (!pending.current) setDeleting(null)
        }}
      >
        {deleting && (
          <>
            <h3>删除这条独立想法？</h3>
            <p>将永久删除 1 条独立想法，无法撤销。不会删除行动或其他记录。</p>
            <p className="thought-text">{deleting.text}</p>
            {error && <p role="alert">{error}</p>}
            <div className="thought-actions">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(
                    () =>
                      window.myTracer.thoughts.delete({
                        id: deleting.id,
                        expectedText: deleting.text,
                        confirmed: true
                      }),
                    '想法已删除。'
                  )
                }
              >
                确认删除想法
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setDeleting(null)
                  setError('')
                }}
              >
                取消删除
              </button>
            </div>
          </>
        )}
      </dialog>
    </section>
  )
}

/** Date navigation keeps older thoughts editable without adding a notes workspace. */
export function ThoughtDayPicker({ today }: { today: string }) {
  const [date, setDate] = useState(today)
  return (
    <div>
      <label>
        回看想法日期
        <input
          type="date"
          value={date}
          max={today}
          onChange={(event) => {
            if (event.target.value && event.target.value <= today) setDate(event.target.value)
          }}
        />
      </label>
      <ThoughtDay key={date} date={date} />
    </div>
  )
}
