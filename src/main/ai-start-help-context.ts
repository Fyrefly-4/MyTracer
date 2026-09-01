import {
  AiContextSelector,
  AiStartHelpContextError,
  type ContextBudget
} from '../application/ai-start-help-context'
import type { ClockPort } from '../application/ports/clock'
import type { StartHelpRequestCapturePort } from '../application/ports/ai-start-help'
import type { StartHelpContextQueryPort } from '../application/ports/persistence'
import type { AiContextManifest } from '../application/ai-start-help-context'
import type { StartHelpRequestDto } from '../application/ports/ai-start-help'

export interface StartAiStartHelpContextInput {
  readonly actionId: string
  readonly locale: string
  readonly userInput: string
  readonly expectedActionUpdatedAt?: string
  readonly expectedGoalUpdatedAt?: string
}

export interface AiStartHelpContextCoordinatorDependencies {
  readonly contextQuery: StartHelpContextQueryPort
  readonly clock: ClockPort
  readonly contextBudget: ContextBudget
  readonly requestCapture: StartHelpRequestCapturePort
  readonly generateRequestId: () => string
}

export interface SelectedAiStartHelpContext {
  readonly requestDto: StartHelpRequestDto
  readonly manifest: AiContextManifest
  readonly expectedGoalUpdatedAt: string
  readonly expectedActionUpdatedAt: string
  readonly expectedCurrentNextActionId: string | null
  readonly understandingTargets: readonly {
    readonly recordId: string
    readonly actionTitle: string
    readonly occurredOn: string
  }[]
}

/** Main-only T061 boundary. Construction and ordinary queries never invoke the request capture. */
export class AiStartHelpContextCoordinator {
  private readonly selector: AiContextSelector

  public constructor(private readonly dependencies: AiStartHelpContextCoordinatorDependencies) {
    this.selector = new AiContextSelector(dependencies.contextBudget)
  }

  public start(input: StartAiStartHelpContextInput): SelectedAiStartHelpContext {
    const selectedFor = String(this.dependencies.clock.currentLocalDate())
    const snapshot = this.dependencies.contextQuery.queryStartHelpContext(
      input.actionId,
      selectedFor
    )
    const selected = this.selector.select({
      requestId: this.dependencies.generateRequestId(),
      locale: input.locale,
      userInput: input.userInput,
      expectedActionUpdatedAt: input.expectedActionUpdatedAt,
      expectedGoalUpdatedAt: input.expectedGoalUpdatedAt,
      snapshot
    })
    this.dependencies.requestCapture.captureStartHelpRequest(selected.requestDto)
    if (!snapshot.goal || !snapshot.action) {
      throw new AiStartHelpContextError('invalid-context', 'The Start Help context is invalid.')
    }
    const eligible = new Set(selected.manifest.eligibleUnderstandingTargetRecordIds)
    return Object.freeze({
      ...selected,
      expectedGoalUpdatedAt: snapshot.goal.updatedAt,
      expectedActionUpdatedAt: snapshot.action.updatedAt,
      expectedCurrentNextActionId: snapshot.goal.currentNextActionId,
      understandingTargets: Object.freeze(
        snapshot.records
          .filter((record) => eligible.has(record.id))
          .map((record) =>
            Object.freeze({
              recordId: record.id,
              actionTitle: record.actionTitle,
              occurredOn: record.occurredOn
            })
          )
      )
    })
  }
}
