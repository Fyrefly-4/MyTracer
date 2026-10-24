import { renderRecordNote, recordNoteCss } from './record-note'
import type { RecordBook, RecordBookMonth } from '../contracts/record-book'

/** Every dynamic string, including attributes, must cross this boundary. No user script/HTML. */
export function escapeBookText(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!
  )
}
export function bookMonthLabel(key: string): string {
  return `${key.slice(0, 4)}年${Number(key.slice(5))}月`
}
function renderEntry(
  entry: RecordBookMonth['days'][number]['entries'][number],
  viewOriginal: boolean
): string {
  const e = escapeBookText
  const isCurrent = (label: string) => label.includes('读取时')
  const fields = entry.fields.filter((row) => row.label !== '名称说明')
  const ordered = [
    ...fields.filter((row) => row.label === '简述'),
    ...fields.filter((row) => row.label === '原备注'),
    ...fields.filter(
      (row) => row.label !== '原备注' && row.label !== '简述' && !isCurrent(row.label)
    ),
    ...fields.filter((row) => isCurrent(row.label))
  ]
  const description = entry.fields.find((row) => row.label === '名称说明')?.text
  return `<article class="rb-entry"><h3>${e(entry.title)}</h3><p class="rb-kind">${entry.kind === 'action-record' ? '行动记录' : entry.kind === 'routine-record' ? '例行记录' : '复盘'}${description ? ` · ${e(description)}` : ''}</p><dl>${ordered
    .map((row) => {
      const style =
        row.label === '原备注'
          ? 'rb-original'
          : row.label.startsWith('理解') || row.label.startsWith('困惑') || row.label === '解决说明'
            ? 'rb-understanding'
            : isCurrent(row.label)
              ? 'rb-current'
              : 'rb-fact'
      return `<div class="${style}"><dt>${e(row.label)}</dt><dd class="${row.label === '原备注' ? 'record-note' : ''}">${row.label === '原备注' ? renderRecordNote(row.text) : e(row.text)}</dd></div>`
    })
    .join(
      ''
    )}</dl>${viewOriginal && entry.kind !== 'review' ? `<button type="button" data-source-kind="${e(entry.kind)}" data-source-id="${e(entry.id)}">查看原记录</button>` : ''}</article>`
}

export function renderBookMonth(month: RecordBookMonth, viewOriginal = false): string {
  const e = escapeBookText
  const days = [...month.days].reverse()
  const index = days
    .map(
      (day) =>
        `<a href="#book-day-${e(day.date)}" aria-label="跳到${e(day.date)}">${e(day.date.slice(8))}</a>`
    )
    .join('')
  const content = days
    .map(
      (day) =>
        `<section class="rb-day" id="book-day-${e(day.date)}" tabindex="-1"><time datetime="${e(day.date)}"><b>${e(day.date.slice(8))}</b>${Number(day.date.slice(5, 7))}月</time><div>${day.entries.map((entry) => renderEntry(entry, viewOriginal)).join('')}</div></section>`
    )
    .join('')
  return `<section class="rb-chapter" aria-label="${e(bookMonthLabel(month.key))}"><h2>${e(bookMonthLabel(month.key))}</h2><p class="rb-month-note">按日连续阅读 · ${days.length} 个有记录的日子</p><nav class="rb-days" aria-label="本月日期索引">${index}</nav>${content}</section>`
}
export function renderBookCoverage(book: RecordBook): string {
  return `<details class="rb-coverage"><summary>收录范围与未收录内容</summary><dl>${book.exclusions.map((row) => `<div><dt>${escapeBookText(row.label)}</dt><dd>${escapeBookText(row.text)}</dd></div>`).join('')}</dl></details>`
}

