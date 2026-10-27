import { factOutcomeText } from '../../app/ui-text'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import type { RecoveryActionDto, RecoveryContextDto } from '../../../../contracts/recovery'
import type { RoutineSummaryDto } from '../../../../contracts/routines'
import { revealStart, useUiSession, useUnsavedContent } from '../../app/ui-session'

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
  const session = useUiSession()
  const resumeRef = useRef<HTMLElement | null>(null)
  const [context, setContext] = useState<RecoveryContextDto | null>(null)
  const [routines, setRoutines] = useState<readonly RoutineSummaryDto[]>([])
  const [todayActionIds, setTodayActionIds] = useState<readonly string[]>([])
  const [draft, setDraft] = useState<RecoveryDraft | null>(null)
  const [newActionTitle, setNewActionTitle] = useState('')
  const [newActionDescription, setNewActionDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useUnsavedContent(
    `recovery-${props.goalId}`,
    Boolean(newActionTitle || newActionDescription || draft?.kind === 'create-current')
  )

  const loadFacts = useCallback(async (): Promise<void> => {
    const [recoveryResult, routinesResult, todayResult] = await Promise.all([
      window.myTracer.recovery.getContext({ goalId: props.goalId }),
      window.myTracer.routines.list({ status: null }),
      window.myTracer.today.get({})
    ])
    if (!recoveryResult.ok) {
      setError(
        recoveryResult.error.code === 'not-found'
          ? '这个目标已不存在。'
          : '暂时无法读取恢复与整理内容。'
      )
      return
    }
    setContext(recoveryResult.value)
    setRoutines(
      routinesResult.ok
        ? routinesResult.value.filter((routine) => routine.goalId === props.goalId)
        : []
    )
    setTodayActionIds(
      todayResult.ok
        ? [...todayResult.value.focuses, ...todayResult.value.intentions].map((action) => action.id)
        : []
    )
    setError(routinesResult.ok ? null : '目标内容已刷新，但关联例行暂时无法读取。')
  }, [props.goalId])

  useEffect(() => {
    let active = true
    void Promise.all([
      window.myTracer.recovery.getContext({ goalId: props.goalId }),
      window.myTracer.routines.list({ status: null }),
      window.myTracer.today.get({})
    ])
      .then(([recoveryResult, routinesResult, todayResult]) => {
        if (!active) return
        if (!recoveryResult.ok) {
          setError(
            recoveryResult.error.code === 'not-found'
              ? '这个目标已不存在。'
              : '暂时无法读取恢复与整理内容。'
          )
          return
        }
        setContext(recoveryResult.value)
        setRoutines(
          routinesResult.ok
            ? routinesResult.value.filter((routine) => routine.goalId === props.goalId)
            : []
        )
        setTodayActionIds(
          todayResult.ok
            ? [...todayResult.value.focuses, ...todayResult.value.intentions].map(
                (action) => action.id
              )
            : []
        )
        setError(routinesResult.ok ? null : '目标内容已刷新，但关联例行暂时无法读取。')
      })
      .catch(() => {
        if (active) setError('暂时无法读取恢复与整理内容。')
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
            : '这次保存没有完成；请刷新后再试。'
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
            : '已加入今天；日期会在下次刷新时显示。'
        )
        await refreshAfterMutation()
        session.openAction(currentDraft.action.id)
        return
      } else {
        setNotice('已保存，并重新读取了最新内容。')
      }
      await refreshAfterMutation()
      if (currentDraft.kind === 'create-current' || currentDraft.kind === 'set-current') {
        requestAnimationFrame(() => revealStart(resumeRef.current))
      }
    } catch {
      setError('这次保存没有完成；请刷新后再试。')
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
          <h2>{context?.goal.name ?? '正在读取…'}</h2>
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
          <section ref={resumeRef} className="recovery-resume-card" aria-label="从这里继续">
            <p className="eyebrow">从这里继续</p>
            <h3>{context.currentNextAction?.title ?? '先选一个很小的下一步'}</h3>
            <p>
              {context.currentNextAction
                ? '这是你上次为这个目标选定的当前下一步。'
                : '当前下一步仍由你决定，下面可以从已有行动中选择或新建。'}
            </p>
            {context.goal.status === 'active' && context.currentNextAction ? (
              todayActionIds.includes(context.currentNextAction.id) ? (
                <button
                  className="primary-button"
                  type="button"
                  disabled={busy}
                  onClick={() => session.openAction(context.currentNextAction!.id)}
                >
                  继续今天的行动
                </button>
              ) : (
                <button
                  className="primary-button"
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    setDraft({ kind: 'select-today', action: context.currentNextAction! })
                  }
                >
                  加入今天并继续
                </button>
              )
            ) : null}
          </section>

          <div className="recovery-fact">
            <span>最近记录到的行动</span>
            <strong>{context.lastRealActionOn ?? '还没有行动记录'}</strong>
            <small>
              截至 {context.asOfLocalDate}
              {context.daysSinceLastRealAction === null
                ? ''
                : context.daysSinceLastRealAction < 0
                  ? ' · 行动发生日期晚于截至日'
                  : ` · 相隔 ${context.daysSinceLastRealAction} 天`}
            </small>
          </div>

          <section className="related-section">
            <h3>上次做到哪里</h3>
            {context.latestRealRecord ? (
              <button
                className="related-record-button"
                type="button"
                onClick={() =>
                  session.openDataRecord(
                    {
                      type:
                        context.latestRealRecord!.kind === 'action'
                          ? 'action-record'
                          : 'routine-record',
                      id: context.latestRealRecord!.recordId
                    },
                    'goals'
                  )
                }
              >
                <span>
                  <strong>{context.latestRealRecord.title}</strong>
                  <small>
                    {context.latestRealRecord.occurredOn} ·{' '}
                    {factOutcomeText[context.latestRealRecord.outcome]}
                  </small>
                </span>
                <span>
                  {context.latestRealRecord.durationMinutes === null
                    ? '时长未记录'
                    : context.latestRealRecord.durationMinutes === 0
                      ? '少于 1 分钟'
                      : `${context.latestRealRecord.durationMinutes} 分钟`}
                  <small>查看完整记录</small>
                </span>
              </button>
            ) : (
              <p className="empty-copy">还没有行动记录，可以从一个很小的下一步重新开始。</p>
            )}
          </section>

          <div className="recovery-fact-columns">
            <section className="related-section">
              <h3>已经确认的理解</h3>
              {context.confirmedUnderstandings.length ? (
                context.confirmedUnderstandings.map((item) => (
                  <div className="related-row" key={item.id}>
                    <span>{item.text}</span>
                  </div>
                ))
              ) : (
                <p className="empty-copy">暂时没有已确认的理解。</p>
              )}
            </section>
            <section className="related-section">
              <h3>还没有解决的困惑</h3>
              {context.openConfusions.length ? (
                context.openConfusions.map((item) => (
                  <div className="related-row" key={item.id}>
                    <span>{item.text}</span>
                  </div>
                ))
              ) : (
                <p className="empty-copy">目前没有待处理的困惑。</p>
              )}
            </section>
          </div>

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
          </section>

          <details className="disclosure recovery-management">
            <summary>整理目标、行动与例行</summary>
            <p className="empty-copy">这些操作会先显示影响说明，由你确认后才保存。</p>
            <div className="lifecycle-actions">
              {context.goal.status === 'active' ? (
                <button
                  className="warning-button"
                  type="button"
                  disabled={busy}
                  onClick={() => setDraft({ kind: 'pause-goal' })}
                >
                  暂停目标
                </button>
              ) : null}
              {context.goal.status !== 'ended' ? (
                <button
                  className="danger-button"
                  type="button"
                  disabled={busy}
                  onClick={() => setDraft({ kind: 'end-goal' })}
                >
                  结束目标
                </button>
              ) : null}
            </div>
            {context.pendingActions.map((action) => (
              <div className="related-row recovery-operation-row" key={action.id}>
                <span>{action.title}</span>
                <small>待行动</small>
                <div className="compact-actions">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setDraft({ kind: 'complete-action', action })}
                  >
                    完成
                  </button>
                  <button
                    className="danger-button"
                    type="button"
                    disabled={busy}
                    onClick={() => setDraft({ kind: 'cancel-action', action })}
                  >
                    取消
                  </button>
                  <button
                    className="warning-button"
                    type="button"
                    disabled={busy}
                    onClick={() => setDraft({ kind: 'reschedule-action', action })}
                  >
                    重新安排
                  </button>
                </div>
              </div>
            ))}
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
                      className="warning-button"
                      type="button"
                      disabled={busy}
                      onClick={() => setDraft({ kind: 'pause-routine', routine })}
                    >
                      暂停
                    </button>
                  ) : null}
                  {routine.status !== 'ended' ? (
                    <button
                      className="danger-button"
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
          </details>

          {draft ? (
            <div
              className={`transition-confirmation ${
                draft.kind === 'end-goal' || draft.kind === 'end-routine'
                  ? 'is-danger'
                  : draft.kind.includes('pause') ||
                      draft.kind.includes('cancel') ||
                      draft.kind.includes('reschedule')
                    ? 'is-warning'
                    : ''
              }`}
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
