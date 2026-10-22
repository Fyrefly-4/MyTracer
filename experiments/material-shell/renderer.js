const mode = document.querySelector('#mode')
const material = document.querySelector('#material')
const intensity = document.querySelector('#intensity')
const status = document.querySelector('#status')
let pending = false
function render(state) {
  mode.value = state.mode
  material.value = state.material
  intensity.value = state.intensity
  document.documentElement.style.setProperty('--shell-alpha', String(state.overlay))
  status.textContent = `${state.reason} · shell milk overlay ${Math.round(state.overlay * 100)}%`
  material.disabled = intensity.disabled = state.mode === 'solid'
}
for (const control of [mode, material, intensity]) {
  control.addEventListener('change', async () => {
    if (pending) return
    pending = true
    for (const input of [mode, material, intensity]) input.disabled = true
    try {
      render(
        await window.materialShell.apply({
          mode: mode.value,
          material: material.value,
          intensity: intensity.value
        })
      )
    } catch {
      status.textContent = '切换失败，请重新启动实验。'
    } finally {
      pending = false
      mode.disabled = false
      material.disabled = intensity.disabled = mode.value === 'solid'
    }
  })
}
window.materialShell
  .read()
  .then(render)
  .catch(() => {
    status.textContent = '无法读取实验状态；请通过 Electron 启动。'
  })
