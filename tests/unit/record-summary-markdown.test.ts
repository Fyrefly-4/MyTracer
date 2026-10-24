import { describe, expect, it } from 'vitest'
import { createActionRecord } from '../../src/domain/action-record'
import { createRoutineRecord } from '../../src/domain/routine-record'
import { renderBookMonth } from '../../src/presentation/record-book'
import { renderRecordBookHtml } from '../../src/infrastructure/export/record-book-html'
import { renderRecordNote } from '../../src/presentation/record-note'
import { searchHistory } from '../../src/renderer/src/features/data-control/history-search'

const base = {
  id: 'record',
  occurredOn: '2026-10-24',
  durationMinutes: null,
  now: '2026-10-24T08:00:00.000Z'
}
const action = (summary?: string | null, note?: string | null) =>
  createActionRecord({ ...base, actionId: 'action', outcome: 'partial', summary, note })
const routine = (summary?: string | null, note?: string | null) =>
  createRoutineRecord({
    ...base,
    routineId: 'routine',
    outcome: 'acted',
    plannedForDate: false,
    plannedForDateBasis: 'user_confirmed_history',
    summary,
    note
  })

describe('independent optional record text', () => {
  for (const create of [action, routine]) {
    it('preserves both fields independently and counts Unicode code points at the save boundary', () => {
      for (const summary of [null, '合成简述\n第二行'])
        for (const note of [null, '  # 原文\r\n\n  code\n']) {
          expect(create(summary, note)).toMatchObject({ summary, note })
        }
      expect(create()).toMatchObject({ summary: null, note: null })
      expect(create('  \n', '  ')).toMatchObject({ summary: null, note: '  ' })
      expect(create('🌱'.repeat(500)).summary).toBe('🌱'.repeat(500))
      expect(() => create('🌱'.repeat(501))).toThrow(/500/)
    })
  }
  it('finds summary and note independently, including summary-only records', () => {
    const result = searchHistory(
      {
        goals: [],
        actions: [],
        routines: [],
        actionRecords: [action('简述词', '笔记词')],
        routineRecords: [routine('简述词')],
        understandings: [],
        confusions: []
      },
      { query: '简述词', kind: 'all', goalId: 'all', date: '' }
    )
    expect(result).toHaveLength(2)
    expect(result.every((row) => row.matches[0].label === '简述')).toBe(true)
  })
})

describe('closed Markdown rendering vocabulary', () => {
  it('renders the approved reading subset while keeping code literal', () => {
    const html = renderRecordNote(
      '# Heading\n\nA **bold** and *gentle* paragraph.\n\n> Quote\n\n- one\n- two\n\n1. first\n2. second\n\n`inline <code>`\n\n```js\n<script>code</script>\n```'
    )
    for (const part of [
      '<h1>Heading</h1>',
      '<strong>bold</strong>',
      '<em>gentle</em>',
      '<blockquote>',
      '<ul>',
      '<ol>',
      '<code>inline &lt;code&gt;</code>',
      '<pre><code>&lt;script&gt;code&lt;/script&gt;</code></pre>'
    ])
      expect(html).toContain(part)
  })
  it.each([0, 3, 999999999])(
    'preserves ordered-list start %s in shared app and offline rendering',
    (start) => {
      const source = `${start}. first\n${start}. second`
      const expected = `<ol start="${start}"><li>first</li><li>second</li></ol>`
      const month = {
        key: '2026-10',
        days: [
          {
            date: '2026-10-24',
            entries: [
              {
                id: 'record',
                kind: 'action-record' as const,
                date: '2026-10-24',
                title: 'Synthetic record',
                fields: [{ label: '原备注', text: source }]
              }
            ]
          }
        ]
      }
      expect(renderRecordNote(source)).toBe(expected)
      expect(renderBookMonth(month)).toContain(expected)
      expect(
        renderRecordBookHtml({ book: { months: [month], exclusions: [] }, readAt: base.now })
      ).toContain(expected)
      expect(month.days[0].entries[0].fields[0].text).toBe(source)
    }
  )
  it('does not promote raw HTML or malformed list markers into list attributes', () => {
    const source =
      '3. <img src="https://example.invalid" onerror="bad()">\n\n<ol start="3" onclick="bad()"><li>raw</li></ol>\n\n3" onclick="bad(). item\n\n9999999999. not a Markdown list'
    const html = renderRecordNote(source)
    expect(html).toContain('<ol start="3">')
    expect(html).toContain('&lt;ol start=&quot;3&quot; onclick=&quot;bad()&quot;&gt;')
    expect(html).toContain('9999999999. not a Markdown list')
    expect(html).not.toMatch(/<[^>]*\b(?:onclick|onerror|src)=/i)
    expect(html.match(/<ol[^>]*>/g)).toEqual(['<ol start="3">'])
    expect(renderRecordNote('1. first')).toBe('<ol><li>first</li></ol>')
    expect(renderRecordNote('- first')).toBe('<ul><li>first</li></ul>')
  })
  it.each([
    'https://example.invalid/pixel',
    'javascript:alert(1)',
    'file:///secret',
    'custom:open',
    'data:text/html,bad',
    '//example.invalid/pixel'
  ])('never creates an active link or image for %s', (url) => {
    const html = renderRecordNote(
      `[label](${url})\n\n![inert alt](${url})\n\n<img src="${url}" onerror="bad()">`
    )
    expect(html).not.toMatch(/<(?:a|img|script|iframe|svg|style|link|object)\b/i)
    expect(html).not.toMatch(/<[^>]*\b(?:src|href|onerror|style)=/i)
    expect(html).toContain('inert alt')
  })
  it('keeps raw HTML and malformed input inert without truncating source', () => {
    const input = '<script>alert(1)</script>\n\n**unfinished\n\n```\n' + 'x'.repeat(5000)
    const html = renderRecordNote(input)
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('**unfinished')
    expect(html).toContain('x'.repeat(5000))
    expect(html).not.toContain('<script>')
  })
})
