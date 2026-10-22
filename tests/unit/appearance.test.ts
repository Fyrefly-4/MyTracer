import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_APPEARANCE,
  SHELL_OVERLAYS,
  validateAppearance
} from '../../src/contracts/appearance'
import {
  applyAppearance,
  CAPTION_OVERLAY,
  SHELL_COLOR,
  supportsMica
} from '../../src/main/appearance'

describe('wallpaper shell appearance', () => {
  it('keeps the approved defaults and exact experiment milk overlays', () => {
    expect(DEFAULT_APPEARANCE).toEqual({ mode: 'mica', intensity: 'strong' })
    expect(SHELL_OVERLAYS).toEqual({ subtle: 0.88, standard: 0.68, strong: 0.42 })
  })
  it.each([
    null,
    [],
    {},
    { mode: 'acrylic', intensity: 'strong' },
    { mode: 'mica', intensity: 'toString' },
    { mode: 'solid', intensity: 'strong', extra: true },
    { mode: ['mica'], intensity: 'strong' }
  ])('rejects malformed settings: %j', (value) => {
    expect(() => validateAppearance(value)).toThrow()
  })
  it.each([
    ['win32', '10.0.22621', true],
    ['win32', '10.0.22000', false],
    ['win32', '10.0.19045', false],
    ['linux', '10.0.22621', false],
    ['darwin', '24.1.0', false],
    ['win32', 'invalid', false]
  ])('gates material on %s %s', (platform, release, expected) => {
    expect(supportsMica(String(platform), String(release))).toBe(expected)
  })
  it('requests only Mica and preserves transparent native caption buttons', () => {
    const window = {
      setBackgroundMaterial: vi.fn(),
      setBackgroundColor: vi.fn(),
      setTitleBarOverlay: vi.fn()
    }
    for (const intensity of ['subtle', 'standard', 'strong'] as const) {
      expect(applyAppearance(window, { mode: 'mica', intensity }, true, false).overlay).toBe(
        SHELL_OVERLAYS[intensity]
      )
    }
    expect(window.setBackgroundMaterial).toHaveBeenLastCalledWith('mica')
    expect(window.setBackgroundColor).toHaveBeenLastCalledWith('#00000000')
    expect(window.setTitleBarOverlay).toHaveBeenLastCalledWith(CAPTION_OVERLAY)
    expect(CAPTION_OVERLAY.color).toBe('#00000000')
  })
  it('falls back to opaque milk for unsupported, disabled, solid and failed native material', () => {
    const window = {
      setBackgroundMaterial: vi.fn(),
      setBackgroundColor: vi.fn(),
      setTitleBarOverlay: vi.fn()
    }
    for (const [supported, reduced] of [
      [false, false],
      [true, true]
    ]) {
      expect(applyAppearance(window, DEFAULT_APPEARANCE, supported, reduced)).toMatchObject({
        materialRequested: false,
        overlay: 1
      })
      expect(window.setBackgroundColor).toHaveBeenLastCalledWith(SHELL_COLOR)
    }
    expect(
      applyAppearance(window, { mode: 'solid', intensity: 'strong' }, true, false).overlay
    ).toBe(1)
    expect(window.setBackgroundMaterial).toHaveBeenLastCalledWith('none')
    window.setBackgroundMaterial.mockImplementation(() => {
      throw new Error('unavailable')
    })
    expect(applyAppearance(window, DEFAULT_APPEARANCE, true, false).materialRequested).toBe(false)
    expect(window.setBackgroundColor).toHaveBeenLastCalledWith(SHELL_COLOR)
  })
})
