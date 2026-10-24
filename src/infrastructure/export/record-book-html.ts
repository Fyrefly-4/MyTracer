import { createHash } from 'node:crypto'
import wordmark from '../../../resources/brand/MyTracer-wordmark-green.svg?raw'
import type { RecordBookSnapshot } from '../../contracts/record-book'
import {
  bookMonthLabel,
  escapeBookText,
  recordBookCss,
  renderBookCoverage,
  renderBookMonth
} from '../../presentation/record-book'

// Constant program only: user text lives exclusively in escaped HTML text nodes.
const navigationScript = `(()=>{
const pages=[...document.querySelectorAll('[data-book-month]')],select=document.querySelector('#book-month'),positions=new Map();let active=null;
function show(key,initial=false){const next=pages.find(p=>p.dataset.bookMonth===key);if(!next||key===active)return;if(active)positions.set(active,window.scrollY);active=key;for(const p of pages)p.hidden=p!==next;select.value=key;for(const a of document.querySelectorAll('[data-month-link]')){if(a.dataset.monthLink===key)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}const i=pages.indexOf(next);document.querySelector('#book-newer').disabled=i===0;document.querySelector('#book-older').disabled=i===pages.length-1;document.querySelector('#book-current').textContent=select.selectedOptions[0].textContent;if(!initial)requestAnimationFrame(()=>window.scrollTo(0,positions.get(key)||0));}
select.addEventListener('change',()=>show(select.value));document.querySelectorAll('[data-month-link]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();show(a.dataset.monthLink);}));document.querySelector('#book-newer').addEventListener('click',()=>show(pages[pages.findIndex(p=>p.dataset.bookMonth===active)-1]?.dataset.bookMonth));document.querySelector('#book-older').addEventListener('click',()=>show(pages[pages.findIndex(p=>p.dataset.bookMonth===active)+1]?.dataset.bookMonth));if(pages.length)show(pages[0].dataset.bookMonth,true);
})();`

export function renderRecordBookHtml(snapshot: RecordBookSnapshot): string {
  const e = escapeBookText
  const months = [...snapshot.book.months].reverse()
  const years = [...new Set(months.map((month) => month.key.slice(0, 4)))]
  const scriptHash = createHash('sha256').update(navigationScript).digest('base64')
  const brand = `data:image/svg+xml;base64,${Buffer.from(wordmark).toString('base64')}`
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; script-src 'sha256-${scriptHash}'; base-uri 'none'; form-action 'none'"><title>记录册 · MyTracer</title><style>body{margin:0;padding:24px;background:#eeeee6}${recordBookCss}</style></head><body><main class="record-book"><div class="rb-layout"><aside class="rb-toc" aria-label="按年份查看月份"><p>这一册 / CONTENTS</p>${years
    .map(
      (year) =>
        `<p>${e(year)}年</p>${months
          .filter((month) => month.key.startsWith(year))
          .map(
            (month) =>
              `<a href="#month-${e(month.key)}" data-month-link="${e(month.key)}">${Number(month.key.slice(5))}月</a>`
          )
          .join('')}`
    )
    .join(
      ''
    )}</aside><article class="rb-paper"><header class="rb-cover"><img class="rb-brand" src="${brand}" alt="MyTracer"><h1>记录册</h1><p class="rb-intro">按年月翻阅，保留保存的原话。当前名称、关联和状态与记录时的文字分别呈现。</p><p class="rb-edition">全书 · 所有有记录的月份 · 固定导出时间 ${e(snapshot.readAt)}（UTC）</p></header><nav class="rb-toolbar" aria-label="月份翻页"><label>翻到<select id="book-month" aria-label="跳转到月份">${years
    .map(
      (year) =>
        `<optgroup label="${e(year)}年">${months
          .filter((month) => month.key.startsWith(year))
          .map(
            (month) => `<option value="${e(month.key)}">${e(bookMonthLabel(month.key))}</option>`
          )
          .join('')}</optgroup>`
    )
    .join(
      ''
    )}</select></label><div class="rb-pager"><button id="book-newer" type="button" disabled>← 较新一月</button><span id="book-current" aria-live="polite"></span><button id="book-older" type="button" disabled>较早一月 →</button></div></nav>${months.length ? months.map((month) => `<div id="month-${e(month.key)}" data-book-month="${e(month.key)}">${renderBookMonth(month)}</div>`).join('') : '<p class="rb-message">还没有可按日期阅读的记录。未收录的对象请见范围说明。</p>'}<footer class="rb-end">本文件保留所有月份，可独立离线阅读。读取时的状态在本文件中固定为导出时的状态。<br>不包含历史版本，也不是备份或恢复验证。</footer></article></div>${renderBookCoverage(snapshot.book)}</main><script>${navigationScript}</script></body></html>`
}
