import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { UiSession, UiSessionContext } from '../../src/renderer/src/app/ui-session'
import { TodayActionDescription } from '../../src/renderer/src/features/today/TodayActionDescription'

function render(description: string | null, actionId = 'one', session = new UiSession(() => {})) {
  return renderToStaticMarkup(
    createElement(
      UiSessionContext.Provider,
      { value: session },
      createElement(TodayActionDescription, { actionId, description })
    )
  )
}

it('omits absent descriptions and displays short raw text without interpreting markup or links', () => {
  for (const text of [null, '', ' \n\t']) expect(render(text)).toBe('')
  const html = render('材料\n<script>raw</script> **literal** https://example.invalid/?a=1&b=2')
  expect(html).toContain('材料\n&lt;script&gt;raw&lt;/script&gt; **literal**')
  expect(html).toContain('?a=1&amp;b=2')
  expect(html).not.toContain('<details')
  expect(html).not.toContain('<a ')
})

it('retains complete long or multiline text and isolates session expansion by action', () => {
  const session = new UiSession(() => {})
  session.expandedActionDescriptions.add('one')
  for (const text of ['长'.repeat(241), '一\n二\n三\n四\n五']) {
    expect(render(text, 'one', session)).toContain('<details open="">')
    expect(render(text, 'two', session)).toContain('<details>')
    expect(render(text, 'one', session)).toContain(text)
  }
  expect(render('短说明', 'one', session)).not.toContain('<details')
  expect(session.hasUnsavedContent()).toBe(false)
  expect(render('长'.repeat(241), 'one')).not.toContain('<details open')
})
