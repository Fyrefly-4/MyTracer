import { useEffect, useState, type ReactNode } from 'react'
import type { ActionDetailDto } from '../../../../contracts/actions'
import type {
  AiConfigurationStatusDto,
  AiStartHelpErrorCode,
  AiStartHelpSessionDto
} from '../../../../contracts/ai-start-help'

const errorText: Record<AiStartHelpErrorCode, string> = {
  disabled: 'AI 启动帮助已关闭，普通手工操作仍可继续。',
  'not-configured': 'AI 尚未配置，普通手工操作仍可继续。',
  'credential-unavailable': 'AI 凭据暂时不可用，基础功能不受影响。',
  'context-not-found': '当前行动上下文已不可用，请刷新后再试。',
  'context-too-large': '这次必要上下文过长，未向 Provider 发送请求。',
  'stale-context': '行动内容已经变化，请刷新后再试。',
  timeout: '这次请求等待时间较长，已安全停止。',
  cancelled: '已取消这次请求。',
  network: '网络暂时不可用，基础功能不受影响。',
  authentication: 'Provider 认证未通过，请检查配置。',
  quota: 'Provider 配额暂时不可用。',
  'rate-limited': 'Provider 当前请求较多，可以稍后手动重试。',
  'provider-unavailable': 'Provider 暂时不可用，基础功能不受影响。',
  'invalid-response': 'Provider 返回内容未通过安全验证，已忽略。',
  internal: 'AI 启动帮助暂时不可用，基础功能不受影响。'
}

const initialSession: AiStartHelpSessionDto = Object.freeze({ state: 'closed', generation: 0 })

export function AiStartHelpPanel(props: { readonly action: ActionDetailDto }): ReactNode {
  const [configuration, setConfiguration] = useState<AiConfigurationStatusDto | null>(null)
  const [session, setSession] = useState<AiStartHelpSessionDto>(initialSession)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    void window.myTracer.aiConfiguration.status().then((value) => {
      if (active) setConfiguration(value)
    })
    return () => {
      active = false
      void window.myTracer.aiStartHelp.close()
    }
  }, [props.action.id])

  const run = async (work: () => Promise<AiStartHelpSessionDto>): Promise<void> => {
    setBusy(true)
    try {
      setSession(await work())
    } catch {
      setSession({
        state: 'failed',
        generation: session.generation,
        error: { code: 'internal', retryable: true }
      })
    } finally {
      setBusy(false)
    }
  }

  const start = (): Promise<void> => {
    setSession({ state: 'requesting', generation: session.generation + 1 })
    return run(() =>
      window.myTracer.aiStartHelp.start({
        actionId: props.action.id,
        locale: navigator.language || 'zh-CN',
        userInput: input,
        expectedActionUpdatedAt: props.action.updatedAt
      })
    )
  }

  const refreshConfiguration = async (
    work: () => Promise<AiConfigurationStatusDto>
  ): Promise<void> => {
    setBusy(true)
    try {
      setConfiguration(await work())
      setSession(initialSession)
    } finally {
      setBusy(false)
    }
  }

  const availability = configuration?.availability ?? 'not-configured'
  const unavailable = availability !== 'configured-available'

  return (
    <section className="ai-start-help-panel" aria-label="AI 启动帮助">
      <div className="ai-start-help-heading">
        <div>
          <p className="eyebrow">可选的启动帮助</p>
          <h3>如果现在有点难开始</h3>
        </div>
        {availability === 'configured-available' ? (
          <button
            className="ghost-button"
            type="button"
            disabled={busy}
            onClick={() =>
              void refreshConfiguration(() => window.myTracer.aiConfiguration.disable())
            }
          >
            关闭 AI
          </button>
        ) : null}
      </div>

      {availability === 'not-configured' ? (
        <div className="ai-start-help-state">
          <p>尚未配置 Provider；你仍可使用下面全部手工入口。</p>
          <button
            className="secondary-button"
            type="button"
            disabled={busy}
            onClick={() =>
              void refreshConfiguration(() =>
                window.myTracer.aiConfiguration.importFromEnvironment()
              )
            }
          >
            从环境变量导入配置
          </button>
        </div>
      ) : availability === 'disabled' ? (
        <div className="ai-start-help-state">
          <p>AI 已关闭；手工记录和管理不受影响。</p>
          <button
            className="secondary-button"
            type="button"
            disabled={busy}
            onClick={() =>
              void refreshConfiguration(() => window.myTracer.aiConfiguration.enable())
            }
          >
            启用 AI
          </button>
        </div>
      ) : availability === 'configured-unavailable' ? (
        <p className="ai-start-help-state">凭据保护暂时不可用；基础功能不受影响。</p>
      ) : (
        <>
          <label>
            现在最卡住你的是什么？
            <textarea
              rows={2}
              maxLength={4000}
              value={input}
              disabled={busy || session.state === 'requesting'}
              onChange={(event) => setInput(event.target.value)}
            />
          </label>
          <div className="ai-start-help-actions">
            <button
              className="primary-button"
              type="button"
              disabled={busy || session.state === 'requesting' || !input.trim()}
              onClick={() => void start()}
            >
              我现在不想开始
            </button>
            {session.state === 'requesting' ? (
              <button
                className="secondary-button"
                type="button"
                onClick={() => void run(() => window.myTracer.aiStartHelp.cancel())}
              >
                取消
              </button>
            ) : null}
            {session.error?.retryable ? (
              <button
                className="secondary-button"
                type="button"
                disabled={busy}
                onClick={() => void run(() => window.myTracer.aiStartHelp.retry())}
              >
                手动重试
              </button>
            ) : null}
          </div>
        </>
      )}

      {session.state === 'requesting' ? (
        <p className="ai-start-help-state">正在整理一个小起点…</p>
      ) : null}
      {session.error ? (
        <p className="ai-start-help-state">{errorText[session.error.code]}</p>
      ) : null}
      {session.state === 'draft-ready' && session.draft ? (
        <div className="ai-start-help-draft">
          <p>{session.draft.acknowledgement}</p>
          {session.draft.clarifyingQuestion ? <p>{session.draft.clarifyingQuestion}</p> : null}
          <ol>
            {session.draft.suggestions.map((suggestion) => (
              <li key={suggestion.candidateId}>{suggestion.text}</li>
            ))}
          </ol>
          <p className="empty-copy">这些只是临时建议，不会修改或记录任何数据。</p>
        </div>
      ) : null}
      {unavailable ? <p className="empty-copy">普通行动、记录、进展与复盘入口始终可用。</p> : null}
    </section>
  )
}
