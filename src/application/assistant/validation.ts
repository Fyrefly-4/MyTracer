import type {
  AssistantCandidatePayload,
  AssistantEntry,
  AssistantErrorCode,
  AssistantObjectRef,
  AssistantScope,
  AssistantToolCall
} from '../../contracts/assistant'
export class AssistantError extends Error {
  constructor(readonly code: AssistantErrorCode) {
    super(code)
  }
}
export function check(
  condition: unknown,
  code: AssistantErrorCode = 'validation'
): asserts condition {
  if (!condition) throw new AssistantError(code)
}
export function object(value: unknown): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value))
  return value as Record<string, unknown>
}
export function keys(value: Record<string, unknown>, allowed: string[]): void {
  check(Object.keys(value).every((k) => allowed.includes(k)))
}
export function text(value: unknown, max = 8000): string {
  check(typeof value === 'string' && value.trim().length > 0 && value.length <= max)
  return value
}
export function id(value: unknown): string {
  const result = text(value, 128)
  check(/^[a-zA-Z0-9_-]+$/.test(result))
  return result
}
export function revision(value: unknown): number {
  check(Number.isSafeInteger(value) && (value as number) >= 0)
  return value as number
}
export function ref(value: unknown): AssistantObjectRef {
  const v = object(value)
  keys(v, ['kind', 'id'])
  check(['goal', 'action', 'action-record', 'routine-record', 'review'].includes(String(v.kind)))
  return { kind: v.kind as AssistantObjectRef['kind'], id: id(v.id) }
}
export const refKey = (value: AssistantObjectRef): string => `${value.kind}:${value.id}`
export function date(value: unknown): string {
  const d = text(value, 10)
  check(
    /^\d{4}-\d{2}-\d{2}$/.test(d) &&
      !Number.isNaN(Date.parse(d)) &&
      new Date(d).toISOString().slice(0, 10) === d
  )
  return d
}
export function scope(value: unknown): AssistantScope {
  const v = object(value)
  keys(v, ['current', 'selectedObjects', 'goalId', 'dateRange'])
  check(Array.isArray(v.selectedObjects) && v.selectedObjects.length <= 50)
  const range = v.dateRange === undefined ? undefined : object(v.dateRange)
  if (range) keys(range, ['from', 'to'])
  const dateRange = range ? { from: date(range.from), to: date(range.to) } : undefined
  check(!dateRange || dateRange.from <= dateRange.to)
  return {
    current: ref(v.current),
    selectedObjects: v.selectedObjects.map(ref),
    ...(v.goalId === undefined ? {} : { goalId: id(v.goalId) }),
    ...(dateRange ? { dateRange } : {})
  }
}
export function entry(value: unknown): AssistantEntry {
  const v = object(value)
  keys(v, ['object', 'intent', 'editorText', 'editorRevision'])
  check(['organize', 'clarify', 'resume', 'review'].includes(String(v.intent)))
  check((v.editorText === undefined) === (v.editorRevision === undefined))
  return {
    object: ref(v.object),
    intent: v.intent as AssistantEntry['intent'],
    ...(v.editorText === undefined
      ? {}
      : { editorText: text(v.editorText, 12000), editorRevision: text(v.editorRevision, 128) })
  }
}
export function payload(value: unknown): AssistantCandidatePayload {
  const v = object(value)
  switch (v.kind) {
    case 'record-summary':
    case 'note-append':
      keys(v, ['kind', 'text'])
      return { kind: v.kind, text: text(v.text, v.kind === 'record-summary' ? 500 : 8000) }
    case 'action-create':
      keys(v, ['kind', 'title', 'description'])
      return {
        kind: v.kind,
        title: text(v.title, 200),
        ...(v.description === undefined ? {} : { description: text(v.description, 2000) })
      }
    case 'review-draft':
      keys(v, ['kind', 'confirmedProgress', 'mainObstacle', 'nextAdjustment'])
      return {
        kind: v.kind,
        confirmedProgress: text(v.confirmedProgress, 4000),
        mainObstacle: text(v.mainObstacle, 4000),
        nextAdjustment: text(v.nextAdjustment, 4000)
      }
    default:
      throw new AssistantError('validation')
  }
}
export function tool(value: unknown): AssistantToolCall {
  const v = object(value)
  switch (v.name) {
    case 'findRecords':
      keys(v, ['name', 'keyword', 'from', 'to'])
      return {
        name: v.name,
        ...(v.keyword === undefined ? {} : { keyword: text(v.keyword, 200) }),
        ...(v.from === undefined ? {} : { from: date(v.from) }),
        ...(v.to === undefined ? {} : { to: date(v.to) })
      }
    case 'readGoal':
      keys(v, ['name', 'goalId'])
      return { name: v.name, goalId: id(v.goalId) }
    case 'getStatistics':
      keys(v, ['name'])
      return { name: v.name }
    default:
      throw new AssistantError('validation')
  }
}
