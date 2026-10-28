import { createLocalDate } from './local-date'

/** A thought is complete when saved; it has no action, goal or workflow status. */
export interface Thought {
  readonly id: string
  readonly occurredOn: string
  readonly text: string
  readonly createdAt: string
  readonly updatedAt: string
}
export function thoughtText(text: string): string {
  if (typeof text !== 'string' || !text.trim()) throw new TypeError('想法不能为空。')
  return text.trim()
}
export function thoughtDate(date: string): string {
  return String(createLocalDate(date))
}
