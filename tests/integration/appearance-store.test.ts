import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { AppearanceStore } from '../../src/main/appearance'
import { DEFAULT_APPEARANCE } from '../../src/contracts/appearance'

it('persists only validated appearance settings and recovers missing/corrupt files safely', () => {
  const root = mkdtempSync(join(tmpdir(), 'mytracer-appearance-'))
  try {
    const path = join(root, 'appearance.json')
    const store = new AppearanceStore(path)
    expect(store.read()).toEqual(DEFAULT_APPEARANCE)
    store.write({ mode: 'solid', intensity: 'subtle' })
    expect(new AppearanceStore(path).read()).toEqual({ mode: 'solid', intensity: 'subtle' })
    const saved = readFileSync(path, 'utf8')
    expect(() => store.write({ mode: 'acrylic', intensity: 'strong' })).toThrow()
    expect(readFileSync(path, 'utf8')).toBe(saved)
    for (const invalid of ['{', '{"mode":"mica","intensity":"invalid"}', 'null']) {
      writeFileSync(path, invalid)
      expect(store.read()).toEqual(DEFAULT_APPEARANCE)
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
