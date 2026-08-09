export type DiagnosticSeverity = 'info' | 'warning' | 'error'

export type DiagnosticCode =
  | 'application-started'
  | 'application-stopping'
  | 'configuration-not-configured'
  | 'safe-storage-unavailable'
  | 'sqlite-initialization-failed'
  | 'unexpected-main-error'

export type DiagnosticErrorCategory =
  'configuration' | 'credential-protection' | 'persistence' | 'unexpected'

export interface DiagnosticInput {
  readonly code: DiagnosticCode
  readonly severity: DiagnosticSeverity
  readonly correlationId: string
  readonly category?: DiagnosticErrorCategory
}

export interface SafeDiagnosticEvent extends DiagnosticInput {
  readonly occurredAt: string
}

export interface DiagnosticsPort {
  record(input: DiagnosticInput): void
}
