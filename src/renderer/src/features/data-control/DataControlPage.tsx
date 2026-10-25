import { RecordSummaryInput, RecordNoteInput, RecordNote } from '../../app/RecordText'
import { chooseVisibleSelection } from '../../app/selection-preferences'
import {
  createContext,
  useCallback,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import type {
  ActionRecordDataDto,
  ConfusionDataDto,
  DataControlErrorCode,
  DataControlListDto,
  DeletePreviewDto,
  DeleteTargetDto,
  RoutineRecordDataDto,
  UnderstandingDataDto
} from '../../../../contracts/data-control'
import { Field } from '../../app/Field'
import {
  actionStatusText,
  goalStatusText,
  recordOutcomeText,
  routineRecordOutcomeText
} from '../../app/ui-text'
import {
  revealStart,
  usePagePosition,
  useUiSession,
  useUnsavedContent,
  useDataUnsavedContent
} from '../../app/ui-session'
import type { CompleteExportErrorCode } from '../../../../contracts/exports'
import './data-workspace.css'
import { searchHistory } from './history-search'

const dataControlErrorText: Record<DataControlErrorCode, string> = {
  validation: '请检查日期、时长和必填内容。',
  'not-found': '目标数据已不存在，请刷新后重试。',
  'invalid-transition': '这项内容已经处于所选状态，未进行修改。',
  'record-already-exists': '这个例行在所选日期已有记录。',
  'delete-preview-stale': '预览后数据发生变化；请重新预览。',
  'invalid-delete-preview': '该删除预览已失效；请重新预览。',
  'invariant-violation': '数据关系与预期不一致，操作已回滚。',
  'persistence-failed': '本地数据操作失败；没有提交部分修改。'
}

const DataDraftContext = createContext<Map<string, boolean> | null>(null)

function useDataDraft(source: string, dirty: boolean): void {
  useUnsavedContent(`data-${source}`, dirty)
  const drafts = useContext(DataDraftContext)
  useLayoutEffect(() => {
    drafts?.set(source, dirty)
    return () => {
      drafts?.delete(source)
    }
  }, [drafts, source, dirty])
}

function useEditorFocus<T extends HTMLElement>(
  editing: boolean,
  saving: boolean
): {
  editButtonRef: RefObject<HTMLButtonElement | null>
  firstFieldRef: RefObject<T | null>
} {
  const editButtonRef = useRef<HTMLButtonElement>(null)
  const firstFieldRef = useRef<T>(null)
  const previous = useRef({ editing, saving })
  useLayoutEffect(() => {
    if (previous.current.editing !== editing) {
      if (editing) firstFieldRef.current?.focus()
      else editButtonRef.current?.focus()
    } else if (editing && previous.current.saving && !saving) {
      // Failed saves retain the draft; restore focus after disabled controls recover.
      firstFieldRef.current?.focus()
    }
    previous.current = { editing, saving }
  }, [editing, saving])
  return { editButtonRef, firstFieldRef }
}

function recordDuration(value: number | null): string {
  return value === null ? '时长未记录' : value === 0 ? '少于 1 分钟' : `${value} 分钟`
}

function ActionRecordEditor(props: {
  readonly objectName: string
  readonly record: ActionRecordDataDto
  readonly onChanged: () => Promise<void>
  readonly onDelete: (target: DeleteTargetDto) => Promise<void>
}): ReactNode {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const { editButtonRef, firstFieldRef } = useEditorFocus<HTMLInputElement>(editing, saving)
  const [occurredOn, setOccurredOn] = useState(props.record.occurredOn)
  const [duration, setDuration] = useState(String(props.record.durationMinutes ?? ''))
  const [outcome, setOutcome] = useState(props.record.outcome)
  const [nextStep, setNextStep] = useState(props.record.nextStep ?? '')
  const [summary, setSummary] = useState(props.record.summary ?? '')
  const [note, setNote] = useState(props.record.note ?? '')
  const [error, setError] = useState<string | null>(null)
  useDataDraft(
    `action-record-edit-${props.record.id}`,
    occurredOn !== props.record.occurredOn ||
      duration !== String(props.record.durationMinutes ?? '') ||
      outcome !== props.record.outcome ||
      nextStep !== (props.record.nextStep ?? '') ||
      summary !== (props.record.summary ?? '') ||
      note !== (props.record.note ?? '')
  )
  const reset = (): void => {
    setOccurredOn(props.record.occurredOn)
    setDuration(String(props.record.durationMinutes ?? ''))
    setOutcome(props.record.outcome)
    setNextStep(props.record.nextStep ?? '')
    setSummary(props.record.summary ?? '')
    setNote(props.record.note ?? '')
    setError(null)
  }
  const submit = async (): Promise<void> => {
    if (saving) return
    setSaving(true)
    try {
      const result = await window.myTracer.dataControl.updateActionRecord({
        recordId: props.record.id,
        occurredOn,
        durationMinutes: duration === '' ? null : Number(duration),
        outcome,
        nextStep: nextStep || null,
        summary: summary.trim() ? summary : null,
        note: note || null
      })
      if (!result.ok) return setError(dataControlErrorText[result.error.code])
      setError(null)
      setOccurredOn(result.value.occurredOn)
      setDuration(String(result.value.durationMinutes ?? ''))
      setOutcome(result.value.outcome)
      setNextStep(result.value.nextStep ?? '')
      setSummary(result.value.summary ?? '')
      setNote(result.value.note ?? '')
      await props.onChanged()
      setEditing(false)
    } catch {
      setError(dataControlErrorText['persistence-failed'])
    } finally {
      setSaving(false)
    }
  }
  return (
    <article className="data-record-card">
      <div className="data-record-heading">
        <div>
          <p className="eyebrow">行动记录</p>
          <h2>行动 · {props.objectName}</h2>
        </div>
        {!editing ? (
          <button
            ref={editButtonRef}
            className="secondary-button"
            type="button"
            onClick={() => {
              reset()
              setEditing(true)
            }}
          >
            编辑记录
          </button>
        ) : (
          <span className="data-editing-label">编辑中</span>
        )}
      </div>
      {!editing ? (
        <dl className="data-record-summary">
          <div>
            <dt>发生日期</dt>
            <dd>{props.record.occurredOn}</dd>
          </div>
          <div>
            <dt>投入时长</dt>
            <dd>{recordDuration(props.record.durationMinutes)}</dd>
          </div>
          <div>
            <dt>本次结果</dt>
            <dd>{recordOutcomeText[props.record.outcome]}</dd>
          </div>
          <div className="data-summary-wide">
            <dt>简述</dt>
            <dd className="record-summary">{props.record.summary || '未填写'}</dd>
            <dt>补充笔记</dt>
            <dd>
              {props.record.note ? (
                <RecordNote
                  readingKey={`data:action:${props.record.id}`}
                  text={props.record.note}
                />
              ) : (
                '未填写'
              )}
            </dd>
          </div>
          <div className="data-summary-wide">
            <dt>记录中的下一步</dt>
            <dd>{props.record.nextStep || '未填写'}</dd>
          </div>
        </dl>
      ) : (
        <fieldset className="data-editor-fields" disabled={saving}>
          <legend className="visually-hidden">修改行动记录</legend>
          <div className="data-edit-grid">
            <Field label="发生日期（必填）" hint="选择实际发生的本地日期。">
              <input
                ref={firstFieldRef}
                aria-label="行动发生日期"
                type="date"
                value={occurredOn}
                onChange={(event) => setOccurredOn(event.target.value)}
              />
            </Field>
            <Field
              label="投入时长（分钟，可选）"
              hint="留空表示时长未知；0 表示不足 1 分钟但确有行动。"
            >
              <input
                aria-label="行动分钟"
                type="number"
                min="0"
                step="1"
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
              />
            </Field>
            <Field label="本次结果（必填）">
              <select
                aria-label="行动结果"
                value={outcome}
                onChange={(event) =>
                  setOutcome(event.target.value as ActionRecordDataDto['outcome'])
                }
              >
                <option value="completed">本次达到预期</option>
                <option value="partial">本次完成一部分</option>
                <option value="stopped">本次在这里停下</option>
              </select>
            </Field>
            <RecordSummaryInput value={summary} onChange={setSummary} />
            <RecordNoteInput label="行动备注" value={note} onChange={setNote} />
            <Field label="记录中的下一步（可选）" hint="仅写入这条记录，不替换目标的当前下一步。">
              <textarea
                aria-label="行动下一步"
                rows={3}
                value={nextStep}
                onChange={(event) => setNextStep(event.target.value)}
                placeholder="下一步（可选）"
              />
            </Field>
          </div>
          <div className="data-editor-actions">
            <button
              className="primary-button"
              type="button"
              disabled={!occurredOn || Array.from(summary).length > 500}
              onClick={() => void submit()}
            >
              {saving ? '正在保存…' : '保存修改'}
            </button>
            <button
              className="quiet-button"
              type="button"
              onClick={() => {
                reset()
                setEditing(false)
              }}
            >
              取消编辑
            </button>
            <small>仅保存本条记录；理解与困惑单独修改。</small>
          </div>
        </fieldset>
      )}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <details className="data-record-danger">
        <summary>删除这条记录</summary>
        <p>先查看影响范围，确认后才会永久删除。</p>
        <button
          className="danger-button"
          type="button"
          disabled={saving}
          onClick={() => void props.onDelete({ type: 'action-record', id: props.record.id })}
        >
          永久删除
        </button>
      </details>
    </article>
  )
}

function RoutineRecordEditor(props: {
  readonly objectName: string
  readonly record: RoutineRecordDataDto
  readonly onChanged: () => Promise<void>
  readonly onDelete: (target: DeleteTargetDto) => Promise<void>
}): ReactNode {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const { editButtonRef, firstFieldRef } = useEditorFocus<HTMLInputElement>(editing, saving)
  const [occurredOn, setOccurredOn] = useState(props.record.occurredOn)
  const [duration, setDuration] = useState(
    props.record.durationMinutes === null ? '' : String(props.record.durationMinutes)
  )
  const [outcome, setOutcome] = useState(props.record.outcome)
  const [planned, setPlanned] = useState(props.record.plannedForDate)
  const [summary, setSummary] = useState(props.record.summary ?? '')
  const [note, setNote] = useState(props.record.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const dateChanged = occurredOn !== props.record.occurredOn
  useDataDraft(
    `routine-record-edit-${props.record.id}`,
    dateChanged ||
      duration !==
        (props.record.durationMinutes === null ? '' : String(props.record.durationMinutes)) ||
      outcome !== props.record.outcome ||
      planned !== props.record.plannedForDate ||
      summary !== (props.record.summary ?? '') ||
      note !== (props.record.note ?? '')
  )
  const reset = (): void => {
    setOccurredOn(props.record.occurredOn)
    setDuration(props.record.durationMinutes === null ? '' : String(props.record.durationMinutes))
    setOutcome(props.record.outcome)
    setPlanned(props.record.plannedForDate)
    setSummary(props.record.summary ?? '')
    setNote(props.record.note ?? '')
    setError(null)
  }
  const submit = async (): Promise<void> => {
    if (saving) return
    setSaving(true)
    try {
      const result = await window.myTracer.dataControl.updateRoutineRecord({
        recordId: props.record.id,
        occurredOn,
        outcome,
        plannedForDate: dateChanged ? planned : undefined,
        durationMinutes: duration === '' ? null : Number(duration),
        summary: summary.trim() ? summary : null,
        note: note || null
      })
      if (!result.ok) return setError(dataControlErrorText[result.error.code])
      setError(null)
      if (dateChanged) {
        await Promise.all([
          window.myTracer.routines.getDayState({
            routineId: props.record.routineId,
            localDate: props.record.occurredOn
          }),
          window.myTracer.routines.getDayState({
            routineId: props.record.routineId,
            localDate: occurredOn
          })
        ])
      }
      setOccurredOn(result.value.occurredOn)
      setDuration(result.value.durationMinutes === null ? '' : String(result.value.durationMinutes))
      setOutcome(result.value.outcome)
      setPlanned(result.value.plannedForDate)
      setSummary(result.value.summary ?? '')
      setNote(result.value.note ?? '')
      await props.onChanged()
      setEditing(false)
    } catch {
      setError(dataControlErrorText['persistence-failed'])
    } finally {
      setSaving(false)
    }
  }
  return (
    <article className="data-record-card">
      <div className="data-record-heading">
        <div>
          <p className="eyebrow">例行记录</p>
          <h2>例行 · {props.objectName}</h2>
        </div>
        {!editing ? (
          <button
            ref={editButtonRef}
            className="secondary-button"
            type="button"
            onClick={() => {
              reset()
              setEditing(true)
            }}
          >
            编辑记录
          </button>
        ) : (
          <span className="data-editing-label">编辑中</span>
        )}
      </div>
      <p className="data-plan-basis">
        {props.record.plannedForDateBasis === 'user_confirmed_history'
          ? '历史计划由用户确认'
          : '记录时的计划安排'}
      </p>
      {!editing ? (
        <dl className="data-record-summary">
          <div>
            <dt>发生日期</dt>
            <dd>{props.record.occurredOn}</dd>
          </div>
          <div>
            <dt>投入时长</dt>
            <dd>{recordDuration(props.record.durationMinutes)}</dd>
          </div>
          <div>
            <dt>本次结果</dt>
            <dd>{routineRecordOutcomeText[props.record.outcome]}</dd>
          </div>
          <div>
            <dt>当时的计划</dt>
            <dd>{props.record.plannedForDate ? '计划日' : '非计划日'}</dd>
          </div>
          <div className="data-summary-wide">
            <dt>简述</dt>
            <dd className="record-summary">{props.record.summary || '未填写'}</dd>
            <dt>补充笔记</dt>
            <dd>
              {props.record.note ? (
                <RecordNote
                  readingKey={`data:routine:${props.record.id}`}
                  text={props.record.note}
                />
              ) : (
                '未填写'
              )}
            </dd>
          </div>
        </dl>
      ) : (
        <fieldset className="data-editor-fields" disabled={saving}>
          <legend className="visually-hidden">修改例行记录</legend>
          <div className="data-edit-grid">
            <Field label="发生日期（必填）" hint="选择实际发生的本地日期。">
              <input
                ref={firstFieldRef}
                aria-label="例行发生日期"
                type="date"
                value={occurredOn}
                onChange={(event) => setOccurredOn(event.target.value)}
              />
            </Field>
            <Field label="本次结果（必填）">
              <select
                aria-label="例行结果"
                value={outcome}
                onChange={(event) => {
                  const value = event.target.value as RoutineRecordDataDto['outcome']
                  setOutcome(value)
                  if (value === 'intentional_rest' || value === 'not_done') setDuration('')
                }}
              >
                <option value="target_met">达到目标</option>
                <option value="acted">有所行动</option>
                <option value="intentional_rest">主动休息</option>
                <option value="not_done">未进行</option>
              </select>
            </Field>
            <Field
              label="投入时长（分钟，可选）"
              hint="留空表示未记录时长；0 表示不足 1 分钟但确有行动。主动休息或未进行时不填写。"
            >
              <input
                aria-label="例行分钟"
                disabled={outcome === 'intentional_rest' || outcome === 'not_done'}
                type="number"
                min="0"
                step="1"
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
              />
            </Field>
            <RecordSummaryInput value={summary} onChange={setSummary} />
            <RecordNoteInput label="例行备注" value={note} onChange={setNote} />
            {dateChanged ? (
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={planned}
                  onChange={(event) => setPlanned(event.target.checked)}
                />
                该历史日期当时属于计划日（明确确认）
              </label>
            ) : null}
          </div>
          <div className="data-editor-actions">
            <button
              className="primary-button"
              type="button"
              disabled={!occurredOn || Array.from(summary).length > 500}
              onClick={() => void submit()}
            >
              {saving ? '正在保存…' : '保存修改'}
            </button>
            <button
              className="quiet-button"
              type="button"
              onClick={() => {
                reset()
                setEditing(false)
              }}
            >
              取消编辑
            </button>
          </div>
        </fieldset>
      )}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <details className="data-record-danger">
        <summary>删除这条记录</summary>
        <p>先查看影响范围，确认后才会永久删除。</p>
        <button
          className="danger-button"
          type="button"
          disabled={saving}
          onClick={() => void props.onDelete({ type: 'routine-record', id: props.record.id })}
        >
          永久删除
        </button>
      </details>
    </article>
  )
}

function UnderstandingEditor(props: {
  readonly fact: UnderstandingDataDto
  readonly onChanged: () => Promise<void>
}): ReactNode {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(props.fact.text)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const { editButtonRef, firstFieldRef } = useEditorFocus<HTMLTextAreaElement>(editing, saving)
  useDataDraft(`understanding-edit-${props.fact.id}`, text !== props.fact.text)
  const run = async (kind: 'update' | 'revoke'): Promise<void> => {
    if (saving) return
    setSaving(true)
    try {
      const result =
        kind === 'update'
          ? await window.myTracer.dataControl.updateUnderstanding({ id: props.fact.id, text })
          : await window.myTracer.dataControl.revokeUnderstanding({ id: props.fact.id })
      if (!result.ok) return setError(dataControlErrorText[result.error.code])
      setError(null)
      setText(result.value.text)
      await props.onChanged()
      setEditing(false)
    } catch {
      setError(dataControlErrorText['persistence-failed'])
    } finally {
      setSaving(false)
    }
  }
  return (
    <li className={`data-fact-card ${props.fact.revokedAt ? 'fact-revoked' : ''}`}>
      <div className="data-fact-heading">
        <h3>已确认的理解</h3>
        {props.fact.revokedAt ? <span>已撤销</span> : null}
      </div>
      {editing ? (
        <Field label="理解成果内容">
          <textarea
            ref={firstFieldRef}
            aria-label="理解成果内容"
            rows={4}
            value={text}
            disabled={saving}
            onChange={(event) => setText(event.target.value)}
          />
        </Field>
      ) : (
        <p className="data-fact-text">{props.fact.text}</p>
      )}
      <div className="data-fact-actions">
        {editing ? (
          <>
            <button
              type="button"
              disabled={saving || !text.trim()}
              onClick={() => void run('update')}
            >
              保存理解
            </button>
            <button
              className="quiet-button"
              type="button"
              disabled={saving}
              onClick={() => {
                setText(props.fact.text)
                setError(null)
                setEditing(false)
              }}
            >
              取消编辑
            </button>
            <small>仅修改这条理解。</small>
          </>
        ) : (
          <button
            ref={editButtonRef}
            className="quiet-button"
            type="button"
            onClick={() => {
              setText(props.fact.text)
              setEditing(true)
            }}
          >
            编辑理解
          </button>
        )}
        <button
          className="quiet-button"
          type="button"
          disabled={saving || editing || props.fact.revokedAt !== null}
          onClick={() => void run('revoke')}
        >
          撤销理解
        </button>
      </div>
      {error ? <span role="alert">{error}</span> : null}
    </li>
  )
}

function ConfusionEditor(props: {
  readonly fact: ConfusionDataDto
  readonly onChanged: () => Promise<void>
}): ReactNode {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(props.fact.text)
  const [resolution, setResolution] = useState(props.fact.resolution ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const { editButtonRef, firstFieldRef } = useEditorFocus<HTMLTextAreaElement>(editing, saving)
  useDataDraft(
    `confusion-edit-${props.fact.id}`,
    text !== props.fact.text || resolution !== (props.fact.resolution ?? '')
  )
  const run = async (kind: 'update' | 'resolve' | 'reopen'): Promise<void> => {
    if (saving) return
    setSaving(true)
    try {
      const result =
        kind === 'update'
          ? await window.myTracer.dataControl.updateConfusion({ id: props.fact.id, text })
          : kind === 'resolve'
            ? await window.myTracer.dataControl.resolveConfusion({
                id: props.fact.id,
                resolution: resolution || null
              })
            : await window.myTracer.dataControl.reopenConfusion({ id: props.fact.id })
      if (!result.ok) return setError(dataControlErrorText[result.error.code])
      setError(null)
      if (kind === 'update') setText(result.value.text)
      if (kind !== 'update') setResolution(result.value.resolution ?? '')
      await props.onChanged()
      if (kind === 'update') setEditing(false)
      if (kind === 'reopen') setResolution('')
    } catch {
      setError(dataControlErrorText['persistence-failed'])
    } finally {
      setSaving(false)
    }
  }
  return (
    <li className="data-fact-card">
      <div className="data-fact-heading">
        <h3>困惑</h3>
        <span>{props.fact.status === 'open' ? '尚未解决' : '已解决'}</span>
      </div>
      {editing ? (
        <Field label="困惑内容">
          <textarea
            ref={firstFieldRef}
            aria-label="困惑内容"
            rows={4}
            disabled={saving}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </Field>
      ) : (
        <p className="data-fact-text">{props.fact.text}</p>
      )}
      <div className="data-fact-actions">
        {editing ? (
          <>
            <button
              type="button"
              disabled={saving || !text.trim()}
              onClick={() => void run('update')}
            >
              保存困惑
            </button>
            <button
              className="quiet-button"
              type="button"
              disabled={saving}
              onClick={() => {
                setText(props.fact.text)
                setError(null)
                setEditing(false)
              }}
            >
              取消编辑
            </button>
            <small>仅修改困惑内容，不改变解决状态。</small>
          </>
        ) : (
          <button
            ref={editButtonRef}
            className="quiet-button"
            type="button"
            onClick={() => {
              setText(props.fact.text)
              setEditing(true)
            }}
          >
            编辑困惑
          </button>
        )}
      </div>
      {props.fact.status === 'open' ? (
        <div className="data-confusion-resolution">
          <Field label="解决说明（可选）">
            <textarea
              aria-label="解决说明"
              rows={2}
              disabled={saving}
              value={resolution}
              onChange={(event) => setResolution(event.target.value)}
              placeholder="有了新的理解？可以在这里留下说明。"
            />
          </Field>
          <button type="button" disabled={saving} onClick={() => void run('resolve')}>
            标记解决
          </button>
        </div>
      ) : (
        <div className="data-confusion-resolution">
          {props.fact.resolution ? (
            <p className="data-fact-text">解决说明：{props.fact.resolution}</p>
          ) : null}
          <button type="button" disabled={saving} onClick={() => void run('reopen')}>
            重新打开
          </button>
        </div>
      )}
      {error ? <span role="alert">{error}</span> : null}
    </li>
  )
}

// Native modal dialogs provide focus containment and Escape semantics, as in delete preview.
function DataPanel(props: {
  title: string
  drawer?: boolean
  busy?: boolean
  onClose: () => void
  children: ReactNode
}): ReactNode {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = ref.current!
    dialog.showModal()
    return () => {
      dialog.close()
      if (trigger?.isConnected) {
        const target = trigger.matches(':disabled')
          ? trigger.closest('dialog')?.querySelector<HTMLElement>('button:not(:disabled)')
          : trigger
        target?.focus()
      }
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className={`confirmation-dialog data-panel${props.drawer ? ' data-drawer' : ''}`}
      aria-label={props.title}
      aria-modal="true"
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return
        const dialog = event.currentTarget
        const controls = [
          ...dialog.querySelectorAll<HTMLElement>(
            'button, input, select, textarea, a[href], [tabindex]'
          )
        ].filter(
          (element) =>
            element.closest('dialog') === dialog &&
            !element.matches(':disabled') &&
            element.tabIndex >= 0 &&
            element.getClientRects().length > 0
        )
        const first = controls[0]
        const last = controls.at(-1)
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }}
      onCancel={(event) => {
        event.preventDefault()
        event.stopPropagation()
        if (!props.busy) props.onClose()
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget || props.busy) return
        const box = event.currentTarget.getBoundingClientRect()
        if (
          event.clientX < box.left ||
          event.clientX > box.right ||
          event.clientY < box.top ||
          event.clientY > box.bottom
        )
          props.onClose()
      }}
    >
      <div className="data-panel-heading">
        <h2>{props.title}</h2>
        <button
          type="button"
          autoFocus
          disabled={props.busy}
          aria-label={`关闭${props.title}`}
          onClick={props.onClose}
        >
          ×
        </button>
      </div>
      {props.children}
    </dialog>
  )
}

