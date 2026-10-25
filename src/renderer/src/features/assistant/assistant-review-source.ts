import type { AssistantObjectRef } from '../../../../contracts/assistant'
import type { ReviewSummaryDto } from '../../../../contracts/review'
/** Select the saved owner of the one chosen fact; never widen to the entire fact browser. */
export function reviewAssistantSources(
  key: string,
  summary: ReviewSummaryDto
): readonly AssistantObjectRef[] {
  const [kind, id] = key.split(':')
  if (kind === 'action' && summary.actionRecords.some((record) => record.recordId === id))
    return [{ kind: 'action-record', id }]
  if (kind === 'routine' && summary.routineRecords.some((record) => record.recordId === id))
    return [{ kind: 'routine-record', id }]
  const fact =
    kind === 'understanding'
      ? summary.understandings.find((fact) => fact.id === id)
      : kind === 'confusion'
        ? summary.openConfusions.find((fact) => fact.id === id)
        : undefined
  return fact ? [{ kind: 'action-record', id: fact.actionRecordId }] : []
}
