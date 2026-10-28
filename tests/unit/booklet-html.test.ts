import { describe, expect, it } from 'vitest'
import { renderBookletHtml } from '../../src/infrastructure/export/booklet-html'

describe('personal booklet HTML', () => {
  it('preserves the chosen order and missing positions, escaping all user text', () => {
    const html = renderBookletHtml({
      readAt: '2026-10-28T00:00:00.000Z',
      booklet: {
        id: 'book',
        title: '<script>title</script>',
        note: 'my\nwords & more',
        revision: 1,
        createdAt: 'now',
        updatedAt: 'now',
        entries: []
      },
      contents: [
        {
          id: 'thought',
          kind: 'thought',
          date: '2026-10-28',
          title: 'Last date first',
          fields: [{ label: '正文', text: '<img src=x onerror=alert(1)>\nsecond line' }]
        },
        null,
        {
          id: 'record',
          kind: 'action-record',
          date: '2020-01-01',
          title: 'Earlier date last',
          fields: []
        }
      ]
    })
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;script&gt;title&lt;/script&gt;')
    expect(html).toContain('my\nwords &amp; more')
    expect(html.indexOf('Last date first')).toBeLessThan(html.indexOf('来源已删除'))
    expect(html.indexOf('来源已删除')).toBeLessThan(html.indexOf('Earlier date last'))
    expect(html).toContain("default-src 'none'")
  })
})
