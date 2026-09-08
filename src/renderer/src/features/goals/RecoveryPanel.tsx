import { factOutcomeText } from '../../app/ui-text'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import type { RecoveryActionDto, RecoveryContextDto } from '../../../../contracts/recovery'
import type { RoutineSummaryDto } from '../../../../contracts/routines'

type RecoveryDraft =
  | { readonly kind: 'pause-goal' | 'end-goal' }
  | { readonly kind: 'pause-routine' | 'end-routine'; readonly routine: RoutineSummaryDto }
  | {
      readonly kind: 'complete-action' | 'cancel-action' | 'reschedule-action'
      readonly action: RecoveryActionDto
    }
  | { readonly kind: 'set-current'; readonly action: RecoveryActionDto }
  | { readonly kind: 'create-current'; readonly title: string; readonly description: string | null }
  | { readonly kind: 'select-today'; readonly action: RecoveryActionDto }

const draftTitle: Record<RecoveryDraft['kind'], string> = {
  'pause-goal': '确认暂停目标',
  'end-goal': '确认结束目标',
  'pause-routine': '确认暂停例行',
  'end-routine': '确认结束例行',
  'complete-action': '确认完成行动',
  'cancel-action': '确认取消行动',
  'reschedule-action': '确认重新安排行动',
  'set-current': '确认设置当前下一步',
  'create-current': '确认创建并设置当前下一步',
  'select-today': '确认加入今天'
}

function draftDescription(draft: RecoveryDraft, context: RecoveryContextDto): string {
  switch (draft.kind) {
    case 'pause-goal':
      return `暂停“${context.goal.name}”；关联例行与已有历史保持原样。`
    case 'end-goal':
      return `结束“${context.goal.name}”；该状态不能恢复，关联例行与已有历史保持原样。`
    case 'pause-routine':
      return `暂停“${draft.routine.name}”；目标与已有历史保持原样。`
    case 'end-routine':
      return `结束“${draft.routine.name}”；该状态不能恢复，目标与已有历史保持原样。`
    case 'complete-action':
      return `完成“${draft.action.title}”${context.currentNextAction?.id === draft.action.id ? '，并清空当前下一步' : ''}。`
    case 'cancel-action':
      return `取消“${draft.action.title}”${context.currentNextAction?.id === draft.action.id ? '，并清空当前下一步' : ''}。`
    case 'reschedule-action':
      return `将“${draft.action.title}”标记为重新安排${context.currentNextAction?.id === draft.action.id ? '，并清空当前下一步' : ''}。`
    case 'set-current':
      return `把“${draft.action.title}”设为“${context.goal.name}”的当前下一步。`
    case 'create-current':
      return `创建“${draft.title}”，并在同一次保存中设为当前下一步；不会自动加入今天。`
    case 'select-today':
      return `把“${draft.action.title}”加入你操作时的今天。`
  }
}

