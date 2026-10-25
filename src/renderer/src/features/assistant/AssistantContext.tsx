import { useContext, useLayoutEffect, useRef, type ReactNode } from 'react'
import { AssistantContext } from './assistant-context'
import type { AssistantEntry, AssistantCandidatePayload } from '../../../../contracts/assistant'

/** No provider means no new entry: integration explicitly enables the common panel. */
export function AssistantEntryButton(props: {
  readonly entry: AssistantEntry
  readonly label: string
  readonly children: ReactNode
  readonly disabled?: boolean
  readonly apply?: (payload: AssistantCandidatePayload) => boolean
}): ReactNode {
  const open = useContext(AssistantContext)
  const current = useRef(props)
  useLayoutEffect(() => {
    current.current = props
  })
  const mounted = useRef(false)
  useLayoutEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  if (!open) return null
  return (
    <button
      type="button"
      className="secondary-button"
      disabled={props.disabled}
      onClick={() =>
        open({
          entry: props.entry,
          label: props.label,
          draft: props.apply
            ? {
                revision: () =>
                  mounted.current ? (current.current.entry.editorRevision ?? '') : '__unmounted__',
                apply: (payload) => mounted.current && (current.current.apply?.(payload) ?? false)
              }
            : undefined
        })
      }
    >
      {props.children}
    </button>
  )
}
