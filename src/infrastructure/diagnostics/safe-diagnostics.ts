import type { ClockPort } from '../../application/ports/clock'
import type {
  DiagnosticInput,
  DiagnosticsPort,
  SafeDiagnosticEvent
} from '../../application/ports/diagnostics'

export interface DiagnosticWriter {
  write(event: SafeDiagnosticEvent): void
}

const CORRELATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/

export class SafeDiagnostics implements DiagnosticsPort {
  public constructor(
    private readonly clock: ClockPort,
    private readonly writer: DiagnosticWriter
  ) {}

  public record(input: DiagnosticInput): void {
    if (!CORRELATION_ID_PATTERN.test(input.correlationId)) {
      return
    }

    try {
      const event = Object.freeze({ ...input, occurredAt: this.clock.nowInstant() })
      this.writer.write(event)
    } catch {
      // Diagnostics are best-effort and must not block application behavior.
    }
  }
}

export class StderrDiagnosticWriter implements DiagnosticWriter {
  public write(event: SafeDiagnosticEvent): void {
    process.stderr.write(`${JSON.stringify(event)}\n`)
  }
}
