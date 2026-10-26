import { AssistantEntryButton } from '../assistant/AssistantContext'
import { RecordSummaryInput } from '../../app/RecordText'
import { createPortal } from 'react-dom'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ActionDetailDto } from '../../../../contracts/actions'
import type { GoalSummaryDto } from '../../../../contracts/goals'
import type {
  FirstActionRecordInputDto,
  RecordingDateChoiceDto
} from '../../../../contracts/records'
import {
  firstRecordDraftAfterFailure,
  useUiSession,
  useUiLifetime,
  useUnsavedContent,
  type FirstActionRecordingDraft
} from '../../app/ui-session'
import './first-action-record.css'

export function FirstActionRecord(props: {
  readonly goals: readonly GoalSummaryDto[]
  readonly actions: readonly ActionDetailDto[]
  readonly ready: boolean
  readonly onExisting: (action: ActionDetailDto) => void
  readonly onSaved: (action: ActionDetailDto) => Promise<void>
}): ReactNode {
  const session = useUiSession()
  const active = useUiLifetime()
  const [draft, setDraft] = useState(() => session.getFirstActionDraft())
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [error, setError] = useState('')
  const [existingId, setExistingId] = useState('')
  const [discarding, setDiscarding] = useState(false)
  const [dates, setDates] = useState<{ capturedOn: string; currentLocalDate: string } | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const noteInput = useRef<HTMLTextAreaElement>(null)
  const composing = useRef(false)
  const imeSubmit = useRef(false)
  useUnsavedContent('first-action-record', open)
  const change = (value: FirstActionRecordingDraft | null): void => {
    session.setFirstActionDraft(value)
    setDraft(value)
  }
  useEffect(() => {
    if (open && !dialog.current?.open) {
      dialog.current?.showModal()
      noteInput.current?.focus()
    }
    if (!open && dialog.current?.open) {
      dialog.current.close()
      trigger.current?.focus({ preventScroll: true })
    }
  }, [open])
  const start = async (): Promise<void> => {
    if (busyRef.current) return
    if (draft) {
      setOpen(true)
      return
    }
    const generation = session.beginFirstActionDraftRequest()
    busyRef.current = true
    setBusy(true)
    setError('')
    try {
      const result = await window.myTracer.records.beginFirst()
      if (!active.current || !session.ownsFirstActionDraftRequest(generation)) {
        if (result.ok) {
          await window.myTracer.records
            .cancel({ recordingContextId: result.value.recordingContextId })
            .catch(() => undefined)
        }
        return
      }
      if (!result.ok) {
        setError('暂时无法打开记录，请重试。')
        return
      }
      change({
        context: result.value,
        title: '',
        goalId: '',
        durationMinutes: '',
        unknownDuration: false,
        outcome: '',
        lifecycle: '',
        summary: '',
        note: ''
      })
      setDates(null)
      setDiscarding(false)
      setOpen(true)
    } catch {
      if (active.current && session.ownsFirstActionDraftRequest(generation))
        setError('暂时无法打开记录，请重试。')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }
  const save = async (dateChoice?: RecordingDateChoiceDto): Promise<void> => {
    if (!draft || busyRef.current || composing.current || imeSubmit.current) return
    if (
      !draft.uncertainInput &&
      (!draft.title.trim() ||
        !draft.outcome ||
        !draft.lifecycle ||
        (!draft.unknownDuration &&
          (draft.durationMinutes.trim() === '' ||
            !Number.isInteger(Number(draft.durationMinutes)) ||
            Number(draft.durationMinutes) < 0)))
    ) {
      setError('请填写做过的事、真实时长或明确不记时长，并选择本次结果和行动状态。')
      return
    }
    const input: FirstActionRecordInputDto = draft.uncertainInput ?? {
      ...draft.context,
      title: draft.title,
      goalId: draft.goalId || null,
      durationMinutes: draft.unknownDuration ? null : Number(draft.durationMinutes),
      outcome: draft.outcome as FirstActionRecordInputDto['outcome'],
      lifecycle: draft.lifecycle as FirstActionRecordInputDto['lifecycle'],
      summary: draft.summary.trim() ? draft.summary : null,
      note: draft.note.trim() ? draft.note : null,
      dateChoice
    }
    // capturedOn is owned by Main, never sent back as renderer authority.
    const {
      actionId,
      recordingContextId,
      title,
      goalId,
      durationMinutes,
      outcome,
      lifecycle,
      summary,
      note
    } = input
    const request: FirstActionRecordInputDto = {
      actionId,
      recordingContextId,
      title,
      goalId,
      durationMinutes,
      outcome,
      lifecycle,
      summary,
      note,
      dateChoice: input.dateChoice
    }
    busyRef.current = true
    setBusy(true)
    setError('')
    change({ ...draft, uncertainInput: request })
    let saved: ActionDetailDto | null = null
    try {
      const result = await window.myTracer.records.saveFirst(request)
      if (!result.ok) {
        const recovered = firstRecordDraftAfterFailure(draft, result.error.code)
        change(recovered)
        setError(
          recovered.uncertainInput
            ? '保存结果仍未确认。请重试同一笔；确认前不能修改或放弃。'
            : result.error.code === 'persistence-failed'
              ? '未能确认保存。草稿已保留，请重试同一笔。'
              : '本次未保存。请检查输入和关联目标的状态，修改后重试或放弃草稿。'
        )
      } else if (result.value.kind === 'date-confirmation-required') {
        change({ ...draft, uncertainInput: undefined })
        setDates(result.value)
      } else {
        saved = result.value.action
        change(null)
        setDates(null)
        setOpen(false)
      }
    } catch {
      setError('保存结果暂未确认。请重试确认同一笔；不会重复创建。确认前不能修改或放弃。')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
    // A refresh failure is not a save failure and must not restore the submitted draft.
    if (saved) {
      try {
        await props.onSaved(saved)
      } catch {
        setError('第一笔已保存，但列表刷新失败。请重新打开今天查看。')
      }
    }
  }
  const abandon = async (): Promise<void> => {
    if (!draft || busyRef.current || draft.uncertainInput) return
    busyRef.current = true
    setBusy(true)
    try {
      const result = await window.myTracer.records.cancel({
        recordingContextId: draft.context.recordingContextId
      })
      if (!result.ok && result.error.code !== 'invalid-recording-context') {
        setError('暂时无法放弃草稿，请重试。')
        return
      }
      change(null)
      setOpen(false)
      setDiscarding(false)
      setDates(null)
      setError('')
    } catch {
      setError('暂时无法放弃草稿，请重试。')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }
  const existing = props.actions.filter((action) => action.canStart)
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="quiet-button"
        aria-haspopup="dialog"
        disabled={busy || !props.ready}
        onClick={() => void start()}
      >
        {draft ? '继续记一笔' : '记一笔'}
      </button>
      {!open && error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
      {createPortal(
        <dialog
          ref={dialog}
          className="confirmation-dialog first-record-dialog"
          aria-labelledby="first-record-title"
          onCancel={(event) => {
            event.preventDefault()
            if (!busyRef.current) setOpen(false)
          }}
        >
          {draft ? (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void save()
              }}
              onCompositionStart={() => {
                composing.current = true
              }}
              onCompositionEnd={() => {
                composing.current = false
              }}
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter' &&
                  (event.nativeEvent.isComposing || composing.current || event.keyCode === 229)
                ) {
                  // Let the IME accept its candidate; only suppress a form submit
                  // in the same task, even if compositionend fires before submit.
                  imeSubmit.current = true
                  setTimeout(() => {
                    imeSubmit.current = false
                  }, 0)
                }
              }}
            >
              <h2 id="first-record-title">记一笔</h2>
              <p className="empty-copy">留下新行动的第一笔，无论还要继续，还是已经做完。</p>
              <p className="draft-notice">
                当前只是会话草稿。收起后可回来继续；最终保存才一起创建行动和记录。未保存草稿不会跨应用重启保留。
              </p>
              <fieldset disabled={busy || Boolean(draft.uncertainInput)}>
                <legend>已有行动？复用原来的记录路径</legend>
                <label>
                  <span id="first-record-existing-label">选择已有行动</span>
                  <select
                    aria-labelledby="first-record-existing-label"
                    value={existingId}
                    onChange={(event) => setExistingId(event.target.value)}
                  >
                    <option value="">选择行动</option>
                    {existing.map((action) => (
                      <option key={action.id} value={action.id}>
                        {action.title}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={!existingId}
                  onClick={() => {
                    const action = existing.find((item) => item.id === existingId)
                    if (action) {
                      setOpen(false)
                      props.onExisting(action)
                    }
                  }}
                >
                  打开已有行动记录
                </button>
                {!existing.length ? (
                  <p className="empty-copy">当前没有可开始的行动。例行或历史补记仍使用原有入口。</p>
                ) : null}
              </fieldset>
              <fieldset disabled={busy || Boolean(draft.uncertainInput)}>
                <legend>新行动的第一次记录</legend>
                <label>
                  先随手写下来（可选）
                  <textarea
                    ref={noteInput}
                    rows={5}
                    value={draft.note}
                    placeholder="做了一点什么？没想清楚也可以，原文会留在这笔记录里。"
                    onChange={(event) => change({ ...draft, note: event.target.value })}
                  />
                </label>
                <p className="empty-copy">
                  可以直接保存原文，也可以让 AI
                  提炼简述。矛盾或不确定的细节请保留；时长、结果和状态由你填写。
                </p>
                {open ? (
                  <AssistantEntryButton
                    label="当前未保存的第一笔 · 只参考这段原文"
                    originalDraft={`简述：${draft.summary || '（空）'}\n原文：${draft.note}`}
                    entry={{
                      object: { kind: 'record-draft', id: draft.context.recordingContextId },
                      intent: 'organize',
                      editorText: draft.note,
                      editorRevision: JSON.stringify(draft)
                    }}
                    disabled={busy || Boolean(draft.uncertainInput)}
                    apply={(payload) => {
                      if (
                        busyRef.current ||
                        draft.uncertainInput ||
                        payload.kind !== 'record-summary'
                      )
                        return false
                      change({ ...draft, summary: payload.text })
                      return true
                    }}
                  >
                    AI 整理这段原文
                  </AssistantEntryButton>
                ) : null}
                <RecordSummaryInput
                  value={draft.summary}
                  onChange={(summary) => change({ ...draft, summary })}
                />
                <label>
                  刚才做了什么
                  <input
                    required
                    value={draft.title}
                    onChange={(event) => change({ ...draft, title: event.target.value })}
                  />
                </label>
                {existing.some((action) => action.title.trim() === draft.title.trim()) ? (
                  <p role="status">已有同名行动，请先确认是否应使用上方的已有行动记录。</p>
                ) : null}
                <label>
                  <span>真实投入（分钟）</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required={!draft.unknownDuration}
                    disabled={draft.unknownDuration}
                    value={draft.durationMinutes}
                    onChange={(event) => change({ ...draft, durationMinutes: event.target.value })}
                  />
                </label>
                <label className="first-record-checkbox">
                  <input
                    type="checkbox"
                    checked={draft.unknownDuration}
                    onChange={(event) =>
                      change({ ...draft, unknownDuration: event.target.checked })
                    }
                  />
                  这次不记时长（未知）
                </label>
                <p className="empty-copy">0 表示不足一分钟但确有行动；不知道时长请明确勾选。</p>
                <label>
                  <span id="first-record-outcome-label">本次结果</span>
                  <select
                    aria-labelledby="first-record-outcome-label"
                    required
                    value={draft.outcome}
                    onChange={(event) =>
                      change({
                        ...draft,
                        outcome: event.target.value as FirstActionRecordingDraft['outcome']
                      })
                    }
                  >
                    <option value="">请选择本次结果</option>
                    <option value="completed">本次达到预期</option>
                    <option value="partial">推进了一部分</option>
                    <option value="stopped">这次停下</option>
                  </select>
                </label>
                <label>
                  <span id="first-record-lifecycle-label">保存后，整个行动</span>
                  <select
                    aria-labelledby="first-record-lifecycle-label"
                    required
                    value={draft.lifecycle}
                    onChange={(event) =>
                      change({
                        ...draft,
                        lifecycle: event.target.value as FirstActionRecordingDraft['lifecycle']
                      })
                    }
                  >
                    <option value="">请明确选择行动状态</option>
                    <option value="keep-pending">继续保留，还可以推进</option>
                    <option value="complete">确认行动已完成</option>
                  </select>
                </label>
                <p className="empty-copy">
                  本次达到预期不等于整个行动已完成。不会自动加入今天或改变目标下一步。
                </p>
                <label>
                  <span id="first-record-goal-label">关联目标（可选）</span>
                  <select
                    aria-labelledby="first-record-goal-label"
                    value={draft.goalId}
                    onChange={(event) => change({ ...draft, goalId: event.target.value })}
                  >
                    <option value="">不关联目标</option>
                    {props.goals.map((goal) => (
                      <option key={goal.id} value={goal.id}>
                        {goal.name}
                      </option>
                    ))}
                  </select>
                </label>
              </fieldset>
              {error ? (
                <p className="form-error" role="alert">
                  {error}
                </p>
              ) : null}
              {dates && !draft.uncertainInput ? (
                <div role="group" aria-label="跨日确认">
                  <p>填写时跨过了午夜，请确认这笔事实的日期。</p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void save('keep-captured-on')}
                  >
                    记在 {dates.capturedOn}
                  </button>
                  <button type="button" disabled={busy} onClick={() => void save('use-current-on')}>
                    记在 {dates.currentLocalDate}
                  </button>
                </div>
              ) : (
                <button type="submit" className="primary-button" disabled={busy}>
                  {draft.uncertainInput ? '重试确认同一笔' : '保存行动和第一笔'}
                </button>
              )}
              <div className="first-record-actions">
                <button type="button" disabled={busy} onClick={() => setOpen(false)}>
                  收起并返回
                </button>
                <button
                  type="button"
                  disabled={busy || Boolean(draft.uncertainInput)}
                  onClick={() => setDiscarding(true)}
                >
                  放弃这份草稿
                </button>
              </div>
              {discarding ? (
                <div role="group" aria-label="确认放弃草稿">
                  <p>放弃会清空输入，不创建行动或记录。</p>
                  <button
                    type="button"
                    disabled={busy || Boolean(draft.uncertainInput)}
                    onClick={() => void abandon()}
                  >
                    确认放弃
                  </button>
                  <button type="button" disabled={busy} onClick={() => setDiscarding(false)}>
                    继续填写
                  </button>
                </div>
              ) : null}
            </form>
          ) : null}
        </dialog>,
        document.body
      )}
    </>
  )
}
