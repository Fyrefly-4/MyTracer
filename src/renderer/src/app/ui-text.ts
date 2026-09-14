import type { ActionStatusDto } from '../../../contracts/actions'
import type { GoalStatusDto } from '../../../contracts/goals'
import type { ActionRecordOutcomeDto } from '../../../contracts/records'
import type { RoutineRecordOutcomeDto } from '../../../contracts/routine-records'

export const goalStatusText: Record<GoalStatusDto, string> = {
  active: '活跃',
  paused: '暂停',
  ended: '结束'
}
export const actionStatusText: Record<ActionStatusDto, string> = {
  pending: '待行动',
  completed: '已完成',
  cancelled: '已取消',
  rescheduled: '已重新安排'
}
export const recordOutcomeText: Record<ActionRecordOutcomeDto, string> = {
  completed: '本次达到预期',
  partial: '本次完成一部分',
  stopped: '本次在这里停下'
}
export const routineRecordOutcomeText: Record<RoutineRecordOutcomeDto | 'unknown', string> = {
  target_met: '达到目标',
  acted: '有所行动',
  intentional_rest: '主动休息',
  not_done: '未进行',
  unknown: '未记录'
}
export const factOutcomeText = { ...recordOutcomeText, ...routineRecordOutcomeText }
