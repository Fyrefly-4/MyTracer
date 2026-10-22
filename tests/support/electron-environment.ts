import type { TemporaryTestRoot } from './temporary-test-root'

export function minimalElectronEnvironment(root: TemporaryTestRoot): Record<string, string> {
  const environment: Record<string, string> = {
    HOME: root.root,
    USERPROFILE: root.root,
    APPDATA: root.roamingAppData,
    LOCALAPPDATA: root.localAppData,
    TEMP: root.temporary,
    TMP: root.temporary,
    ELECTRON_RENDERER_URL: ''
  }

  for (const name of [
    'PATH',
    'SystemRoot',
    'WINDIR',
    'ComSpec',
    'PATHEXT',
    'DISPLAY',
    'XAUTHORITY'
  ]) {
    const value = process.env[name]
    if (value) {
      environment[name] = value
    }
  }

  return environment
}