function DataControlWorkspace({
  onOpenBook,
  strictOriginal = false
}: {
  onOpenBook: () => void
  strictOriginal?: boolean
}): ReactNode {
  const session = useUiSession()
  const [data, setData] = useState<DataControlListDto | null>(null)
  const dataRef = useRef<DataControlListDto | null>(null)
  const readSequence = useRef(0)
  const [readState, setReadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [readError, setReadError] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [panel, setPanel] = useState<
    'backfill' | 'export' | 'more' | 'filters' | 'search-scope' | null
  >(null)
  const [discardBackfill, setDiscardBackfill] = useState(false)
  const [backfillKind, setBackfillKind] = useState<'action' | 'routine'>('action')
  const [backfillMessage, setBackfillMessage] = useState('')
  const [savingBackfill, setSavingBackfill] = useState(false)
  const [preview, setPreview] = useState<DeletePreviewDto | null>(null)
  const [previewName, setPreviewName] = useState('')
  const deleteDialogRef = useRef<HTMLDialogElement | null>(null)
  const deleteTriggerRef = useRef<HTMLElement | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const dataUnsaved = useDataUnsavedContent()
  const [routeRecord, setRouteRecord] = useState(() =>
    session.takeNavigationSelection('data') ? session.dataRecord : null
  )
  const [selectedRecord, setSelectedRecord] = useState<typeof session.dataRecord>(null)
  const [recordKind, setRecordKind] = useState(session.dataHistory.kind)
  const [recordGoalId, setRecordGoalId] = useState(session.dataHistory.goalId)
  const [recordDate, setRecordDate] = useState(session.dataHistory.date)
  const [historyPage, setHistoryPage] = useState(session.dataHistory.page)
  const [searchInput, setSearchInput] = useState(session.dataHistory.query)
  const [searchQuery, setSearchQuery] = useState(session.dataHistory.query)
  const composingSearch = useRef(false)
  const searchRef = useRef<HTMLInputElement>(null)
  useLayoutEffect(() => {
    session.setDataHistory({
      kind: recordKind,
      goalId: recordGoalId,
      date: recordDate,
      query: searchQuery,
      page: historyPage
    })
  }, [session, recordKind, recordGoalId, recordDate, searchQuery, historyPage])
  const applySearch = (value: string): void => {
    setSearchQuery(value)
    setHistoryPage(1)
    setRouteRecord(null)
  }
  const clearSearch = (): void => {
    setSearchInput('')
    applySearch('')
    searchRef.current?.focus()
  }
  const [recordDrafts] = useState(() => new Map<string, boolean>())
  const [pendingSelection, setPendingSelection] = useState<typeof selectedRecord>(null)
  const [deleteType, setDeleteType] = useState<'goal' | 'action' | 'routine'>('goal')
  const [deleteId, setDeleteId] = useState('')
  const selectedRecordRef = useRef<HTMLElement | null>(null)
  const [actionId, setActionId] = useState('')
  const [routineId, setRoutineId] = useState('')
  const [actionDate, setActionDate] = useState('')
  const [actionDuration, setActionDuration] = useState('')
  const [actionOutcome, setActionOutcome] = useState<ActionRecordDataDto['outcome']>('partial')
  const [actionUnderstanding, setActionUnderstanding] = useState('')
  const [actionConfusion, setActionConfusion] = useState('')
  const [actionNextStep, setActionNextStep] = useState('')
  const [actionSummary, setActionSummary] = useState('')
  const [actionNote, setActionNote] = useState('')
  const [routineDate, setRoutineDate] = useState('')
  const [routinePlanned, setRoutinePlanned] = useState(false)
  const [routineOutcome, setRoutineOutcome] = useState<RoutineRecordDataDto['outcome']>('not_done')
  const [routineDuration, setRoutineDuration] = useState('')
  const [routineSummary, setRoutineSummary] = useState('')
  const [routineNote, setRoutineNote] = useState('')
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const actionBackfillDirty = Boolean(
    actionDate ||
    actionUnderstanding ||
    actionConfusion ||
    actionNextStep ||
    actionSummary ||
    actionNote ||
    actionDuration !== '' ||
    actionOutcome !== 'partial'
  )
  const routineBackfillDirty = Boolean(
    routineDate ||
    routineSummary ||
    routineNote ||
    routineDuration ||
    routinePlanned ||
    routineOutcome !== 'not_done'
  )
  const backfillSelectionRef = useRef({ actionId: '', routineId: '' })
  useLayoutEffect(() => {
    backfillSelectionRef.current = {
      actionId: actionBackfillDirty ? actionId : '',
      routineId: routineBackfillDirty ? routineId : ''
    }
  }, [actionBackfillDirty, actionId, routineBackfillDirty, routineId])
  useUnsavedContent('data-backfill', actionBackfillDirty || routineBackfillDirty)

  const history = useMemo(
    () =>
      data
        ? searchHistory(data, {
            query: searchQuery,
            kind: recordKind,
            goalId: recordGoalId,
            date: recordDate
          })
        : [],
    [data, searchQuery, recordKind, recordGoalId, recordDate]
  )

  const pageCount = Math.max(1, Math.ceil(history.length / 8))
  const currentPage = Math.min(historyPage, pageCount)
  const visibleHistory = history.slice((currentPage - 1) * 8, currentPage * 8)

  const visibleIds = visibleHistory.map((row) => `${row.type}:${row.id}`).join('|')
  const reconcileSelection = useEffectEvent((): void => {
    if (
      !data ||
      dataUnsaved ||
      pendingSelection ||
      preview ||
      deleting ||
      [...recordDrafts.values()].some(Boolean)
    )
      return
    const key = (row: { type: string; id: string }): string => `${row.type}:${row.id}`
    const routeExists =
      routeRecord &&
      (routeRecord.type === 'action-record'
        ? data.actionRecords.some((row) => row.id === routeRecord.id)
        : data.routineRecords.some((row) => row.id === routeRecord.id))
    const routeActive =
      routeExists &&
      recordKind === 'all' &&
      recordGoalId === 'all' &&
      !recordDate &&
      !searchQuery.trim() &&
      historyPage === 1
    if (
      selectedRecord &&
      (visibleHistory.some((row) => key(row) === key(selectedRecord)) ||
        (routeActive && key(selectedRecord) === key(routeRecord)))
    )
      return
    const next =
      routeActive && !selectedRecord
        ? routeRecord
        : chooseVisibleSelection(
            visibleHistory,
            session.dataRecord ? key(session.dataRecord) : null,
            key
          )
    setSelectedRecord(next ? { type: next.type, id: next.id } : null)
    if (next) session.selectDataRecord({ type: next.type, id: next.id })
  })
  useEffect(() => {
    let active = true
    void Promise.resolve().then(() => {
      if (active) reconcileSelection()
    })
    return () => {
      active = false
    }
  }, [
    dataUnsaved,
    visibleIds,
    data,
    selectedRecord,
    pendingSelection,
    preview,
    deleting,
    recordKind,
    recordGoalId,
    recordDate,
    searchQuery,
    historyPage
  ])

  const revealSelectedRecord = (): void => {
    const element = selectedRecordRef.current
    element?.scrollTo({ top: 0 })
    if (element && getComputedStyle(element).overflowY === 'visible') {
      element.scrollIntoView({ block: 'start' })
    } else {
      revealStart(element)
    }
  }

  const applySelection = (selection: NonNullable<typeof selectedRecord>): void => {
    setRouteRecord(null)
    setPendingSelection(null)
    setSelectedRecord(selection)
    session.selectDataRecord(selection)
    requestAnimationFrame(revealSelectedRecord)
  }

  const chooseRecord = (selection: NonNullable<typeof selectedRecord>): void => {
    if (selection.id === selectedRecord?.id && selection.type === selectedRecord.type) return
    if ([...recordDrafts.values()].some(Boolean)) {
      setPendingSelection(selection)
      requestAnimationFrame(revealSelectedRecord)
      return
    }
    applySelection(selection)
  }

  const load = useCallback(async (): Promise<void> => {
    const sequence = ++readSequence.current
    setReadState('loading')
    setReadError('')
    try {
      const result = await window.myTracer.dataControl.list()
      if (sequence !== readSequence.current) return
      if (!result.ok) {
        setReadState('error')
        setReadError('记录暂时无法读取。这不表示记录不存在，请重新读取。')
        return
      }
      const backfill = backfillSelectionRef.current
      if (
        (backfill.actionId &&
          !result.value.actions.some((item) => item.id === backfill.actionId)) ||
        (backfill.routineId &&
          !result.value.routines.some((item) => item.id === backfill.routineId))
      ) {
        setReadState('error')
        setReadError('补记对象已变化。请先取消补记或明确选择其他对象，再重新读取。')
        return
      }
      // Keep mounted editors if an intervening change removed a record with a draft.
      const previous = dataRef.current
      if (
        previous &&
        [...recordDrafts.values()].some(Boolean) &&
        (previous.actionRecords.some(
          (record) => !result.value.actionRecords.some((item) => item.id === record.id)
        ) ||
          previous.routineRecords.some(
            (record) => !result.value.routineRecords.some((item) => item.id === record.id)
          ) ||
          previous.understandings.some(
            (fact) => !result.value.understandings.some((item) => item.id === fact.id)
          ) ||
          previous.confusions.some(
            (fact) => !result.value.confusions.some((item) => item.id === fact.id)
          ))
      ) {
        setReadState('error')
        setReadError('记录列表已变化。请先保存或取消当前修改，再重新读取。')
        return
      }
      dataRef.current = result.value
      setData(result.value)
      setReadState('ready')
      setActionId((current) =>
        result.value.actions.some((item) => item.id === current)
          ? current
          : (result.value.actions[0]?.id ?? '')
      )
      setRoutineId((current) =>
        result.value.routines.some((item) => item.id === current)
          ? current
          : (result.value.routines[0]?.id ?? '')
      )
      setSelectedRecord((current) => {
        if (!current) return null
        const exists =
          current.type === 'action-record'
            ? result.value.actionRecords.some((record) => record.id === current.id)
            : result.value.routineRecords.some((record) => record.id === current.id)
        return exists ? current : null
      })
    } catch {
      if (sequence !== readSequence.current) return
      setReadState('error')
      setReadError('记录暂时无法读取。这不表示记录不存在，请重新读取。')
    }
  }, [recordDrafts])
  const refreshAfterMutation = async (): Promise<void> => {
    await Promise.all([load(), window.myTracer.progress.get({}), window.myTracer.today.get({})])
  }
  useEffect(() => {
    let active = true
    void Promise.resolve().then(() => {
      if (active) void load()
    })
    return () => {
      active = false
      readSequence.current += 1
    }
  }, [load])

  const previewId = preview?.previewId
  useEffect(() => {
    const dialog = deleteDialogRef.current
    if (!previewId || !dialog) return
    dialog.showModal()
    return () => {
      dialog.close()
      if (deleteTriggerRef.current?.isConnected) deleteTriggerRef.current.focus()
    }
  }, [previewId])

  const describeDeleteTarget = (target: DeleteTargetDto): string => {
    if (!data) return '所选内容'
    if (target.type === 'goal')
      return `目标“${data.goals.find((item) => item.id === target.id)?.title ?? '未知目标'}”`
    if (target.type === 'action')
      return `行动“${data.actions.find((item) => item.id === target.id)?.title ?? '未知行动'}”`
    if (target.type === 'routine')
      return `例行“${data.routines.find((item) => item.id === target.id)?.name ?? '未知例行'}”`
    if (target.type === 'action-record') {
      const record = data.actionRecords.find((item) => item.id === target.id)
      const action = data.actions.find((item) => item.id === record?.actionId)
      return `“${action?.title ?? '行动'}”在 ${record?.occurredOn ?? '所选日期'} 的记录`
    }
    const record = data.routineRecords.find((item) => item.id === target.id)
    const routine = data.routines.find((item) => item.id === record?.routineId)
    return `“${routine?.name ?? '例行'}”在 ${record?.occurredOn ?? '所选日期'} 的记录`
  }

  const requestDelete = async (target: DeleteTargetDto): Promise<void> => {
    deleteTriggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const result = await window.myTracer.dataControl.previewDelete({ target })
    if (!result.ok) return setError(dataControlErrorText[result.error.code])
    setDeleteError(null)
    setPreviewName(describeDeleteTarget(target))
    setPreview(result.value)
    setError(null)
  }
  const cancelDelete = async (): Promise<void> => {
    if (!preview || deleting) return
    setDeleting(true)
    try {
      const result = await window.myTracer.dataControl.cancelDelete({
        previewId: preview.previewId
      })
      if (!result.ok) return setDeleteError(dataControlErrorText[result.error.code])
      setPreview(null)
      setPreviewName('')
    } catch {
      setDeleteError('暂时无法关闭删除预览，请重试。')
    } finally {
      setDeleting(false)
    }
  }
  const confirmDelete = async (): Promise<void> => {
    if (!preview || deleting) return
    setDeleting(true)
    try {
      const result = await window.myTracer.dataControl.confirmDelete({
        previewId: preview.previewId,
        target: preview.target,
        confirmation: 'permanently-delete'
      })
      setPreview(null)
      setPreviewName('')
      if (!result.ok) return setError(dataControlErrorText[result.error.code])
      await refreshAfterMutation()
    } catch {
      setPreview(null)
      setPreviewName('')
      setError('暂时无法确认删除结果，请刷新后查看。')
    } finally {
      setDeleting(false)
    }
  }
  const backfillAction = async (): Promise<void> => {
    if (savingBackfill) return
    setSavingBackfill(true)
    setBackfillMessage('')
    try {
      const result = await window.myTracer.dataControl.backfillActionRecord({
        actionId,
        occurredOn: actionDate,
        durationMinutes: actionDuration === '' ? null : Number(actionDuration),
        outcome: actionOutcome,
        understanding: actionUnderstanding || null,
        confusion: actionConfusion || null,
        nextStep: actionNextStep || null,
        summary: actionSummary.trim() ? actionSummary : null,
        note: actionNote || null
      })
      if (!result.ok) return setError(dataControlErrorText[result.error.code])
      setError(null)
      setBackfillMessage(
        `已补记：${data?.actions.find((item) => item.id === actionId)?.title ?? '记录'} · ${actionDate}`
      )
      setActionDate('')
      setActionDuration('')
      setActionOutcome('partial')
      setActionUnderstanding('')
      setActionConfusion('')
      setActionNextStep('')
      setActionSummary('')
      setActionNote('')
      await refreshAfterMutation()
    } catch {
      setError(dataControlErrorText['persistence-failed'])
    } finally {
      setSavingBackfill(false)
    }
  }
  const backfillRoutine = async (): Promise<void> => {
    if (savingBackfill) return
    setSavingBackfill(true)
    setBackfillMessage('')
    try {
      const result = await window.myTracer.dataControl.backfillRoutineRecord({
        routineId,
        occurredOn: routineDate,
        outcome: routineOutcome,
        plannedForDate: routinePlanned,
        durationMinutes:
          routineOutcome === 'intentional_rest' || routineOutcome === 'not_done'
            ? null
            : routineDuration === ''
              ? null
              : Number(routineDuration),
        summary: routineSummary.trim() ? routineSummary : null,
        note: routineNote || null
      })
      if (!result.ok) return setError(dataControlErrorText[result.error.code])
      setError(null)
      setBackfillMessage(
        `已补记：${data?.routines.find((item) => item.id === routineId)?.name ?? '记录'} · ${routineDate}`
      )
      setRoutineDate('')
      setRoutinePlanned(false)
      setRoutineOutcome('not_done')
      setRoutineDuration('')
      setRoutineSummary('')
      setRoutineNote('')
      await window.myTracer.routines.getDayState({ routineId, localDate: routineDate })
      await refreshAfterMutation()
    } catch {
      setError(dataControlErrorText['persistence-failed'])
    } finally {
      setSavingBackfill(false)
    }
  }
  const generateExport = async (): Promise<void> => {
    setExporting(true)
    try {
      const result = await window.myTracer.exports.generate()
      if (!result.ok) {
        const messages: Record<CompleteExportErrorCode, string> = {
          validation: '导出请求无效。',
          'snapshot-failed': '无法读取一致的完整数据快照。',
          'serialization-failed': '无法序列化导出文件。',
          'export-validation-failed': '导出内容校验未通过，未交付文件。',
          'write-failed': '文件未能安全写入。',
          'destination-changed': '目标文件发生变化，请重新选择。',
          'replace-not-supported': '请使用新文件名，现有导出文件未被修改。'
        }
        setExportMessage(messages[result.error.code])
        return
      }
      setExportMessage(
        result.value.kind === 'cancelled'
          ? '已取消导出，未创建文件。'
          : `已导出 ${result.value.fileName}（${result.value.byteLength} 字节）。`
      )
    } catch {
      setExportMessage('导出暂时失败，请重试。')
    } finally {
      setExporting(false)
    }
  }
  const selectedActionRecord =
    selectedRecord?.type === 'action-record'
      ? (data?.actionRecords.find((record) => record.id === selectedRecord.id) ?? null)
      : null
  const selectedRoutineRecord =
    selectedRecord?.type === 'routine-record'
      ? (data?.routineRecords.find((record) => record.id === selectedRecord.id) ?? null)
      : null
  // Rows can arrive one commit before selection reconciliation mounts the detail.
  // Restoring into that empty pane clamps its saved offset to zero permanently.
  usePagePosition(
    'data',
    data !== null &&
      (visibleHistory.length === 0 ||
        selectedActionRecord !== null ||
        selectedRoutineRecord !== null)
  )
  const deleteOptions =
    deleteType === 'goal'
      ? (data?.goals.map((item) => ({ id: item.id, label: item.title })) ?? [])
      : deleteType === 'action'
        ? (data?.actions.map((item) => ({ id: item.id, label: item.title })) ?? [])
        : (data?.routines.map((item) => ({ id: item.id, label: item.name })) ?? [])
  const effectiveDeleteId = deleteOptions.some((item) => item.id === deleteId)
    ? deleteId
    : (deleteOptions[0]?.id ?? '')

  const impactLabels: Record<string, string> = {
    goals: '目标',
    actions: '行动',
    routines: '例行',
    routineScheduleDays: '例行排期',
    todaySelections: '今天选择',
    actionRecords: '行动记录',
    routineRecords: '例行记录',
    understandings: '已确认的理解',
    confusions: '尚未解决或已处理的困惑',
    reviewResults: '复盘',
    detachedGoalStages: '解除的阶段关联（其他阶段与数据保留）',
    detachedRoutines: '解除关联的例行',
    detachedReviewResults: '解除关联的复盘',
    clearedCurrentNext: '清空的当前下一步'
  }

  if (
    strictOriginal &&
    data &&
    routeRecord &&
    !(routeRecord.type === 'action-record'
      ? data.actionRecords.some((row) => row.id === routeRecord.id)
      : data.routineRecords.some((row) => row.id === routeRecord.id))
  ) {
    return <p role="alert">这条原记录已不存在。请返回记录册读取最新资料。</p>
  }

  return (
    <section className="data-workspace" aria-label="历史记录与数据控制">
      {error && !panel ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="data-toolbar" aria-label="数据操作">
        <button type="button" onClick={() => setPanel('backfill')}>
          补记记录{actionBackfillDirty || routineBackfillDirty ? ' · 有草稿' : ''}
        </button>
        <button type="button" onClick={() => setPanel('export')}>
          导出
        </button>
        <button type="button" onClick={() => setPanel('more')}>
          更多
        </button>
      </div>
      {panel === 'export' ? (
        <DataPanel title="导出数据" busy={exporting} onClose={() => setPanel(null)}>
          <p>导出包含目标、行动、例行、记录及其关联状态，并由你选择保存位置。</p>
          <p>目前只支持导出；尚不支持自动导入或一键恢复。</p>
          <p>
            新记录的未完成输入会加密保留在本机，方便下次继续；正式保存或放弃后清除，不进入导出。系统备份可能包含本机文件，跨设备或系统账户不保证可恢复。升级前的数据库快照可能保留旧资料，不再需要时可在关闭应用后自行删除。
          </p>
          <button
            className="primary-button"
            type="button"
            disabled={exporting}
            onClick={() => void generateExport()}
          >
            {exporting ? '正在准备导出…' : '导出完整数据'}
          </button>
          {exportMessage ? <p role="status">{exportMessage}</p> : null}
          <hr />
          <p>
            记录册按月阅读保存的原文，可另存包含所有月份的离线
            HTML；它不是备份或恢复证明，不能替代完整 JSON。
          </p>
          <button
            type="button"
            disabled={exporting}
            onClick={() => {
              setPanel(null)
              onOpenBook()
            }}
          >
            阅读记录册 / 保存 HTML
          </button>
        </DataPanel>
      ) : null}
      {panel === 'backfill' ? (
        <DataPanel title="补记历史记录" drawer busy={savingBackfill} onClose={() => setPanel(null)}>
          <p className="data-panel-note">关闭或切换类型会保留本页草稿；离开页面前会提示确认。</p>
          <label className="field">
            补记类型
            <select
              aria-label="补记类型"
              value={backfillKind}
              disabled={savingBackfill}
              onChange={(event) => setBackfillKind(event.target.value as 'action' | 'routine')}
            >
              <option value="action">行动记录{actionBackfillDirty ? ' · 有草稿' : ''}</option>
              <option value="routine">例行记录{routineBackfillDirty ? ' · 有草稿' : ''}</option>
            </select>
          </label>
          <button
            type="button"
            disabled={
              savingBackfill ||
              !(backfillKind === 'action' ? actionBackfillDirty : routineBackfillDirty)
            }
            onClick={() => setDiscardBackfill(true)}
          >
            清空当前草稿
          </button>
          {discardBackfill ? (
            <DataPanel title="放弃当前补记草稿" onClose={() => setDiscardBackfill(false)}>
              <p>当前类型的未保存内容将被清空，另一类型的草稿会保留。</p>
              <button type="button" onClick={() => setDiscardBackfill(false)}>
                继续补记
              </button>
              <button
                type="button"
                onClick={() => {
                  if (backfillKind === 'action') {
                    setActionDate('')
                    setActionDuration('')
                    setActionOutcome('partial')
                    setActionUnderstanding('')
                    setActionConfusion('')
                    setActionNextStep('')
                    setActionSummary('')
                    setActionNote('')
                  } else {
                    setRoutineDate('')
                    setRoutineDuration('')
                    setRoutineOutcome('not_done')
                    setRoutinePlanned(false)
                    setRoutineSummary('')
                    setRoutineNote('')
                  }
                  setError(null)
                  setBackfillMessage('已清空当前草稿，未保存记录。')
                  setDiscardBackfill(false)
                }}
              >
                放弃草稿
              </button>
            </DataPanel>
          ) : null}
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          {backfillMessage ? (
            <p className="success-message" role="status">
              {backfillMessage}
            </p>
          ) : null}
          {backfillKind === 'action' ? (
            <section className="data-backfill-form">
              <h2>补记行动记录</h2>
              {data && !data.actions.length ? (
                <p className="empty-copy">还没有可补记的行动，请先在今天或目标页创建行动。</p>
              ) : null}
              <fieldset
                className="backfill-fields"
                disabled={savingBackfill || !data?.actions.length}
              >
                <Field label="行动（必选）">
                  <select
                    aria-label="补记行动"
                    value={actionId}
                    onChange={(event) => setActionId(event.target.value)}
                  >
                    {data?.actions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title} · {actionStatusText[item.status]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="发生日期（必填）" hint="选择实际发生的本地日期。">
                  <input
                    aria-label="行动补记日期"
                    type="date"
                    value={actionDate}
                    onChange={(event) => setActionDate(event.target.value)}
                  />
                </Field>
                <Field
                  label="投入时长（分钟，可选）"
                  hint="留空表示时长未知；0 表示不足 1 分钟但确有行动。"
                >
                  <input
                    aria-label="行动补记分钟"
                    type="number"
                    min="0"
                    step="1"
                    value={actionDuration}
                    onChange={(event) => setActionDuration(event.target.value)}
                  />
                </Field>
                <Field label="本次结果（必填）">
                  <select
                    aria-label="行动补记结果"
                    value={actionOutcome}
                    onChange={(event) =>
                      setActionOutcome(event.target.value as ActionRecordDataDto['outcome'])
                    }
                  >
                    <option value="completed">本次达到预期</option>
                    <option value="partial">本次完成一部分</option>
                    <option value="stopped">本次在这里停下</option>
                  </select>
                </Field>
                <RecordSummaryInput value={actionSummary} onChange={setActionSummary} />
                <Field label="我理解了（可选）">
                  <input
                    aria-label="行动补记理解"
                    value={actionUnderstanding}
                    onChange={(event) => setActionUnderstanding(event.target.value)}
                    placeholder="写下已经确认的理解（可选）"
                  />
                </Field>
                <Field label="我仍困惑（可选）">
                  <input
                    aria-label="行动补记困惑"
                    value={actionConfusion}
                    onChange={(event) => setActionConfusion(event.target.value)}
                    placeholder="写下仍未解决的困惑（可选）"
                  />
                </Field>
                <Field
                  label="记录中的下一步（可选）"
                  hint="仅写入这条记录，不替换目标的当前下一步。"
                >
                  <input
                    aria-label="行动补记下一步"
                    value={actionNextStep}
                    onChange={(event) => setActionNextStep(event.target.value)}
                    placeholder="下一步（可选）"
                  />
                </Field>

                <RecordNoteInput label="行动补记备注" value={actionNote} onChange={setActionNote} />
                <button
                  className="primary-button"
                  type="button"
                  disabled={
                    savingBackfill ||
                    !actionId ||
                    !actionDate ||
                    Array.from(actionSummary).length > 500
                  }
                  onClick={() => void backfillAction()}
                >
                  补记行动记录
                </button>
                <button type="button" disabled={savingBackfill} onClick={() => setPanel(null)}>
                  取消行动补记
                </button>
              </fieldset>
            </section>
          ) : (
            <section className="data-backfill-form">
              <h2>补记例行记录</h2>
              {data && !data.routines.length ? (
                <p className="empty-copy">还没有可补记的例行，请先在例行页创建。</p>
              ) : null}
              <fieldset
                className="backfill-fields"
                disabled={savingBackfill || !data?.routines.length}
              >
                <Field label="例行（必选）">
                  <select
                    aria-label="补记例行"
                    value={routineId}
                    onChange={(event) => setRoutineId(event.target.value)}
                  >
                    {data?.routines.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · {goalStatusText[item.status]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="发生日期（必填）" hint="选择实际发生的本地日期。">
                  <input
                    aria-label="例行补记日期"
                    type="date"
                    value={routineDate}
                    onChange={(event) => setRoutineDate(event.target.value)}
                  />
                </Field>
                <Field label="本次结果（必填）">
                  <select
                    aria-label="例行补记结果"
                    value={routineOutcome}
                    onChange={(event) =>
                      setRoutineOutcome(event.target.value as RoutineRecordDataDto['outcome'])
                    }
                  >
                    <option value="target_met">达到目标</option>
                    <option value="acted">有所行动</option>
                    <option value="intentional_rest">主动休息</option>
                    <option value="not_done">未进行</option>
                  </select>
                </Field>
                <Field
                  label="投入时长（分钟，可选）"
                  hint="留空表示未记录时长；0 表示不足 1 分钟但确有行动。主动休息或未进行时不填写。"
                >
                  <input
                    aria-label="例行补记分钟"
                    type="number"
                    min="0"
                    step="1"
                    disabled={
                      routineOutcome === 'intentional_rest' || routineOutcome === 'not_done'
                    }
                    value={routineDuration}
                    onChange={(event) => setRoutineDuration(event.target.value)}
                  />
                </Field>
                <RecordSummaryInput value={routineSummary} onChange={setRoutineSummary} />
                <RecordNoteInput
                  label="例行补记备注"
                  value={routineNote}
                  onChange={setRoutineNote}
                />
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={routinePlanned}
                    onChange={(event) => setRoutinePlanned(event.target.checked)}
                  />
                  该历史日期当时属于计划日（请按当时实际安排确认）
                </label>
                <button
                  className="primary-button"
                  type="button"
                  disabled={
                    savingBackfill ||
                    !routineId ||
                    !routineDate ||
                    Array.from(routineSummary).length > 500
                  }
                  onClick={() => void backfillRoutine()}
                >
                  补记例行记录
                </button>
                <button type="button" disabled={savingBackfill} onClick={() => setPanel(null)}>
                  取消例行补记
                </button>
              </fieldset>
            </section>
          )}
        </DataPanel>
      ) : null}
      {panel === 'more' ? (
        <DataPanel title="删除目标、行动或例行" onClose={() => setPanel(null)}>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <h2>选择要永久删除的内容</h2>
          <p>暂停、结束或取消会保留历史；永久删除只适合确实不再需要的数据。</p>
          <div className="data-delete-picker">
            <label>
              内容类型
              <select
                value={deleteType}
                onChange={(event) => {
                  setDeleteType(event.target.value as 'goal' | 'action' | 'routine')
                  setDeleteId('')
                }}
              >
                <option value="goal">目标</option>
                <option value="action">行动</option>
                <option value="routine">例行</option>
              </select>
            </label>
            <label>
              选择内容
              <select
                value={effectiveDeleteId}
                onChange={(event) => setDeleteId(event.target.value)}
              >
                {deleteOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="danger-button"
              type="button"
              disabled={!effectiveDeleteId}
              onClick={() =>
                void requestDelete({ type: deleteType, id: effectiveDeleteId } as DeleteTargetDto)
              }
            >
              预览永久删除影响
            </button>
          </div>
        </DataPanel>
      ) : null}
      <div className="data-browser">
        <section className="goal-card data-history" aria-label="历史记录">
          <div className="card-heading">
            <h2>历史记录</h2>
            <button
              className="quiet-button"
              type="button"
              aria-disabled={readState === 'loading'}
              onClick={() => {
                if (readState !== 'loading') void load()
              }}
            >
              重新读取
            </button>
          </div>
          <div className="data-read-state">
            {readState === 'loading' ? (
              <p role="status">
                {data ? '正在重新读取；暂时显示上次读取的内容。' : '正在读取记录…'}
              </p>
            ) : readState === 'error' ? (
              <div role="alert">
                <p>{readError}</p>
                {data ? <p>当前页面仍是上次读取的内容，可能不是最新结果。</p> : null}
              </div>
            ) : null}
            {data ? (
              <p className="data-history-count">
                {readState !== 'ready' ? '上次读取 · ' : ''}
                {history.length} 条 · 每页 8 条
              </p>
            ) : null}
          </div>
          <div className="data-history-search">
            <label htmlFor="history-keyword">查找保存的文字</label>
            <input
              id="history-keyword"
              ref={searchRef}
              type="search"
              value={searchInput}
              aria-describedby="history-search-scope"
              onCompositionStart={() => {
                composingSearch.current = true
              }}
              onCompositionEnd={(event) => {
                composingSearch.current = false
                applySearch(event.currentTarget.value)
              }}
              onChange={(event) => {
                setSearchInput(event.target.value)
                if (!composingSearch.current) applySearch(event.target.value)
              }}
            />
            <div className="data-fact-actions">
              <button
                type="button"
                className="quiet-button"
                onClick={() => setPanel('search-scope')}
              >
                搜索范围
              </button>
              <button type="button" className="quiet-button" onClick={clearSearch}>
                清除搜索
              </button>
              <button
                type="button"
                className="quiet-button"
                onClick={() => {
                  clearSearch()
                  setRecordKind('all')
                  setRecordGoalId('all')
                  setRecordDate('')
                }}
              >
                重置全部条件
              </button>
            </div>
            <p id="history-search-scope">搜索全部已保存记录，与日期、类型、目标筛选共同生效。</p>
            {panel === 'search-scope' ? (
              <DataPanel title="搜索范围" onClose={() => setPanel(null)}>
                <p>按原文片段查找，忽略大小写；不使用通配符。</p>
                <p>
                  包含行动标题、例行名称、简述、备注、行动记录下一步、关联理解、困惑与解决说明（含已撤销/已解决）。
                </p>
                <p>标题、文字与状态均以当前保存内容为准，不还原旧版本或已删除文字。</p>
              </DataPanel>
            ) : null}
          </div>
          <button className="data-filter-entry" type="button" onClick={() => setPanel('filters')}>
            筛选记录 ·{' '}
            {
              [recordKind !== 'all', recordGoalId !== 'all', Boolean(recordDate)].filter(Boolean)
                .length
            }{' '}
            项条件
          </button>
          {panel === 'filters' ? (
            <DataPanel title="筛选记录" onClose={() => setPanel(null)}>
              <div className="data-history-filters">
                <label>
                  记录类型
                  <select
                    value={recordKind}
                    onChange={(event) => {
                      setRecordKind(
                        event.target.value as 'all' | 'action-record' | 'routine-record'
                      )
                      setRouteRecord(null)
                      setHistoryPage(1)
                    }}
                  >
                    <option value="all">全部记录</option>
                    <option value="action-record">行动记录</option>
                    <option value="routine-record">例行记录</option>
                  </select>
                </label>
                <label>
                  关联目标
                  <select
                    value={recordGoalId}
                    onChange={(event) => {
                      setRecordGoalId(event.target.value)
                      setRouteRecord(null)
                      setHistoryPage(1)
                    }}
                  >
                    <option value="all">全部目标</option>
                    <option value="none">未关联目标</option>
                    {data?.goals.map((goal) => (
                      <option key={goal.id} value={goal.id}>
                        {goal.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  发生日期
                  <input
                    type="date"
                    value={recordDate}
                    onChange={(event) => {
                      setRecordDate(event.target.value)
                      setRouteRecord(null)
                      setHistoryPage(1)
                    }}
                  />
                </label>
                <button
                  className="quiet-button"
                  type="button"
                  onClick={() => {
                    setRecordKind('all')
                    setRecordGoalId('all')
                    setRecordDate('')
                    setRouteRecord(null)
                    setHistoryPage(1)
                  }}
                >
                  清除筛选
                </button>
              </div>
              <button type="button" onClick={() => setPanel(null)}>
                完成筛选
              </button>
            </DataPanel>
          ) : null}
          <div
            className="data-history-list"
            data-scroll-key="master"
            key={`${currentPage}-${recordKind}-${recordGoalId}-${recordDate}-${searchQuery.trim()}`}
          >
            {history.length ? (
              <table className="data-history-table">
                <caption className="visually-hidden">当前筛选范围内的历史记录</caption>
                <thead>
                  <tr>
                    <th scope="col">日期 / 类型</th>
                    <th scope="col">行动内容</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleHistory.map((row) => (
                    <tr
                      key={`${row.type}-${row.id}`}
                      className={
                        selectedRecord?.id === row.id && selectedRecord.type === row.type
                          ? 'selected'
                          : ''
                      }
                    >
                      <td>
                        <time dateTime={row.occurredOn}>{row.occurredOn}</time>
                        <small>{row.type === 'action-record' ? '行动记录' : '例行记录'}</small>
                      </td>
                      <td>
                        <button
                          className="data-history-row"
                          type="button"
                          aria-pressed={
                            selectedRecord?.type === row.type && selectedRecord.id === row.id
                          }
                          onClick={() => chooseRecord({ type: row.type, id: row.id })}
                        >
                          <strong>{row.objectName}</strong>
                          <small>
                            {row.goalId
                              ? (data?.goals.find((goal) => goal.id === row.goalId)?.title ??
                                '关联目标')
                              : '未关联目标'}
                          </small>
                          <small>
                            {row.type === 'action-record'
                              ? recordOutcomeText[row.outcome as ActionRecordDataDto['outcome']]
                              : routineRecordOutcomeText[
                                  row.outcome as RoutineRecordDataDto['outcome']
                                ]}{' '}
                            ·{' '}
                            {row.durationMinutes === null
                              ? '时长未记录'
                              : row.durationMinutes === 0
                                ? '少于 1 分钟'
                                : `${row.durationMinutes} 分钟`}
                          </small>
                          {row.matches.map((match, index) => (
                            <small className="data-search-match" key={index}>
                              <b>{match.label}</b>：{match.snippet}
                            </small>
                          ))}
                          <span className="data-row-open">查看记录 ›</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : readState === 'ready' ? (
              <p className="empty-copy">
                {data && !data.actionRecords.length && !data.routineRecords.length
                  ? '还没有保存的记录，可以先记一笔或补记。'
                  : searchQuery.trim()
                    ? '当前条件下没有匹配文字。试试其他关键词，或重置全部条件。'
                    : '当前筛选下没有记录。'}
              </p>
            ) : data ? (
              <p className="empty-copy">上次读取时没有匹配记录，当前结果尚未确认。</p>
            ) : null}
          </div>
          {history.length > 8 ? (
            <nav className="data-pagination" aria-label="历史记录分页">
              <button
                type="button"
                className="quiet-button"
                disabled={currentPage === 1}
                onClick={() => {
                  setRouteRecord(null)
                  setHistoryPage(currentPage - 1)
                }}
              >
                上一页
              </button>
              <span aria-live="polite">
                第 {currentPage} / {pageCount} 页
              </span>
              <button
                type="button"
                className="quiet-button"
                disabled={currentPage === pageCount}
                onClick={() => {
                  setRouteRecord(null)
                  setHistoryPage(currentPage + 1)
                }}
              >
                下一页
              </button>
            </nav>
          ) : null}
        </section>

        <DataDraftContext value={recordDrafts}>
          <section
            ref={selectedRecordRef}
            className="selected-data-record"
            data-scroll-key="detail"
            aria-label="所选记录"
          >
            {pendingSelection ? (
              <div className="data-switch-warning" role="alert">
                <p>当前记录有未保存的修改。先保存，或放弃修改后切换。</p>
                <div className="data-fact-actions">
                  <button type="button" onClick={() => setPendingSelection(null)}>
                    继续编辑当前记录
                  </button>
                  <button
                    type="button"
                    className="quiet-button"
                    onClick={() => applySelection(pendingSelection)}
                  >
                    放弃修改并切换
                  </button>
                </div>
              </div>
            ) : null}
            {selectedActionRecord ? (
              <>
                <ActionRecordEditor
                  key={selectedActionRecord.id}
                  record={selectedActionRecord}
                  objectName={
                    data?.actions.find((action) => action.id === selectedActionRecord.actionId)
                      ?.title ?? '行动记录'
                  }
                  onChanged={refreshAfterMutation}
                  onDelete={requestDelete}
                />
                <details className="selected-record-facts">
                  <summary>理解与困惑</summary>
                  <p className="data-facts-note">每条内容单独保存，不会改动上方的行动记录。</p>
                  <ul className="data-facts">
                    {data?.understandings
                      .filter((fact) => fact.actionRecordId === selectedActionRecord.id)
                      .map((fact) => (
                        <UnderstandingEditor
                          key={fact.id}
                          fact={fact}
                          onChanged={refreshAfterMutation}
                        />
                      ))}
                    {data?.confusions
                      .filter((fact) => fact.actionRecordId === selectedActionRecord.id)
                      .map((fact) => (
                        <ConfusionEditor
                          key={fact.id}
                          fact={fact}
                          onChanged={refreshAfterMutation}
                        />
                      ))}
                  </ul>
                  {!data?.understandings.some(
                    (fact) => fact.actionRecordId === selectedActionRecord.id
                  ) &&
                  !data?.confusions.some(
                    (fact) => fact.actionRecordId === selectedActionRecord.id
                  ) ? (
                    <p className="empty-copy">这条记录没有补充理解或困惑。</p>
                  ) : null}
                </details>
              </>
            ) : selectedRoutineRecord ? (
              <RoutineRecordEditor
                key={selectedRoutineRecord.id}
                record={selectedRoutineRecord}
                objectName={
                  data?.routines.find((routine) => routine.id === selectedRoutineRecord.routineId)
                    ?.name ?? '例行记录'
                }
                onChanged={refreshAfterMutation}
                onDelete={requestDelete}
              />
            ) : (
              <div className="data-detail-empty">
                <span aria-hidden="true">◷</span>
                <h2>{readState === 'ready' ? '当前没有匹配的记录' : '记录暂时不可用'}</h2>
                <p>
                  {readState === 'ready'
                    ? '可以调整筛选条件，或通过“补记记录”添加历史记录。'
                    : '读取成功后，可以在这里查看记录详情。'}
                </p>
                {recordKind !== 'all' || recordGoalId !== 'all' || recordDate ? (
                  <button
                    type="button"
                    onClick={() => {
                      setRecordKind('all')
                      setRecordGoalId('all')
                      setRecordDate('')
                      setRouteRecord(null)
                      setHistoryPage(1)
                    }}
                  >
                    清除筛选
                  </button>
                ) : null}
              </div>
            )}
          </section>
        </DataDraftContext>
      </div>

      {preview ? (
        <dialog
          ref={deleteDialogRef}
          className="confirmation-dialog"
          aria-modal="true"
          aria-labelledby="delete-preview-title"
          onCancel={(event) => {
            event.preventDefault()
            void cancelDelete()
          }}
        >
          <p className="eyebrow">永久删除影响预览</p>
          <h2 id="delete-preview-title">确认永久删除{previewName}</h2>
          <ul>
            {Object.entries(preview.counts)
              .filter(([, count]) => count > 0)
              .map(([key, count]) => (
                <li key={key}>
                  {impactLabels[key] ?? key}：{count}
                </li>
              ))}
          </ul>
          <p>以下内容会一并受到影响。若预览后数据发生变化，本次确认会被拒绝。</p>
          {deleteError ? <p role="alert">{deleteError}</p> : null}
          <div className="dialog-actions">
            <button type="button" autoFocus disabled={deleting} onClick={() => void cancelDelete()}>
              取消
            </button>
            <button
              className="danger-button"
              type="button"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              永久删除
            </button>
          </div>
        </dialog>
      ) : null}
    </section>
  )
}

export { DataControlWorkspace as DataControlPage }
