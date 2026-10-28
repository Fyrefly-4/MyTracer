export interface ThoughtDto {
  readonly id: string
  readonly occurredOn: string
  readonly text: string
  readonly createdAt: string
  readonly updatedAt: string
}
export const THOUGHT_CHANNELS = Object.freeze({
  list: 'thoughts:list',
  create: 'thoughts:create',
  update: 'thoughts:update',
  delete: 'thoughts:delete'
})
export type ThoughtResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false
      readonly error: {
        readonly code: 'validation' | 'conflict' | 'persistence-failed'
        readonly message: string
      }
    }
export interface ThoughtApi {
  list(input: { date: string }): Promise<ThoughtResult<readonly ThoughtDto[]>>
  create(input: {
    id: string
    occurredOn: string
    text: string
  }): Promise<ThoughtResult<ThoughtDto>>
  update(input: {
    id: string
    text: string
    expectedText: string
  }): Promise<ThoughtResult<ThoughtDto>>
  delete(input: { id: string; expectedText: string; confirmed: true }): Promise<ThoughtResult<null>>
}