// Shared by the app reading view and the self-contained exported file. All selectors are scoped.
export const recordBookCss =
  recordNoteCss +
  `
.record-book{--rb-paper:#faf8f2;--rb-ground:#eeeee6;--rb-ink:#343b32;--rb-muted:#62695d;--rb-line:#dedfd3;--rb-sage:#657b60;--rb-wash:#edf0e6;color:var(--rb-ink);font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;font-size:15px;line-height:1.85;overflow-wrap:anywhere}
.record-book *{box-sizing:border-box}.record-book [hidden]{display:none!important}.record-book button,.record-book select{font:inherit;color:inherit}.record-book a{color:var(--rb-sage)}.record-book :is(button,a,select,summary){outline-offset:4px}.record-book button{cursor:pointer;border:1px solid #c6cdbb;border-radius:4px;padding:6px 12px;background:transparent;font-size:13px;min-height:36px}.record-book button:hover{background:var(--rb-wash)}.record-book button:disabled{opacity:.5;cursor:default}
.record-book .rb-layout{max-width:1190px;margin:20px auto 45px;display:grid;grid-template-columns:145px minmax(0,1fr);gap:28px}.record-book .rb-toc{align-self:start;position:sticky;top:20px;font-size:14px;max-height:75vh;overflow:auto}.record-book .rb-toc p{font-size:12px;color:var(--rb-muted);letter-spacing:.1em}.record-book .rb-toc button,.record-book .rb-toc a{display:block;border:0;border-left:1px solid var(--rb-line);border-radius:0;width:100%;text-align:left;padding:6px 16px;font-size:14px;text-decoration:none}.record-book .rb-toc [aria-current=page]{border-left:2px solid var(--rb-sage);background:#e5e9de}.record-book .rb-paper{min-width:0;background:var(--rb-paper);border:1px solid #e1e1d6;box-shadow:0 3px 5px #303f2810,0 18px 65px #35432d06}.record-book .rb-cover{padding:40px 50px 28px}.record-book .rb-brand{display:block;width:150px;height:auto}.record-book h1{font-family:"Songti SC",SimSun,serif;font-size:36px;font-weight:600;letter-spacing:.08em;margin:15px 0 12px;line-height:1.5}.record-book .rb-intro{max-width:36em;font-size:15px;color:var(--rb-muted);margin:0}.record-book .rb-edition{font-size:12px;color:var(--rb-muted);border-top:1px solid var(--rb-line);margin-top:25px;padding-top:14px}
.record-book .rb-toolbar{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;padding:12px 32px;background:#f4f3eb;border-block:1px solid var(--rb-line);font-size:13px}.record-book .rb-toolbar select{max-width:100%;background:var(--rb-paper);border:1px solid var(--rb-line);padding:5px;margin-left:8px}.record-book .rb-pager{display:flex;justify-content:space-between;align-items:center;gap:8px;width:100%}.record-book .rb-pager button{border:0}.record-book .rb-chapter{padding:30px 50px 0}.record-book h2{font-family:"Songti SC",SimSun,serif;font-size:28px;font-weight:600;margin:0 0 16px;border-bottom:1px solid var(--rb-line);padding-bottom:12px}.record-book .rb-month-note{font-size:13px;color:var(--rb-muted)}.record-book .rb-days{display:flex;gap:6px;flex-wrap:wrap;padding:0 0 25px}.record-book .rb-days a{min-width:32px;padding:5px;text-align:center;font-size:13px}.record-book .rb-day{display:grid;grid-template-columns:42px minmax(0,1fr);gap:22px;padding-bottom:30px;scroll-margin-top:155px}.record-book .rb-day+.rb-day{border-top:1px solid var(--rb-line);padding-top:30px}.record-book time{font-size:12px;color:var(--rb-muted)}.record-book time b{display:block;font:32px/1.2 Georgia,serif;color:var(--rb-sage);margin:6px 0}.record-book h3{font-size:19px;font-weight:650;line-height:1.6;margin:0 0 6px}.record-book .rb-kind{font-size:12px;color:var(--rb-muted);margin:0}.record-book dl{margin:12px 0 0}.record-book dt{font-size:12px;color:var(--rb-muted);margin-bottom:4px}.record-book dd{margin:0;white-space:pre-wrap;line-height:2}.record-book dl>div{margin:12px 0}.record-book .rb-original{font-size:16px;margin:22px 0}.record-book .rb-fact{border-left:2px solid #9aaa89;padding-left:14px;font-size:14px}.record-book .rb-understanding{padding:12px 16px;background:var(--rb-wash);font-size:14px}.record-book .rb-current{font-size:13px;color:var(--rb-muted)}.record-book .rb-entry+.rb-entry{padding-top:25px;margin-top:25px;border-top:1px dashed var(--rb-line)}.record-book .rb-end{margin:0 50px;padding:20px 0;border-top:1px solid var(--rb-line);text-align:center;font-size:13px;color:var(--rb-muted)}.record-book .rb-coverage{max-width:75ch;margin:25px auto;padding:0 16px;font-size:13px}.record-book summary{cursor:pointer;color:var(--rb-sage)}.record-book .rb-message{padding:25px;white-space:pre-wrap}.record-book .rb-return{margin-bottom:10px}.record-book .rb-export-status{font-size:13px;padding:0 32px}
@media(max-width:950px){.record-book .rb-layout{grid-template-columns:1fr;gap:0}.record-book .rb-toc{display:none}.record-book .rb-cover{padding:30px}.record-book .rb-chapter{padding:28px 30px 0}.record-book .rb-end{margin:0 30px}}
@media(max-width:600px){.record-book .rb-cover,.record-book .rb-chapter{padding-left:20px;padding-right:20px}.record-book .rb-toolbar{padding:10px 16px}.record-book .rb-day{grid-template-columns:30px minmax(0,1fr);gap:12px}.record-book h1{font-size:30px}.record-book h3{font-size:18px}.record-book .rb-pager{flex-wrap:wrap}.record-book .rb-day{scroll-margin-top:180px}}
@media print{.record-book .rb-toc,.record-book .rb-toolbar,.record-book .rb-return,.record-book .rb-days{display:none}.record-book .rb-layout{display:block}.record-book .rb-paper{border:0;box-shadow:none}.record-book [data-book-month][hidden]{display:block!important}.record-book .rb-chapter{break-before:page}.record-book .rb-entry{break-inside:avoid}}
`
