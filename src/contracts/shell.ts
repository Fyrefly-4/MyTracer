import type { GoalApi } from './goals'
import type { ActionApi } from './actions'
import type { TodayApi } from './today'
import type { RecordApi } from './records'
import type { ProgressApi } from './progress'
import type { RoutineApi } from './routines'
import type { DataControlApi } from './data-control'
import type { CompleteExportApi } from './exports'

export const SHELL_STATUS_CHANNEL = 'shell:query-status' as const

export interface ShellStatus {
  readonly appName: 'MyTracer'
  readonly appVersion: string
  readonly platform: 'windows'
  readonly ai: {
    readonly configured: false
    readonly availability: 'not-configured'
  }
}

export interface MyTracerApi {
  readonly shell: {
    readonly getStatus: () => Promise<ShellStatus>
  }
  readonly goals: GoalApi
  readonly actions: ActionApi
  readonly today: TodayApi
  readonly records: RecordApi
  readonly progress: ProgressApi
  readonly routines: RoutineApi
  readonly dataControl: DataControlApi
  readonly exports: CompleteExportApi
}
