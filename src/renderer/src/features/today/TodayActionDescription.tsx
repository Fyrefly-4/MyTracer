import { type ReactNode, useState } from 'react'
import { useUiSession } from '../../app/ui-session'

/** Read the saved action text; never derive a current plan from historical records. */
export function TodayActionDescription(props: {
  readonly actionId: string
  readonly description: string | null
}): ReactNode {
  const session = useUiSession()
  const [expanded, setExpanded] = useState(() =>
    session.expandedActionDescriptions.has(props.actionId)
  )
  const text = props.description
  if (!text?.trim()) return null
  const long = text.length > 240 || text.split(/\r\n|\r|\n/).length > 4
  const body = <p className="today-action-description-text">{text}</p>
  return (
    <section className="today-action-description" aria-label="当前行动说明">
      {long ? (
        <details
          open={expanded}
          onToggle={(event) => {
            setExpanded(event.currentTarget.open)
            if (event.currentTarget.open) session.expandedActionDescriptions.add(props.actionId)
            else session.expandedActionDescriptions.delete(props.actionId)
          }}
        >
          <summary>行动说明 · {expanded ? '收起' : '展开阅读全文'}</summary>
          {body}
        </details>
      ) : (
        <>
          <h3>行动说明</h3>
          {body}
        </>
      )}
    </section>
  )
}
