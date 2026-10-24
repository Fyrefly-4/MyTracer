import { useContext, useId, useState, type ReactNode } from 'react'
import { UiSessionContext } from './ui-session'
import { renderRecordNote } from '../../../presentation/record-note'

export function RecordSummaryInput({
  value,
  onChange
}: {
  readonly value: string
  readonly onChange: (value: string) => void
}): ReactNode {
  const id = useId()
  const count = Array.from(value).length
  return (
    <label>
      简述（可选）
      <textarea
        aria-label="简述（可选）"
        aria-describedby={id}
        aria-invalid={count > 500 || undefined}
        rows={2}
        value={value}
        onChange={(event) => {
          event.currentTarget.setCustomValidity(
            Array.from(event.target.value).length > 500 ? '简述请保持在 500 字以内。' : ''
          )
          onChange(event.target.value)
        }}
        ref={(element) => {
          element?.setCustomValidity(count > 500 ? '简述请保持在 500 字以内。' : '')
        }}
      />
      <small id={id}>用一两句话留下一点印象，也可以留空。{count}/500 字</small>
    </label>
  )
}

export function RecordNoteInput({
  value,
  onChange,
  label = '备注（可选）'
}: {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly label?: string
}): ReactNode {
  const id = useId()
  const [expanded, setExpanded] = useState(Boolean(value))
  return (
    <details
      className="record-note-details"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>补充笔记（可选）</summary>
      <label>
        {label}
        <textarea
          aria-label={label}
          aria-describedby={id}
          rows={5}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      <small id={id}>支持 Markdown；保存原文。阅读时链接和图片仅显示文字，不打开或加载资源。</small>
    </details>
  )
}

export function RecordNote({
  text,
  readingKey
}: {
  readonly text: string
  readonly readingKey?: string
}): ReactNode {
  const session = useContext(UiSessionContext)
  const [expanded, setExpanded] = useState(() =>
    Boolean(readingKey && session?.expandedRecordNotes.has(readingKey))
  )
  const content = (
    <div className="record-note" dangerouslySetInnerHTML={{ __html: renderRecordNote(text) }} />
  )
  return text.length > 500 || text.split('\n').length > 8 ? (
    <details
      className="record-note-details"
      open={expanded}
      onToggle={(event) => {
        const open = event.currentTarget.open
        setExpanded(open)
        if (readingKey && session) {
          if (open) session.expandedRecordNotes.add(readingKey)
          else session.expandedRecordNotes.delete(readingKey)
        }
      }}
    >
      <summary>展开完整笔记</summary>
      {content}
    </details>
  ) : (
    content
  )
}
