export type DiagnosticSeverity = 'info' | 'warning' | 'error'

export type DiagnosticCode =
  | 'application-started'
  | 'application-stopping'
  | 'configuration-not-configured'
  | 'safe-storage-unavailable'
  | 'ai-request-succeeded'
  | 'ai-request-failed'
  | 'ai-request-cancelled'
  | 'sqlite-initialization-failed'
  | 'unexpected-main-error'

export type DiagnosticErrorCategory =
  'configuration' | 'credential-protection' | 'persistence' | 'ai-provider' | 'unexpected'

export type DiagnosticProviderCategory = 'litellm-gateway' | 'offline-fake'

export interface DiagnosticInput {
  readonly code: DiagnosticCode
  readonly severity: DiagnosticSeverity
  readonly correlationId: string
  readonly category?: DiagnosticErrorCategory
  readonly durationMs?: number
  readonly providerCategory?: DiagnosticProviderCategory
}

export interface SafeDiagnosticEvent extends DiagnosticInput {
  readonly occurredAt: string
}

export interface DiagnosticsPort {
  record(input: DiagnosticInput): void
}
