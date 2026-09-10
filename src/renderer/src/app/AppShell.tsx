import { type ReactNode, useEffect, useRef, useState } from 'react'
import type { ShellStatus } from '../../../contracts/shell'
import { DataControlPage } from '../features/data-control/DataControlPage'
import { GoalsPage } from '../features/goals/GoalsPage'
import { ProgressPage } from '../features/progress/ProgressPage'
import { ReviewPage } from '../features/review/ReviewPage'
import { RoutinesPage } from '../features/routines/RoutinesPage'
import { TodayPage } from '../features/today/TodayPage'
import { UiSessionContext, UiSession } from './ui-session'
import { appSections, type AppSectionId } from './navigation'

export function AppShell(): ReactNode {
  const [activeSection, setActiveSection] = useState<AppSectionId>('today')
  const mainRef = useRef<HTMLElement | null>(null)
  const [session] = useState(() => new UiSession((section) => setActiveSection(section)))
  const navigate = (section: AppSectionId): void => {
    if (section === activeSection) return
    session.setPosition(activeSection, mainRef.current?.scrollTop ?? 0)
    setActiveSection(section)
  }
  const [status, setStatus] = useState<ShellStatus | null>(null)
  const [statusError, setStatusError] = useState(false)

  useEffect(() => {
    let active = true
    window.myTracer.shell
      .getStatus()
      .then((nextStatus) => {
        if (active) setStatus(nextStatus)
      })
      .catch(() => {
        if (active) setStatusError(true)
      })
    return () => {
      active = false
    }
  }, [])

  const selected = appSections.find((section) => section.id === activeSection) ?? appSections[0]

  return (
    <UiSessionContext value={session}>
      <div className="app-shell">
        <header className="topbar">
          <div className="brand-block">
            <span className="brand-mark" aria-hidden="true">
              M
            </span>
            <div>
              <p className="brand">MyTracer</p>
              <p className="brand-note">行动、记录与温和恢复</p>
            </div>
          </div>
          <div className={`connection ${statusError ? 'connection-error' : ''}`} role="status">
            <span aria-hidden="true" />
            {statusError ? '本地数据暂时无法连接' : status ? '本地数据可用' : '正在连接本地数据'}
          </div>
        </header>

        <div className="workspace">
          <nav className="sidebar" aria-label="主要视图">
            <p className="nav-label">主要页面</p>
            {appSections.map((section) => (
              <button
                className={section.id === activeSection ? 'nav-item active' : 'nav-item'}
                key={section.id}
                type="button"
                aria-pressed={section.id === activeSection}
                onClick={() => navigate(section.id)}
              >
                <span className="nav-dot" aria-hidden="true" />
                {section.label}
              </button>
            ))}
            <div className="sidebar-note">
              <p>本地优先</p>
              <span>目标和下一步保存在本机；AI 未配置也不影响使用。</span>
            </div>
          </nav>

          <main className="content" ref={mainRef} key={activeSection}>
            <div className="content-inner">
              <section className="hero" aria-labelledby="section-title">
                <h1 id="section-title">{selected.title}</h1>
                <p className="lede">{selected.description}</p>
              </section>

              {activeSection === 'goals' ? (
                <GoalsPage />
              ) : activeSection === 'routines' ? (
                <RoutinesPage />
              ) : activeSection === 'today' ? (
                <TodayPage />
              ) : activeSection === 'progress' ? (
                <ProgressPage />
              ) : activeSection === 'data' ? (
                <DataControlPage />
              ) : (
                <ReviewPage />
              )}
            </div>
          </main>
        </div>
      </div>
    </UiSessionContext>
  )
}
