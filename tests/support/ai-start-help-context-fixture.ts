import type {
  ActionPersistenceRecord,
  ActionRecordPersistenceRecord,
  GoalPersistenceRecord,
  RepositoryPort,
  RoutinePersistenceRecord,
  RoutineRecordPersistenceRecord
} from '../../src/application/ports/persistence'

export const START_HELP_IDS = Object.freeze({
  goal: 'goal-current',
  action: 'action-opened',
  currentNextAction: 'action-current-next',
  otherGoal: 'goal-other',
  otherAction: 'action-other',
  noGoalAction: 'action-no-goal',
  terminalAction: 'action-terminal',
  routine: 'routine-current'
})

export const START_HELP_MARKERS = Object.freeze({
  allowedGoalName: '__allowed_goal_name__',
  allowedGoalDescription: '__allowed_goal_description__',
  allowedActionTitle: '__allowed_action_title__',
  allowedActionDescription: '__allowed_action_description__',
  allowedCurrentNextTitle: '__allowed_current_next_title__',
  allowedCurrentNextDescription: '__allowed_current_next_description__',
  allowedUnderstanding: '__allowed_understanding__',
  allowedConfusion: '__allowed_confusion__',
  allowedNextStep: '__allowed_next_step__',
  otherGoal: '__forbidden_other_goal__',
  otherAction: '__forbidden_other_action__',
  otherRecord: '__forbidden_other_record__',
  revokedUnderstanding: '__forbidden_revoked_understanding__',
  resolvedConfusion: '__forbidden_resolved_confusion__',
  routineRecord: '__forbidden_routine_record__',
  credential: '__forbidden_credential_marker__',
  diagnostics: '__forbidden_diagnostics_marker__',
  fullSnapshotExtra: '__forbidden_full_snapshot_extra__'
})

export const START_HELP_FORBIDDEN_MARKERS = Object.freeze([
  START_HELP_MARKERS.otherGoal,
  START_HELP_MARKERS.otherAction,
  START_HELP_MARKERS.otherRecord,
  START_HELP_MARKERS.revokedUnderstanding,
  START_HELP_MARKERS.resolvedConfusion,
  START_HELP_MARKERS.routineRecord,
  START_HELP_MARKERS.credential,
  START_HELP_MARKERS.diagnostics,
  START_HELP_MARKERS.fullSnapshotExtra
])

const instant = (day: number, minute = 0): string =>
  `2026-08-${String(day).padStart(2, '0')}T08:${String(minute).padStart(2, '0')}:00.000Z`

export interface StartHelpIsolationFixture {
  readonly selectedFor: string
  readonly actionUpdatedAt: string
  readonly goalUpdatedAt: string
  readonly relatedRecordIds: readonly string[]
}

