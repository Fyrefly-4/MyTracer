export type StartHelpActionRecordOutcome = 'completed' | 'partial' | 'stopped'

export interface StartHelpTextDto {
  readonly title: string
  readonly description?: string
}

export interface StartHelpGoalDto {
  readonly name: string
  readonly description?: string
}

export interface StartHelpRelevantRecordDto {
  readonly occurredOn: string
  readonly outcome: StartHelpActionRecordOutcome
  readonly durationMinutes: number
  readonly confirmedUnderstandings: readonly string[]
  readonly openConfusions: readonly string[]
  readonly nextStepCandidate?: string
}

export interface StartHelpRequestDto {
  readonly requestId: string
  readonly locale: string
  readonly userInput: string
  readonly goal: StartHelpGoalDto
  readonly action: StartHelpTextDto
  readonly currentNextAction?: StartHelpTextDto
  readonly recentRelevantRecords: readonly StartHelpRelevantRecordDto[]
}

/** T061-only request capture seam. It has no response, network, configuration, or write authority. */
export interface StartHelpRequestCapturePort {
  captureStartHelpRequest(request: StartHelpRequestDto): void
}
