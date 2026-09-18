import { addLocalDateDays, createLocalDate, weekContaining } from './local-date'
import { differenceInLocalDateDays } from './recovery'
import { buildProgressView, type ProgressView } from './progress'

export interface GoalActivityFact {
  readonly goalId: string
  readonly lastRealActionOn: string | null
  readonly daysSinceLastRealAction: number | null
}

export function buildGoalActivity(
  asOfLocalDate: string,
  dates: readonly { readonly goalId: string; readonly lastRealActionOn: string | null }[]
) {
  const today = createLocalDate(asOfLocalDate)
  return Object.freeze({
    asOfLocalDate: today,
    goals: Object.freeze(
      dates.map((fact): GoalActivityFact =>
        Object.freeze({
          ...fact,
          daysSinceLastRealAction: fact.lastRealActionOn
            ? differenceInLocalDateDays(today, createLocalDate(fact.lastRealActionOn))
            : null
        })
      )
    )
  })
}

export function comparisonPeriods(asOfLocalDate: string) {
  const today = createLocalDate(asOfLocalDate)
  const week = weekContaining(today)
  return Object.freeze({
    asOfLocalDate: today,
    current: { from: week.monday, through: today },
    previous: {
      from: addLocalDateDays(week.monday, -7),
      through: addLocalDateDays(week.monday, -1)
    },
    currentWeekEndedOn: week.sunday
  })
}

export function buildWeekComparison(asOfLocalDate: string, progress: ProgressView) {
  const periods = comparisonPeriods(asOfLocalDate)
  const summarize = (period: { readonly from: string; readonly through: string }) => {
    const within = (record: { readonly occurredOn: string }) =>
      record.occurredOn >= period.from && record.occurredOn <= period.through
    const actions = progress.records.filter(within)
    const routines = progress.routineRecords.filter(within)
    const facts = buildProgressView(progress.filter, actions, routines)
    return Object.freeze({
      ...period,
      totalDurationMinutes: facts.totalDurationMinutes,
      realActionCount: facts.realActionCount,
      hasRecordedFacts: actions.length > 0 || routines.length > 0
    })
  }
  const current = summarize(periods.current)
  const previous = summarize(periods.previous)
  return Object.freeze({
    goalId: progress.filter.goalId,
    asOfLocalDate: periods.asOfLocalDate,
    currentWeekEndedOn: periods.currentWeekEndedOn,
    current,
    previous,
    difference: Object.freeze({
      totalDurationMinutes: current.totalDurationMinutes - previous.totalDurationMinutes,
      realActionCount: current.realActionCount - previous.realActionCount
    })
  })
}
