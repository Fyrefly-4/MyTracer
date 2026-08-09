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
  })
})

contextBridge.exposeInMainWorld('myTracer', api)
