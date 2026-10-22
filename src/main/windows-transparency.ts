import { execFile } from 'node:child_process'
import { win32 } from 'node:path'

const PERSONALIZE_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize'

// Read one current-user preference only. Never invoke a shell or accept renderer arguments.
export function readWindowsTransparency(): Promise<boolean> {
  if (process.platform !== 'win32') return Promise.resolve(false)
  return new Promise((resolve) => {
    execFile(
      win32.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'reg.exe'),
      ['query', PERSONALIZE_KEY, '/v', 'EnableTransparency'],
      { windowsHide: true, timeout: 2000, maxBuffer: 8192, encoding: 'utf8' },
      (error, stdout) => resolve(!error && parseWindowsTransparency(stdout))
    )
  })
}

export function parseWindowsTransparency(output: string): boolean {
  // Missing, malformed or unreadable values fail closed to the opaque shell.
  return /^\s*EnableTransparency\s+REG_DWORD\s+0x0*1\s*$/im.test(output)
}

export class WindowsTransparencyPreference {
  enabled = false
  private generation = 0
  private disposed = false

  constructor(
    private readonly read: () => Promise<boolean>,
    private readonly changed: () => void
  ) {}

  async refresh(): Promise<void> {
    if (this.disposed) return
    const generation = ++this.generation
    let enabled = false
    try {
      enabled = await this.read()
    } catch {
      /* Keep the solid fallback. */
    }
    if (this.disposed || generation !== this.generation) return
    this.enabled = enabled
    this.changed()
  }

  dispose(): void {
    this.disposed = true
    this.generation += 1
  }
}
