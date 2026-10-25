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
  const editorVersion = useRef({ snapshot: '', token: '' })
  useLayoutEffect(() => {
    const snapshot = props.entry.editorRevision ?? ''
    if (editorVersion.current.snapshot !== snapshot || !editorVersion.current.token) {
      editorVersion.current = { snapshot, token: crypto.randomUUID() }
    }
  }, [props.entry.editorRevision])
  const mounted = useRef(false)
  useLayoutEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  if (!open) return null
  const textLimit =
    props.entry.editorText !== undefined &&
    (!props.entry.editorText.trim() || props.entry.editorText.length > 12000)
  return (
    <button
      type="button"
      className="secondary-button"
      disabled={props.disabled || textLimit}
      title={textLimit ? '请提供 1–12000 字的明确选定内容，再开始整理。' : undefined}
      onClick={() =>
        open({
          entry:
            props.entry.editorText === undefined
              ? props.entry
              : { ...props.entry, editorRevision: editorVersion.current.token },
          label: props.label,
          draft: props.apply
            ? {
                revision: () => (mounted.current ? editorVersion.current.token : '__unmounted__'),
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
