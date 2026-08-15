import { contextBridge, ipcRenderer } from 'electron'
import {
  GOAL_CHANNELS,
  type CreateGoalInputDto,
  type GoalDetailDto,
  type GoalIdInputDto,
  type GoalResult,
  type GoalSummaryDto,
  type ListGoalsInputDto,
  type SetGoalCurrentNextActionInputDto,
  type UpdateGoalDetailsInputDto
} from '../contracts/goals'
import { SHELL_STATUS_CHANNEL, type MyTracerApi, type ShellStatus } from '../contracts/shell'
import {
  ACTION_CHANNELS,
  type ActionDetailDto,
  type ActionIdInputDto,
  type ActionResult,
  type CreateActionInputDto,
  type TransitionActionInputDto,
  type UpdateActionDetailsInputDto
} from '../contracts/actions'
import { TODAY_CHANNELS, type GetTodayInputDto, type TodayViewDto } from '../contracts/today'
import {
  RECORD_CHANNELS,
  type ActionRecordDetailDto,
  type ActionRecordIdInputDto,
  type ActionRecordSummaryDto,
  type BeginActionRecordingDto,
  type BeginActionRecordingInputDto,
  type CancelActionRecordingInputDto,
  type ListActionRecordsInputDto,
  type RecordActionInputDto,
  type RecordActionValueDto,
  type RecordResult
} from '../contracts/records'
import {
  PROGRESS_CHANNELS,
  type GetProgressInputDto,
  type ProgressResult,
  type ProgressViewDto
} from '../contracts/progress'
import {
  ROUTINE_CHANNELS,
  type CreateRoutineInputDto,
  type ListRoutinesInputDto,
  type ReplaceRoutineScheduleInputDto,
  type RoutineDetailDto,
  type RoutineIdInputDto,
  type RoutineResult,
  type RoutineSummaryDto,
  type UpdateRoutineDetailsInputDto
} from '../contracts/routines'
import {
  ROUTINE_RECORD_CHANNELS,
  type BeginRoutineRecordingDto,
  type BeginRoutineRecordingInputDto,
  type CancelRoutineRecordingInputDto,
  type GetRoutineDayStateInputDto,
  type RecordRoutineInputDto,
  type RecordRoutineValueDto,
  type RoutineDayStateDto,
  type RoutineRecordResult
} from '../contracts/routine-records'

