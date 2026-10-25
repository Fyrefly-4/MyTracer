import { type ReactNode, useEffect, useState } from 'react'
import { AppErrorBoundary } from './app/AppErrorBoundary'
import { AppShell } from './app/AppShell'
import { UiSession } from './app/ui-session'
import type { AppSectionId } from './app/navigation'

export function App(): ReactNode {
  const [activeSection, setActiveSection] = useState<AppSectionId>('home')
  const [session] = useState(() => new UiSession(setActiveSection))
  // Persistence outlives the content boundary: a rendered error must not remove
  // the only listener able to drain retained inputs before normal shutdown.
  useEffect(() => window.myTracer.recordDrafts?.subscribeClose((requestId) => {
    document.body.inert = Boolean(requestId)
    if (!requestId) return
    requestAnimationFrame(() => {
      void session.flushRecordInputs().then((retained) =>
        window.myTracer.recordDrafts.replyClose({ requestId, retained }))
    })
  }), [session])
  return (
    <AppErrorBoundary>
      <AppShell session={session} activeSection={activeSection} setActiveSection={setActiveSection} />
    </AppErrorBoundary>
  )
}
