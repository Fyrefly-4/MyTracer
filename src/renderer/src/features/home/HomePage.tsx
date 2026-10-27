import { recordDuration } from '../../app/ui-text'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { HomeOverviewDto, HomeRecordDto } from '../../../../contracts/home'
import type { GoalSummaryDto } from '../../../../contracts/goals'
import type { TodayViewDto } from '../../../../contracts/today'
import { usePagePosition, useUiSession } from '../../app/ui-session'
import { factOutcomeText, routineRecordOutcomeText } from '../../app/ui-text'
import { HomeRecordCalendar } from './HomeRecordCalendar'
import { goalCoverMark, readGoalCoverMark } from '../goals/goal-cover'
import type { HomeRecord } from './home-model'
import './home.css'

function presentRecord(record: HomeRecordDto): HomeRecord {
  return { ...record, outcomeText: factOutcomeText[record.outcome] }
}

interface HomeSnapshot {
  readonly goals: readonly GoalSummaryDto[] | null
  readonly data: HomeOverviewDto | null
  readonly today: TodayViewDto | null
  readonly errors: readonly string[]
}

export function HomePage(): ReactNode {
  const session = useUiSession()
  const [snapshot, setSnapshot] = useState<HomeSnapshot | null>(null)
  const [reload, setReload] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  usePagePosition('home', snapshot !== null)
  useEffect(() => {
    let active = true
    void Promise.allSettled([window.myTracer.home.get({}), window.myTracer.today.get({})]).then(
      ([data, today]) => {
        if (!active) return
        const errors: string[] = []
        const dataValue = data.status === 'fulfilled' && data.value.ok ? data.value.value : null
        const todayValue = today.status === 'fulfilled' && today.value.ok ? today.value.value : null
        const goalsValue = dataValue?.goals ?? null
        if (!goalsValue) errors.push('目标暂时无法读取')
        if (!dataValue) errors.push('历史记录暂时无法读取')
        if (!todayValue) errors.push('今天的日期与例行暂时无法读取')
        setSnapshot({ goals: goalsValue, data: dataValue, today: todayValue, errors })
        setRefreshing(false)
      }
    )
    return () => {
      active = false
    }
  }, [reload])
  // Reload when returning to the app, and across a local midnight while left open.
  useEffect(() => {
    let day = new Date().toDateString()
    let foregroundTimer: number | undefined
    const refresh = (): void => {
      window.clearTimeout(foregroundTimer)
      foregroundTimer = window.setTimeout(() => {
        setRefreshing(true)
        setReload((value) => value + 1)
      }, 100)
    }
    const visibility = (): void => {
      if (document.visibilityState === 'visible') refresh()
    }
    const timer = window.setInterval(() => {
      const next = new Date().toDateString()
      if (day !== next) {
        day = next
        refresh()
      }
    }, 60000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      window.clearInterval(timer)
      window.clearTimeout(foregroundTimer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [])
  const today = snapshot?.data?.localDate ?? snapshot?.today?.localDate
  const records = useMemo(
    () => snapshot?.data?.recentRecords.map(presentRecord) ?? [],
    [snapshot?.data]
  )
  const goals = snapshot?.data?.goals ?? []
  const latestByGoal = useMemo(() => {
    const latest = new Map<string, HomeRecord>()
    for (const record of snapshot?.data?.latestByGoal ?? [])
      if (record.goalId) latest.set(record.goalId, presentRecord(record))
    return latest
  }, [snapshot?.data])
  const actions = useMemo(
    () => new Map(snapshot?.data?.currentActions.map((action) => [action.id, action])),
    [snapshot?.data]
  )
  const activeGoals = snapshot?.data?.activeGoalCount ?? 0
  const routines = snapshot?.today?.plannedRoutines ?? []
  const recordDataAvailable = Boolean(snapshot?.data && today)
  const openRecord = (record: { id: string; type: 'action-record' | 'routine-record' }): void =>
    session.openDataRecord(record, 'home')

  return (
    <div
      className="home-page"
      data-scroll-key="overview"
      aria-busy={snapshot === null || refreshing}
    >
      <header className="home-welcome">
        <div>
          <p className="eyebrow">MyTracer · 个人记录</p>
          <h1>看看最近走到了哪里。</h1>
          <p className="home-intro">记下做过的事，也为下次留个线索。</p>
        </div>
        {today ? (
          <time className="home-date" dateTime={today}>
            <strong>{Number(today.slice(8))}</strong>
            {today.slice(0, 4)} 年 {Number(today.slice(5, 7))} 月
          </time>
        ) : null}
      </header>
      {!snapshot ? (
        <p role="status">正在读取本地近况…</p>
      ) : (
        <>
          {snapshot.errors.length ? (
            <div className="home-error" role="alert">
              <p>{snapshot.errors.join('；')}。其他入口仍可使用。</p>
              <button
                type="button"
                disabled={refreshing}
                onClick={() => {
                  setRefreshing(true)
                  setReload((value) => value + 1)
                }}
              >
                重新读取
              </button>
            </div>
          ) : null}
          <section aria-labelledby="home-goals-title">
            <div className="home-section-heading">
              <h2 id="home-goals-title">最近在推进</h2>
              {snapshot.goals ? <span>{activeGoals} 个活跃目标</span> : null}
              <button type="button" onClick={() => session.openSection('goals')}>
                查看所有目标 →
              </button>
            </div>
            {snapshot.goals ? (
              goals.length ? (
                <>
                  <div className="home-goals">
                    {goals.map((goal, position) => {
                      const record = latestByGoal.get(goal.id)
                      const candidate = goal.currentNextActionId
                        ? actions.get(goal.currentNextActionId)
                        : null
                      const next =
                        candidate?.goalId === goal.id && candidate.status === 'pending'
                          ? candidate
                          : null
                      return (
                        <article
                          className="home-goal"
                          key={goal.id}
                          aria-label={`${goal.name} 概览`}
                        >
                          <div className="home-goal-cover">
                            <span aria-hidden="true">
                              {goalCoverMark(position, readGoalCoverMark(goal.id))}
                            </span>
                            <small>活跃目标</small>
                          </div>
                          <div className="home-goal-body">
                            <h3>{goal.name}</h3>
                            <p className="home-goal-note">
                              {record ? (
                                <>
                                  <time dateTime={record.occurredOn}>{record.occurredOn}</time> ·{' '}
                                  {record.summary || `${record.title} · ${record.outcomeText}`}
                                </>
                              ) : recordDataAvailable ? (
                                '还没有这个目标的记录。'
                              ) : (
                                '最近记录暂时无法读取。'
                              )}
                            </p>
                            <div className="home-next">
                              <span>当前下一步</span>
                              <p>
                                {next?.title ??
                                  (snapshot.data ? '尚未设置下一步。' : '暂时无法读取。')}
                              </p>
                              <div className="home-goal-actions">
                                <button
                                  type="button"
                                  className="home-text-button"
                                  onClick={() => session.openGoal(goal.id)}
                                >
                                  查看目标 ↗
                                </button>
                                {next ? (
                                  <button
                                    type="button"
                                    onClick={() => session.openAction(next.id, 'home')}
                                  >
                                    去今天继续 →
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                  <p className="home-order-note">
                    按最近记录日期排列，同日按目标更新时间；最多展示 3 个活跃目标。
                  </p>
                </>
              ) : (
                <div className="home-empty">
                  <h3>
                    {snapshot.data?.totalGoalCount
                      ? '这里暂时没有活跃的目标。'
                      : '给想做的事留一页。'}
                  </h3>
                  <p>目标用来放方向和下一步；记录用来留下实际发生的事。</p>
                  <button type="button" onClick={() => session.openSection('goals')}>
                    {snapshot.data?.totalGoalCount ? '查看已有目标' : '＋ 留下一个目标'}
                  </button>
                  {snapshot.data?.totalGoalCount === 0 ? (
                    <>
                      <p>
                        只想记下刚才做的事？去“今天”点“记一笔”，无需先建目标。已有行动可接着记录，还没开始可用“新建行动”。
                      </p>
                      <button type="button" onClick={() => session.openSection('today')}>
                        去今天
                      </button>
                    </>
                  ) : null}
                </div>
              )
            ) : (
              <p className="home-muted">目标概览暂时不可用。</p>
            )}
          </section>
          <div className="home-below">
            {recordDataAvailable && today ? (
              <HomeRecordCalendar
                counts={snapshot.data!.calendarCounts}
                today={today}
                onOpenRecord={openRecord}
              />
            ) : (
              <section>
                <h2>留下的痕迹</h2>
                <p className="home-muted">记录暂时无法读取；不会将读取失败显示为没有记录。</p>
              </section>
            )}
            <section aria-labelledby="home-routines-title">
              <div className="home-section-heading">
                <h2 id="home-routines-title">日常的节奏</h2>
                <button type="button" onClick={() => session.openSection('routines')}>
                  查看例行 →
                </button>
              </div>
              <div className="home-routines">
                {snapshot.today ? (
                  routines.length ? (
                    routines.slice(0, 5).map((routine) => (
                      <div className="home-routine" key={routine.id}>
                        <span className="home-routine-mark" aria-hidden="true">
                          ↻
                        </span>
                        <div>
                          <strong>{routine.name}</strong>
                          <span>
                            {routine.record
                              ? routineRecordOutcomeText[routine.record.outcome]
                              : '今天尚未记录'}
                          </span>
                        </div>
                        <button type="button" onClick={() => session.openTodayRoutine(routine.id)}>
                          {routine.record ? '查看' : '去记录'}
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="home-muted">
                      今天没有安排例行。需要时，可以在“例行”里设置重复做的事。
                    </p>
                  )
                ) : (
                  <p className="home-muted">今天的例行暂时无法读取。</p>
                )}
              </div>
              {routines.length > 5 ? (
                <button
                  className="home-text-button"
                  type="button"
                  onClick={() => session.openSection('today')}
                >
                  查看今天全部 {routines.length} 项例行 →
                </button>
              ) : null}
              <p className="home-order-note">只展示今天安排的例行，记录不等于完成配额。</p>
            </section>
          </div>
          <section className="home-history" aria-labelledby="home-recent-title">
            <div className="home-section-heading">
              <h2 id="home-recent-title">最近的几笔</h2>
              <button type="button" onClick={() => session.openSection('progress')}>
                查看完整进展 →
              </button>
            </div>
            {recordDataAvailable ? (
              records.length ? (
                <div className="home-recent">
                  {records.slice(0, 3).map((record) => (
                    <button
                      key={`${record.type}:${record.id}`}
                      type="button"
                      onClick={() => openRecord(record)}
                    >
                      <time dateTime={record.occurredOn}>
                        {record.occurredOn}
                        {record.durationMinutes !== null
                          ? ` · ${recordDuration(record.durationMinutes)}`
                          : ''}
                      </time>
                      <strong>{record.title}</strong>
                      <span>
                        {record.summary || record.outcomeText}
                        {record.hasNote ? ' · 有笔记' : ''}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="home-muted">这里按日期留下最近的记录。</p>
              )
            ) : (
              <p className="home-muted">最近记录暂时无法读取。</p>
            )}
          </section>
        </>
      )}
    </div>
  )
}
