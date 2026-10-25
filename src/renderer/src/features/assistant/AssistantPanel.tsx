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
      <p>
        候选 · {candidate.target.kind}/{candidate.target.id} ·{' '}
        {candidate.state === 'committed' ? '已保存' : '尚未保存'}
      </p>
      <fieldset disabled={!editable}>
        {payload.kind === 'review-draft' ? (
          <>
            <label>
              确认的进展
              <textarea
                value={payload.confirmedProgress}
                onChange={(e) => change({ ...payload, confirmedProgress: e.target.value })}
              />
            </label>
            <label>
              主要阻碍
              <textarea
                value={payload.mainObstacle}
                onChange={(e) => change({ ...payload, mainObstacle: e.target.value })}
              />
            </label>
            <label>
              下一次调整
              <textarea
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
              maxLength={payload.kind === 'record-summary' ? 500 : 10000}
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
              仅填入编辑草稿
            </button>
          ) : null}
          <button
            type="button"
            className="secondary-button"
            onClick={() => void controller.preview(candidate, payload)}
          >
            预览：{candidateLabels[payload.kind]}
          </button>
        </div>
      </fieldset>
    </section>
  )
}
export function AssistantPanel({
  controller,
  scopeChoices = [],
  onSource
}: {
  readonly controller: AssistantController
  readonly scopeChoices?: readonly { ref: AssistantObjectRef; label: string }[]
  readonly onSource?: (ref: AssistantObjectRef) => void
}): ReactNode {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot
  )
  const dialog = useRef<HTMLDialogElement>(null)
  const [composer, setComposer] = useState({ sessionId: '', text: '' })
  const input = composer.sessionId === state.session?.id ? composer.text : ''
  const setInput = (text: string): void => setComposer({ sessionId: state.session?.id ?? '', text })
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [mode, setMode] = useState<'persistent' | 'temporary'>('persistent')
  useEffect(() => {
    const node = dialog.current
    if (!node || !state.visible) return
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    node.showModal()
    return () => {
      node.close()
      trigger?.focus({ preventScroll: true })
    }
  }, [state.visible])
  const session = state.session
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
      <header className="assistant-header">
        <div>
          <small>
            {controller.simulation
              ? '探索演示 · 合成数据 · 模拟服务（仅内存，刷新清空）'
              : 'Assistant'}
          </small>
          <h2 id="assistant-title">一起理清下一步</h2>
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
        <small>
          服务：{controller.service.endpoint || '未配置'} · 模型：
          {controller.service.model || '未配置'}。流式与工具能力以连接测试结果为准；未知不代表支持。
        </small>
        <details>
          <summary>会话与参考范围</summary>
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
                  void controller.open(state.launch, mode)
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
                    setInput('')
                    setDeleteId(null)
                    void controller.restore(s.id)
                  }}
                >
                  {s.entry.object.kind}/{s.entry.object.id} · {s.updatedAt.slice(0, 10)}
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
          {session ? (
            <>
              <p>
                允许参考：当前 {session.scope.current.kind}/{session.scope.current.id}
                {session.scope.goalId ? `，目标 ${session.scope.goalId}` : ''}
                {session.scope.dateRange
                  ? `，${session.scope.dateRange.from} 至 ${session.scope.dateRange.to}`
                  : ''}
                ；额外选择 {session.scope.selectedObjects.length} 项。范围不等于实际发送内容。
              </p>
              {scopeChoices.map((choice) => (
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
            </>
          ) : null}
        </details>
        {state.run ? (
          <details open>
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
                  字段：{source.fields.join('、')} · 版本 {source.sourceRevision}
                  {source.truncated ? ' · 已截断' : ''}
                </small>
                <p>{source.excerpt}</p>
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
        <section aria-label="对话" className="assistant-messages">
          {session?.messages.map((message) => (
            <article key={message.id}>
              <strong>{message.role === 'user' ? '你' : 'Assistant'}</strong>
              <p>{message.text}</p>
            </article>
          ))}
        </section>
        {state.run?.steps.length ? (
          <details>
            <summary>只读查询 · {state.run.steps.length} 步</summary>
            <ol>
              {state.run.steps.map((step, index) => (
                <li key={index}>
                  {step.call.name} · 返回 {step.sources.length} 项
                  {step.truncated ? '（已截断）' : ''}
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
        {state.preview ? (
          <section className="assistant-preview" aria-label="正式写入预览">
            <h3>检查后再正式保存</h3>
            {state.preview.changes.map((change, i) => (
              <div key={i}>
                <strong>
                  {change.label} · {change.target.kind}/{change.target.id}
                </strong>
                <p>修改前</p>
                <pre>{change.before || '（空）'}</pre>
                <p>修改后</p>
                <pre>{change.after}</pre>
              </div>
            ))}
            <button
              type="button"
              className="primary-button"
              disabled={state.busy}
              onClick={() => void controller.confirm()}
            >
              确认：{candidateLabels[state.preview.payload.kind]}
            </button>
            <button type="button" disabled={state.busy} onClick={() => controller.clearPreview()}>
              取消预览
            </button>
          </section>
        ) : null}
      </div>
      <footer className="assistant-composer">
        <p role="status">{state.notice}</p>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void controller.send(input)
          }}
        >
          <label>
            继续聊聊
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
            <small>未确认不会写入正式记录。</small>
          </div>
        </form>
      </footer>
    </dialog>
  )
}
