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
}
