import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { renderRecordBookHtml } from '../../src/infrastructure/export/record-book-html'
import { escapeBookText, renderBookMonth } from '../../src/presentation/record-book'
import type { RecordBookSnapshot } from '../../src/contracts/record-book'

const malicious =
  '</script><script>globalThis.attack=1</script><img src="https://example.invalid" onerror="attack()"> & \' 原文\n第二行'
const snapshot: RecordBookSnapshot = {
  readAt: '2026-01-01T00:00:00.000Z',
  book: {
    months: ['2024-12', '2026-01'].map((key) => ({
      key,
      days: [
        {
          date: `${key}-01`,
          entries: [
            {
              id: malicious,
              kind: 'action-record',
              date: `${key}-01`,
              title: malicious,
              fields: [
                { label: '原备注', text: malicious },
                { label: '时长', text: '0 分钟' }
              ]
            }
          ]
        }
      ]
    })),
    exclusions: [{ label: '范围', text: malicious }]
  }
}
describe('offline record book', () => {
  it('escapes original text and attributes including malicious closing scripts without losing text', () => {
    const html = renderRecordBookHtml(snapshot)
    expect(html).toContain(escapeBookText(malicious))
    expect(html).not.toContain(malicious)
    expect(html.match(/<script>/g)).toHaveLength(1)
    expect(html.match(/<\/script>/g)).toHaveLength(1)
    expect(html).not.toContain('<img src="https:')
    const app = renderBookMonth(snapshot.book.months[0], true)
    expect(app).toContain(`data-source-id="${escapeBookText(malicious)}"`)
    expect(app).not.toContain(malicious)
  })
  it('retains all months with internal navigation, fixed timestamp and embedded official branding', () => {
    const html = renderRecordBookHtml(snapshot)
    for (const key of ['2024-12', '2026-01']) {
      expect(html).toContain(`data-book-month="${key}"`)
      expect(html).toContain(`href="#month-${key}"`)
    }
    expect(html).toContain('全书 · 所有有记录的月份')
    expect(html).toContain(snapshot.readAt)
    expect(html).toContain('data:image/svg+xml;base64,')
    expect(html).not.toContain('查看原记录')
    expect(html).not.toMatch(/<(?:link|iframe|object|embed)\b|@import|url\(/i)
    expect(html).not.toMatch(/(?:src|href)="https?:/i)
    const script = html.match(/<script>([\s\S]*)<\/script>/)![1]
    expect(script).not.toContain('原文')
    expect(html).toContain(
      `script-src 'sha256-${createHash('sha256').update(script).digest('base64')}'`
    )
    expect(html).toContain("default-src 'none'")
  })
  it('explains an empty export and never invents dated chapters', () => {
    const html = renderRecordBookHtml({ ...snapshot, book: { months: [], exclusions: [] } })
    expect(html).toContain('还没有可按日期阅读的记录')
    expect(html).not.toContain('data-book-month="')
  })
})
