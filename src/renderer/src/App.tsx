import { Component, type ErrorInfo, type ReactNode, useEffect, useState } from 'react'
import type { ShellStatus } from '../../contracts/shell'

type Section = 'today' | 'progress' | 'review'

const sections: ReadonlyArray<{
  readonly id: Section
  readonly label: string
  readonly eyebrow: string
  readonly title: string
  readonly description: string
}> = [
  {
    id: 'today',
    label: 'Today',
    eyebrow: '轻量开始',
    title: '今天，从一个真实动作开始',
    description: '此处将承载由你选择的今日重点、例行与非强制意向。T001 仅提供安全、可运行的界面空壳。'
  },
  {
    id: 'progress',
    label: 'Progress',
    eyebrow: '只看事实',
    title: '进展会来自已经记录的事实',
    description: '后续切片会展示投入时间、行动次数和你亲自确认的理解；当前不会推断得分、连续性或失败。'
  },
  {
    id: 'review',
    label: 'Review',
    eyebrow: '温和复盘',
    title: '复盘将帮助你选择下一次调整',
    description: '后续切片会复用已有事实形成周期摘要；当前不创建业务数据，也不会要求配置 AI。'
  }
]

class ShellErrorBoundary extends Component<{ readonly children: ReactNode }, { readonly failed: boolean }> {
  public state = { failed: false }

  public static getDerivedStateFromError(): { readonly failed: boolean } {
    return { failed: true }
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Renderer boundary caught an error.', { message: error.message, componentStack: info.componentStack })
  }

  public render(): ReactNode {
    if (this.state.failed) {
      return (
        <main className="fatal-state">
          <p className="eyebrow">界面暂时不可用</p>
          <h1>MyTracer 没有修改任何数据</h1>
          <p>请关闭并重新打开应用。T001 不会在此状态下读取或写入业务数据。</p>
        </main>
      )
    }

    return this.props.children
  }
}

function Shell(): ReactNode {
  const [activeSection, setActiveSection] = useState<Section>('today')
  const [status, setStatus] = useState<ShellStatus | null>(null)
  const [statusError, setStatusError] = useState(false)

  useEffect(() => {
    let active = true

    window.myTracer.shell
      .getStatus()
      .then((nextStatus) => {
        if (active) {
          setStatus(nextStatus)
        }
      })
      .catch(() => {
        if (active) {
          setStatusError(true)
        }
      })

    return () => {
      active = false
    }
  }, [])

  const selected = sections.find((section) => section.id === activeSection) ?? sections[0]

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true">M</span>
          <div>
            <p className="brand">MyTracer</p>
            <p className="brand-note">事实、行动与温和恢复</p>
          </div>
        </div>
        <div className={`connection ${statusError ? 'connection-error' : ''}`} role="status">
          <span aria-hidden="true" />
          {statusError ? '安全边界响应失败' : status ? '本地安全边界已连接' : '正在连接本地边界'}
        </div>
      </header>

      <div className="workspace">
        <nav className="sidebar" aria-label="主要视图">
          <p className="nav-label">空间</p>
          {sections.map((section) => (
            <button
              className={section.id === activeSection ? 'nav-item active' : 'nav-item'}
              key={section.id}
              type="button"
              aria-pressed={section.id === activeSection}
              onClick={() => setActiveSection(section.id)}
            >
              <span className="nav-dot" aria-hidden="true" />
              {section.label}
            </button>
          ))}
          <div className="sidebar-note">
            <p>本地优先</p>
            <span>当前空壳不创建数据库，也不读取凭据。</span>
          </div>
        </nav>

        <main className="content">
          <section className="hero" aria-labelledby="section-title">
            <p className="eyebrow">{selected.eyebrow}</p>
            <h1 id="section-title">{selected.title}</h1>
            <p className="lede">{selected.description}</p>
          </section>

          <section className="placeholder-card" aria-label={`${selected.label} 占位内容`}>
            <div className="placeholder-icon" aria-hidden="true">◎</div>
            <div>
              <h2>{selected.label} 空壳已就绪</h2>
              <p>业务能力会在后续获批任务中逐步加入。这里没有隐藏记录，也不会因 AI 未配置而阻塞。</p>
            </div>
          </section>

          <footer className="status-strip">
            <div>
              <span>应用版本</span>
              <strong>{status?.appVersion ?? '读取中'}</strong>
            </div>
            <div>
              <span>运行边界</span>
              <strong>{status ? 'Windows · Main / Preload / Renderer' : '验证中'}</strong>
            </div>
            <div>
              <span>AI 状态</span>
              <strong>{status?.ai.availability === 'not-configured' ? '未配置 · 不影响使用' : '读取中'}</strong>
            </div>
          </footer>
        </main>
      </div>
    </div>
  )
}

export function App(): ReactNode {
  return (
    <ShellErrorBoundary>
      <Shell />
    </ShellErrorBoundary>
  )
}