export function RecoveryPanel(props: {
  readonly goalId: string
  readonly onClose: () => void
  readonly onMutation: () => Promise<void>
}): ReactNode {
  const [context, setContext] = useState<RecoveryContextDto | null>(null)
  const [routines, setRoutines] = useState<readonly RoutineSummaryDto[]>([])
  const [draft, setDraft] = useState<RecoveryDraft | null>(null)
  const [newActionTitle, setNewActionTitle] = useState('')
  const [newActionDescription, setNewActionDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const loadFacts = useCallback(async (): Promise<void> => {
    const [recoveryResult, routinesResult] = await Promise.all([
      window.myTracer.recovery.getContext({ goalId: props.goalId }),
      window.myTracer.routines.list({ status: null })
    ])
    if (!recoveryResult.ok) {
      setError(
        recoveryResult.error.code === 'not-found'
          ? '这个目标已不存在。'
          : '暂时无法读取恢复与整理事实。'
      )
      return
    }
    setContext(recoveryResult.value)
    setRoutines(
      routinesResult.ok
        ? routinesResult.value.filter((routine) => routine.goalId === props.goalId)
        : []
    )
    setError(routinesResult.ok ? null : '目标事实已刷新，但关联例行暂时无法读取。')
  }, [props.goalId])

  useEffect(() => {
    let active = true
    void Promise.all([
      window.myTracer.recovery.getContext({ goalId: props.goalId }),
      window.myTracer.routines.list({ status: null })
    ])
      .then(([recoveryResult, routinesResult]) => {
        if (!active) return
        if (!recoveryResult.ok) {
          setError(
            recoveryResult.error.code === 'not-found'
              ? '这个目标已不存在。'
              : '暂时无法读取恢复与整理事实。'
          )
          return
        }
        setContext(recoveryResult.value)
        setRoutines(
          routinesResult.ok
            ? routinesResult.value.filter((routine) => routine.goalId === props.goalId)
            : []
        )
        setError(routinesResult.ok ? null : '目标事实已刷新，但关联例行暂时无法读取。')
      })
      .catch(() => {
        if (active) setError('暂时无法读取恢复与整理事实。')
      })
    return () => {
      active = false
    }
  }, [props.goalId])

  const refreshAfterMutation = async (): Promise<void> => {
    await Promise.all([loadFacts(), props.onMutation()])
  }

  const confirmDraft = async (): Promise<void> => {
    if (!draft || !context) return
    const currentDraft = draft
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      let result: { readonly ok: boolean; readonly error?: { readonly code: string } }
      switch (currentDraft.kind) {
        case 'pause-goal':
          result = await window.myTracer.goals.pause({ goalId: context.goal.id })
          break
        case 'end-goal':
          result = await window.myTracer.goals.end({ goalId: context.goal.id })
          break
        case 'pause-routine':
          result = await window.myTracer.routines.pause({ routineId: currentDraft.routine.id })
          break
        case 'end-routine':
          result = await window.myTracer.routines.end({ routineId: currentDraft.routine.id })
          break
        case 'complete-action':
        case 'cancel-action':
        case 'reschedule-action': {
          const method = currentDraft.kind.replace('-action', '') as
            'complete' | 'cancel' | 'reschedule'
          result = await window.myTracer.actions[method]({
            actionId: currentDraft.action.id,
            currentNextResolution:
              context.currentNextAction?.id === currentDraft.action.id
                ? { kind: 'clear' }
                : undefined
          })
          break
        }
        case 'set-current':
          result = await window.myTracer.goals.setCurrentNextAction({
            goalId: context.goal.id,
            actionId: currentDraft.action.id
          })
          break
        case 'create-current':
          result = await window.myTracer.goals.createAndSetCurrentNextAction({
            goalId: context.goal.id,
            title: currentDraft.title,
            description: currentDraft.description
          })
          break
        case 'select-today':
          result = await window.myTracer.today.selectAction({ actionId: currentDraft.action.id })
          break
      }
      if (!result.ok) {
        setError(
          result.error?.code === 'validation'
            ? '请检查草稿内容。没有保存任何变化。'
            : '这次保存没有完成；请刷新事实后再试。'
        )
        return
      }
      setDraft(null)
      if (currentDraft.kind === 'create-current') {
        setNewActionTitle('')
        setNewActionDescription('')
      }
      if (currentDraft.kind === 'select-today') {
        const today = await window.myTracer.today.get({})
        setNotice(
          today.ok
            ? `已加入今天（${today.value.localDate}）。`
            : '已加入今天；日期事实将在下次刷新时显示。'
        )
      } else {
        setNotice('已保存，并重新读取了最新事实。')
      }
      await refreshAfterMutation()
    } catch {
      setError('这次保存没有完成；请刷新事实后再试。')
    } finally {
      setBusy(false)
    }
  }

  const createActionDraft = (): void => {
    if (!newActionTitle.trim()) {
      setError('请先写下一个小行动。')
      return
    }
    setError(null)
    setDraft({
      kind: 'create-current',
      title: newActionTitle,
      description: newActionDescription || null
    })
  }

  return (
    <article className="goal-card recovery-panel" aria-label="恢复与整理页面">
      <div className="detail-title-row">
        <div>
          <p className="eyebrow">恢复与整理</p>
          <h2>{context?.goal.name ?? '正在读取事实…'}</h2>
        </div>
        <button className="secondary-button" type="button" disabled={busy} onClick={props.onClose}>
          返回目标
        </button>
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="form-success" role="status">
          {notice}
        </p>
      ) : null}
      {context ? (
        <>
          <div className="recovery-fact">
            <span>距上次真实行动</span>
            <strong>
              {context.daysSinceLastRealAction === null
                ? '尚无真实行动'
                : `${context.daysSinceLastRealAction} 天`}
            </strong>
            <small>
              截至 {context.asOfLocalDate}
              {context.lastRealActionOn ? ` · 上次行动 ${context.lastRealActionOn}` : ''}
            </small>
          </div>

          <section className="related-section recovery-actions" aria-label="整理目标">
            <h3>整理仍重要的内容</h3>
            <p className="empty-copy">先形成草稿；确认前可以随时返回或取消。</p>
            <div className="lifecycle-actions">
              {context.goal.status === 'active' ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setDraft({ kind: 'pause-goal' })}
                >
                  暂停目标
                </button>
              ) : null}
              {context.goal.status !== 'ended' ? (
                <button
                  className="end-button"
                  type="button"
                  disabled={busy}
                  onClick={() => setDraft({ kind: 'end-goal' })}
                >
                  结束目标
                </button>
              ) : null}
            </div>
            {routines.map((routine) => (
              <div className="related-row recovery-operation-row" key={routine.id}>
                <span>{routine.name}</span>
                <small>
                  {routine.status === 'active'
                    ? '活跃'
                    : routine.status === 'paused'
                      ? '暂停'
                      : '结束'}
                </small>
                <div className="compact-actions">
                  {routine.status === 'active' ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setDraft({ kind: 'pause-routine', routine })}
                    >
                      暂停
                    </button>
                  ) : null}
                  {routine.status !== 'ended' ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setDraft({ kind: 'end-routine', routine })}
                    >
                      结束
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </section>

          <section className="related-section recovery-actions" aria-label="选择下一步">
            <h3>选择一个小行动</h3>
            {context.pendingActions.length ? (
              context.pendingActions.map((action) => (
                <div className="related-row recovery-operation-row" key={action.id}>
                  <span>{action.title}</span>
                  <small>
                    {action.id === context.currentNextAction?.id ? '当前下一步' : '待行动'}
                  </small>
                  <div className="compact-actions">
                    {context.goal.status === 'active' &&
                    action.id !== context.currentNextAction?.id ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setDraft({ kind: 'set-current', action })}
                      >
                        设为下一步
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setDraft({ kind: 'complete-action', action })}
                    >
                      完成
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setDraft({ kind: 'cancel-action', action })}
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setDraft({ kind: 'reschedule-action', action })}
                    >
                      重新安排
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="empty-copy">目前没有可继续的行动。</p>
            )}
            {context.goal.status === 'active' ? (
              <div className="recovery-create-action">
                <label>
                  新的小行动
                  <input
                    value={newActionTitle}
                    onChange={(event) => setNewActionTitle(event.target.value)}
                  />
                </label>
                <label>
                  说明（可选）
                  <textarea
                    rows={2}
                    value={newActionDescription}
                    onChange={(event) => setNewActionDescription(event.target.value)}
                  />
                </label>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={busy}
                  onClick={createActionDraft}
                >
                  创建并设为下一步
                </button>
              </div>
            ) : null}
            {context.goal.status === 'active' && context.currentNextAction ? (
              <button
                className="secondary-button"
                type="button"
                disabled={busy}
                onClick={() =>
                  setDraft({ kind: 'select-today', action: context.currentNextAction! })
                }
              >
                将当前下一步加入今天
              </button>
            ) : null}
          </section>

          <section className="related-section">
            <h3>此前真实行动</h3>
            {context.latestRealRecord ? (
              <div className="related-row">
                <span>
                  {context.latestRealRecord.title} ·{' '}
                  {context.latestRealRecord.durationMinutes === null
                    ? '未记录分钟'
                    : `${context.latestRealRecord.durationMinutes} 分钟`}
                </span>
                <small>
                  {context.latestRealRecord.occurredOn} ·{' '}
                  {factOutcomeText[context.latestRealRecord.outcome]}
                </small>
              </div>
            ) : (
              <p className="empty-copy">还没有真实行动记录。</p>
            )}
          </section>
          <section className="related-section">
            <h3>确认的理解</h3>
            {context.confirmedUnderstandings.length ? (
              context.confirmedUnderstandings.map((item) => (
                <div className="related-row" key={item.id}>
                  <span>{item.text}</span>
                </div>
              ))
            ) : (
              <p className="empty-copy">暂无已确认理解。</p>
            )}
          </section>
          <section className="related-section">
            <h3>开放困惑</h3>
            {context.openConfusions.length ? (
              context.openConfusions.map((item) => (
                <div className="related-row" key={item.id}>
                  <span>{item.text}</span>
                </div>
              ))
            ) : (
              <p className="empty-copy">暂无开放困惑。</p>
            )}
          </section>

          {draft ? (
            <div
              className="transition-confirmation"
              role="alertdialog"
              aria-labelledby="recovery-draft-title"
            >
              <div>
                <h3 id="recovery-draft-title">{draftTitle[draft.kind]}</h3>
                <p>{draftDescription(draft, context)}</p>
              </div>
              <div className="transition-confirmation-actions">
                <button type="button" autoFocus disabled={busy} onClick={() => void confirmDraft()}>
                  确认保存
                </button>
                <button type="button" disabled={busy} onClick={() => setDraft(null)}>
                  取消草稿
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </article>
  )
}
