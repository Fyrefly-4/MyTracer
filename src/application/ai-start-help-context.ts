import type {
  StartHelpRelevantRecordDto,
  StartHelpRequestDto,
  StartHelpTextDto
} from './ports/ai-start-help'
import type {
  StartHelpActionRecordFactPersistence,
  StartHelpContextQuerySnapshotPersistence
} from './ports/persistence'

export interface ContextBudget {
  readonly totalTextCharacters: number
}

export type AiContextSourceType =
  | 'user-input'
  | 'goal'
  | 'action'
  | 'current-next-action'
  | 'action-record'
  | 'understanding'
  | 'confusion'

export type AiContextExclusionReason = 'over-budget' | 'over-five-limit'

export interface AiContextFieldEntry {
  readonly sourceType: AiContextSourceType
  readonly sourceId: string
  readonly requestPath: string
  readonly originalCharacters: number
  readonly sentCharacters: number
  readonly truncated: boolean
  readonly exclusionReason?: AiContextExclusionReason
}

export interface AiContextManifest {
  readonly requestId: string
  readonly goalId: string
  readonly actionId: string
  readonly currentNextActionId?: string
  readonly selectedRecordIds: readonly string[]
  readonly eligibleUnderstandingTargetRecordIds: readonly string[]
  readonly fieldEntries: readonly AiContextFieldEntry[]
  readonly excludedCounts: {
    readonly otherGoals: number
    readonly unrelatedRecords: number
    readonly overFiveLimit: number
    readonly overBudget: number
  }
  readonly totalTextCharacters: number
  readonly budget: number
}

export interface SelectedStartHelpContext {
  readonly requestDto: StartHelpRequestDto
  readonly manifest: AiContextManifest
}

export interface SelectAiContextInput {
  readonly requestId: string
  readonly locale: string
  readonly userInput: string
  readonly expectedActionUpdatedAt?: string
  readonly expectedGoalUpdatedAt?: string
  readonly snapshot: StartHelpContextQuerySnapshotPersistence
}

export type AiStartHelpContextErrorCode =
  'validation' | 'not-found' | 'stale' | 'invalid-context' | 'context-too-large'

export class AiStartHelpContextError extends Error {
  public constructor(
    readonly code: AiStartHelpContextErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'AiStartHelpContextError'
  }
}

interface FieldSource {
  readonly sourceType: AiContextSourceType
  readonly sourceId: string
  readonly requestPath: string
}

function normalizeText(value: string): string {
  return value.replace(/\r\n?/g, '\n').trim()
}

function normalizeOptionalText(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined
  const normalized = normalizeText(value)
  return normalized.length > 0 ? normalized : undefined
}

function characterCount(value: string): number {
  return Array.from(value).length
}

function truncateToCharacters(value: string, length: number): string {
  return Array.from(value).slice(0, length).join('')
}

function compareRecords(
  left: StartHelpActionRecordFactPersistence,
  right: StartHelpActionRecordFactPersistence
): number {
  if (left.occurredOn !== right.occurredOn) return left.occurredOn > right.occurredOn ? -1 : 1
  if (left.createdAt !== right.createdAt) return left.createdAt > right.createdAt ? -1 : 1
  if (left.id === right.id) return 0
  return left.id < right.id ? -1 : 1
}

function assertIdentifier(value: string, label: string): string {
  const normalized = normalizeText(value)
  if (!normalized) throw new AiStartHelpContextError('validation', `${label} is required.`)
  return normalized
}

export class AiContextSelector {
  public constructor(private readonly contextBudget: ContextBudget) {
    if (
      !Number.isSafeInteger(contextBudget.totalTextCharacters) ||
      contextBudget.totalTextCharacters <= 0
    ) {
      throw new TypeError('ContextBudget.totalTextCharacters must be a positive safe integer.')
    }
  }

