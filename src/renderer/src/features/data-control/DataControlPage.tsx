import { type ReactNode, useEffect, useState } from 'react'
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
import type { CompleteExportErrorCode } from '../../../../contracts/exports'

const dataControlErrorText: Record<DataControlErrorCode, string> = {
  validation: '请检查日期、时长和必填内容。',
  'not-found': '目标数据已不存在，请刷新后重试。',
  'invalid-transition': '该事实已经处于目标状态，未进行修改。',
  'record-already-exists': '这个 Routine 在所选日期已有记录。',
  'delete-preview-stale': '预览后数据发生变化；请重新预览。',
  'invalid-delete-preview': '该删除预览已失效；请重新预览。',
  'invariant-violation': '数据关系与预期不一致，操作已回滚。',
  'persistence-failed': '本地数据操作失败；没有提交部分修改。'
}

function ActionRecordEditor(props: {
  readonly record: ActionRecordDataDto
  readonly onChanged: () => Promise<void>
  readonly onDelete: (target: DeleteTargetDto) => Promise<void>
}): ReactNode {
  const [occurredOn, setOccurredOn] = useState(props.record.occurredOn)
  const [duration, setDuration] = useState(String(props.record.durationMinutes))
  const [outcome, setOutcome] = useState(props.record.outcome)
  const [nextStep, setNextStep] = useState(props.record.nextStep ?? '')
  const [note, setNote] = useState(props.record.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const submit = async (): Promise<void> => {
    const result = await window.myTracer.dataControl.updateActionRecord({
      recordId: props.record.id,
      occurredOn,
      durationMinutes: Number(duration),
      outcome,
      nextStep: nextStep || null,
      note: note || null
    })
    if (!result.ok) return setError(dataControlErrorText[result.error.code])
    setError(null)
    await props.onChanged()
  }
  return (
    <article className="data-record-card">
      <div className="data-record-heading">
        <strong>Action · {props.record.actionId}</strong>
        <button
          className="danger-button"
          type="button"
          onClick={() => void props.onDelete({ type: 'action-record', id: props.record.id })}
        >
          永久删除
        </button>
      </div>
      <div className="data-edit-grid">
        <input
          aria-label="Action 发生日期"
          type="date"
          value={occurredOn}
          onChange={(event) => setOccurredOn(event.target.value)}
        />
        <input
          aria-label="Action 分钟"
          type="number"
          min="0"
          step="1"
          value={duration}
          onChange={(event) => setDuration(event.target.value)}
        />
        <select
          aria-label="Action 结果"
          value={outcome}
          onChange={(event) => setOutcome(event.target.value as ActionRecordDataDto['outcome'])}
        >
          <option value="completed">达到预期</option>
          <option value="partial">完成一部分</option>
          <option value="stopped">停下</option>
        </select>
        <input
          aria-label="Action 备注"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="备注（可选）"
        />
        <input
          aria-label="Action 下一步"
          value={nextStep}
          onChange={(event) => setNextStep(event.target.value)}
          placeholder="下一步（可选）"
        />
        <button className="secondary-button" type="button" onClick={() => void submit()}>
          保存修改
        </button>
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </article>
  )
}

function RoutineRecordEditor(props: {
  readonly record: RoutineRecordDataDto
  readonly onChanged: () => Promise<void>
  readonly onDelete: (target: DeleteTargetDto) => Promise<void>
}): ReactNode {
  const [occurredOn, setOccurredOn] = useState(props.record.occurredOn)
  const [duration, setDuration] = useState(
    props.record.durationMinutes === null ? '' : String(props.record.durationMinutes)
  )
  const [outcome, setOutcome] = useState(props.record.outcome)
  const [planned, setPlanned] = useState(props.record.plannedForDate)
  const [note, setNote] = useState(props.record.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const dateChanged = occurredOn !== props.record.occurredOn
  const submit = async (): Promise<void> => {
    const result = await window.myTracer.dataControl.updateRoutineRecord({
      recordId: props.record.id,
      occurredOn,
      outcome,
      plannedForDate: dateChanged ? planned : undefined,
      durationMinutes: duration === '' ? null : Number(duration),
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
    await props.onChanged()
  }
  return (
    <article className="data-record-card">
      <div className="data-record-heading">
        <strong>Routine · {props.record.routineId}</strong>
        <span>
          {props.record.plannedForDateBasis === 'user_confirmed_history'
            ? '历史计划由用户确认'
            : '记录时 schedule 快照'}
        </span>
        <button
          className="danger-button"
          type="button"
          onClick={() => void props.onDelete({ type: 'routine-record', id: props.record.id })}
        >
          永久删除
        </button>
      </div>
      <div className="data-edit-grid">
        <input
          aria-label="Routine 发生日期"
          type="date"
          value={occurredOn}
          onChange={(event) => setOccurredOn(event.target.value)}
        />
        <select
          aria-label="Routine 结果"
          value={outcome}
          onChange={(event) => setOutcome(event.target.value as RoutineRecordDataDto['outcome'])}
        >
          <option value="target_met">达到目标</option>
          <option value="acted">有行动</option>
          <option value="intentional_rest">有意休息</option>
          <option value="not_done">明确未做</option>
        </select>
        <input
          aria-label="Routine 分钟"
          type="number"
          min="0"
          step="1"
          value={duration}
          onChange={(event) => setDuration(event.target.value)}
        />
        <input
          aria-label="Routine 备注"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="备注（可选）"
        />
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
        <button className="secondary-button" type="button" onClick={() => void submit()}>
          保存修改
        </button>
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </article>
  )
}

function UnderstandingEditor(props: {
  readonly fact: UnderstandingDataDto
  readonly onChanged: () => Promise<void>
}): ReactNode {
  const [text, setText] = useState(props.fact.text)
  const [error, setError] = useState<string | null>(null)
  const run = async (kind: 'update' | 'revoke'): Promise<void> => {
    const result =
      kind === 'update'
        ? await window.myTracer.dataControl.updateUnderstanding({ id: props.fact.id, text })
        : await window.myTracer.dataControl.revokeUnderstanding({ id: props.fact.id })
    if (!result.ok) return setError(dataControlErrorText[result.error.code])
    setError(null)
    await props.onChanged()
  }
  return (
    <li className={props.fact.revokedAt ? 'fact-revoked' : ''}>
      <input
        aria-label="Understanding 内容"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <button type="button" onClick={() => void run('update')}>
        修改
      </button>
      <button
        type="button"
        disabled={props.fact.revokedAt !== null}
        onClick={() => void run('revoke')}
      >
        撤销
      </button>
      {error ? <span role="alert">{error}</span> : null}
    </li>
  )
}

function ConfusionEditor(props: {
  readonly fact: ConfusionDataDto
  readonly onChanged: () => Promise<void>
}): ReactNode {
  const [text, setText] = useState(props.fact.text)
  const [resolution, setResolution] = useState(props.fact.resolution ?? '')
  const [error, setError] = useState<string | null>(null)
  const run = async (kind: 'update' | 'resolve' | 'reopen'): Promise<void> => {
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
    await props.onChanged()
  }
  return (
    <li>
      <input
        aria-label="Confusion 内容"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <button type="button" onClick={() => void run('update')}>
        修改
      </button>
      {props.fact.status === 'open' ? (
        <>
          <input
            aria-label="解决说明"
            value={resolution}
            onChange={(event) => setResolution(event.target.value)}
            placeholder="解决说明（可选）"
          />
          <button type="button" onClick={() => void run('resolve')}>
            标记解决
          </button>
        </>
      ) : (
        <button type="button" onClick={() => void run('reopen')}>
          重新打开
        </button>
      )}
      {error ? <span role="alert">{error}</span> : null}
    </li>
  )
}

function DataControlWorkspace(): ReactNode {
  const [data, setData] = useState<DataControlListDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<DeletePreviewDto | null>(null)
  const [actionId, setActionId] = useState('')
  const [routineId, setRoutineId] = useState('')
  const [actionDate, setActionDate] = useState('')
  const [actionDuration, setActionDuration] = useState('0')
  const [actionOutcome, setActionOutcome] = useState<ActionRecordDataDto['outcome']>('partial')
  const [actionUnderstanding, setActionUnderstanding] = useState('')
  const [actionConfusion, setActionConfusion] = useState('')
  const [actionNextStep, setActionNextStep] = useState('')
  const [actionNote, setActionNote] = useState('')
  const [routineDate, setRoutineDate] = useState('')
  const [routinePlanned, setRoutinePlanned] = useState(false)
  const [routineOutcome, setRoutineOutcome] = useState<RoutineRecordDataDto['outcome']>('not_done')
  const [routineDuration, setRoutineDuration] = useState('')
  const [routineNote, setRoutineNote] = useState('')
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const load = async (): Promise<void> => {
    const result = await window.myTracer.dataControl.list()
    if (!result.ok) return setError(dataControlErrorText[result.error.code])
    setData(result.value)
    setError(null)
    setActionId((current) => current || result.value.actions[0]?.id || '')
    setRoutineId((current) => current || result.value.routines[0]?.id || '')
  }
  const refreshAfterMutation = async (): Promise<void> => {
    await Promise.all([load(), window.myTracer.progress.get({}), window.myTracer.today.get({})])
  }
  useEffect(() => {
    let active = true
    void window.myTracer.dataControl.list().then((result) => {
      if (!active) return
      if (!result.ok) {
        setError(dataControlErrorText[result.error.code])
        return
      }
      setData(result.value)
      setActionId(result.value.actions[0]?.id ?? '')
      setRoutineId(result.value.routines[0]?.id ?? '')
      setError(null)
    })
    return () => {
      active = false
    }
  }, [])

  const requestDelete = async (target: DeleteTargetDto): Promise<void> => {
    const result = await window.myTracer.dataControl.previewDelete({ target })
    if (!result.ok) return setError(dataControlErrorText[result.error.code])
    setPreview(result.value)
    setError(null)
  }
  const cancelDelete = async (): Promise<void> => {
    if (!preview) return
    await window.myTracer.dataControl.cancelDelete({ previewId: preview.previewId })
    setPreview(null)
  }
  const confirmDelete = async (): Promise<void> => {
    if (!preview) return
    const result = await window.myTracer.dataControl.confirmDelete({
      previewId: preview.previewId,
      target: preview.target,
      confirmation: 'permanently-delete'
    })
    setPreview(null)
    if (!result.ok) return setError(dataControlErrorText[result.error.code])
    await refreshAfterMutation()
  }
  const backfillAction = async (): Promise<void> => {
    const result = await window.myTracer.dataControl.backfillActionRecord({
      actionId,
      occurredOn: actionDate,
      durationMinutes: Number(actionDuration),
      outcome: actionOutcome,
      understanding: actionUnderstanding || null,
      confusion: actionConfusion || null,
      nextStep: actionNextStep || null,
      note: actionNote || null
    })
    if (!result.ok) return setError(dataControlErrorText[result.error.code])
    setActionDate('')
    setActionUnderstanding('')
    setActionConfusion('')
    setActionNextStep('')
    setActionNote('')
    await refreshAfterMutation()
  }
  const backfillRoutine = async (): Promise<void> => {
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
      note: routineNote || null
    })
    if (!result.ok) return setError(dataControlErrorText[result.error.code])
    setRoutineDate('')
    setRoutineNote('')
    await window.myTracer.routines.getDayState({ routineId, localDate: routineDate })
    await refreshAfterMutation()
  }
  const generateExport = async (): Promise<void> => {
    setExporting(true)
    const result = await window.myTracer.exports.generate()
    setExporting(false)
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
  }
  const impactLabels: Record<string, string> = {
    goals: 'Goals',
    actions: 'Actions',
    routines: 'Routines',
    routineScheduleDays: 'Routine 排期',
    todaySelections: 'Today 选择',
    actionRecords: 'Action Records',
    routineRecords: 'Routine Records',
    understandings: 'Understandings',
    confusions: 'Confusions',
    reviewResults: 'Reviews',
    detachedRoutines: '解除关联的 Routines',
    detachedReviewResults: '解除关联的 Reviews',
    clearedCurrentNext: '清空的当前下一步'
  }

  return (
    <section className="data-workspace" aria-label="历史事实与数据控制">
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <section className="goal-card export-card">
        <h2>导出完整数据</h2>
        <p>导出会包含当前保留的核心事实和关系，并由你在系统保存对话框中选择位置。</p>
        <p>v0.1 目前只支持导出；尚不支持自动导入或一键恢复。</p>
        <button
          className="primary-button"
          type="button"
          disabled={exporting}
          onClick={() => void generateExport()}
        >
          {exporting ? '正在准备导出…' : '导出完整数据'}
        </button>
        {exportMessage ? <p role="status">{exportMessage}</p> : null}
      </section>
      <div className="data-backfill-grid">
        <section className="goal-card">
          <h2>补记 ActionRecord</h2>
          <select
            aria-label="补记 Action"
            value={actionId}
            onChange={(event) => setActionId(event.target.value)}
          >
            {data?.actions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title} · {item.status}
              </option>
            ))}
          </select>
          <input
            aria-label="Action 补记日期"
            type="date"
            value={actionDate}
            onChange={(event) => setActionDate(event.target.value)}
          />
          <input
            aria-label="Action 补记分钟"
            type="number"
            min="0"
            step="1"
            value={actionDuration}
            onChange={(event) => setActionDuration(event.target.value)}
          />
          <select
            aria-label="Action 补记结果"
            value={actionOutcome}
            onChange={(event) =>
              setActionOutcome(event.target.value as ActionRecordDataDto['outcome'])
            }
          >
            <option value="completed">达到预期</option>
            <option value="partial">完成一部分</option>
            <option value="stopped">停下</option>
          </select>
          <input
            aria-label="Action 补记理解"
            value={actionUnderstanding}
            onChange={(event) => setActionUnderstanding(event.target.value)}
            placeholder="确认理解（可选）"
          />
          <input
            aria-label="Action 补记困惑"
            value={actionConfusion}
            onChange={(event) => setActionConfusion(event.target.value)}
            placeholder="开放困惑（可选）"
          />
          <input
            aria-label="Action 补记下一步"
            value={actionNextStep}
            onChange={(event) => setActionNextStep(event.target.value)}
            placeholder="下一步（可选）"
          />
          <input
            aria-label="Action 补记备注"
            value={actionNote}
            onChange={(event) => setActionNote(event.target.value)}
            placeholder="备注（可选）"
          />
          <button
            className="primary-button"
            type="button"
            disabled={!actionId || !actionDate || actionDuration === ''}
            onClick={() => void backfillAction()}
          >
            补记 ActionRecord
          </button>
        </section>
        <section className="goal-card">
          <h2>补记 RoutineRecord</h2>
          <select
            aria-label="补记 Routine"
            value={routineId}
            onChange={(event) => setRoutineId(event.target.value)}
          >
            {data?.routines.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.status}
              </option>
            ))}
          </select>
          <input
            aria-label="Routine 补记日期"
            type="date"
            value={routineDate}
            onChange={(event) => setRoutineDate(event.target.value)}
          />
          <select
            aria-label="Routine 补记结果"
            value={routineOutcome}
            onChange={(event) =>
              setRoutineOutcome(event.target.value as RoutineRecordDataDto['outcome'])
            }
          >
            <option value="target_met">达到目标</option>
            <option value="acted">有行动</option>
            <option value="intentional_rest">有意休息</option>
            <option value="not_done">明确未做</option>
          </select>
          <input
            aria-label="Routine 补记分钟"
            type="number"
            min="0"
            step="1"
            disabled={routineOutcome === 'intentional_rest' || routineOutcome === 'not_done'}
            value={routineDuration}
            onChange={(event) => setRoutineDuration(event.target.value)}
          />
          <input
            aria-label="Routine 补记备注"
            value={routineNote}
            onChange={(event) => setRoutineNote(event.target.value)}
            placeholder="备注（可选）"
          />
          <label className="inline-check">
            <input
              type="checkbox"
              checked={routinePlanned}
              onChange={(event) => setRoutinePlanned(event.target.checked)}
            />
            明确确认该历史日期属于计划日
          </label>
          <button
            className="primary-button"
            type="button"
            disabled={!routineId || !routineDate}
            onClick={() => void backfillRoutine()}
          >
            补记 RoutineRecord
          </button>
        </section>
      </div>

      <section className="goal-card">
        <h2>删除父实体</h2>
        <div className="data-root-list">
          {data?.goals.map((item) => (
            <button
              key={item.id}
              className="danger-button"
              type="button"
              onClick={() => void requestDelete({ type: 'goal', id: item.id })}
            >
              删除 Goal：{item.title}
            </button>
          ))}
          {data?.actions.map((item) => (
            <button
              key={item.id}
              className="danger-button"
              type="button"
              onClick={() => void requestDelete({ type: 'action', id: item.id })}
            >
              删除 Action：{item.title}
            </button>
          ))}
          {data?.routines.map((item) => (
            <button
              key={item.id}
              className="danger-button"
              type="button"
              onClick={() => void requestDelete({ type: 'routine', id: item.id })}
            >
              删除 Routine：{item.name}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="progress-section-title">Action Records</h2>
        {data?.actionRecords.map((record) => (
          <ActionRecordEditor
            key={record.id}
            record={record}
            onChanged={refreshAfterMutation}
            onDelete={requestDelete}
          />
        ))}
      </section>
      <section>
        <h2 className="progress-section-title">Routine Records</h2>
        {data?.routineRecords.map((record) => (
          <RoutineRecordEditor
            key={record.id}
            record={record}
            onChanged={refreshAfterMutation}
            onDelete={requestDelete}
          />
        ))}
      </section>
      <section className="goal-card">
        <h2>Understandings</h2>
        <ul className="data-facts">
          {data?.understandings.map((fact) => (
            <UnderstandingEditor key={fact.id} fact={fact} onChanged={refreshAfterMutation} />
          ))}
        </ul>
      </section>
      <section className="goal-card">
        <h2>Confusions</h2>
        <ul className="data-facts">
          {data?.confusions.map((fact) => (
            <ConfusionEditor key={fact.id} fact={fact} onChanged={refreshAfterMutation} />
          ))}
        </ul>
      </section>

      {preview ? (
        <div className="modal-backdrop" role="presentation">
          <section
            className="confirmation-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-preview-title"
          >
            <p className="eyebrow">永久删除影响预览</p>
            <h2 id="delete-preview-title">确认删除 {preview.target.type}</h2>
            <ul>
              {Object.entries(preview.counts)
                .filter(([, count]) => count > 0)
                .map(([key, count]) => (
                  <li key={key}>
                    {impactLabels[key] ?? key}：{count}
                  </li>
                ))}
            </ul>
            <p>预览后若事实变化，确认会拒绝且不写入。暂停、结束或取消不是删除。</p>
            <div className="dialog-actions">
              <button type="button" onClick={() => void cancelDelete()}>
                取消
              </button>
              <button className="danger-button" type="button" onClick={() => void confirmDelete()}>
                永久删除
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  )
}

export { DataControlWorkspace as DataControlPage }
