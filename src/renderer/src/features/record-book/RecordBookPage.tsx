import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import wordmark from '../../../../../resources/brand/MyTracer-wordmark-green.svg'
import type { RecordBookErrorCode, RecordBookSnapshot } from '../../../../contracts/record-book'
import {
  bookMonthLabel,
  recordBookCss,
  renderBookCoverage,
  renderBookMonth
} from '../../../../presentation/record-book'
import { useUiLifetime, useUiSession, type DataRecordSelection } from '../../app/ui-session'

const errors: Record<RecordBookErrorCode, string> = {
  validation: '请求无效，请重试。',
  'read-failed': '记录暂时无法读取，请重试。',
  busy: '另一次记录册导出仍在进行，请完成或取消后重试。',
  'write-failed': '记录册未能安全保存，请重试。',
  'destination-changed': '保存位置发生变化，未交付文件，请重新选择。',
  'replace-not-supported': '无法安全替换已有文件，请选择新文件名。',
  'export-validation-failed': '文件回读校验未通过，未交付文件。'
}
export function RecordBookPage({
  onBack,
  onOriginal
}: {
  onBack: () => void
  onOriginal: (selection: DataRecordSelection) => void
}): ReactNode {
  const session = useUiSession()
  const alive = useUiLifetime()
  const root = useRef<HTMLElement>(null)
  const [snapshot, setSnapshot] = useState<RecordBookSnapshot | null>(null)
  const [monthKey, setMonthKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [exporting, setExporting] = useState(false)
  const exportLock = useRef(false)
  const [exportMessage, setExportMessage] = useState('')
  useEffect(() => {
    let current = true
    void window.myTracer.recordBook
      .read()
      .then((result) => {
        if (!current) return
        if (!result.ok) {
          setError(errors[result.error.code])
          return
        }
        const months = result.value.book.months
        const key = months.some((month) => month.key === session.bookReading.month)
          ? session.bookReading.month
          : (months[months.length - 1]?.key ?? null)
        setSnapshot(result.value)
        setMonthKey(key)
        session.setBookMonth(key)
      })
      .catch(() => {
        if (current) setError(errors['read-failed'])
      })
    return () => {
      current = false
    }
  }, [attempt, session])
  useEffect(() => {
    if (snapshot) root.current?.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true })
  }, [snapshot])
  useLayoutEffect(() => {
    if (!monthKey) return
    const main = root.current?.closest('main')
    if (!main) return
    main.scrollTop = session.bookReading.positions.get(monthKey) ?? 0
    const remember = () => session.setBookPosition(monthKey, main.scrollTop)
    main.addEventListener('scroll', remember)
    return () => {
      main.removeEventListener('scroll', remember)
    }
  }, [monthKey, session])
  const months = [...(snapshot?.book.months ?? [])].reverse()
  const month = months.find((item) => item.key === monthKey)
  const index = months.findIndex((item) => item.key === monthKey)
  const years = [...new Set(months.map((item) => item.key.slice(0, 4)))]
  const changeMonth = (key: string) => {
    if (!months.some((item) => item.key === key)) return
    session.setBookMonth(key)
    setMonthKey(key)
  }
  const save = async () => {
    if (exportLock.current) return
    exportLock.current = true
    setExporting(true)
    setExportMessage('')
    try {
      const result = await window.myTracer.recordBook.export()
      if (!alive.current) return
      setExportMessage(
        !result.ok
          ? errors[result.error.code]
          : result.value.kind === 'cancelled'
            ? '已取消保存。'
            : `已保存全书：${result.value.fileName} · 固定导出时间 ${result.value.exportedAt}（UTC）`
      )
    } catch {
      if (alive.current) setExportMessage(errors['write-failed'])
    } finally {
      exportLock.current = false
      if (alive.current) setExporting(false)
    }
  }
  return (
    <section ref={root} className="record-book" aria-label="记录册">
      <style>{recordBookCss}</style>
      <button className="rb-return" type="button" onClick={onBack}>
        返回来源页面
      </button>
      {error ? (
        <div role="alert" className="rb-message">
          {error}
          <button
            type="button"
            onClick={() => {
              setError(null)
              setAttempt((value) => value + 1)
            }}
          >
            重新读取
          </button>
        </div>
      ) : !snapshot ? (
        <p role="status">正在读取记录…</p>
      ) : (
        <>
          <div className="rb-layout">
            <aside className="rb-toc" aria-label="按年份查看月份">
              <p>这一册 / CONTENTS</p>
              {years.map((year) => (
                <div key={year}>
                  <p>{year}年</p>
                  {months
                    .filter((item) => item.key.startsWith(year))
                    .map((item) => (
                      <button
                        type="button"
                        key={item.key}
                        aria-current={item.key === monthKey ? 'page' : undefined}
                        onClick={() => changeMonth(item.key)}
                      >
                        {Number(item.key.slice(5))}月
                      </button>
                    ))}
                </div>
              ))}
              <p>
                仅列出有记录的月份
                <br />近 → 远
              </p>
            </aside>
            <article className="rb-paper">
              <header className="rb-cover">
                <img className="rb-brand" src={wordmark} alt="MyTracer" />
                <h1 tabIndex={-1}>记录册</h1>
                <p className="rb-intro">
                  按年月翻阅，保留保存的原话。
                  <br />
                  当前名称、关联和状态与记录时的文字分别呈现。
                </p>
                <p className="rb-edition">
                  册内阅读 · 读取时间 {snapshot.readAt}（UTC）
                  <br />
                  进入与返回时读取已保存资料；阅读途中不自动更新。
                </p>
              </header>
              <nav className="rb-toolbar" aria-label="月份翻页">
                <label>
                  翻到
                  <select
                    aria-label="跳转到月份"
                    value={monthKey ?? ''}
                    disabled={!month}
                    onChange={(event) => changeMonth(event.target.value)}
                  >
                    {years.map((year) => (
                      <optgroup key={year} label={`${year}年`}>
                        {months
                          .filter((item) => item.key.startsWith(year))
                          .map((item) => (
                            <option key={item.key} value={item.key}>
                              {bookMonthLabel(item.key)}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <button type="button" disabled={exporting} onClick={() => void save()}>
                  {exporting ? '正在保存…' : '保存全书 HTML ↓'}
                </button>
                <div className="rb-pager">
                  <button
                    type="button"
                    disabled={index <= 0}
                    onClick={() => changeMonth(months[index - 1].key)}
                  >
                    ← 较新一月
                  </button>
                  <span aria-live="polite">{month ? bookMonthLabel(month.key) : '暂无记录'}</span>
                  <button
                    type="button"
                    disabled={index < 0 || index >= months.length - 1}
                    onClick={() => changeMonth(months[index + 1].key)}
                  >
                    较早一月 →
                  </button>
                </div>
              </nav>
              <p className="rb-export-status" role="status">
                {exportMessage}
              </p>
              {month ? (
                <div
                  onClick={(event) => {
                    const target = event.target as HTMLElement
                    const source = target.closest<HTMLButtonElement>('button[data-source-id]')
                    if (source) {
                      const entry = month.days
                        .flatMap((day) => day.entries)
                        .find(
                          (entry) =>
                            entry.id === source.dataset.sourceId &&
                            entry.kind === source.dataset.sourceKind
                        )
                      if (entry && entry.kind !== 'review')
                        onOriginal({ type: entry.kind, id: entry.id })
                    }
                    const link = target.closest<HTMLAnchorElement>('a[href^="#book-day-"]')
                    if (link) {
                      event.preventDefault()
                      const day = document.getElementById(link.hash.slice(1))
                      day?.scrollIntoView({ block: 'start' })
                      day?.focus({ preventScroll: true })
                    }
                  }}
                  dangerouslySetInnerHTML={{ __html: renderBookMonth(month, true) }}
                />
              ) : (
                <p className="rb-message">还没有可按日期阅读的记录。未收录的对象请见范围说明。</p>
              )}
              <footer className="rb-end">
                这一月的记录到这里。
                <br />
                保存全书包含所有有记录的月份，使用保存时的当前资料，不限于本月。
              </footer>
            </article>
          </div>
          <div dangerouslySetInnerHTML={{ __html: renderBookCoverage(snapshot.book) }} />
        </>
      )}
    </section>
  )
}
