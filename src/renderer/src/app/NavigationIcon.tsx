import type { ReactNode } from 'react'
import type { AppSectionId } from './navigation'

const paths: Record<AppSectionId, ReactNode> = {
  home: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  today: (
    <>
      <path d="m3 10 9-7 9 7" />
      <path d="M5 9v12h5v-7h4v7h5V9" />
    </>
  ),
  goals: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <path d="m12 12 7-8m-1 0h3v3" />
    </>
  ),
  routines: (
    <>
      <path d="M20 7v5h-5M4 17v-5h5" />
      <path d="M6 6a8 8 0 0 1 13 2M5 16a8 8 0 0 0 13 2" />
    </>
  ),
  progress: (
    <>
      <path d="M4 20V10m5 10V4m6 16v-7m5 7V7" />
    </>
  ),
  data: (
    <>
      <path d="M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7" />
    </>
  ),
  review: (
    <>
      <path d="M4 4h16v14H9l-5 3zM8 8h8M8 12h5" />
    </>
  )
}

export function NavigationIcon({ section }: { readonly section: AppSectionId }): ReactNode {
  return (
    <svg
      className="nav-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[section]}
    </svg>
  )
}
