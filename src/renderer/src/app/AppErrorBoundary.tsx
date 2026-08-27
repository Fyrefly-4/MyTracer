import { Component, type ErrorInfo, type ReactNode } from 'react'

export class AppErrorBoundary extends Component<
  { readonly children: ReactNode },
  { readonly failed: boolean }
> {
  public state = { failed: false }

  public static getDerivedStateFromError(): { readonly failed: boolean } {
    return { failed: true }
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Renderer boundary caught an error.', {
      message: error.message,
      componentStack: info.componentStack
    })
  }

  public render(): ReactNode {
    if (this.state.failed) {
      return (
        <main className="fatal-state">
          <p className="eyebrow">界面暂时不可用</p>
          <h1>MyTracer 没有修改任何数据</h1>
          <p>请关闭并重新打开应用。此状态不会绕过应用命令写入业务数据。</p>
        </main>
      )
    }
    return this.props.children
  }
}
