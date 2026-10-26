import { createPortal } from 'react-dom'
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import type {
  AssistantCandidate,
  AssistantCandidatePayload,
  AssistantObjectRef
} from '../../../../contracts/assistant'
import { AssistantController, candidateLabels } from './assistant-controller'
import './assistant.css'

function CandidateEditor({
  candidate,
  controller
}: {
  readonly candidate: AssistantCandidate
  readonly controller: AssistantController
}): ReactNode {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot
  )
  const [payload, setPayload] = useState(candidate.payload)
  const change = (next: AssistantCandidatePayload): void => {
    controller.clearPreview()
    setPayload(next)
  }
  const editable = !state.busy && candidate.state === 'proposed'
  return (
    <section className="assistant-candidate" aria-label={candidateLabels[payload.kind]}>
      <h3>{candidateLabels[payload.kind]}</h3>
      {state.launch?.originalDraft ? (
        <details>
          <summary>对照当前编辑草稿 · {state.launch.label}</summary>
          <p>{state.launch.originalDraft}</p>
        </details>
      ) : null}
      <p>
        AI 候选 ·{' '}
        {candidate.state === 'committed'
          ? '已处理'
          : candidate.state === 'uncertain'
            ? '结果不确定，请核对目标记录；不会自动重试'
            : candidate.state === 'stale'
              ? '已填入或已过期；如需修改请重新整理'
              : '尚未保存'}
      </p>
      <fieldset disabled={!editable}>
        {payload.kind === 'review-draft' ? (
          <>
            <label>
              确认的进展
              <textarea
                maxLength={4000}
                value={payload.confirmedProgress}
                onChange={(e) => change({ ...payload, confirmedProgress: e.target.value })}
              />
            </label>
            <label>
              主要阻碍
              <textarea
                maxLength={4000}
                value={payload.mainObstacle}
                onChange={(e) => change({ ...payload, mainObstacle: e.target.value })}
              />
            </label>
            <label>
              下一次调整
              <textarea
                maxLength={4000}
                value={payload.nextAdjustment}
                onChange={(e) => change({ ...payload, nextAdjustment: e.target.value })}
              />
            </label>
          </>
        ) : payload.kind === 'action-create' ? (
          <>
            <label>
              行动名称
              <input
                value={payload.title}
                maxLength={200}
                onChange={(e) => change({ ...payload, title: e.target.value })}
              />
            </label>
            <label>
              行动说明
              <textarea
                maxLength={2000}
                value={payload.description ?? ''}
                onChange={(e) => change({ ...payload, description: e.target.value })}
              />
            </label>
          </>
        ) : (
          <label>
            候选文字
            <textarea
              rows={3}
              value={payload.text}
              maxLength={payload.kind === 'record-summary' ? 500 : 8000}
              onChange={(e) => change({ ...payload, text: e.target.value })}
            />
          </label>
        )}
        <div className="assistant-actions">
          {state.launch?.draft && payload.kind !== 'action-create' ? (
            <button
              type="button"
              className="secondary-button"
              onClick={() => void controller.preview(candidate, payload, true)}
            >
              填入编辑草稿
            </button>
          ) : null}
          <small>候选不会保存正式记录。请在原编辑器检查草稿并手动保存。</small>
        </div>
      </fieldset>
    </section>
  )
}
export function AssistantPanel({
  controller,
  scopeChoices = [],
  onRequestSources,
  onSource
}: {
  readonly controller: AssistantController
  readonly scopeChoices?: readonly { ref: AssistantObjectRef; label: string }[]
  readonly onRequestSources?: () => void
  readonly onSource?: (ref: AssistantObjectRef) => void
}): ReactNode {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot
  )
  const dialog = useRef<HTMLDialogElement>(null)
  const inline = state.launch?.presentation === 'inline' && Boolean(state.launch.anchor)
  const labelFor = (ref: AssistantObjectRef): string =>
    scopeChoices.find((c) => c.ref.kind === ref.kind && c.ref.id === ref.id)?.label ??
    state.run?.manifest.sources.find((s) => s.ref.kind === ref.kind && s.ref.id === ref.id)
      ?.label ??
    {
      goal: '目标',
      action: '行动',
      'action-record': '行动记录',
      'routine-record': '例行记录',
      review: '选定复盘',
      conversation: '自由对话'
    }[ref.kind]
  const [composers, setComposers] = useState<Record<string, string>>({})
  const composersRef = useRef<Record<string, string>>({})
  // Entry identity survives a fresh session on reopen. Other entry drafts remain recoverable.
  const entryKey = state.launch
    ? JSON.stringify([state.launch.entry.intent, state.launch.entry.object])
    : (state.session?.id ?? '')
  const input = composers[entryKey] ?? ''
  const setInput = (text: string): void => {
    const next = { ...composersRef.current, [entryKey]: text }
    composersRef.current = next
    controller.setInputDirty(
      'composer',
      Object.values(next).some((value) => value.length > 0)
    )
    setComposers(next)
  }
  const [sourceSearch, setSourceSearch] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [mode, setMode] = useState<'persistent' | 'temporary'>('persistent')
  useEffect(() => {
    const node = dialog.current
    if (!node || !state.visible || inline) return
    const trigger =
      state.launch?.trigger ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null)
    node.showModal()
    return () => {
      node.close()
      trigger?.focus({ preventScroll: true })
    }
  }, [state.visible, inline, state.launch?.trigger])
  const session = state.session
  const content = (
    <>
      <header className="assistant-header">
        <div>
          <small>
            {controller.simulation
              ? '探索演示 · 合成数据 · 模拟服务（仅内存，刷新清空）'
              : 'Assistant'}
          </small>
          <h2 id="assistant-title">{inline ? 'AI 整理笔记' : 'AI 助手'}</h2>
        </div>
        <button type="button" className="quiet-button" onClick={() => controller.close()}>
          关闭
        </button>
      </header>
      <div className="assistant-body">
        <p>
          {state.launch?.label ?? '本地会话'} ·{' '}
          {session?.mode === 'temporary' ? '临时，不保存' : '保存在本机'}
        </p>
        {!inline ? (
          <details>
            <summary>历史对话与保存方式</summary>
            <div className="assistant-actions">
              <label>
                新会话保存方式
                <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
                  <option value="persistent">本地保存</option>
                  <option value="temporary">临时会话</option>
                </select>
              </label>
              <button
                type="button"
                disabled={state.busy || !state.launch}
                onClick={() => {
                  if (state.launch) {
                    setInput('')
                    void controller.createNew(state.launch, mode)
                  }
                }}
              >
                开始新会话
              </button>
            </div>
            <p>删除只影响对话，不删除已经确认的正式记录。</p>
            <ul className="assistant-sessions">
              {state.sessions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    disabled={state.busy}
                    onClick={() => {
                      setDeleteId(null)
                      void controller.restore(s.id)
                    }}
                  >
                    {s.title ?? labelFor(s.entry.object)} · {s.updatedAt.slice(0, 10)}
                    {s.id === session?.id ? ' · 当前' : ''}
                  </button>
                  <button type="button" disabled={state.busy} onClick={() => setDeleteId(s.id)}>
                    删除
                  </button>
                </li>
              ))}
            </ul>
            {deleteId ? (
              <div role="group" aria-label="删除会话确认">
                <p>删除此本地对话？正式记录不受影响。</p>
                <button
                  type="button"
                  disabled={state.busy}
                  onClick={() => {
                    void controller.remove(deleteId)
                    setDeleteId(null)
                  }}
                >
                  确认删除会话
                </button>
                <button type="button" onClick={() => setDeleteId(null)}>
                  保留
                </button>
              </div>
            ) : null}
          </details>
        ) : null}
        {session ? (
          <details
            onToggle={(event) => {
              if (event.currentTarget.open) onRequestSources?.()
            }}
          >
            <summary>
              参考范围 ·{' '}
              {session.scope.current.kind === 'conversation' &&
              !session.scope.selectedObjects.length &&
              !session.scope.goalId
                ? '未选择记录'
                : `${session.scope.selectedObjects.length + (session.scope.current.kind === 'conversation' ? 0 : 1)} 项及所选范围`}
            </summary>
            <p>
              允许参考：{labelFor(session.scope.current)}
              {session.scope.goalId
                ? `，目标 ${labelFor({ kind: 'goal', id: session.scope.goalId })}`
                : ''}
              {session.scope.dateRange
                ? `，${session.scope.dateRange.from} 至 ${session.scope.dateRange.to}`
                : ''}
              ；额外选择 {session.scope.selectedObjects.length} 项。范围不等于实际发送内容。
            </p>
            {session.scope.current.kind === 'goal' ? (
              <label>
                <input
                  type="checkbox"
                  disabled={state.busy}
                  checked={session.scope.goalId === session.scope.current.id}
                  onChange={(e) =>
                    void controller.changeScope({
                      ...session.scope,
                      goalId: e.target.checked ? session.scope.current.id : undefined
                    })
                  }
                />
                允许查询这个目标下的记录
              </label>
            ) : null}
            <label>
              查找参考标题
              <input
                value={sourceSearch}
                onChange={(e) => setSourceSearch(e.target.value)}
                placeholder="只显示本机列表，勾选后才授权参考"
              />
            </label>
            {session.scope.selectedObjects.some((r) => r.kind === 'goal') ? (
              <label>
                目标相关记录授权
                <select
                  value={session.scope.goalId ?? ''}
                  disabled={state.busy}
                  onChange={(e) =>
                    void controller.changeScope({
                      ...session.scope,
                      goalId: e.target.value || undefined
                    })
                  }
                >
                  <option value="">仅参考已勾选对象</option>
                  {session.scope.selectedObjects
                    .filter((r) => r.kind === 'goal')
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        允许查询「{labelFor(r)}」的记录
                      </option>
                    ))}
                </select>
              </label>
            ) : null}
            {scopeChoices
              .filter((choice) => choice.label.includes(sourceSearch))
              .slice(0, 50)
              .map((choice) => (
                <label key={`${choice.ref.kind}:${choice.ref.id}`}>
                  <input
                    type="checkbox"
                    disabled={state.busy}
                    checked={session.scope.selectedObjects.some(
                      (ref) => ref.kind === choice.ref.kind && ref.id === choice.ref.id
                    )}
                    onChange={(e) =>
                      void controller.changeScope({
                        ...session.scope,
                        goalId:
                          !e.target.checked && choice.ref.id === session.scope.goalId
                            ? undefined
                            : session.scope.goalId,
                        selectedObjects: e.target.checked
                          ? [...session.scope.selectedObjects, choice.ref]
                          : session.scope.selectedObjects.filter(
                              (ref) => ref.kind !== choice.ref.kind || ref.id !== choice.ref.id
                            )
                      })
                    }
                  />
                  {choice.label}
                </label>
              ))}
          </details>
        ) : null}
        {state.run ? (
          <details>
            <summary>本次实际参考 · {state.run.manifest.sources.length} 项</summary>
            {state.run.manifest.sources.map((source, index) => (
              <article
                key={`${source.ref.kind}:${source.ref.id}:${index}`}
                className="assistant-source"
              >
                <strong>
                  {source.label} ·{' '}
                  {source.origin === 'editor-draft'
                    ? source.ref.kind === 'review'
                      ? '选定事实（当前文本）'
                      : '当前未保存笔记'
                    : '已保存来源'}
                </strong>
                <small>
                  {source.origin === 'editor-draft' ? '未保存内容' : '已保存内容'}
                  {source.truncated ? ' · 已截断' : ''}
                </small>
                <p>{readableExcerpt(source.excerpt)}</p>
                {onSource ? (
                  <button
                    type="button"
                    onClick={() => {
                      controller.close()
                      onSource(source.ref)
                    }}
                  >
                    回到来源
                  </button>
                ) : null}
              </article>
            ))}
            <small>
              {state.run.manifest.truncated ? '部分内容已截断。' : ''}省略来源{' '}
              {state.run.manifest.omittedCount} 项；省略历史消息{' '}
              {state.run.manifest.historyOmittedCount} 条。
            </small>
          </details>
        ) : session?.entry.editorText ? (
          <p>本次入口包含当前未保存笔记；发送后可查看实际参考内容。</p>
        ) : null}
        {inline && state.launch?.entry.editorText ? (
          <details open>
            <summary>原笔记 · 未保存内容</summary>
            <p>{state.launch.entry.editorText}</p>
          </details>
        ) : null}
        <section aria-label="对话" className="assistant-messages" hidden={inline}>
          {session?.messages.map((message) => (
            <article key={message.id}>
              <strong>{message.role === 'user' ? '你' : 'AI 助手 · 建议与解释'}</strong>
              <p>{message.text}</p>
              {message.sourceRefs.length ? (
                <small>
                  来源：{message.sourceRefs.map(labelFor).join('、')}
                  （可在「本次实际参考」核对原文）
                </small>
              ) : null}
            </article>
          ))}
        </section>
        {state.run?.steps.length ? (
          <details>
            <summary>只读查询 · {state.run.steps.length} 步</summary>
            <ol>
              {state.run.steps.map((step, index) => (
                <li key={index}>
                  {
                    {
                      findRecords: '查找选定记录',
                      readGoal: '读取选定目标',
                      getStatistics: '计算选定记录统计'
                    }[step.call.name]
                  }{' '}
                  · 返回 {step.sources.length} 项{step.truncated ? '（已截断）' : ''}
                  {step.statistics
                    ? ` · ${step.statistics.recordCount} 条记录，${step.statistics.totalDurationMinutes} 分钟，${step.statistics.unknownDurationCount} 条时长未知；未记录不算未进行`
                    : ''}
                </li>
              ))}
            </ol>
            <small>
              查询 {state.run.budget.usedToolCalls}/{state.run.budget.maxToolCalls}；输出{' '}
              {state.run.budget.usedOutputCharacters}/{state.run.budget.maxOutputCharacters} 字符。
            </small>
          </details>
        ) : null}
        {state.run?.candidates.map((candidate) => (
          <CandidateEditor
            key={`${session?.id}:${candidate.id}`}
            candidate={candidate}
            controller={controller}
          />
        ))}
      </div>
      <footer className="assistant-composer">
        <p role="status">{state.notice}</p>
        {!session?.messages.length ? (
          <div className="assistant-actions">
            {(inline
              ? ['提炼简述，保留原意和未完成的部分']
              : [
                  '我想做点什么，但还说不清',
                  '帮我接上上次；缺少参考时请先告诉我',
                  '回顾已选记录，区分事实和推测'
                ]
            ).map((prompt) => (
              <button type="button" key={prompt} onClick={() => setInput(prompt)}>
                {prompt}
              </button>
            ))}
          </div>
        ) : null}
        <form
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            const submitted = input
            const submittedEntry = entryKey
            void controller.send(submitted).then((completed) => {
              if (!completed) return
              const current = composersRef.current
              if (current[submittedEntry] !== submitted) return
              const next = { ...current, [submittedEntry]: '' }
              composersRef.current = next
              controller.setInputDirty(
                'composer',
                Object.values(next).some((value) => value.length > 0)
              )
              setComposers(next)
            })
          }}
        >
          <label>
            {inline ? '整理要求（可修改）' : '继续聊聊'}
            <textarea
              rows={2}
              maxLength={4000}
              value={input}
              disabled={!session}
              onChange={(e) => setInput(e.target.value)}
            />
          </label>
          <div className="assistant-actions">
            {state.busy ? (
              <button
                type="button"
                disabled={!controller.canStop()}
                onClick={() => controller.stop()}
              >
                {controller.canStop() ? '停止' : '正在处理…'}
              </button>
            ) : (
              <button type="submit" className="primary-button" disabled={!session || !input.trim()}>
                发送
              </button>
            )}
            {Object.values(composers).some((value) => value.length > 0) ? (
              <button
                type="button"
                onClick={() => {
                  composersRef.current = {}
                  setComposers({})
                  controller.setInputDirty('composer', false)
                }}
              >
                清空所有未发送输入
              </button>
            ) : null}
            <small>只聊也可以。AI 不保存正式记录、不创建行动。</small>
          </div>
        </form>
        {inline ? (
          <button type="button" className="secondary-button" onClick={() => controller.expand()}>
            带着内容继续对话
          </button>
        ) : null}
      </footer>
    </>
  )
  if (inline && state.launch?.anchor)
    return state.visible
      ? createPortal(
          <section className="assistant-panel assistant-inline" aria-label="AI 整理笔记">
            {content}
          </section>,
          state.launch.anchor
        )
      : null
  return (
    <dialog
      ref={dialog}
      className="assistant-panel"
      aria-labelledby="assistant-title"
      onCancel={(event) => {
        event.preventDefault()
        controller.close()
      }}
    >
      {content}
    </dialog>
  )
}

function readableExcerpt(excerpt: string): string {
  const labels: Record<string, string> = {
    title: '标题',
    description: '说明',
    status: '状态',
    summary: '简述',
    note: '笔记',
    occurredOn: '日期',
    durationMinutes: '分钟',
    outcome: '结果',
    nextStep: '记录中的下一步',
    periodStartedOn: '开始日期',
    periodEndedOn: '结束日期',
    confirmedProgress: '进展',
    mainObstacle: '阻碍',
    nextAdjustment: '调整'
  }
  try {
    const fields = JSON.parse(excerpt) as Record<string, unknown>
    return Object.entries(fields)
      .filter(([key]) => key !== 'reviewContext')
      .map(([key, value]) => `${labels[key] ?? '内容'}：${value ?? '未知 / 未填写'}`)
      .join('\n')
  } catch {
    return excerpt
  }
}
