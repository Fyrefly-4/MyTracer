import { thoughtDate, thoughtText, type Thought } from '../domain/thought'
import type { ClockPort } from './ports/clock'

export interface ThoughtRepository {
  list(date?: string): readonly Thought[]
  find(id: string): Thought | null
  insert(thought: Thought): void
  replace(thought: Thought): void
  remove(id: string): void
  transaction<T>(work: () => T): T
}
export class ThoughtConflict extends Error {}
export class ThoughtService {
  constructor(
    private readonly repository: ThoughtRepository,
    private readonly clock: ClockPort
  ) {}
  list(date: string): readonly Thought[] {
    return this.repository.list(thoughtDate(date))
  }
  create(input: { id: string; occurredOn: string; text: string }): Thought {
    const text = thoughtText(input.text)
    const occurredOn = thoughtDate(input.occurredOn)
    if (occurredOn > String(this.clock.snapshot().localDate))
      throw new TypeError('不能记录未来的想法。')
    return this.repository.transaction(() => {
      const existing = this.repository.find(input.id)
      if (existing) {
        if (existing.text === text && existing.occurredOn === occurredOn) return existing
        throw new ThoughtConflict('这次保存已经处理，请重新读取。')
      }
      const now = this.clock.snapshot().instant
      const thought = { id: input.id, text, occurredOn, createdAt: now, updatedAt: now }
      this.repository.insert(thought)
      return thought
    })
  }
  update(input: { id: string; text: string; expectedText: string }): Thought {
    const text = thoughtText(input.text)
    return this.repository.transaction(() => {
      const old = this.repository.find(input.id)
      if (!old) throw new ThoughtConflict('想法已不存在，请重新读取。')
      if (old.text === text) return old
      if (old.text !== input.expectedText)
        throw new ThoughtConflict('想法已变化，请重新读取后再修改。')
      const thought = { ...old, text, updatedAt: this.clock.snapshot().instant }
      this.repository.replace(thought)
      return thought
    })
  }
  delete(input: { id: string; expectedText: string; confirmed: true }): void {
    if (input.confirmed !== true) throw new TypeError('删除需要确认。')
    this.repository.transaction(() => {
      const old = this.repository.find(input.id)
      if (!old) return
      if (old.text !== input.expectedText)
        throw new ThoughtConflict('想法已变化，请重新查看再删除。')
      this.repository.remove(input.id)
    })
  }
}
