import { useEffect, useEffectEvent, type RefObject } from 'react'

// Only the two shell panels use this; native modal dialogs retain their own cancel behavior.
export function usePanelDismiss({
  panel,
  trigger,
  open,
  blocked,
  onClose
}: {
  readonly panel: RefObject<HTMLElement | null>
  readonly trigger: RefObject<HTMLButtonElement | null>
  readonly open: boolean
  readonly blocked: boolean
  readonly onClose: () => void
}): void {
  const dismiss = useEffectEvent(() => {
    if (!blocked) onClose()
  })
  useEffect(() => {
    if (!open) return
    const returnTarget = trigger.current
    let composing = false
    const start = () => {
      composing = true
    }
    const end = () => {
      composing = false
    }
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.isComposing || event.keyCode === 229 || composing) return
      // A top-layer dialog must consume its own Escape, never dismiss the panel underneath.
      if (document.querySelector(':modal')) return
      event.preventDefault()
      event.stopImmediatePropagation()
      dismiss()
    }
    panel.current?.focus({ preventScroll: true })
    document.addEventListener('compositionstart', start, true)
    document.addEventListener('compositionend', end, true)
    document.addEventListener('keydown', keydown, true)
    return () => {
      document.removeEventListener('compositionstart', start, true)
      document.removeEventListener('compositionend', end, true)
      document.removeEventListener('keydown', keydown, true)
      if (returnTarget?.isConnected) returnTarget.focus({ preventScroll: true })
    }
  }, [open, panel, trigger])
}
