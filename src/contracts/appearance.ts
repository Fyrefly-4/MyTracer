export const APPEARANCE_CHANNELS = {
  get: 'appearance:get',
  set: 'appearance:set',
  changed: 'appearance:changed'
} as const

export interface AppearanceSettings {
  readonly mode: 'mica' | 'solid'
  readonly intensity: 'subtle' | 'standard' | 'strong'
}
export interface AppearanceState extends AppearanceSettings {
  readonly materialRequested: boolean
  readonly overlay: number
}
export const DEFAULT_APPEARANCE: AppearanceSettings = { mode: 'mica', intensity: 'strong' }
export const SHELL_OVERLAYS = { subtle: 0.88, standard: 0.68, strong: 0.42 } as const

export function validateAppearance(value: unknown): AppearanceSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError('Invalid appearance')
  const input = value as Record<string, unknown>
  if (
    Object.keys(input).length !== 2 ||
    !Object.hasOwn(input, 'mode') ||
    !Object.hasOwn(input, 'intensity') ||
    (input.mode !== 'mica' && input.mode !== 'solid') ||
    typeof input.intensity !== 'string' ||
    !Object.hasOwn(SHELL_OVERLAYS, input.intensity)
  ) {
    throw new TypeError('Invalid appearance')
  }
  return {
    mode: input.mode as AppearanceSettings['mode'],
    intensity: input.intensity as AppearanceSettings['intensity']
  }
}