const api: MyTracerApi = Object.freeze({
  shell: Object.freeze({
    getStatus: (): Promise<ShellStatus> => ipcRenderer.invoke(SHELL_STATUS_CHANNEL)
  }),
  goals: Object.freeze({
    create: (input: CreateGoalInputDto): Promise<GoalResult<GoalDetailDto>> =>
      ipcRenderer.invoke(GOAL_CHANNELS.create, input),
    updateDetails: (input: UpdateGoalDetailsInputDto): Promise<GoalResult<GoalSummaryDto>> =>
      ipcRenderer.invoke(GOAL_CHANNELS.updateDetails, input),
    pause: (input: GoalIdInputDto): Promise<GoalResult<GoalSummaryDto>> =>
      ipcRenderer.invoke(GOAL_CHANNELS.pause, input),
    resume: (input: GoalIdInputDto): Promise<GoalResult<GoalSummaryDto>> =>
      ipcRenderer.invoke(GOAL_CHANNELS.resume, input),
    end: (input: GoalIdInputDto): Promise<GoalResult<GoalSummaryDto>> =>
      ipcRenderer.invoke(GOAL_CHANNELS.end, input),
    setCurrentNextAction: (
      input: SetGoalCurrentNextActionInputDto
    ): Promise<GoalResult<GoalSummaryDto>> =>
      ipcRenderer.invoke(GOAL_CHANNELS.setCurrentNextAction, input),
    list: (input: ListGoalsInputDto): Promise<GoalResult<readonly GoalSummaryDto[]>> =>
      ipcRenderer.invoke(GOAL_CHANNELS.list, input),
    getDetail: (input: GoalIdInputDto): Promise<GoalResult<GoalDetailDto>> =>
      ipcRenderer.invoke(GOAL_CHANNELS.getDetail, input)
  }),
  actions: Object.freeze({
    create: (input: CreateActionInputDto): Promise<ActionResult<ActionDetailDto>> =>
      ipcRenderer.invoke(ACTION_CHANNELS.create, input),
    updateDetails: (input: UpdateActionDetailsInputDto): Promise<ActionResult<ActionDetailDto>> =>
      ipcRenderer.invoke(ACTION_CHANNELS.updateDetails, input),
    complete: (input: TransitionActionInputDto): Promise<ActionResult<ActionDetailDto>> =>
      ipcRenderer.invoke(ACTION_CHANNELS.complete, input),
    cancel: (input: TransitionActionInputDto): Promise<ActionResult<ActionDetailDto>> =>
      ipcRenderer.invoke(ACTION_CHANNELS.cancel, input),
    reschedule: (input: TransitionActionInputDto): Promise<ActionResult<ActionDetailDto>> =>
      ipcRenderer.invoke(ACTION_CHANNELS.reschedule, input),
    getDetail: (input: ActionIdInputDto): Promise<ActionResult<ActionDetailDto>> =>
      ipcRenderer.invoke(ACTION_CHANNELS.getDetail, input)
  }),
  today: Object.freeze({
    selectAction: (input: ActionIdInputDto): Promise<ActionResult<ActionDetailDto>> =>
      ipcRenderer.invoke(TODAY_CHANNELS.selectAction, input),
    removeAction: (input: ActionIdInputDto): Promise<ActionResult<TodayViewDto>> =>
      ipcRenderer.invoke(TODAY_CHANNELS.removeAction, input),
    get: (input: GetTodayInputDto): Promise<ActionResult<TodayViewDto>> =>
      ipcRenderer.invoke(TODAY_CHANNELS.get, input)
  }),
  records: Object.freeze({
    begin: (input: BeginActionRecordingInputDto): Promise<RecordResult<BeginActionRecordingDto>> =>
      ipcRenderer.invoke(RECORD_CHANNELS.begin, input),
    cancel: (
      input: CancelActionRecordingInputDto
    ): Promise<RecordResult<{ readonly cancelled: true }>> =>
      ipcRenderer.invoke(RECORD_CHANNELS.cancel, input),
    record: (input: RecordActionInputDto): Promise<RecordResult<RecordActionValueDto>> =>
      ipcRenderer.invoke(RECORD_CHANNELS.record, input),
    listForAction: (
      input: ListActionRecordsInputDto
    ): Promise<RecordResult<readonly ActionRecordSummaryDto[]>> =>
      ipcRenderer.invoke(RECORD_CHANNELS.listForAction, input),
    getDetail: (input: ActionRecordIdInputDto): Promise<RecordResult<ActionRecordDetailDto>> =>
      ipcRenderer.invoke(RECORD_CHANNELS.getDetail, input)
  }),
  progress: Object.freeze({
    get: (input: GetProgressInputDto): Promise<ProgressResult<ProgressViewDto>> =>
      ipcRenderer.invoke(PROGRESS_CHANNELS.get, input)
  }),
  routines: Object.freeze({
    create: (input: CreateRoutineInputDto): Promise<RoutineResult<RoutineDetailDto>> =>
      ipcRenderer.invoke(ROUTINE_CHANNELS.create, input),
    updateDetails: (
      input: UpdateRoutineDetailsInputDto
    ): Promise<RoutineResult<RoutineDetailDto>> =>
      ipcRenderer.invoke(ROUTINE_CHANNELS.updateDetails, input),
    replaceSchedule: (
      input: ReplaceRoutineScheduleInputDto
    ): Promise<RoutineResult<RoutineDetailDto>> =>
      ipcRenderer.invoke(ROUTINE_CHANNELS.replaceSchedule, input),
    pause: (input: RoutineIdInputDto): Promise<RoutineResult<RoutineDetailDto>> =>
      ipcRenderer.invoke(ROUTINE_CHANNELS.pause, input),
    resume: (input: RoutineIdInputDto): Promise<RoutineResult<RoutineDetailDto>> =>
      ipcRenderer.invoke(ROUTINE_CHANNELS.resume, input),
    end: (input: RoutineIdInputDto): Promise<RoutineResult<RoutineDetailDto>> =>
      ipcRenderer.invoke(ROUTINE_CHANNELS.end, input),
    list: (input: ListRoutinesInputDto): Promise<RoutineResult<readonly RoutineSummaryDto[]>> =>
      ipcRenderer.invoke(ROUTINE_CHANNELS.list, input),
    getDetail: (input: RoutineIdInputDto): Promise<RoutineResult<RoutineDetailDto>> =>
      ipcRenderer.invoke(ROUTINE_CHANNELS.getDetail, input),
    beginRecording: (
      input: BeginRoutineRecordingInputDto
    ): Promise<RoutineRecordResult<BeginRoutineRecordingDto>> =>
      ipcRenderer.invoke(ROUTINE_RECORD_CHANNELS.begin, input),
    cancelRecording: (
      input: CancelRoutineRecordingInputDto
    ): Promise<RoutineRecordResult<{ readonly cancelled: true }>> =>
      ipcRenderer.invoke(ROUTINE_RECORD_CHANNELS.cancel, input),
    record: (input: RecordRoutineInputDto): Promise<RoutineRecordResult<RecordRoutineValueDto>> =>
      ipcRenderer.invoke(ROUTINE_RECORD_CHANNELS.record, input),
    getDayState: (
      input: GetRoutineDayStateInputDto
    ): Promise<RoutineRecordResult<RoutineDayStateDto>> =>
      ipcRenderer.invoke(ROUTINE_RECORD_CHANNELS.getDayState, input)
  })
})

contextBridge.exposeInMainWorld('myTracer', api)
