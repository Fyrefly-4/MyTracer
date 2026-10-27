import { useContext, useLayoutEffect, useRef, type ReactNode } from 'react'
import { AssistantContext } from './assistant-context'
import type {
  AssistantEntry,
  AssistantCandidatePayload,
  AssistantObjectRef
} from '../../../../contracts/assistant'

/** No provider means no new entry: integration explicitly enables the common panel. */
export function AssistantEntryButton(props: {
  readonly entry: AssistantEntry
  readonly selectedObjects?: readonly AssistantObjectRef[]
  readonly label: string
  readonly originalDraft?: string
  readonly children: ReactNode
  readonly disabled?: boolean
  readonly apply?: (payload: AssistantCandidatePayload) => boolean
}): ReactNode {
  const leave = useRef<(() => void) | void>(undefined)
  const anchor = useRef<HTMLDivElement>(null)
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
      leave.current?.()
    }
  }, [])
  if (!open) return null
  const textLimit =
    props.entry.editorText !== undefined &&
    (!props.entry.editorText.trim() || props.entry.editorText.length > 12000)
  return (
    <>
      <button
        type="button"
        className="secondary-button assistant-entry-button"
        disabled={props.disabled || textLimit}
        title={textLimit ? '请提供 1–12000 字的明确选定内容，再开始整理。' : undefined}
        onClick={(event) => {
          const scrollPositions: { node: HTMLElement; top: number; left: number }[] = []
          for (let node = event.currentTarget.parentElement; node; node = node.parentElement) {
            scrollPositions.push({ node, top: node.scrollTop, left: node.scrollLeft })
          }
          leave.current = open({
            trigger: event.currentTarget,
            restoreLocation: () =>
              requestAnimationFrame(() => {
                if (mounted.current)
                  for (const { node, top, left } of scrollPositions)
                    node.scrollTo({ top, left, behavior: 'instant' })
              }),
            anchor: anchor.current ?? undefined,
            presentation: props.entry.intent === 'organize' ? 'inline' : 'conversation',
            entry:
              props.entry.editorText === undefined
                ? props.entry
                : { ...props.entry, editorRevision: editorVersion.current.token },
            label: props.label,
            originalDraft: props.originalDraft,
            selectedObjects: props.selectedObjects,
            draft: props.apply
              ? {
                  revision: () => (mounted.current ? editorVersion.current.token : '__unmounted__'),
                  apply: (payload) => mounted.current && (current.current.apply?.(payload) ?? false)
                }
              : undefined
          })
        }}
      >
        {props.children}
      </button>
      <div ref={anchor} className="assistant-entry-anchor" />
    </>
  )
}