export function seedStartHelpIsolationFixture(
  repository: RepositoryPort,
  selectedFor = '2026-08-31'
): StartHelpIsolationFixture {
  const goal: GoalPersistenceRecord = {
    id: START_HELP_IDS.goal,
    title: START_HELP_MARKERS.allowedGoalName,
    description: START_HELP_MARKERS.allowedGoalDescription,
    status: 'active',
    currentNextActionId: null,
    createdAt: instant(1),
    updatedAt: instant(20)
  }
  const action: ActionPersistenceRecord = {
    id: START_HELP_IDS.action,
    goalId: goal.id,
    title: START_HELP_MARKERS.allowedActionTitle,
    description: START_HELP_MARKERS.allowedActionDescription,
    status: 'pending',
    createdAt: instant(2),
    updatedAt: instant(21)
  }
  const currentNextAction: ActionPersistenceRecord = {
    id: START_HELP_IDS.currentNextAction,
    goalId: goal.id,
    title: START_HELP_MARKERS.allowedCurrentNextTitle,
    description: START_HELP_MARKERS.allowedCurrentNextDescription,
    status: 'pending',
    createdAt: instant(3),
    updatedAt: instant(3)
  }

  repository.saveGoal(goal)
  repository.saveAction(action)
  repository.saveAction(currentNextAction)
  const activeGoal = {
    ...goal,
    currentNextActionId: currentNextAction.id,
    updatedAt: instant(22)
  }
  repository.saveGoal(activeGoal)
  repository.createTodaySelection({
    actionId: action.id,
    selectedFor,
    kind: 'focus',
    selectedBy: 'user',
    createdAt: instant(31)
  })

  const relatedRecordIds: string[] = []
  for (let index = 0; index < 6; index += 1) {
    const sequence = index + 1
    const record: ActionRecordPersistenceRecord = {
      id: `record-related-${sequence}`,
      actionId: action.id,
      occurredOn: `2026-08-${String(31 - index).padStart(2, '0')}`,
      durationMinutes: sequence,
      outcome: index % 2 === 0 ? 'partial' : 'completed',
      nextStep: index === 0 ? START_HELP_MARKERS.allowedNextStep : `related-next-${sequence}`,
      note: `__forbidden_related_note_${sequence}__`,
      createdAt: instant(31 - index, sequence),
      updatedAt: instant(31 - index, sequence)
    }
    relatedRecordIds.push(record.id)
    repository.saveActionRecord(record)
    repository.saveUnderstanding({
      id: `understanding-related-${sequence}`,
      actionRecordId: record.id,
      text:
        index === 0 ? START_HELP_MARKERS.allowedUnderstanding : `related-understanding-${sequence}`,
      source: 'manual',
      revokedAt: null,
      createdAt: instant(31 - index, sequence + 10),
      updatedAt: instant(31 - index, sequence + 10)
    })
    repository.saveConfusion({
      id: `confusion-related-${sequence}`,
      actionRecordId: record.id,
      text: index === 0 ? START_HELP_MARKERS.allowedConfusion : `related-confusion-${sequence}`,
      status: 'open',
      resolvedAt: null,
      resolution: null,
      createdAt: instant(31 - index, sequence + 20),
      updatedAt: instant(31 - index, sequence + 20)
    })
  }

  repository.saveUnderstanding({
    id: 'understanding-revoked',
    actionRecordId: relatedRecordIds[0],
    text: START_HELP_MARKERS.revokedUnderstanding,
    source: 'manual',
    revokedAt: instant(31, 50),
    createdAt: instant(31, 40),
    updatedAt: instant(31, 50)
  })
  repository.saveConfusion({
    id: 'confusion-resolved',
    actionRecordId: relatedRecordIds[0],
    text: START_HELP_MARKERS.resolvedConfusion,
    status: 'resolved',
    resolvedAt: instant(31, 51),
    resolution: 'resolved',
    createdAt: instant(31, 41),
    updatedAt: instant(31, 51)
  })

  const otherGoal: GoalPersistenceRecord = {
    id: START_HELP_IDS.otherGoal,
    title: START_HELP_MARKERS.otherGoal,
    description: START_HELP_MARKERS.fullSnapshotExtra,
    status: 'active',
    currentNextActionId: null,
    createdAt: instant(4),
    updatedAt: instant(4)
  }
  const otherAction: ActionPersistenceRecord = {
    id: START_HELP_IDS.otherAction,
    goalId: otherGoal.id,
    title: START_HELP_MARKERS.otherAction,
    description: null,
    status: 'pending',
    createdAt: instant(5),
    updatedAt: instant(5)
  }
  repository.saveGoal(otherGoal)
  repository.saveAction(otherAction)
  repository.saveActionRecord({
    id: 'record-other',
    actionId: otherAction.id,
    occurredOn: selectedFor,
    durationMinutes: 99,
    outcome: 'completed',
    nextStep: START_HELP_MARKERS.otherRecord,
    note: START_HELP_MARKERS.diagnostics,
    createdAt: instant(31, 52),
    updatedAt: instant(31, 52)
  })

  repository.saveAction({
    id: START_HELP_IDS.noGoalAction,
    goalId: null,
    title: 'Independent Action',
    description: null,
    status: 'pending',
    createdAt: instant(6),
    updatedAt: instant(6)
  })
  repository.createTodaySelection({
    actionId: START_HELP_IDS.noGoalAction,
    selectedFor,
    kind: 'focus',
    selectedBy: 'user',
    createdAt: instant(31, 53)
  })
  repository.saveAction({
    id: START_HELP_IDS.terminalAction,
    goalId: goal.id,
    title: 'Completed Action',
    description: null,
    status: 'completed',
    createdAt: instant(7),
    updatedAt: instant(7)
  })
  repository.createTodaySelection({
    actionId: START_HELP_IDS.terminalAction,
    selectedFor,
    kind: 'focus',
    selectedBy: 'user',
    createdAt: instant(31, 54)
  })

  const routine: RoutinePersistenceRecord = {
    id: START_HELP_IDS.routine,
    goalId: goal.id,
    name: 'Routine',
    minimumAction: 'Minimum',
    description: null,
    status: 'active',
    createdAt: instant(8),
    updatedAt: instant(8)
  }
  const routineRecord: RoutineRecordPersistenceRecord = {
    id: 'routine-record-current',
    routineId: routine.id,
    occurredOn: selectedFor,
    outcome: 'acted',
    plannedForDate: true,
    plannedForDateBasis: 'schedule_at_recording',
    durationMinutes: 5,
    note: START_HELP_MARKERS.routineRecord,
    createdAt: instant(31, 55),
    updatedAt: instant(31, 55)
  }
  repository.saveRoutine(routine)
  repository.saveRoutineRecord(routineRecord)
  repository.saveReviewResult({
    id: 'review-result-current',
    periodStartedOn: '2026-08-31',
    confirmedProgress: START_HELP_MARKERS.fullSnapshotExtra,
    mainObstacle: 'Synthetic obstacle',
    nextAdjustment: 'Synthetic adjustment',
    goalId: goal.id,
    createdAt: instant(31, 56),
    updatedAt: instant(31, 56)
  })

  return Object.freeze({
    selectedFor,
    actionUpdatedAt: action.updatedAt,
    goalUpdatedAt: activeGoal.updatedAt,
    relatedRecordIds: Object.freeze(relatedRecordIds)
  })
}
