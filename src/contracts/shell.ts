import type { AppearanceSettings, AppearanceState } from './appearance'
import type { HomeApi } from './home'
import type { GoalApi } from './goals'
import type { ActionApi } from './actions'
import type { TodayApi } from './today'
import type { RecordApi } from './records'
import type { ProgressApi } from './progress'
import type { RoutineApi } from './routines'
import type { DataControlApi } from './data-control'
import type { CompleteExportApi } from './exports'
import type { RecoveryApi } from './recovery'
import type { ReviewApi } from './review'
import type { AiConfigurationApi, AiStartHelpApi } from './ai-start-help'
import type { UpdateApi } from './updates'

export const SHELL_STATUS_CHANNEL = 'shell:query-status' as const

export interface ShellStatus {
  readonly appName: 'MyTracer'
  readonly appVersion: string
  readonly platform: 'windows'
  readonly ai: {
    readonly configured: boolean
    readonly availability:
      'disabled' | 'not-configured' | 'configured-available' | 'configured-unavailable'
  }
}

export interface MyTracerApi {
  readonly shell: {
    readonly getStatus: () => Promise<ShellStatus>
    readonly getAppearance: () => Promise<AppearanceState>
    readonly setAppearance: (settings: AppearanceSettings) => Promise<AppearanceState>
    readonly subscribeAppearance: (listener: (state: AppearanceState) => void) => () => void
  }
  readonly home: HomeApi
  readonly goals: GoalApi
  readonly actions: ActionApi
  readonly today: TodayApi
  readonly records: RecordApi
  readonly progress: ProgressApi
  readonly recovery: RecoveryApi
  readonly review: ReviewApi
  readonly routines: RoutineApi
  readonly dataControl: DataControlApi
  readonly exports: CompleteExportApi
  readonly aiStartHelp: AiStartHelpApi
  readonly aiConfiguration: AiConfigurationApi
  readonly updates: UpdateApi
}
