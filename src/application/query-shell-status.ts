import type { ShellStatus } from '../contracts/shell'
import type { AiConfigurationState } from './ports/configuration'

const emptyConfiguration: AiConfigurationState = Object.freeze({
  configured: false,
  availability: 'not-configured',
  credentialProtection: 'unavailable'
})

export function queryShellStatus(
  appVersion: string,
  configuration: AiConfigurationState = emptyConfiguration
): ShellStatus {
  return {
    appName: 'MyTracer',
    appVersion,
    platform: 'windows',
    ai: {
      configured: configuration.configured,
      availability: configuration.availability
    }
  }
}
