import type { ShellStatus } from '../contracts/shell'

export function queryShellStatus(appVersion: string): ShellStatus {
  return {
    appName: 'MyTracer',
    appVersion,
    platform: 'windows',
    ai: {
      configured: false,
      availability: 'not-configured'
    }
  }
}