  public select(input: SelectAiContextInput): SelectedStartHelpContext {
    const requestId = assertIdentifier(input.requestId, 'A request ID')
    const locale = assertIdentifier(input.locale, 'A locale')
    const userInput = normalizeText(input.userInput)
    if (!userInput) {
      throw new AiStartHelpContextError('validation', 'Start Help input must not be blank.')
    }

    const { goal, action, todaySelection, currentNextAction } = input.snapshot
    if (!action) {
      throw new AiStartHelpContextError(
        'not-found',
        'The requested pending Today Action was not found.'
      )
    }
    if (!goal) {
      throw new AiStartHelpContextError('invalid-context', 'Start Help requires an active Goal.')
    }
    if (
      action.status !== 'pending' ||
      goal.status !== 'active' ||
      action.goalId !== goal.id ||
      !todaySelection ||
      todaySelection.actionId !== action.id
    ) {
      throw new AiStartHelpContextError('invalid-context', 'The Start Help context is invalid.')
    }
    if (
      input.expectedActionUpdatedAt !== undefined &&
      input.expectedActionUpdatedAt !== action.updatedAt
    ) {
      throw new AiStartHelpContextError('stale', 'The requested Action has changed.')
    }
    if (
      input.expectedGoalUpdatedAt !== undefined &&
      input.expectedGoalUpdatedAt !== goal.updatedAt
    ) {
      throw new AiStartHelpContextError('stale', 'The requested Goal has changed.')
    }

    const hasDifferentCurrentNext =
      goal.currentNextActionId !== null && goal.currentNextActionId !== action.id
    if (
      hasDifferentCurrentNext &&
      (!currentNextAction ||
        currentNextAction.id !== goal.currentNextActionId ||
        currentNextAction.goalId !== goal.id ||
        currentNextAction.status !== 'pending')
    ) {
      throw new AiStartHelpContextError('invalid-context', 'The current-next Action is invalid.')
    }
    if (!hasDifferentCurrentNext && currentNextAction) {
      throw new AiStartHelpContextError(
        'invalid-context',
        'The current-next Action was duplicated.'
      )
    }

    const goalName = normalizeText(goal.title)
    const actionTitle = normalizeText(action.title)
    if (!goalName || !actionTitle) {
      throw new AiStartHelpContextError('invalid-context', 'Mandatory context text is invalid.')
    }

    const entries: AiContextFieldEntry[] = []
    let remaining = this.contextBudget.totalTextCharacters
    let optionalBudgetExhausted = false

    const addMandatory = (value: string, source: FieldSource): string => {
      const length = characterCount(value)
      entries.push({
        ...source,
        originalCharacters: length,
        sentCharacters: length,
        truncated: false
      })
      remaining -= length
      return value
    }

    const mandatoryCharacters =
      characterCount(userInput) + characterCount(goalName) + characterCount(actionTitle)
    if (mandatoryCharacters > remaining) {
      throw new AiStartHelpContextError(
        'context-too-large',
        'Mandatory Start Help context exceeds the character budget.'
      )
    }

    addMandatory(userInput, {
      sourceType: 'user-input',
      sourceId: requestId,
      requestPath: 'userInput'
    })
    addMandatory(goalName, {
      sourceType: 'goal',
      sourceId: goal.id,
      requestPath: 'goal.name'
    })
    addMandatory(actionTitle, {
      sourceType: 'action',
      sourceId: action.id,
      requestPath: 'action.title'
    })

    const addOptional = (value: string | undefined, source: FieldSource): string | undefined => {
      if (value === undefined) return undefined
      const length = characterCount(value)
      if (optionalBudgetExhausted || remaining === 0) {
        entries.push({
          ...source,
          originalCharacters: length,
          sentCharacters: 0,
          truncated: false,
          exclusionReason: 'over-budget'
        })
        optionalBudgetExhausted = true
        return undefined
      }
      if (length <= remaining) {
        remaining -= length
        entries.push({
          ...source,
          originalCharacters: length,
          sentCharacters: length,
          truncated: false
        })
        return value
      }

      const truncated = truncateToCharacters(value, remaining)
      entries.push({
        ...source,
        originalCharacters: length,
        sentCharacters: characterCount(truncated),
        truncated: true
      })
      remaining = 0
      optionalBudgetExhausted = true
      return truncated
    }

    const currentNextTitle = currentNextAction
      ? addOptional(normalizeText(currentNextAction.title), {
          sourceType: 'current-next-action',
          sourceId: currentNextAction.id,
          requestPath: 'currentNextAction.title'
        })
      : undefined

    const goalDescription = addOptional(normalizeOptionalText(goal.description), {
      sourceType: 'goal',
      sourceId: goal.id,
      requestPath: 'goal.description'
    })
    const actionDescription = addOptional(normalizeOptionalText(action.description), {
      sourceType: 'action',
      sourceId: action.id,
      requestPath: 'action.description'
    })
    const currentNextDescription = currentNextAction
      ? addOptional(normalizeOptionalText(currentNextAction.description), {
          sourceType: 'current-next-action',
          sourceId: currentNextAction.id,
          requestPath: 'currentNextAction.description'
        })
      : undefined

    const sortedRecords = [...input.snapshot.records].sort(compareRecords)
    const limitedRecords = sortedRecords.slice(0, 5)
    const overFiveRecords = sortedRecords.slice(5)
    const selectedRecordIds: string[] = []
    const recentRelevantRecords: StartHelpRelevantRecordDto[] = []
    let overBudgetRecords = 0

    const excludeRecordFields = (
      record: StartHelpActionRecordFactPersistence,
      candidateIndex: number,
      reason: AiContextExclusionReason
    ): void => {
      const basePath = `recentRelevantRecords[${candidateIndex}]`
      const excluded = (
        value: string | null | undefined,
        sourceType: AiContextSourceType,
        sourceId: string,
        requestPath: string
      ): void => {
        const normalized = normalizeOptionalText(value)
        if (normalized === undefined) return
        entries.push({
          sourceType,
          sourceId,
          requestPath,
          originalCharacters: characterCount(normalized),
          sentCharacters: 0,
          truncated: false,
          exclusionReason: reason
        })
      }
      excluded(record.occurredOn, 'action-record', record.id, `${basePath}.occurredOn`)
      record.understandings.forEach((item, index) =>
        excluded(
          item.text,
          'understanding',
          item.id,
          `${basePath}.confirmedUnderstandings[${index}]`
        )
      )
      record.confusions.forEach((item, index) =>
        excluded(item.text, 'confusion', item.id, `${basePath}.openConfusions[${index}]`)
      )
      excluded(record.nextStep, 'action-record', record.id, `${basePath}.nextStepCandidate`)
    }

    limitedRecords.forEach((record, candidateIndex) => {
      if (optionalBudgetExhausted || remaining < characterCount(normalizeText(record.occurredOn))) {
        optionalBudgetExhausted = true
        overBudgetRecords += 1
        excludeRecordFields(record, candidateIndex, 'over-budget')
        return
      }

      const basePath = `recentRelevantRecords[${recentRelevantRecords.length}]`
      const occurredOn = addOptional(normalizeText(record.occurredOn), {
        sourceType: 'action-record',
        sourceId: record.id,
        requestPath: `${basePath}.occurredOn`
      })
      if (!occurredOn) {
        overBudgetRecords += 1
        return
      }

      const confirmedUnderstandings = record.understandings.flatMap((item, index) => {
        const included = addOptional(normalizeOptionalText(item.text), {
          sourceType: 'understanding',
          sourceId: item.id,
          requestPath: `${basePath}.confirmedUnderstandings[${index}]`
        })
        return included === undefined ? [] : [included]
      })
      const openConfusions = record.confusions.flatMap((item, index) => {
        const included = addOptional(normalizeOptionalText(item.text), {
          sourceType: 'confusion',
          sourceId: item.id,
          requestPath: `${basePath}.openConfusions[${index}]`
        })
        return included === undefined ? [] : [included]
      })
      const nextStepCandidate = addOptional(normalizeOptionalText(record.nextStep), {
        sourceType: 'action-record',
        sourceId: record.id,
        requestPath: `${basePath}.nextStepCandidate`
      })

      const dto: StartHelpRelevantRecordDto = {
        occurredOn,
        outcome: record.outcome,
        durationMinutes: record.durationMinutes,
        confirmedUnderstandings,
        openConfusions,
        ...(nextStepCandidate === undefined ? {} : { nextStepCandidate })
      }
      recentRelevantRecords.push(Object.freeze(dto))
      selectedRecordIds.push(record.id)
    })

    overFiveRecords.forEach((record, index) =>
      excludeRecordFields(record, 5 + index, 'over-five-limit')
    )

    const currentNextActionDto: StartHelpTextDto | undefined =
      currentNextAction && currentNextTitle
        ? Object.freeze({
            title: currentNextTitle,
            ...(currentNextDescription === undefined ? {} : { description: currentNextDescription })
          })
        : undefined

    const requestDto: StartHelpRequestDto = Object.freeze({
      requestId,
      locale,
      userInput,
      goal: Object.freeze({
        name: goalName,
        ...(goalDescription === undefined ? {} : { description: goalDescription })
      }),
      action: Object.freeze({
        title: actionTitle,
        ...(actionDescription === undefined ? {} : { description: actionDescription })
      }),
      ...(currentNextActionDto === undefined ? {} : { currentNextAction: currentNextActionDto }),
      recentRelevantRecords: Object.freeze(recentRelevantRecords)
    })

    const manifest: AiContextManifest = Object.freeze({
      requestId,
      goalId: goal.id,
      actionId: action.id,
      ...(currentNextActionDto === undefined ? {} : { currentNextActionId: currentNextAction!.id }),
      selectedRecordIds: Object.freeze(selectedRecordIds),
      eligibleUnderstandingTargetRecordIds: Object.freeze([...selectedRecordIds]),
      fieldEntries: Object.freeze(entries),
      excludedCounts: Object.freeze({
        otherGoals: 0,
        unrelatedRecords: 0,
        overFiveLimit: overFiveRecords.length,
        overBudget: overBudgetRecords
      }),
      totalTextCharacters: this.contextBudget.totalTextCharacters - remaining,
      budget: this.contextBudget.totalTextCharacters
    })

    return Object.freeze({ requestDto, manifest })
  }
}
