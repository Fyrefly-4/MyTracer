const recordOutcomeText = {
  completed: '本次达到预期',
  partial: '本次完成一部分',
  stopped: '本次在这里停下'
}
const recordDuration = (value: number | null): string =>
  value === null ? '时长未记录' : value === 0 ? '少于 1 分钟' : `${value} 分钟`
import type { ReviewSummaryDto } from '../contracts/review'

export interface ReviewReference {
  readonly key: string
  readonly periodStartedOn: string
  readonly label: string
  readonly text: string
  readonly citation: string
}

export function reviewReferences(summary: ReviewSummaryDto): ReviewReference[] {
  const reference = (key: string, label: string, text: string): ReviewReference => ({
    key,
    periodStartedOn: summary.periodStartedOn,
    label,
    text,
    citation: `【${label}】\n${text}`
  })
  return [
    ...summary.actionRecords.map((record) =>
      reference(
        `action:${record.recordId}`,
        `${record.occurredOn} · 行动 · ${record.actionTitle}`,
        `${recordDuration(record.durationMinutes)} · ${recordOutcomeText[record.outcome]}`
      )
    ),
    ...summary.routineRecords.map((record) =>
      reference(
        `routine:${record.recordId}`,
        `${record.occurredOn} · 例行 · ${record.routineName}`,
        `${{ target_met: '达到目标', acted: '有所行动', intentional_rest: '主动休息', not_done: '未进行' }[record.outcome]}${record.durationMinutes === null ? '' : ` · ${recordDuration(record.durationMinutes)}`}${record.summary ? `\n简述：${record.summary}` : ''}${record.note ? `\n补充笔记：${record.note}` : ''}`
      )
    ),
    ...summary.understandings.map((fact) =>
      reference(
        `understanding:${fact.id}`,
        `${fact.occurredOn} · 理解 · ${fact.actionTitle}`,
        fact.text
      )
    ),
    ...summary.openConfusions.map((fact) =>
      reference(
        `confusion:${fact.id}`,
        `${fact.occurredOn} · 困惑 · ${fact.actionTitle}`,
        fact.text
      )
    )
  ]
}

export function referenceState(
  selected: ReviewReference,
  current: readonly ReviewReference[]
): 'current' | 'changed' | 'missing' {
  const match = current.find(
    (fact) => fact.key === selected.key && fact.periodStartedOn === selected.periodStartedOn
  )
  return !match ? 'missing' : match.citation === selected.citation ? 'current' : 'changed'
}

export function appendCitation(draft: string, citation: string): string {
  return draft.includes(citation) ? draft : `${draft}${draft ? '\n\n' : ''}${citation}`
}
