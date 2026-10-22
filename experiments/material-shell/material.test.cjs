const { test } = require('node:test')
const assert = require('node:assert/strict')
const { MILK, supportsMaterial, applyMaterial } = require('./material.cjs')
const settings = { mode: 'environment', material: 'mica', intensity: 'subtle' }
function fakeWindow(fail = false) {
  const calls = []
  return {
    calls,
    setBackgroundMaterial(value) {
      calls.push(['material', value])
      if (fail) throw new Error('DWM unavailable')
    },
    setBackgroundColor(value) {
      calls.push(['color', value])
    }
  }
}
test('only Windows 11 22H2+ is eligible', () => {
  for (const [platform, version, expected] of [
    ['linux', '6.8.0', false],
    ['darwin', '24.0.0', false],
    ['win32', '10.0.19045', false],
    ['win32', '10.0.22000', false],
    ['win32', '10.0.22621', true],
    ['win32', '10.0.26100', true],
    ['win32', 'unknown', false]
  ])
    assert.equal(supportsMaterial(platform, version), expected)
})
test('unsupported OS never calls native material and keeps opaque surface', () => {
  const win = fakeWindow()
  const state = applyMaterial(win, settings, false)
  assert.equal(state.active, false)
  assert.equal(state.overlay, 1)
  assert.deepEqual(win.calls, [['color', MILK]])
})
test('native failure after a previous success restores opaque fallback', () => {
  const win = fakeWindow(true)
  const state = applyMaterial(win, settings, true)
  assert.equal(state.active, false)
  assert.equal(state.overlay, 1)
  assert.deepEqual(win.calls.at(-1), ['color', MILK])
})
test('both materials and all intensities preserve native window opacity', () => {
  for (const material of ['mica', 'acrylic']) {
    const overlays = []
    for (const intensity of ['subtle', 'standard', 'strong']) {
      const win = fakeWindow()
      const state = applyMaterial(win, { ...settings, material, intensity }, true)
      assert.equal(state.active, true)
      overlays.push(state.overlay)
      assert.deepEqual(win.calls, [
        ['material', material],
        ['color', '#00000000']
      ])
    }
    assert.deepEqual(overlays, [0.88, 0.68, 0.42])
  }
})
test('solid comparison removes native material', () => {
  const win = fakeWindow()
  const state = applyMaterial(win, { ...settings, mode: 'solid' }, true)
  assert.equal(state.overlay, 1)
  assert.deepEqual(win.calls, [
    ['material', 'none'],
    ['color', MILK]
  ])
})
test('malformed IPC settings are rejected before touching the window', () => {
  const win = fakeWindow()
  for (const value of [
    null,
    {},
    { ...settings, intensity: '__proto__' },
    { ...settings, material: 'auto' },
    { ...settings, mode: 'other' }
  ]) {
    assert.throws(() => applyMaterial(win, value, true), TypeError)
  }
  assert.deepEqual(win.calls, [])
})
