import { createLocalDate } from './local-date'

export type ActionRecordOutcome = 'completed' | 'partial' | 'stopped'

export interface ActionRecord {
  readonly id: string
  readonly actionId: string
  readonly occurredOn: string
  readonly durationMinutes: number
  readonly outcome: ActionRecordOutcome
  readonly nextStep: string | null
  readonly note: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface ManualUnderstanding {
  readonly id: string
  readonly actionRecordId: string
  readonly text: string
  readonly source: 'manual'
  readonly revokedAt: null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface OpenConfusion {
  readonly id: string
  readonly actionRecordId: string
  readonly text: string
  readonly status: 'open'
  readonly resolvedAt: null
  readonly resolution: null
  readonly createdAt: string
  readonly updatedAt: string
}

export type ActionRecordDomainErrorCode = 'validation'

export class ActionRecordDomainError extends Error {
  public constructor(
    readonly code: ActionRecordDomainErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'ActionRecordDomainError'
  }
}

function requiredText(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized) {
    throw new ActionRecordDomainError('validation', `${field} must not be blank.`)
  }
  return normalized
}

function optionalText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const normalized = value.trim()
  return normalized || null
}

export function createActionRecord(input: {
  readonly id: string
  readonly actionId: string
  readonly occurredOn: string
  readonly durationMinutes: number
  readonly outcome: ActionRecordOutcome
  readonly nextStep?: string | null
  readonly note?: string | null
  readonly now: string
}): ActionRecord {
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 0) {
    throw new ActionRecordDomainError(
      'validation',
      'Action duration must be a non-negative integer number of minutes.'
    )
  }
  if (!['completed', 'partial', 'stopped'].includes(input.outcome)) {
    throw new ActionRecordDomainError('validation', 'Action record outcome is invalid.')
  }

  let occurredOn: string
  try {
    occurredOn = createLocalDate(input.occurredOn)
  } catch {
    throw new ActionRecordDomainError('validation', 'Action occurrence date is invalid.')
  }

  return Object.freeze({
    id: requiredText(input.id, 'Action record id'),
    actionId: requiredText(input.actionId, 'Action id'),
    occurredOn,
    durationMinutes: input.durationMinutes,
    outcome: input.outcome,
    nextStep: optionalText(input.nextStep),
    note: optionalText(input.note),
    createdAt: input.now,
    updatedAt: input.now
  })
}

export function createManualUnderstanding(input: {
  readonly id: string
  readonly actionRecordId: string
  readonly text: string
  readonly now: string
}): ManualUnderstanding {
  return Object.freeze({
    id: requiredText(input.id, 'Understanding id'),
    actionRecordId: requiredText(input.actionRecordId, 'Action record id'),
    text: requiredText(input.text, 'Understanding text'),
    source: 'manual',
    revokedAt: null,
    createdAt: input.now,
    updatedAt: input.now
  })
}

export function createOpenConfusion(input: {
  readonly id: string
  readonly actionRecordId: string
  readonly text: string
  readonly now: string
}): OpenConfusion {
  return Object.freeze({
    id: requiredText(input.id, 'Confusion id'),
    actionRecordId: requiredText(input.actionRecordId, 'Action record id'),
    text: requiredText(input.text, 'Confusion text'),
    status: 'open',
    resolvedAt: null,
    resolution: null,
    createdAt: input.now,
    updatedAt: input.now
  })
}
