import type { AppearanceSettings, AppearanceState } from '../../../contracts/appearance'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import type { ShellStatus } from '../../../contracts/shell'
import type { UpdateStatusDto } from '../../../contracts/updates'
import { DataControlPage } from '../features/data-control/DataControlPage'
import { GoalsPage } from '../features/goals/GoalsPage'
import { ProgressPage } from '../features/progress/ProgressPage'
import { ReviewPage } from '../features/review/ReviewPage'
import { RoutinesPage } from '../features/routines/RoutinesPage'
import { HomePage } from '../features/home/HomePage'
import { TodayPage } from '../features/today/TodayPage'
import { UpdatePanel } from '../features/update/UpdatePanel'
import { UiSessionContext, UiSession } from './ui-session'
import { appSections, type AppSectionId } from './navigation'
import { NavigationIcon } from './NavigationIcon'

export function AppShell(): ReactNode {
  const [activeSection, setActiveSection] = useState<AppSectionId>('home')
  const mainRef = useRef<HTMLElement | null>(null)
  const [session] = useState(() => new UiSession((section) => setActiveSection(section)))
  const navigate = (section: AppSectionId): void => {
    if (section === activeSection) return
    session.setPosition(activeSection, mainRef.current?.scrollTop ?? 0)
    setActiveSection(section)
  }
  const [status, setStatus] = useState<ShellStatus | null>(null)
  const [statusError, setStatusError] = useState(false)
  const [updateOpen, setUpdateOpen] = useState(false)
  const [appearanceOpen, setAppearanceOpen] = useState(false)
  const [appearance, setAppearance] = useState<AppearanceState | null>(null)
  const [appearanceError, setAppearanceError] = useState(false)
  const [appearanceSaving, setAppearanceSaving] = useState(false)
  useEffect(() => {
    let active = true
    let received = false
    const apply = (state: AppearanceState) => {
      if (!active) return
      setAppearance(state)
      document.documentElement.style.setProperty('--shell-alpha', String(state.overlay))
    }
    const unsubscribe = window.myTracer.shell.subscribeAppearance((state) => {
      received = true
      apply(state)
    })
    void window.myTracer.shell
      .getAppearance()
      .then((state) => {
        if (!received) apply(state)
      })
      .catch(() => {
        if (active) setAppearanceError(true)
      })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])
  const changeAppearance = async (settings: AppearanceSettings) => {
    setAppearanceSaving(true)
    setAppearanceError(false)
    try {
      setAppearance(await window.myTracer.shell.setAppearance(settings))
    } catch {
      setAppearanceError(true)
    } finally {
      setAppearanceSaving(false)
    }
  }
  const [installPreparing, setInstallPreparing] = useState(true)
  const [restartRequired, setRestartRequired] = useState(false)

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

  useEffect(() => {
    let active = true
    let receivedStatus = false
    const applyUpdateStatus = (next: UpdateStatusDto): void => {
      if (!active) return
      setRestartRequired(next.state === 'restartRequired')
      setInstallPreparing(
        next.state === 'preparing' ||
          next.state === 'installing' ||
          next.state === 'restartRequired'
      )
    }
    const unsubscribeStatus = window.myTracer.updates.subscribe((next) => {
      receivedStatus = true
      applyUpdateStatus(next)
    })
    void window.myTracer.updates
      .getStatus()
      .then((next) => {
        if (!receivedStatus) applyUpdateStatus(next)
      })
      .catch(() => {
        if (active) setStatusError(true)
      })
    const unsubscribeDraftRequests = window.myTracer.updates.subscribeDraftRequests((request) => {
      requestAnimationFrame(() => {
        void window.myTracer.updates.replyToDraftRequest({
          requestId: request.requestId,
          hasUnsavedContent: session.hasUnsavedContent()
        })
      })
    })
    return () => {
      active = false
      unsubscribeStatus()
      unsubscribeDraftRequests()
    }
  }, [session])

  const selected = appSections.find((section) => section.id === activeSection) ?? appSections[0]

  return (
    <UiSessionContext value={session}>
      <div className="app-shell" data-section={activeSection}>
        <header className="topbar" aria-label="窗口标题栏">
          <p className="brand">
            MyTracer<span aria-hidden="true"> ·</span>
          </p>
        </header>

        {updateOpen || restartRequired ? (
          <UpdatePanel onClose={() => setUpdateOpen(false)} />
        ) : null}

        <div className="workspace" inert={installPreparing}>
          <nav className="sidebar" aria-label="主要视图">
            {appSections.map((section) => (
              <button
                className={`nav-item${section.id === activeSection ? ' active' : ''}${section.id === 'progress' ? ' nav-group-separator' : ''}`}
                key={section.id}
                type="button"
                aria-pressed={section.id === activeSection}
                onClick={() => navigate(section.id)}
              >
                <NavigationIcon section={section.id} />
                {section.label}
              </button>
            ))}
            <div className="sidebar-note">
              <button
                type="button"
                className="update-entry"
                onClick={() => {
                  setUpdateOpen(false)
                  setAppearanceOpen(!appearanceOpen)
                }}
                aria-expanded={appearanceOpen}
              >
                外观
              </button>
              <button
                type="button"
                className="update-entry"
                onClick={() => {
                  setAppearanceOpen(false)
                  setUpdateOpen(true)
                }}
              >
                关于与更新
              </button>
              <div className={`connection ${statusError ? 'connection-error' : ''}`} role="status">
                <span aria-hidden="true" />
                {statusError
                  ? '本地数据暂时无法连接'
                  : status
                    ? '本地数据可用'
                    : '正在连接本地数据'}
              </div>
            </div>
          </nav>

          <main
            className={`content content-${activeSection}`}
            ref={mainRef}
            onScrollCapture={(event) => {
              const target = event.target
              if (target instanceof HTMLElement && target.dataset.scrollKey) {
                session.setPanePosition(activeSection, target.dataset.scrollKey, target.scrollTop)
              }
            }}
            key={activeSection}
          >
            <div className="content-inner">
              {appearanceOpen && !updateOpen && !installPreparing && !restartRequired ? (
                <section className="appearance-panel" aria-label="外观设置">
                  <h2>外观</h2>
                  <p>
                    壁纸材质仅用于标题栏、侧栏与外壳，正文保持奶白。系统不支持或关闭材质时使用实色。
                  </p>
                  {appearance ? (
                    <div className="appearance-fields">
                      <label>
                        外壳材质
                        <select
                          aria-label="外壳材质"
                          value={appearance.mode}
                          disabled={appearanceSaving}
                          onChange={(event) =>
                            void changeAppearance({
                              mode: event.target.value as AppearanceSettings['mode'],
                              intensity: appearance.intensity
                            })
                          }
                        >
                          <option value="mica">壁纸材质（Mica）</option>
                          <option value="solid">奶白实色</option>
                        </select>
                      </label>
                      <label>
                        壁纸色强度
                        <select
                          aria-label="壁纸色强度"
                          value={appearance.intensity}
                          disabled={appearanceSaving || appearance.mode === 'solid'}
                          onChange={(event) =>
                            void changeAppearance({
                              mode: appearance.mode,
                              intensity: event.target.value as AppearanceSettings['intensity']
                            })
                          }
                        >
                          <option value="subtle">轻微（Subtle）</option>
                          <option value="standard">标准（Standard）</option>
                          <option value="strong">浓郁（Strong）</option>
                        </select>
                      </label>
                    </div>
                  ) : null}
                  <p role="status">
                    {appearanceError
                      ? '外观设置读取或保存失败，请重试。'
                      : appearance?.materialRequested
                        ? '已请求 Windows 壁纸材质；最终效果由系统控制。'
                        : '当前使用奶白实色外壳。'}
                  </p>
                  <button type="button" onClick={() => setAppearanceOpen(false)}>
                    关闭外观设置
                  </button>
                </section>
              ) : null}
              {!['home', 'today', 'goals', 'routines'].includes(activeSection) ? (
                <section className="hero" aria-labelledby="section-title">
                  <h1 id="section-title">{selected.title}</h1>
                  <p className="lede">{selected.description}</p>
                </section>
              ) : null}

              {activeSection === 'home' ? (
                <HomePage />
              ) : activeSection === 'goals' ? (
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
