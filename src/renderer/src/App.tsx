import type { ReactNode } from 'react'
import { AppErrorBoundary } from './app/AppErrorBoundary'
import { AppShell } from './app/AppShell'

export function App(): ReactNode {
  return (
    <AppErrorBoundary>
      <AppShell />
    </AppErrorBoundary>
  )
}
