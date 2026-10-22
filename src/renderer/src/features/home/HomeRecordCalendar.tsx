import { useState, type CSSProperties } from 'react'
import {
  buildCalendarDays,
  calendarLevel,
  calendarMonths,
  readCalendarPreferences,
  saveCalendarPreferences,
  visibleCalendarSelection,
  type CalendarPreferences,
  type HomeCalendarRecord
} from './calendar'
import './calendar.css'

export type { HomeCalendarRecord } from './calendar'
export interface HomeRecordCalendarProps {
  records: readonly HomeCalendarRecord[]
  today: string
  onOpenRecord: (record: Pick<HomeCalendarRecord, 'id' | 'type'>) => void
}

export function HomeRecordCalendar({ records, today, onOpenRecord }: HomeRecordCalendarProps) {
  const [preferences, setPreferences] = useState(() => readCalendarPreferences())
  const [recordPage, setRecordPage] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)
  const days = buildCalendarDays(today, preferences.weeks, records)
  const visibleSelected = visibleCalendarSelection(selected, days)
  // Clear stale selection on range/date changes rather than resurrecting it later.
  if (visibleSelected !== selected) setSelected(visibleSelected)
  const selectedRecords = records.filter((record) => record.occurredOn === visibleSelected)
  const pageCount = Math.max(1, Math.ceil(selectedRecords.length / 10))
  const visiblePage = Math.min(recordPage, pageCount)
  function updatePreferences(next: CalendarPreferences) {
    setPreferences(next)
    saveCalendarPreferences(next)
  }
  return (
    <section className="home-record-calendar" aria-label="留下的痕迹">
      <header className="hrc-heading">
        <h2>留下的痕迹</h2>
        <div className="hrc-toggle" role="group" aria-label="日历时间范围">
          {([12, 26] as const).map((weeks) => (
            <button
              key={weeks}
              type="button"
              aria-pressed={preferences.weeks === weeks}
              onClick={() => updatePreferences({ ...preferences, weeks })}
            >
              {weeks === 12 ? '12 周' : '半年'}
            </button>
          ))}
        </div>
      </header>
      <div className={`hrc-calendar ${preferences.weeks === 26 ? 'hrc-half-year' : ''}`}>
        <div className="hrc-top">
          <span className="hrc-title">
            {days[0].date.replaceAll('-', '.')} — {days.at(-1)!.date.slice(5).replace('-', '.')} ·{' '}
            {preferences.weeks} 周
          </span>
          <div className="hrc-toggle" role="group" aria-label="记录日历显示方式">
            {([false, true] as const).map((intensity) => (
              <button
                key={String(intensity)}
                type="button"
                aria-pressed={preferences.intensity === intensity}
                onClick={() => updatePreferences({ ...preferences, intensity })}
              >
                {intensity ? '按条数' : '有记录'}
              </button>
            ))}
          </div>
        </div>
        <div
          className="hrc-stage"
          tabIndex={0}
          role="region"
          aria-label={`${preferences.weeks} 周记录日历，周一至周日`}
        >
          <div className="hrc-plot" style={{ '--hrc-weeks': preferences.weeks } as CSSProperties}>
            <div className="hrc-months" aria-hidden="true">
              {calendarMonths(days).map((month) => (
                <span
                  key={month.month}
                  style={{ gridColumn: `${month.start + 2} / span ${month.span}` }}
                >
                  {Number(month.month.slice(5))} 月
                </span>
              ))}
            </div>
            <div className="hrc-grid">
              {['一', '', '三', '', '五', '', '日'].map((label, index) => (
                <span key={`label-${index}`} className="hrc-day-label" aria-hidden="true">
                  {label}
                </span>
              ))}
              {days.map((day) => (
                <button
                  key={day.date}
                  type="button"
                  disabled={day.future}
                  className={`hrc-cell ${day.future ? 'hrc-future' : ''}`}
                  data-level={calendarLevel(day.count, preferences.intensity)}
                  aria-pressed={day.date === visibleSelected}
                  aria-label={`${day.date} · ${day.future ? '未来日期' : `${day.count} 条记录`}`}
                  title={`${day.date} · ${day.future ? '未来日期' : `${day.count} 条记录`}`}
                  onClick={() => {
                    setSelected(day.date)
                    setRecordPage(1)
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="hrc-legend">
          <span>
            {preferences.intensity ? '浅 → 深：1、2、3、4 条及以上' : '亮起的一天，留过一点记录'}
          </span>
          <span className="hrc-swatches" aria-hidden="true">
            {(preferences.intensity ? [0, 1, 2, 3, 4] : [0, 2]).map((level) => (
              <i key={level} data-level={level} />
            ))}
          </span>
        </div>
        <p className="hrc-caption">
          没有记录，不代表没有行动。<span>点击方格回看 · 数据截至 {today}</span>
        </p>
      </div>
      {visibleSelected && (
        <section className="hrc-details" aria-label={`${visibleSelected} 的记录`}>
          <header>
            <h3>{visibleSelected} 的记录</h3>
            <button type="button" onClick={() => setSelected(null)}>
              收起
            </button>
          </header>
          {selectedRecords.length ? (
            <>
              <p>这一天留下了 {selectedRecords.length} 条记录。</p>
              <ul>
                {selectedRecords.slice((visiblePage - 1) * 10, visiblePage * 10).map((record) => (
                  <li key={`${record.type}-${record.id}`}>
                    <button type="button" onClick={() => onOpenRecord(record)}>
                      <span>{record.type === 'action-record' ? '行动记录' : '例行记录'} · </span>
                      {record.title}
                    </button>
                  </li>
                ))}
              </ul>
              {pageCount > 1 ? (
                <nav className="hrc-pagination" aria-label="当日记录分页">
                  <button
                    type="button"
                    disabled={visiblePage === 1}
                    onClick={() => setRecordPage(visiblePage - 1)}
                  >
                    上一页
                  </button>
                  <span>
                    第 {visiblePage} / {pageCount} 页
                  </span>
                  <button
                    type="button"
                    disabled={visiblePage === pageCount}
                    onClick={() => setRecordPage(visiblePage + 1)}
                  >
                    下一页
                  </button>
                </nav>
              ) : null}
              <p>条数不是成绩，也不代表完成目标。</p>
            </>
          ) : (
            <p>这一天暂时没有留下记录。没有记录，不代表没有行动。</p>
          )}
        </section>
      )}
    </section>
  )
}
