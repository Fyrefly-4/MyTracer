import { AssistantHost } from '../features/assistant/AssistantHost'
import { AssistantSettings } from '../features/assistant/AssistantSettings'
import { AssistantController } from '../features/assistant/assistant-controller'
import type { AssistantObjectRef } from '../../../contracts/assistant'
import { RecordBookPage } from '../features/record-book/RecordBookPage'
import wordmark from '../../../../resources/brand/MyTracer-wordmark-green.svg'
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
  const [assistantController] = useState(
    () =>
      new AssistantController(window.myTracer.assistant, {
        endpoint: '',
        model: '',
        enabled: false,
        credentialPresent: false
      })
  )
  const [assistantSettingsOpen, setAssistantSettingsOpen] = useState(false)
  const [assistantChoices, setAssistantChoices] = useState<
    { ref: AssistantObjectRef; label: string }[]
  >([])
  useEffect(() => {
    let active = true
    void window.myTracer.assistantService
      .getStatus()
      .then((result) => {
        if (active && result.ok) assistantController.updateService(result.value)
      })
      .catch(() => undefined)
    return () => {
      active = false
      assistantController.close()
    }
  }, [assistantController])
  // Only an explicit reference-picker action loads local choices; chat itself reads no library.
  const refreshAssistantChoices = async (): Promise<void> => {
    const [records, goals] = await Promise.all([
      window.myTracer.dataControl.list(),
      window.myTracer.goals.list({})
    ])
    setAssistantChoices([
      ...(goals.ok
        ? goals.value.map((g) => ({ ref: { kind: 'goal' as const, id: g.id }, label: g.name }))
        : []),
      ...(records.ok
        ? records.value.actionRecords.map((r) => ({
            ref: { kind: 'action-record' as const, id: r.id },
            label: `${r.occurredOn} · ${r.summary ?? '行动记录'}`
          }))
        : []),
      ...(records.ok
        ? records.value.routineRecords.map((r) => ({
            ref: { kind: 'routine-record' as const, id: r.id },
            label: `${r.occurredOn} · ${r.summary ?? '例行记录'}`
          }))
        : [])
    ])
  }
  const [activeSection, setActiveSection] = useState<AppSectionId>('home')
  const mainRef = useRef<HTMLElement | null>(null)
  const [bookMode, setBookMode] = useState<'reading' | 'original' | null>(null)
  const restoreDataContext = useRef<(() => void) | null>(null)
  const restoreData = () => {
    restoreDataContext.current?.()
    restoreDataContext.current = null
  }
  const [session] = useState(() => new UiSession((section) => setActiveSection(section)))
  const [pendingDataNavigation, setPendingDataNavigation] = useState<{ run: () => void } | null>(
    null
  )
  const dataNavigationDialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (!pendingDataNavigation) return
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dataNavigationDialog.current!
    dialog.showModal()
    return () => {
      dialog.close()
      if (trigger?.isConnected) trigger.focus()
    }
  }, [pendingDataNavigation])
  const guardedNavigation = (run: () => void): void => {
    if (
      (bookMode === 'original' || (!bookMode && activeSection === 'data')) &&
      session.hasDataUnsavedContent()
    ) {
      setPendingDataNavigation({ run })
    } else run()
  }
  const navigate = (section: AppSectionId): void => {
    if (section === activeSection && !bookMode) return
    guardedNavigation(() => {
      if (!bookMode) session.setPosition(activeSection, mainRef.current?.scrollTop ?? 0)
      restoreData()
      setBookMode(null)
      setActiveSection(section)
    })
  }
  const openBook = (): void =>
    guardedNavigation(() => {
      session.setPosition(activeSection, mainRef.current?.scrollTop ?? 0)
      setBookMode('reading')
    })
  const returnToBook = (): void =>
    guardedNavigation(() => {
      restoreData()
      setBookMode('reading')
    })
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
          hasUnsavedContent:
            session.hasUnsavedContent() ||
            assistantController.hasUnsavedInput() ||
            (() => {
              const view = assistantController.getSnapshot()
              return (
                Boolean(view.busy && !assistantController.canStop()) ||
                Boolean(view.preview) ||
                Boolean(view.run?.candidates.some((c) => c.state === 'proposed')) ||
                Boolean(view.session?.mode === 'temporary' && view.session.messages.length)
              )
            })()
        })
      })
    })
    return () => {
      active = false
      unsubscribeStatus()
      unsubscribeDraftRequests()
    }
  }, [session, assistantController])

  const selected = appSections.find((section) => section.id === activeSection) ?? appSections[0]

  return (
    <AssistantHost
      controller={assistantController}
      scopeChoices={assistantChoices}
      onRequestSources={() => void refreshAssistantChoices().catch(() => undefined)}
      onSource={(ref) => {
        guardedNavigation(() => {
          void assistantController.close()
          if (ref.kind === 'goal') session.openGoal(ref.id)
          else if (ref.kind === 'action') session.openAction(ref.id)
          else if (ref.kind === 'action-record' || ref.kind === 'routine-record')
            session.openDataRecord({ type: ref.kind, id: ref.id }, 'home')
          else navigate('review')
        })
      }}
    >
      <UiSessionContext value={session}>
        <div className="app-shell" data-section={activeSection}>
          <header className="topbar" aria-label="窗口标题栏">
            <p className="brand">
              <img className="titlebar-wordmark" src={wordmark} alt="MyTracer" draggable={false} />
            </p>
          </header>

          {updateOpen || restartRequired ? (
            <UpdatePanel onClose={() => setUpdateOpen(false)} />
          ) : null}

          {pendingDataNavigation ? (
            <dialog
              ref={dataNavigationDialog}
              className="confirmation-dialog"
              aria-label="离开数据页"
              aria-modal="true"
              onCancel={(event) => {
                event.preventDefault()
                setPendingDataNavigation(null)
              }}
            >
              <h2>数据页还有未保存的修改</h2>
              <p>离开会放弃补记和记录编辑中的草稿。可以返回继续编辑或保存。</p>
              <div className="dialog-actions">
                <button type="button" autoFocus onClick={() => setPendingDataNavigation(null)}>
                  继续留在数据页
                </button>
                <button
                  type="button"
                  onClick={() => {
                    pendingDataNavigation.run()
                    setPendingDataNavigation(null)
                  }}
                >
                  放弃修改并离开
                </button>
              </div>
            </dialog>
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
              <button
                type="button"
                className="nav-item"
                onClick={() =>
                  void assistantController.open({
                    entry: { object: { kind: 'conversation', id: 'free-chat' }, intent: 'chat' },
                    label: '自由对话 · 可随时添加参考',
                    presentation: 'conversation'
                  })
                }
              >
                AI 助手
              </button>
              <div className="sidebar-note">
                <button
                  type="button"
                  className="update-entry"
                  aria-expanded={assistantSettingsOpen}
                  onClick={() => setAssistantSettingsOpen(!assistantSettingsOpen)}
                >
                  Assistant 服务设置
                </button>
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
                <div
                  className={`connection ${statusError ? 'connection-error' : ''}`}
                  role="status"
                >
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
              hidden={assistantSettingsOpen && !installPreparing && !restartRequired}
              className={`content content-${bookMode === 'reading' ? 'book' : bookMode === 'original' ? 'data' : activeSection}`}
              ref={mainRef}
              onScrollCapture={(event) => {
                const target = event.target
                if (
                  bookMode !== 'reading' &&
                  target instanceof HTMLElement &&
                  target.dataset.scrollKey
                ) {
                  session.setPanePosition(
                    bookMode === 'original' ? 'data' : activeSection,
                    target.dataset.scrollKey,
                    target.scrollTop
                  )
                }
              }}
              key={`${activeSection}:${bookMode ?? 'source'}`}
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
                {!bookMode && !['home', 'today', 'goals', 'routines'].includes(activeSection) ? (
                  <section className="hero" aria-labelledby="section-title">
                    <h1 id="section-title">{selected.title}</h1>
                    <p className="lede">{selected.description}</p>
                  </section>
                ) : null}

                {bookMode === 'reading' ? (
                  <RecordBookPage
                    onBack={() => setBookMode(null)}
                    onOriginal={(selection) => {
                      restoreDataContext.current = session.visitBookOriginal(selection)
                      setBookMode('original')
                    }}
                  />
                ) : bookMode === 'original' ? (
                  <>
                    <button type="button" onClick={returnToBook}>
                      返回记录册
                    </button>
                    <DataControlPage onOpenBook={returnToBook} strictOriginal />
                  </>
                ) : activeSection === 'home' ? (
                  <HomePage />
                ) : activeSection === 'goals' ? (
                  <GoalsPage />
                ) : activeSection === 'routines' ? (
                  <RoutinesPage />
                ) : activeSection === 'today' ? (
                  <TodayPage />
                ) : activeSection === 'progress' ? (
                  <ProgressPage onOpenBook={openBook} />
                ) : activeSection === 'data' ? (
                  <DataControlPage onOpenBook={openBook} />
                ) : (
                  <ReviewPage />
                )}
              </div>
            </main>
            <section
              className="content"
              hidden={!assistantSettingsOpen || installPreparing || restartRequired}
              aria-label="Assistant 服务设置"
            >
              <div className="content-inner">
                <AssistantSettings
                  api={window.myTracer.assistantService}
                  onDirtyChange={(dirty) => assistantController.setInputDirty('settings', dirty)}
                  onChanged={(value) => assistantController.updateService(value)}
                />
                <button type="button" onClick={() => setAssistantSettingsOpen(false)}>
                  关闭服务设置
                </button>
              </div>
            </section>
          </div>
        </div>
      </UiSessionContext>
    </AssistantHost>
  )
}
