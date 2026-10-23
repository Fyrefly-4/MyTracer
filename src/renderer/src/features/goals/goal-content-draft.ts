export interface GoalContent {
  readonly id: string
  readonly name: string
  readonly description: string | null
}

export interface GoalContentSnapshot {
  readonly goalId: string
  readonly name: string
  readonly description: string
  readonly baselineName: string
  readonly baselineDescription: string
  readonly revision: number
  readonly generation: number
}

/** One renderer-session slot, exclusively for an existing goal's two content fields. */
export class GoalContentDraft {
  private value: GoalContentSnapshot | null = null
  private revision = 0
  private generation = 0
  private version = 0
  private listeners = new Set<() => void>()
  saveFailed = false
  savedVersion = 0
  lastSaved: (GoalContent & { generation: number }) | null = null
  private pending: GoalContentSnapshot | null = null
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  readonly getVersion = (): number => this.version
  private changed(): void {
    this.version++
    for (const listener of this.listeners) listener()
  }
  get saving(): boolean {
    return this.pending !== null
  }
  beginSave(): GoalContentSnapshot | null {
    if (!this.value || this.pending) return null
    this.saveFailed = false
    this.pending = this.value
    this.changed()
    return this.pending
  }
  finishSave(submitted: GoalContentSnapshot, success: boolean, accepted?: GoalContent): void {
    if (this.pending !== submitted) return
    if (success) {
      const content = accepted ?? {
        id: submitted.goalId,
        name: submitted.name,
        description: submitted.description
      }
      this.acknowledge(submitted, content)
      this.lastSaved = { ...content, generation: submitted.generation }
      this.savedVersion++
    }
    this.saveFailed = !success && this.value?.generation === submitted.generation
    this.pending = null
    this.changed()
  }

  get snapshot(): GoalContentSnapshot | null {
    return this.value
  }

  get dirty(): boolean {
    const value = this.value
    return Boolean(
      value &&
      (value.name !== value.baselineName || value.description !== value.baselineDescription)
    )
  }

  get retained(): boolean {
    return this.dirty || Boolean(this.pending && this.value?.generation === this.pending.generation)
  }

  read(goal: GoalContent, savedVersion = this.savedVersion): GoalContentSnapshot {
    if (this.value?.goalId === goal.id && (this.retained || savedVersion < this.savedVersion))
      return this.value
    if (this.value?.goalId !== goal.id && this.retained) {
      throw new Error('Resolve the existing goal content draft before switching')
    }
    this.value = {
      goalId: goal.id,
      name: goal.name,
      description: goal.description ?? '',
      baselineName: goal.name,
      baselineDescription: goal.description ?? '',
      revision: ++this.revision,
      generation: this.value?.goalId === goal.id ? this.value.generation : ++this.generation
    }
    return this.value
  }

  edit(goalId: string, field: 'name' | 'description', text: string): void {
    if (this.value?.goalId !== goalId) return
    this.value = { ...this.value, [field]: text, revision: ++this.revision }
    this.changed()
  }

  private acknowledge(submitted: GoalContentSnapshot, accepted: GoalContent): void {
    const current = this.value
    if (!current || current.goalId !== submitted.goalId) return
    // A newer slot for the same ID may have been loaded after an explicit discard.
    if (current.generation !== submitted.generation) return
    this.value = {
      ...current,
      ...(current.revision === submitted.revision
        ? { name: accepted.name, description: accepted.description ?? '' }
        : {}),
      baselineName: accepted.name,
      baselineDescription: accepted.description ?? ''
    }
  }

  discard(): void {
    this.value = null
    this.saveFailed = false
    ++this.revision
    ++this.generation
    this.changed()
  }
}
