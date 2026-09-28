import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
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
import { revealStart, usePagePosition, useUiSession } from '../../app/ui-session'
import type { CompleteExportErrorCode } from '../../../../contracts/exports'

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

function ActionRecordEditor(props: {
  readonly objectName: string
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
        <strong>行动 · {props.objectName}</strong>
        <button
          className="danger-button"
          type="button"
          onClick={() => void props.onDelete({ type: 'action-record', id: props.record.id })}
        >
          永久删除
        </button>
      </div>
      <div className="data-edit-grid">
        <Field label="发生日期（必填）" hint="选择实际发生的本地日期。">
          <input
            aria-label="行动发生日期"
            type="date"
            value={occurredOn}
            onChange={(event) => setOccurredOn(event.target.value)}
          />
        </Field>
        <Field label="投入时长（分钟，必填）" hint="0 表示不足 1 分钟但确有行动。">
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
            onChange={(event) => setOutcome(event.target.value as ActionRecordDataDto['outcome'])}
          >
            <option value="completed">本次达到预期</option>
            <option value="partial">本次完成一部分</option>
            <option value="stopped">本次在这里停下</option>
          </select>
        </Field>
        <Field label="备注（可选）">
          <input
            aria-label="行动备注"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="备注（可选）"
          />
        </Field>
        <Field label="记录中的下一步（可选）" hint="仅写入这条记录，不替换目标的当前下一步。">
          <input
            aria-label="行动下一步"
            value={nextStep}
            onChange={(event) => setNextStep(event.target.value)}
            placeholder="下一步（可选）"
          />
        </Field>
        <button
          className="secondary-button"
          type="button"
          disabled={!occurredOn || duration === ''}
          onClick={() => void submit()}
        >
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
  readonly objectName: string
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
        <strong>例行 · {props.objectName}</strong>
        <span>
          {props.record.plannedForDateBasis === 'user_confirmed_history'
            ? '历史计划由用户确认'
            : '记录时的计划安排'}
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
        <Field label="发生日期（必填）" hint="选择实际发生的本地日期。">
          <input
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
        <Field label="备注（可选）">
          <input
            aria-label="例行备注"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="备注（可选）"
          />
        </Field>
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
        <button
          className="secondary-button"
          type="button"
          disabled={!occurredOn}
          onClick={() => void submit()}
        >
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
      <Field label="已确认的理解">
        <input
          aria-label="理解成果内容"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </Field>
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
      <Field label="困惑内容">
        <input
          aria-label="困惑内容"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </Field>
      <button type="button" onClick={() => void run('update')}>
        修改
      </button>
      {props.fact.status === 'open' ? (
        <>
          <Field label="解决说明（可选）">
            <input
              aria-label="解决说明"
              value={resolution}
              onChange={(event) => setResolution(event.target.value)}
              placeholder="解决说明（可选）"
            />
          </Field>
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

interface DataHistoryRow {
  readonly type: 'action-record' | 'routine-record'
  readonly id: string
  readonly objectName: string
  readonly goalId: string | null
  readonly occurredOn: string
  readonly createdAt: string
  readonly outcome: string
  readonly durationMinutes: number | null
}

function DataControlWorkspace(): ReactNode {
  const session = useUiSession()
  const [data, setData] = useState<DataControlListDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  usePagePosition('data', data !== null)
  const [backfillMessage, setBackfillMessage] = useState('')
  const [savingBackfill, setSavingBackfill] = useState(false)
  const [preview, setPreview] = useState<DeletePreviewDto | null>(null)
  const [previewName, setPreviewName] = useState('')
  const deleteDialogRef = useRef<HTMLDialogElement | null>(null)
  const deleteTriggerRef = useRef<HTMLElement | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [selectedRecord, setSelectedRecord] = useState(session.dataRecord)
  const [recordKind, setRecordKind] = useState<'all' | 'action-record' | 'routine-record'>('all')
  const [recordGoalId, setRecordGoalId] = useState('all')
  const [recordDate, setRecordDate] = useState('')
  const [deleteType, setDeleteType] = useState<'goal' | 'action' | 'routine'>('goal')
  const [deleteId, setDeleteId] = useState('')
  const selectedRecordRef = useRef<HTMLElement | null>(null)
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

  const history = useMemo<readonly DataHistoryRow[]>(() => {
    if (!data) return []
    const rows: DataHistoryRow[] = [
      ...data.actionRecords.map((record) => {
        const action = data.actions.find((item) => item.id === record.actionId)
        return {
          type: 'action-record' as const,
          id: record.id,
          objectName: action?.title ?? '已删除的行动',
          goalId: action?.goalId ?? null,
          occurredOn: record.occurredOn,
          createdAt: record.createdAt,
          outcome: record.outcome,
          durationMinutes: record.durationMinutes
        }
      }),
      ...data.routineRecords.map((record) => {
        const routine = data.routines.find((item) => item.id === record.routineId)
        return {
          type: 'routine-record' as const,
          id: record.id,
          objectName: routine?.name ?? '已删除的例行',
          goalId: routine?.goalId ?? null,
          occurredOn: record.occurredOn,
          createdAt: record.createdAt,
          outcome: record.outcome,
          durationMinutes: record.durationMinutes
        }
      })
    ]
    return rows
      .filter((row) => recordKind === 'all' || row.type === recordKind)
      .filter(
        (row) =>
          recordGoalId === 'all' ||
          (recordGoalId === 'none' ? row.goalId === null : row.goalId === recordGoalId)
      )
      .filter((row) => !recordDate || row.occurredOn === recordDate)
      .sort(
        (left, right) =>
          right.occurredOn.localeCompare(left.occurredOn) ||
          right.createdAt.localeCompare(left.createdAt)
      )
  }, [data, recordDate, recordGoalId, recordKind])

  const chooseRecord = (selection: NonNullable<typeof selectedRecord>): void => {
    setSelectedRecord(selection)
    session.selectDataRecord(selection)
    requestAnimationFrame(() => revealStart(selectedRecordRef.current))
  }

  const load = async (): Promise<void> => {
    const result = await window.myTracer.dataControl.list()
    if (!result.ok) return setError(dataControlErrorText[result.error.code])
    setData(result.value)
    setError(null)
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
      if (!exists) session.selectDataRecord(null)
      return exists ? current : null
    })
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

  useEffect(() => {
    if (!data || !selectedRecord) return
    const frame = requestAnimationFrame(() => revealStart(selectedRecordRef.current))
    return () => cancelAnimationFrame(frame)
  }, [data, selectedRecord])

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
        durationMinutes: Number(actionDuration),
        outcome: actionOutcome,
        understanding: actionUnderstanding || null,
        confusion: actionConfusion || null,
        nextStep: actionNextStep || null,
        note: actionNote || null
      })
      if (!result.ok) return setError(dataControlErrorText[result.error.code])
      setBackfillMessage(
        `已补记：${data?.actions.find((item) => item.id === actionId)?.title ?? '记录'} · ${actionDate}`
      )
      setActionDate('')
      setActionUnderstanding('')
      setActionConfusion('')
      setActionNextStep('')
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
        note: routineNote || null
      })
      if (!result.ok) return setError(dataControlErrorText[result.error.code])
      setBackfillMessage(
        `已补记：${data?.routines.find((item) => item.id === routineId)?.name ?? '记录'} · ${routineDate}`
      )
      setRoutineDate('')
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
  const selectedActionRecord =
    selectedRecord?.type === 'action-record'
      ? (data?.actionRecords.find((record) => record.id === selectedRecord.id) ?? null)
      : null
  const selectedRoutineRecord =
    selectedRecord?.type === 'routine-record'
      ? (data?.routineRecords.find((record) => record.id === selectedRecord.id) ?? null)
      : null
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
    detachedRoutines: '解除关联的例行',
    detachedReviewResults: '解除关联的复盘',
    clearedCurrentNext: '清空的当前下一步'
  }

  return (
    <section className="data-workspace" aria-label="历史记录与数据控制">
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <section className="goal-card data-history" aria-label="历史记录">
        <div className="card-heading">
          <p className="eyebrow">历史记录</p>
          <h2>先找到记录，再查看或修改</h2>
        </div>
        <div className="data-history-filters">
          <label>
            记录类型
            <select
              value={recordKind}
              onChange={(event) =>
                setRecordKind(event.target.value as 'all' | 'action-record' | 'routine-record')
              }
            >
              <option value="all">全部记录</option>
              <option value="action-record">行动记录</option>
              <option value="routine-record">例行记录</option>
            </select>
          </label>
          <label>
            关联目标
            <select value={recordGoalId} onChange={(event) => setRecordGoalId(event.target.value)}>
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
              onChange={(event) => setRecordDate(event.target.value)}
            />
          </label>
          <button
            className="quiet-button"
            type="button"
            onClick={() => {
              setRecordKind('all')
              setRecordGoalId('all')
              setRecordDate('')
            }}
          >
            清除筛选
          </button>
        </div>
        <div className="data-history-list">
          {history.length ? (
            history.map((row) => (
              <button
                className={
                  selectedRecord?.id === row.id ? 'data-history-row selected' : 'data-history-row'
                }
                type="button"
                key={`${row.type}-${row.id}`}
                aria-pressed={selectedRecord?.type === row.type && selectedRecord.id === row.id}
                onClick={() => chooseRecord({ type: row.type, id: row.id })}
              >
                <span>
                  <strong>{row.objectName}</strong>
                  <small>
                    {row.type === 'action-record' ? '行动记录' : '例行记录'} ·{' '}
                    {row.goalId
                      ? (data?.goals.find((goal) => goal.id === row.goalId)?.title ?? '关联目标')
                      : '未关联目标'}
                  </small>
                </span>
                <span>
                  <strong>{row.occurredOn}</strong>
                  <small>
                    {row.type === 'action-record'
                      ? recordOutcomeText[row.outcome as ActionRecordDataDto['outcome']]
                      : routineRecordOutcomeText[row.outcome as RoutineRecordDataDto['outcome']]}
                    {' · '}
                    {row.durationMinutes === null
                      ? '时长未记录'
                      : row.durationMinutes === 0
                        ? '少于 1 分钟'
                        : `${row.durationMinutes} 分钟`}
                  </small>
                </span>
              </button>
            ))
          ) : (
            <p className="empty-copy">当前筛选下没有记录。</p>
          )}
        </div>
      </section>

      <section ref={selectedRecordRef} className="selected-data-record" aria-label="所选记录">
        {selectedActionRecord ? (
          <>
            <ActionRecordEditor
              record={selectedActionRecord}
              objectName={
                data?.actions.find((action) => action.id === selectedActionRecord.actionId)
                  ?.title ?? '行动记录'
              }
              onChanged={refreshAfterMutation}
              onDelete={requestDelete}
            />
            <section className="goal-card selected-record-facts">
              <h2>这条记录中的理解与困惑</h2>
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
                    <ConfusionEditor key={fact.id} fact={fact} onChanged={refreshAfterMutation} />
                  ))}
              </ul>
              {!data?.understandings.some(
                (fact) => fact.actionRecordId === selectedActionRecord.id
              ) &&
              !data?.confusions.some((fact) => fact.actionRecordId === selectedActionRecord.id) ? (
                <p className="empty-copy">这条记录没有补充理解或困惑。</p>
              ) : null}
            </section>
          </>
        ) : selectedRoutineRecord ? (
          <RoutineRecordEditor
            record={selectedRoutineRecord}
            objectName={
              data?.routines.find((routine) => routine.id === selectedRoutineRecord.routineId)
                ?.name ?? '例行记录'
            }
            onChanged={refreshAfterMutation}
            onDelete={requestDelete}
          />
        ) : (
          <p className="empty-copy">从上方选择一条记录查看完整内容。</p>
        )}
      </section>

      <details className="goal-card data-tool export-card">
        <summary>导出数据</summary>
        <h2>导出完整数据</h2>
        <p>导出包含目标、行动、例行、记录及其关联状态，并由你选择保存位置。</p>
        <p>目前只支持导出；尚不支持自动导入或一键恢复。</p>
        <button
          className="primary-button"
          type="button"
          disabled={exporting}
          onClick={() => void generateExport()}
        >
          {exporting ? '正在准备导出…' : '导出完整数据'}
        </button>
        {exportMessage ? <p role="status">{exportMessage}</p> : null}
      </details>
      {backfillMessage ? (
        <p className="success-message" role="status">
          {backfillMessage}
        </p>
      ) : null}
      <details className="goal-card data-tool">
        <summary>补记历史记录</summary>
        <div className="data-backfill-grid">
          <section className="goal-card">
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
              <Field label="投入时长（分钟，必填）" hint="0 表示不足 1 分钟但确有行动。">
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
              <Field label="记录中的下一步（可选）" hint="仅写入这条记录，不替换目标的当前下一步。">
                <input
                  aria-label="行动补记下一步"
                  value={actionNextStep}
                  onChange={(event) => setActionNextStep(event.target.value)}
                  placeholder="下一步（可选）"
                />
              </Field>
              <Field label="备注（可选）">
                <input
                  aria-label="行动补记备注"
                  value={actionNote}
                  onChange={(event) => setActionNote(event.target.value)}
                  placeholder="备注（可选）"
                />
              </Field>
              <button
                className="primary-button"
                type="button"
                disabled={savingBackfill || !actionId || !actionDate || actionDuration === ''}
                onClick={() => void backfillAction()}
              >
                补记行动记录
              </button>
              <button
                type="button"
                disabled={savingBackfill}
                onClick={() => {
                  setActionDate('')
                  setActionDuration('0')
                  setActionOutcome('partial')
                  setActionUnderstanding('')
                  setActionConfusion('')
                  setActionNextStep('')
                  setActionNote('')
                  setBackfillMessage('已取消行动补记，未保存记录。')
                  setError(null)
                }}
              >
                取消行动补记
              </button>
            </fieldset>
          </section>
          <section className="goal-card">
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
                  disabled={routineOutcome === 'intentional_rest' || routineOutcome === 'not_done'}
                  value={routineDuration}
                  onChange={(event) => setRoutineDuration(event.target.value)}
                />
              </Field>
              <Field label="备注（可选）">
                <input
                  aria-label="例行补记备注"
                  value={routineNote}
                  onChange={(event) => setRoutineNote(event.target.value)}
                  placeholder="备注（可选）"
                />
              </Field>
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
                disabled={savingBackfill || !routineId || !routineDate}
                onClick={() => void backfillRoutine()}
              >
                补记例行记录
              </button>
              <button
                type="button"
                disabled={savingBackfill}
                onClick={() => {
                  setRoutineDate('')
                  setRoutineDuration('')
                  setRoutineOutcome('not_done')
                  setRoutinePlanned(false)
                  setRoutineNote('')
                  setBackfillMessage('已取消例行补记，未保存记录。')
                  setError(null)
                }}
              >
                取消例行补记
              </button>
            </fieldset>
          </section>
        </div>
      </details>

      <details className="goal-card data-tool destructive-tool">
        <summary>删除目标、行动或例行</summary>
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
            <select value={effectiveDeleteId} onChange={(event) => setDeleteId(event.target.value)}>
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
      </details>

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
