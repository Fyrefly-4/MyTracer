import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useUnsavedContent } from '../../app/ui-session'
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
  'context-not-found': '当前行动或记录已不可用，没有保存任何内容。',
  'context-too-large': '这次需要参考的内容过长，未发送请求。',
  'stale-context': '当前行动已经变化，没有保存任何内容。',
  timeout: '这次请求等待时间较长，已安全停止。',
  cancelled: '已取消这次整理，没有保存任何内容。',
  network: '网络暂时不可用，基础功能不受影响。',
  authentication: 'AI 服务认证未通过，请检查配置。',
  quota: 'AI 服务额度暂时不可用。',
  'rate-limited': 'AI 服务当前请求较多，可以稍后手动重试。',
  'provider-unavailable': 'AI 服务暂时不可用，手工记录功能不受影响。',
  'invalid-response': 'AI 返回内容或确认输入未通过安全检查，已忽略。',
  internal: 'AI 启动帮助暂时不可用，基础功能不受影响。'
}

const initialSession: AiStartHelpSessionDto = Object.freeze({ state: 'idle', generation: 0 })

export function AiStartHelpPanel(props: { readonly action: ActionDetailDto }): ReactNode {
  const [configuration, setConfiguration] = useState<AiConfigurationStatusDto | null>(null)
  const [session, setSession] = useState<AiStartHelpSessionDto>(initialSession)
  const sessionRef = useRef<AiStartHelpSessionDto>(initialSession)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(null)
  const [suggestionEdits, setSuggestionEdits] = useState<Record<string, string>>({})
  const [understandingEdits, setUnderstandingEdits] = useState<Record<string, string>>({})
  const [understandingTargets, setUnderstandingTargets] = useState<Record<string, string>>({})
  useUnsavedContent(
    `ai-input-${props.action.id}`,
    Boolean(input.trim()) ||
      Object.keys(suggestionEdits).length > 0 ||
      Object.keys(understandingEdits).length > 0
  )

  const applySession = (value: AiStartHelpSessionDto): void => {
    setSession(value)
    const draft = value.draft
    if (!draft) {
      setSelectedSuggestionId(null)
      setSuggestionEdits({})
      setUnderstandingEdits({})
      setUnderstandingTargets({})
      return
    }
    setSelectedSuggestionId((current) =>
      draft.suggestions.some((item) => item.candidateId === current)
        ? current
        : (draft.suggestions[0]?.candidateId ?? null)
    )
    setSuggestionEdits((current) =>
      Object.fromEntries(
        draft.suggestions.map((item) => [item.candidateId, current[item.candidateId] ?? item.text])
      )
    )
    setUnderstandingEdits((current) =>
      Object.fromEntries(
        (draft.understandingCandidates ?? []).map((item) => [
          item.candidateId,
          current[item.candidateId] ?? item.text
        ])
      )
    )
  }

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  useEffect(() => {
    let active = true
    void Promise.all([
      window.myTracer.aiConfiguration.status(),
      window.myTracer.aiStartHelp.status()
    ]).then(([configurationValue, sessionValue]) => {
      if (!active) return
      setConfiguration(configurationValue)
      applySession(sessionValue)
    })
    return () => {
      active = false
      const sessionId = sessionRef.current.sessionId
      if (sessionId) void window.myTracer.aiStartHelp.close({ sessionId })
    }
  }, [props.action.id])

  const run = async (
    work: () => Promise<AiStartHelpSessionDto>,
    followRequest = false
  ): Promise<void> => {
    setBusy(true)
    try {
      let current = await work()
      applySession(current)
      let polls = 0
      while (
        followRequest &&
        current.sessionId &&
        (current.state === 'building-context' || current.state === 'requesting') &&
        polls < 400
      ) {
        await new Promise((resolve) => setTimeout(resolve, 75))
        current = await window.myTracer.aiStartHelp.status()
        applySession(current)
        polls += 1
      }
    } catch {
      applySession({
        state: 'failed',
        sessionId: sessionRef.current.sessionId,
        generation: sessionRef.current.generation,
        error: { code: 'internal', retryable: true }
      })
    } finally {
      setBusy(false)
    }
  }

  const start = (): Promise<void> => {
    setSession((current) => ({ state: 'building-context', generation: current.generation + 1 }))
    return run(
      () =>
        window.myTracer.aiStartHelp.start({
          actionId: props.action.id,
          locale: navigator.language || 'zh-CN',
          userInput: input,
          expectedActionUpdatedAt: props.action.updatedAt
        }),
      true
    )
  }

  const withSession = (
    work: (sessionId: string) => Promise<AiStartHelpSessionDto>
  ): Promise<void> => {
    if (!session.sessionId) return Promise.resolve()
    return run(() => work(session.sessionId!))
  }

  const refreshConfiguration = async (
    work: () => Promise<AiConfigurationStatusDto>
  ): Promise<void> => {
    setBusy(true)
    try {
      setConfiguration(await work())
      applySession(initialSession)
    } finally {
      setBusy(false)
    }
  }

  const availability = configuration?.availability
  const unavailable = availability !== undefined && availability !== 'configured-available'
  const waiting = session.state === 'building-context' || session.state === 'requesting'
  const draftReady =
    session.state === 'draft-ready' && Boolean(session.draft) && session.error === undefined
  const showComposer = availability === 'configured-available' && !waiting && !draftReady
  const selectedSuggestion = session.draft?.suggestions.find(
    (item) => item.candidateId === selectedSuggestionId
  )

  return (
    <section className="ai-start-help-panel" aria-label="AI 启动帮助" aria-busy={busy || waiting}>
      <div className="ai-start-help-heading">
        <div>
          <p className="eyebrow">可选的启动帮助</p>
          <h3>如果现在有点难开始</h3>
        </div>
        {draftReady && session.sessionId ? (
          <button
            className="ghost-button"
            type="button"
            disabled={busy}
            onClick={() =>
              void withSession((sessionId) => window.myTracer.aiStartHelp.close({ sessionId }))
            }
          >
            结束本次帮助
          </button>
        ) : availability === 'configured-available' && !waiting ? (
          <button
            className="ghost-button"
            type="button"
            disabled={busy}
            onClick={() =>
              void refreshConfiguration(() => window.myTracer.aiConfiguration.disable())
            }
          >
            停用 AI 功能
          </button>
        ) : null}
      </div>

      {availability === undefined ? (
        <p className="ai-start-help-feedback" role="status">
          正在确认 AI 是否可用…
        </p>
      ) : availability === 'not-configured' ? (
        <div className="ai-start-help-availability" role="status">
          <div>
            <strong>AI 尚未配置</strong>
            <p>配置前，手工记录和管理仍可正常使用。</p>
          </div>
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
        <div className="ai-start-help-availability" role="status">
          <div>
            <strong>AI 功能已停用</strong>
            <p>手工记录和管理不受影响。</p>
          </div>
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
        <div className="ai-start-help-availability" role="status">
          <div>
            <strong>AI 暂时不可用</strong>
            <p>凭据保护暂时不可用；手工记录和管理不受影响。</p>
          </div>
        </div>
      ) : showComposer ? (
        <>
          <p className="ai-start-help-intro">
            说说哪里卡住了，AI 会基于当前行动整理一个更小、可以拒绝的起点。
          </p>
          <label className="ai-start-help-input">
            现在最卡住你的是什么？
            <textarea
              rows={2}
              maxLength={4000}
              value={input}
              disabled={busy || waiting}
              onChange={(event) => setInput(event.target.value)}
            />
          </label>
          <div className="ai-start-help-actions">
            <button
              className="primary-button"
              type="button"
              disabled={busy || waiting || !input.trim()}
              onClick={() => void start()}
            >
              帮我找一个小起点
            </button>
          </div>
        </>
      ) : null}

      {waiting ? (
        <div className="ai-start-help-waiting" role="status">
          <div>
            <strong>正在根据当前行动整理一个小起点…</strong>
            <p>你的描述：{input}</p>
            <small>等待期间，手工记录和其它操作仍可继续。</small>
          </div>
          <button
            className="secondary-button"
            type="button"
            disabled={!session.sessionId}
            onClick={() =>
              void withSession((sessionId) => window.myTracer.aiStartHelp.cancel({ sessionId }))
            }
          >
            取消整理
          </button>
        </div>
      ) : null}
      {session.error ? (
        <div className="ai-start-help-feedback ai-start-help-feedback-error" role="status">
          <p>{errorText[session.error.code]}</p>
          {session.error.retryable && session.sessionId ? (
            <button
              className="ghost-button"
              type="button"
              disabled={busy}
              onClick={() =>
                void run(
                  () => window.myTracer.aiStartHelp.retry({ sessionId: session.sessionId! }),
                  true
                )
              }
            >
              重新整理建议
            </button>
          ) : null}
        </div>
      ) : null}
      {draftReady && session.draft ? (
        <div className="ai-start-help-draft">
          <div className="ai-start-help-response-copy">
            <p>{session.draft.acknowledgement}</p>
            {session.draft.clarifyingQuestion ? <p>{session.draft.clarifyingQuestion}</p> : null}
          </div>
          <section
            className="ai-start-help-suggestions"
            role="group"
            aria-labelledby="ai-start-help-suggestions-title"
          >
            <div className="ai-start-help-section-heading">
              <h4 id="ai-start-help-suggestions-title">选择一个临时建议</h4>
              <p>可以先修改；确认前不会保存或改变当前行动。</p>
            </div>
            {session.draft.suggestions.map((suggestion, index) => {
              const selected = selectedSuggestionId === suggestion.candidateId
              return (
                <label
                  className={`ai-start-help-candidate${selected ? ' is-selected' : ''}`}
                  key={suggestion.candidateId}
                >
                  <span>
                    <input
                      type="radio"
                      name="start-help-suggestion"
                      checked={selectedSuggestionId === suggestion.candidateId}
                      onChange={() => setSelectedSuggestionId(suggestion.candidateId)}
                    />
                    建议 {index + 1}
                  </span>
                  <textarea
                    aria-label={`建议 ${index + 1} 文本`}
                    rows={2}
                    maxLength={500}
                    value={suggestionEdits[suggestion.candidateId] ?? suggestion.text}
                    disabled={suggestion.status === 'confirmed'}
                    onChange={(event) =>
                      setSuggestionEdits((current) => ({
                        ...current,
                        [suggestion.candidateId]: event.target.value
                      }))
                    }
                  />
                </label>
              )
            })}
          </section>
          <div className="ai-start-help-actions">
            <button
              className="primary-button"
              type="button"
              disabled={
                busy ||
                !selectedSuggestion ||
                !(suggestionEdits[selectedSuggestion.candidateId] ?? selectedSuggestion.text).trim()
              }
              onClick={() => {
                if (!selectedSuggestion || !session.sessionId) return
                void run(() =>
                  window.myTracer.aiStartHelp.confirmSuggestion({
                    sessionId: session.sessionId!,
                    candidateId: selectedSuggestion.candidateId,
                    finalText:
                      suggestionEdits[selectedSuggestion.candidateId] ?? selectedSuggestion.text
                  })
                )
              }}
            >
              确认并设为新的下一步
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={busy}
              onClick={() =>
                void withSession((sessionId) => window.myTracer.aiStartHelp.reject({ sessionId }))
              }
            >
              这次不采用建议
            </button>
          </div>
          {session.sessionId ? (
            <button
              className="ai-start-help-retry"
              type="button"
              disabled={busy}
              onClick={() =>
                void run(
                  () => window.myTracer.aiStartHelp.retry({ sessionId: session.sessionId! }),
                  true
                )
              }
            >
              重新整理建议
            </button>
          ) : null}

          {(session.draft.understandingCandidates ?? []).length > 0 ? (
            <section
              className="ai-start-help-understandings"
              role="group"
              aria-labelledby="ai-start-help-understandings-title"
            >
              <div className="ai-start-help-section-heading">
                <h4 id="ai-start-help-understandings-title">可选：保存一条理解</h4>
                <p>每项需要单独确认，并关联到一条已有的行动记录。</p>
              </div>
              {(session.draft.understandingCandidates ?? []).map((candidate, index) => (
                <div className="ai-start-help-candidate" key={candidate.candidateId}>
                  <textarea
                    aria-label={`理解候选 ${index + 1} 文本`}
                    rows={2}
                    maxLength={500}
                    value={understandingEdits[candidate.candidateId] ?? candidate.text}
                    disabled={candidate.status === 'confirmed'}
                    onChange={(event) =>
                      setUnderstandingEdits((current) => ({
                        ...current,
                        [candidate.candidateId]: event.target.value
                      }))
                    }
                  />
                  <select
                    aria-label="理解关联的行动记录"
                    value={understandingTargets[candidate.candidateId] ?? ''}
                    disabled={candidate.status === 'confirmed'}
                    onChange={(event) =>
                      setUnderstandingTargets((current) => ({
                        ...current,
                        [candidate.candidateId]: event.target.value
                      }))
                    }
                  >
                    <option value="">选择已有行动记录</option>
                    {(session.draft?.understandingTargets ?? []).map((target) => (
                      <option key={target.targetRef} value={target.targetRef}>
                        {target.occurredOn} · {target.actionTitle}
                      </option>
                    ))}
                  </select>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={
                      busy ||
                      candidate.status === 'confirmed' ||
                      !understandingTargets[candidate.candidateId] ||
                      !(understandingEdits[candidate.candidateId] ?? candidate.text).trim()
                    }
                    onClick={() => {
                      if (!session.sessionId) return
                      void run(() =>
                        window.myTracer.aiStartHelp.confirmUnderstanding({
                          sessionId: session.sessionId!,
                          candidateId: candidate.candidateId,
                          targetRef: understandingTargets[candidate.candidateId],
                          finalText: understandingEdits[candidate.candidateId] ?? candidate.text
                        })
                      )
                    }}
                  >
                    {candidate.status === 'confirmed' ? '已保存' : '保存这条理解'}
                  </button>
                </div>
              ))}
              {(session.draft.understandingTargets ?? []).length === 0 ? (
                <p className="empty-copy">没有可关联的真实行动记录；这些候选不会被保存。</p>
              ) : null}
            </section>
          ) : null}
        </div>
      ) : null}
      {session.state === 'confirmed' ? (
        <p className="ai-start-help-feedback ai-start-help-feedback-success" role="status">
          已保存为新的下一步。
        </p>
      ) : null}
      {session.state === 'rejected' ? (
        <p className="ai-start-help-feedback" role="status">
          你没有采用这次建议，没有保存任何内容。
        </p>
      ) : null}
      {session.state === 'closed' ? (
        <p className="ai-start-help-feedback" role="status">
          本次帮助已结束，未确认内容没有保存。
        </p>
      ) : null}
      {unavailable ? <p className="empty-copy">普通行动、记录、进展与复盘入口始终可用。</p> : null}
    </section>
  )
}
