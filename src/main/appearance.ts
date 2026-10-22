import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  DEFAULT_APPEARANCE,
  SHELL_OVERLAYS,
  validateAppearance,
  type AppearanceSettings,
  type AppearanceState
} from '../contracts/appearance'

export const SHELL_COLOR = '#f2f4ee'
export const CAPTION_OVERLAY = { color: '#00000000', symbolColor: '#293a34', height: 42 }

export function supportsMica(platform: string, release: string): boolean {
  const [major, , build] = release.split('.').map(Number)
  return platform === 'win32' && major >= 10 && build >= 22621
}

export class AppearanceStore {
  constructor(private readonly path: string) {}
  read(): AppearanceSettings {
    try {
      return validateAppearance(JSON.parse(readFileSync(this.path, 'utf8')))
    } catch {
      return { ...DEFAULT_APPEARANCE }
    }
  }
  write(value: unknown): AppearanceSettings {
    const settings = validateAppearance(value)
    mkdirSync(dirname(this.path), { recursive: true })
    writeFileSync(`${this.path}.tmp`, JSON.stringify(settings), { mode: 0o600 })
    renameSync(`${this.path}.tmp`, this.path)
    return settings
  }
}

interface MaterialWindow {
  setBackgroundMaterial(material: 'mica' | 'none'): void
  setBackgroundColor(color: string): void
  setTitleBarOverlay(options: typeof CAPTION_OVERLAY): void
}

export function applyAppearance(
  window: MaterialWindow,
  settings: AppearanceSettings,
  supported: boolean,
  reducedTransparency: boolean
): AppearanceState {
  let materialRequested = supported && !reducedTransparency && settings.mode === 'mica'
  try {
    if (supported) window.setBackgroundMaterial(materialRequested ? 'mica' : 'none')
  } catch {
    materialRequested = false
  }
  window.setBackgroundColor(materialRequested ? '#00000000' : SHELL_COLOR)
  window.setTitleBarOverlay(CAPTION_OVERLAY)
  return {
    ...settings,
    materialRequested,
    overlay: materialRequested ? SHELL_OVERLAYS[settings.intensity] : 1
  }
}
