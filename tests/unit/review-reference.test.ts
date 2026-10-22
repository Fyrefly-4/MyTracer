import { describe, expect, it } from 'vitest'
import {
  appendCitation,
  referenceState,
  reviewReferences,
  type ReviewReference
} from '../../src/renderer/src/features/review/review-reference'
import type { ReviewSummaryDto } from '../../src/contracts/review'

const selected: ReviewReference = {
  key: 'understanding:1',
  periodStartedOn: '2026-10-19',
  label: '一条理解',
  citation: '【一条理解】\n用户原文'
}
describe('explicit review references', () => {
  it('appends without rewriting whitespace and blocks the same literal citation twice', () => {
    const draft = '我自己的话。\n'
    const cited = appendCitation(draft, selected.citation)
    expect(cited).toBe(`${draft}\n\n${selected.citation}`)
    expect(appendCitation(cited, selected.citation)).toBe(cited)
  })
  it('distinguishes changed, missing, and other-period sources without altering the selection', () => {
    expect(referenceState(selected, [selected])).toBe('current')
    expect(referenceState(selected, [{ ...selected, citation: '新内容' }])).toBe('changed')
    expect(referenceState(selected, [])).toBe('missing')
    expect(referenceState(selected, [{ ...selected, periodStartedOn: '2026-10-26' }])).toBe(
      'missing'
    )
    expect(selected.citation).toBe('【一条理解】\n用户原文')
  })
  it('keeps action outcome and intentional rest factual, with distinct source identities', () => {
    const summary = {
      periodStartedOn: '2026-10-19',
      actionRecords: [
        {
          recordId: 'same',
          occurredOn: '2026-10-20',
          actionTitle: '读一页',
          durationMinutes: 2,
          outcome: 'partial'
        }
      ],
      routineRecords: [
        {
          recordId: 'same',
          occurredOn: '2026-10-20',
          routineName: '散步',
          outcome: 'intentional_rest',
          durationMinutes: null,
          note: '今天选择休息'
        }
      ],
      understandings: [],
      openConfusions: []
    } as unknown as ReviewSummaryDto
    const facts = reviewReferences(summary)
    expect(facts.map((fact) => fact.key)).toEqual(['action:same', 'routine:same'])
    expect(facts[0].citation).toContain('本次完成一部分')
    expect(facts[1].citation).toContain('主动休息\n今天选择休息')
    expect(facts[1].citation).not.toContain('失败')
  })
})
