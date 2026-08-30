import {
  AiContextSelector,
  type ContextBudget,
  type SelectedStartHelpContext
} from '../application/ai-start-help-context'
import type { ClockPort } from '../application/ports/clock'
import type { StartHelpRequestCapturePort } from '../application/ports/ai-start-help'
import {
  asStartHelpContextQueryRepository,
  type RepositoryPort
} from '../application/ports/persistence'

export interface StartAiStartHelpContextInput {
  readonly actionId: string
  readonly locale: string
  readonly userInput: string
  readonly expectedActionUpdatedAt?: string
  readonly expectedGoalUpdatedAt?: string
}

export interface AiStartHelpContextCoordinatorDependencies {
  readonly repository: RepositoryPort
  readonly clock: ClockPort
  readonly contextBudget: ContextBudget
  readonly requestCapture: StartHelpRequestCapturePort
  readonly generateRequestId: () => string
}

/** Main-only T061 boundary. Construction and ordinary queries never invoke the request capture. */
export class AiStartHelpContextCoordinator {
  private readonly selector: AiContextSelector

  public constructor(private readonly dependencies: AiStartHelpContextCoordinatorDependencies) {
    this.selector = new AiContextSelector(dependencies.contextBudget)
  }

  public start(input: StartAiStartHelpContextInput): SelectedStartHelpContext {
    const selectedFor = String(this.dependencies.clock.currentLocalDate())
    const snapshot = asStartHelpContextQueryRepository(
      this.dependencies.repository
    ).queryStartHelpContext(input.actionId, selectedFor)
    const selected = this.selector.select({
      requestId: this.dependencies.generateRequestId(),
      locale: input.locale,
      userInput: input.userInput,
      expectedActionUpdatedAt: input.expectedActionUpdatedAt,
      expectedGoalUpdatedAt: input.expectedGoalUpdatedAt,
      snapshot
    })
    this.dependencies.requestCapture.captureStartHelpRequest(selected.requestDto)
    return selected
  }
}
