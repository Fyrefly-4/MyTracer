import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Booklet, BookletRead, BookletResult } from '../../../../contracts/booklets'
import type { RecordBookEntry } from '../../../../contracts/record-book'
import { useUiSession, useUnsavedContent } from '../../app/ui-session'
import { DataControlPage } from '../data-control/DataControlPage'
import { ThoughtDay } from '../thoughts/ThoughtDay'
import './booklets.css'

function unwrap<T>(result: BookletResult<T>): T {
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}
const unavailable = '暂时无法读取或保存，请重试。'
export function BookletsPage({ onBack }: { onBack: () => void }) {
  const session = useUiSession()
  const alive = useRef(false)
  const [books, setBooks] = useState<readonly Booklet[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<BookletRead | null>(null)
  const [editor, setEditor] = useState<Booklet | null>(null)
  const [candidates, setCandidates] = useState<readonly RecordBookEntry[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState('')
  const [original, setOriginal] = useState<RecordBookEntry | null>(null)
  const restoreSource = useRef<(() => void) | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const sequence = useRef(0)
  const [confirm, setConfirm] = useState<{ message: string; action: () => void } | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const readingPosition = useRef(0)
  const restoreReading = useRef(false)
  const operationFocus = useRef<{
    id: string | null
    action: string
    offset: number
    scrollTop: number
  } | null>(null)
  useUnsavedContent('booklet-editor', Boolean(editor) || busy)
  useEffect(() => {
    if (!confirm) return
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const element = dialog.current!
    element.showModal()
    return () => {
      element.close()
      if (trigger?.isConnected) trigger.focus()
    }
  }, [confirm])
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      restoreSource.current?.()
    }
  }, [])
  const read = useCallback(async (id: string | null, preserveLayout = false) => {
    const token = ++sequence.current
    setError('')
    if (!preserveLayout) {
      setSnapshot(null)
      setCandidates(null)
    }
    if (!id) setBooks(null)
    try {
      const result = id ? unwrap(await window.myTracer.booklets.read({ id })) : null
      const list = id ? null : unwrap(await window.myTracer.booklets.list())
      if (!alive.current || token !== sequence.current) return
      if (result) setSnapshot(result)
      else setBooks(list)
    } catch (failure) {
      if (alive.current && token === sequence.current) {
        operationFocus.current = null
        setSnapshot(null)
        setError(failure instanceof Error ? failure.message : unavailable)
      }
    }
  }, [])
  useEffect(() => {
    let current = true
    void Promise.resolve().then(() => {
      if (current) void read(selected)
    })
    return () => {
      current = false
    }
  }, [read, selected])
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
  }, [selected, original])
  useLayoutEffect(() => {
    const main = heading.current?.closest('main')
    if (!main) return
    if (original || adding) main.scrollTop = 0
    else if (snapshot && restoreReading.current) {
      main.scrollTop = readingPosition.current
      restoreReading.current = false
    }
  }, [original, adding, snapshot])
  useLayoutEffect(() => {
    if (busy || !snapshot || !operationFocus.current) return
    const pending = operationFocus.current
    operationFocus.current = null
    const main = heading.current?.closest('main')
    if (!main) return
    main.scrollTop = pending.scrollTop
    const entry = [...main.querySelectorAll<HTMLElement>('[data-booklet-entry]')].find(
      (element) => element.dataset.bookletEntry === pending.id
    )
    const buttons = entry
      ? [...entry.querySelectorAll<HTMLButtonElement>('button[data-booklet-action]')]
      : []
    const target =
      buttons.find(
        (button) => button.dataset.bookletAction === pending.action && !button.disabled
      ) ?? buttons.find((button) => !button.disabled)
    if (target) {
      main.scrollTop +=
        target.getBoundingClientRect().top - main.getBoundingClientRect().top - pending.offset
      target.focus({ preventScroll: true })
    } else heading.current?.focus({ preventScroll: true })
  }, [snapshot, busy])
  function changeEntries(
    booklet: Booklet,
    id: string | null,
    action: string,
    trigger: HTMLButtonElement
  ) {
    if (lock.current) return
    const main = heading.current?.closest('main')
    operationFocus.current = {
      id,
      action,
      offset: trigger.getBoundingClientRect().top - (main?.getBoundingClientRect().top ?? 0),
      scrollTop: main?.scrollTop ?? 0
    }
    void run(() => save(booklet))
  }
  // Returning to the window re-resolves references; never treat the old body as current after a failed read.
  useEffect(() => {
    const refresh = () => {
      if (!lock.current && !editor && !original && !adding) void read(selected)
    }
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [read, selected, editor, original, adding])
  async function run(work: () => Promise<void>) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await work()
    } catch (failure) {
      if (alive.current) {
        operationFocus.current = null
        setSnapshot(null)
        setCandidates(null)
        setError(failure instanceof Error ? failure.message : unavailable)
      }
    } finally {
      lock.current = false
      if (alive.current) setBusy(false)
    }
  }
  async function save(booklet: Booklet) {
    const saved = unwrap(
      await window.myTracer.booklets.save({
        id: booklet.id,
        expectedRevision: booklet.revision,
        title: booklet.title,
        note: booklet.note,
        entries: booklet.entries
      })
    )
    if (!alive.current) return
    setEditor(null)
    setSelected(saved.id)
    await read(saved.id, saved.id === selected)
    setNotice('已保存。')
  }
  async function loadCandidates() {
    if (!adding) readingPosition.current = heading.current?.closest('main')?.scrollTop ?? 0
    setAdding(true)
    setCandidates(null)
    const rows = unwrap(await window.myTracer.booklets.sources())
    if (alive.current) setCandidates(rows)
  }
  function goBack() {
    if (busy) return
    if (editor || (original && session.hasActiveUnsavedContent())) {
      setConfirm({ message: '离开会丢弃此处未保存的输入。', action: back })
    } else back()
  }
  function back() {
    setEditor(null)
    setError('')
    setNotice('')
    if (original) {
      restoreReading.current = true
      restoreSource.current?.()
      restoreSource.current = null
      setOriginal(null)
      void read(selected)
    } else if (adding) {
      restoreReading.current = true
      setAdding(false)
      setCandidates(null)
      void read(selected)
    } else if (selected) {
      setSelected(null)
      setSnapshot(null)
    } else onBack()
  }
  async function openOriginal(index: number) {
    if (!selected) return
    readingPosition.current = heading.current?.closest('main')?.scrollTop ?? 0
    // Validate the reference again, including its deleted state, before navigating.
    setSnapshot(null)
    const fresh = unwrap(await window.myTracer.booklets.read({ id: selected }))
    if (!alive.current) return
    setSnapshot(fresh)
    const referenceId = snapshot?.booklet.entries[index]?.id
    const currentIndex = fresh.booklet.entries.findIndex((entry) => entry.id === referenceId)
    const entry = fresh.contents[currentIndex]
    if (!entry) {
      setNotice('来源已删除或已移出小册子。')
      return
    }
    if (entry.kind === 'action-record')
      restoreSource.current = session.visitBookOriginal({ type: 'action-record', id: entry.id })
    setOriginal(entry)
  }
  const booklet = snapshot?.booklet
  const used = new Set(booklet?.entries.map((entry) => `${entry.kind}:${entry.sourceId}`))
  const filtered = candidates?.filter(
    (entry) =>
      !used.has(`${entry.kind}:${entry.id}`) &&
      `${entry.title}\n${entry.date}\n${entry.fields.map((field) => field.text).join('\n')}`
        .toLowerCase()
        .includes(search.toLowerCase())
  )
  return (
    <section className="personal-booklets" aria-label="小册子">
      <button type="button" disabled={busy} onClick={goBack}>
        {original ? '返回小册子' : adding ? '返回阅读' : selected ? '返回小册子列表' : '返回记录册'}
      </button>
      <h1 ref={heading} tabIndex={-1}>
        {original ? '查看来源' : booklet?.title || '小册子'}
      </h1>
      {error && (
        <div role="alert">
          <p>{error}</p>
          {!editor && !original && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(() => (adding ? read(selected).then(loadCandidates) : read(selected)))
              }
            >
              重新读取
            </button>
          )}
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      {original ? (
        original.kind === 'thought' ? (
          <ThoughtDay date={original.date} thoughtId={original.id} />
        ) : (
          <DataControlPage strictOriginal onOpenBook={goBack} />
        )
      ) : editor ? (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void run(() => save(editor))
          }}
        >
          <label>
            标题（可选）
            <input
              maxLength={200}
              value={editor.title}
              disabled={busy}
              onChange={(event) => setEditor({ ...editor, title: event.target.value })}
            />
          </label>
          <label>
            自己的话（可选）
            <textarea
              rows={5}
              maxLength={4000}
              value={editor.note}
              disabled={busy}
              onChange={(event) => setEditor({ ...editor, note: event.target.value })}
            />
          </label>
          <p>不必总结，也不必得出成长结论。离开前请保存；输入不会自动保存。</p>
          <div className="booklet-actions">
            <button disabled={busy} type="submit">
              {busy ? '正在保存…' : '保存小册子'}
            </button>
            <button
              disabled={busy}
              type="button"
              onClick={() => {
                setEditor(null)
                setError('')
                if (selected) void read(selected)
              }}
            >
              取消编辑
            </button>
          </div>
        </form>
      ) : adding ? (
        <div>
          <h2>加入行动记录或独立想法</h2>
          <p>只加入引用；正文跟随来源修正。同一来源在一本册子中只放一次。</p>
          <label>
            查找日期或文字
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <button type="button" disabled={busy} onClick={() => void run(loadCandidates)}>
            刷新可加入内容
          </button>
          {!candidates ? (
            !error && <p role="status">正在读取来源…</p>
          ) : (
            <ul className="booklet-candidates">
              {filtered?.map((entry) => (
                <li key={`${entry.kind}:${entry.id}`}>
                  <div>
                    <strong>
                      {entry.date} · {entry.kind === 'thought' ? '独立想法' : entry.title}
                    </strong>
                    <p>
                      {entry.fields
                        .find((field) => field.label === '正文' || field.label === '简述')
                        ?.text.slice(0, 180)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy || !booklet}
                    onClick={() =>
                      void run(async () => {
                        if (
                          !booklet ||
                          (entry.kind !== 'action-record' && entry.kind !== 'thought')
                        )
                          return
                        await save({
                          ...booklet,
                          entries: [
                            ...booklet.entries,
                            { id: crypto.randomUUID(), kind: entry.kind, sourceId: entry.id }
                          ]
                        })
                        await loadCandidates()
                      })
                    }
                  >
                    加入
                  </button>
                </li>
              ))}
            </ul>
          )}
          {filtered?.length === 0 && <p>没有匹配的可加入内容。已加入的来源不会重复列出。</p>}
        </div>
      ) : !selected ? (
        <>
          <p>挑几段想留下的话，慢慢添进来。册内引用跟随原文，保存 HTML 时定格。</p>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              setEditor({
                id: crypto.randomUUID(),
                title: '',
                note: '',
                revision: 0,
                createdAt: '',
                updatedAt: '',
                entries: []
              })
            }
          >
            创建小册子
          </button>
          {!books ? (
            !error && <p role="status">正在读取小册子…</p>
          ) : books.length === 0 ? (
            <p>还没有小册子。</p>
          ) : (
            <ul className="booklet-list">
              {books.map((book) => (
                <li key={book.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(book.id)
                      setNotice('')
                    }}
                  >
                    {book.title || '未题名的小册子'} · {book.entries.length} 条
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : !snapshot ? (
        !error && <p role="status">正在读取当前原文…</p>
      ) : (
        <>
          <p className="booklet-note">{booklet!.note}</p>
          <p>引用当前保留的原文；进入、返回、重新读取时更新。读取时间 {snapshot.readAt}（UTC）</p>
          <div className="booklet-actions">
            <button type="button" disabled={busy} onClick={() => void run(loadCandidates)}>
              加入内容
            </button>
            <button type="button" disabled={busy} onClick={() => setEditor(booklet!)}>
              修改标题和自己的话
            </button>
            <button type="button" disabled={busy} onClick={() => void run(() => read(selected))}>
              重新读取原文
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const result = unwrap(await window.myTracer.booklets.export({ id: selected }))
                  if (alive.current)
                    setNotice(
                      result.kind === 'cancelled'
                        ? '已取消导出。'
                        : `已保存 ${result.fileName}，内容已定格。`
                    )
                })
              }
            >
              保存小册子 HTML
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                setConfirm({
                  message: `删除“${booklet!.title || '未题名的小册子'}”及其中 ${booklet!.entries.length} 个引用位置？不会删除任何原记录、想法或已有导出文件。`,
                  action: () =>
                    void run(async () => {
                      unwrap(
                        await window.myTracer.booklets.delete({
                          id: selected,
                          expectedRevision: booklet!.revision,
                          confirmed: true
                        })
                      )
                      if (alive.current) {
                        setSelected(null)
                        setSnapshot(null)
                      }
                    })
                })
              }
            >
              删除小册子
            </button>
          </div>
          {booklet!.entries.length === 0 && <p>还没有内容，可以加入行动记录或独立想法。</p>}
          <ol className="booklet-reading">
            {booklet!.entries.map((reference, index) => {
              const entry = snapshot.contents[index]
              return (
                <li key={reference.id}>
                  <article data-booklet-entry={reference.id} aria-label={`第 ${index + 1} 条`}>
                    <h2>{entry ? entry.title : '来源已删除'}</h2>
                    {entry ? (
                      <>
                        <p>
                          {entry.date} · {entry.kind === 'thought' ? '独立想法' : '行动记录'}
                        </p>
                        <dl>
                          {entry.fields.map((field, n) => (
                            <div key={n}>
                              <dt>{field.label}</dt>
                              <dd>{field.text}</dd>
                            </div>
                          ))}
                        </dl>
                      </>
                    ) : (
                      <p>这里没有保留已删除的正文，可以移除此位置。</p>
                    )}
                    <div className="booklet-actions">
                      {entry && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void run(() => openOriginal(index))}
                        >
                          回到来源
                        </button>
                      )}
                      {([-1, 1] as const).map((direction) => (
                        <button
                          key={direction}
                          data-booklet-action={direction === -1 ? 'up' : 'down'}
                          type="button"
                          disabled={
                            busy ||
                            index + direction < 0 ||
                            index + direction >= booklet!.entries.length
                          }
                          onClick={(event) => {
                            const entries = [...booklet!.entries]
                            ;[entries[index], entries[index + direction]] = [
                              entries[index + direction],
                              entries[index]
                            ]
                            changeEntries(
                              { ...booklet!, entries },
                              reference.id,
                              direction === -1 ? 'up' : 'down',
                              event.currentTarget
                            )
                          }}
                        >
                          {direction === -1 ? '上移' : '下移'}
                        </button>
                      ))}
                      <button
                        type="button"
                        disabled={busy}
                        data-booklet-action="remove"
                        onClick={(event) =>
                          changeEntries(
                            {
                              ...booklet!,
                              entries: booklet!.entries.filter((item) => item.id !== reference.id)
                            },
                            booklet!.entries[index + 1]?.id ??
                              booklet!.entries[index - 1]?.id ??
                              null,
                            'remove',
                            event.currentTarget
                          )
                        }
                      >
                        移出小册子
                      </button>
                    </div>
                  </article>
                </li>
              )
            })}
          </ol>
          <p>移出仅删除册内引用，原文仍在来源处保留。</p>
        </>
      )}
      <dialog
        ref={dialog}
        onCancel={(event) => {
          event.preventDefault()
          setConfirm(null)
        }}
      >
        <h2>确认离开或删除</h2>
        <p>{confirm?.message}</p>
        <div className="booklet-actions">
          <button type="button" autoFocus onClick={() => setConfirm(null)}>
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              const action = confirm?.action
              setConfirm(null)
              action?.()
            }}
          >
            确认
          </button>
        </div>
      </dialog>
    </section>
  )
}
