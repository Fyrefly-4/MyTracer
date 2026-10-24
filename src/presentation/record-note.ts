import { Lexer, type Token } from 'marked'

function escape(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  )
}

/** Closed HTML vocabulary: never emit user attributes, HTML, URLs, images or executable code. */
function render(tokens: readonly Token[]): string {
  return tokens
    .map((token): string => {
      switch (token.type) {
        case 'space':
          return ''
        case 'heading':
          return `<h${token.depth}>${render(token.tokens ?? [])}</h${token.depth}>`
        case 'paragraph':
          return `<p>${render(token.tokens ?? [])}</p>`
        case 'text':
          return token.tokens ? render(token.tokens ?? []) : escape(token.text)
        case 'escape':
          return escape(token.text)
        case 'strong':
          return `<strong>${render(token.tokens ?? [])}</strong>`
        case 'em':
          return `<em>${render(token.tokens ?? [])}</em>`
        case 'codespan':
          return `<code>${escape(token.text)}</code>`
        case 'code':
          return `<pre><code>${escape(token.text)}</code></pre>`
        case 'blockquote':
          return `<blockquote>${render(token.tokens ?? [])}</blockquote>`
        case 'list': {
          const tag = token.ordered ? 'ol' : 'ul'
          const start =
            token.ordered &&
            typeof token.start === 'number' &&
            Number.isSafeInteger(token.start) &&
            token.start >= 0 &&
            token.start !== 1
              ? ` start="${token.start}"`
              : ''
          return `<${tag}${start}>${token.items.map((item: { tokens: Token[] }) => `<li>${render(item.tokens)}</li>`).join('')}</${tag}>`
        }
        case 'br':
          return '<br>'
        case 'hr':
          return '<hr>'
        case 'link':
          return `${render(token.tokens ?? [])} (${escape(token.href)})`
        case 'image':
          return escape(token.text)
        default:
          return escape(token.raw)
      }
    })
    .join('')
}

export function renderRecordNote(source: string): string {
  try {
    return render(Lexer.lex(source, { gfm: false, breaks: false }))
  } catch {
    // Malformed or excessively nested input remains readable, never interpreted as HTML.
    return `<p>${escape(source)}</p>`
  }
}

export const recordNoteCss = `
.record-note,.record-book dd.record-note{white-space:normal;overflow-wrap:anywhere;min-width:0;max-width:100%;line-height:1.7}
.record-note :is(p,li,blockquote){white-space:pre-wrap}
.record-note p{margin:.5em 0}
.record-note :is(h1,h2,h3,h4,h5,h6),.record-book .record-note :is(h1,h2,h3,h4,h5,h6){font-family:inherit;font-size:1.1em;line-height:1.5;letter-spacing:normal;margin:.8em 0 .4em;padding:0;border:0}
.record-note pre{white-space:pre-wrap;overflow-wrap:anywhere;max-width:100%;padding:.75em;background:#8881;border-radius:4px}
.record-note code{font-family:monospace;font-size:.92em;overflow-wrap:anywhere}
.record-note blockquote{margin:.5em 0;padding-left:1em;border-left:3px solid #8886}
.record-note :is(ul,ol){padding-left:1.5em}
.record-note-details{min-width:0;max-width:100%}
.record-note-details>summary{cursor:pointer}
.record-summary{white-space:pre-wrap;overflow-wrap:anywhere}
`
