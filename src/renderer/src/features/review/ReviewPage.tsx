import type { ReactNode } from 'react'

export function ReviewPage(): ReactNode {
  return (
    <section className="placeholder-card" aria-label="Review 占位内容">
      <div className="placeholder-icon" aria-hidden="true">
        ◎
      </div>
      <div>
        <h2>Review 空壳已就绪</h2>
        <p>业务能力会在后续获批任务中逐步加入。这里不会因 AI 未配置而阻塞。</p>
      </div>
    </section>
  )
}
