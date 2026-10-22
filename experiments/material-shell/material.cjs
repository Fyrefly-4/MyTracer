// Slightly cooler shell separates the opaque milk-white content without a dark frame.
const SHELL = '#f2f4ee'
const CAPTION = Object.freeze({ color: '#00000000', symbolColor: '#293a34', height: 42 })

function syncCaption(window) {
  // Transparent native button backgrounds reveal the same renderer tint as the titlebar.
  // Keep native hover/pressed/accessibility behavior; never replace caption controls.
  if (typeof window.setTitleBarOverlay === 'function') window.setTitleBarOverlay(CAPTION)
}
const OVERLAYS = Object.freeze({ subtle: 0.88, standard: 0.68, strong: 0.42 })

function supportsMaterial(platform, release) {
  const [major, , build] = release.split('.').map(Number)
  return platform === 'win32' && major >= 10 && build >= 22621
}

function validateSettings(value) {
  if (
    !value ||
    !['solid', 'environment'].includes(value.mode) ||
    !['mica', 'acrylic'].includes(value.material) ||
    !Object.hasOwn(OVERLAYS, value.intensity)
  )
    throw new TypeError('Invalid shell settings')
  return { mode: value.mode, material: value.material, intensity: value.intensity }
}

function applyMaterial(window, settings, supported) {
  const requested = validateSettings(settings)
  let active = supported && requested.mode === 'environment'
  let reason = supported ? 'Solid comparison' : 'Unsupported OS: solid fallback'
  try {
    if (supported) window.setBackgroundMaterial(active ? requested.material : 'none')
    if (active)
      reason = `${requested.material}: requested from Windows (visual result not detectable)`
  } catch {
    active = false
    reason = 'Native material call failed: solid fallback'
    // An opaque background also hides any previously applied system material.
  }
  window.setBackgroundColor(active ? '#00000000' : SHELL)
  syncCaption(window)
  return { ...requested, active, reason, overlay: active ? OVERLAYS[requested.intensity] : 1 }
}

module.exports = {
  SHELL,
  CAPTION,
  syncCaption,
  OVERLAYS,
  supportsMaterial,
  validateSettings,
  applyMaterial
}
