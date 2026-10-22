import { execFile, type ChildProcess } from 'node:child_process'
import { expect, it, vi } from 'vitest'
import {
  readWindowsTransparency,
  parseWindowsTransparency,
  WindowsTransparencyPreference
} from '../../src/main/windows-transparency'
import { applyAppearance } from '../../src/main/appearance'
import { DEFAULT_APPEARANCE } from '../../src/contracts/appearance'

it.each([
  [
    '\r\nHKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize\r\n    EnableTransparency    REG_DWORD    0x1\r\n',
    true
  ],
  ['EnableTransparency REG_DWORD 0x00000001', true],
  ['EnableTransparency REG_DWORD 0x0', false],
  ['EnableTransparency REG_SZ 0x1', false],
  ['EnableTransparency REG_DWORD 0x10', false],
  ['OtherPreference REG_DWORD 0x1', false],
  ['', false]
])('reads only the enabled DWORD from registry output', (output, expected) => {
  expect(parseWindowsTransparency(output)).toBe(expected)
})

it('changes from Mica to opaque milk when Windows disables transparency, without high contrast', async () => {
  const window = {
    setBackgroundMaterial: vi.fn(),
    setBackgroundColor: vi.fn(),
    setTitleBarOverlay: vi.fn()
  }
  const read = vi
    .fn<() => Promise<boolean>>()
    .mockResolvedValueOnce(true)
    .mockResolvedValueOnce(false)
    .mockRejectedValueOnce(new Error('timeout'))
    .mockResolvedValueOnce(true)
  const preference = new WindowsTransparencyPreference(read, () => {
    applyAppearance(window, DEFAULT_APPEARANCE, true, !preference.enabled)
  })
  expect(preference.enabled).toBe(false)
  await preference.refresh()
  expect(window.setBackgroundMaterial).toHaveBeenLastCalledWith('mica')
  await preference.refresh()
  expect(window.setBackgroundMaterial).toHaveBeenLastCalledWith('none')
  expect(window.setBackgroundColor).toHaveBeenLastCalledWith('#f2f4ee')
  await preference.refresh()
  expect(preference.enabled).toBe(false)
  await preference.refresh()
  expect(window.setBackgroundMaterial).toHaveBeenLastCalledWith('mica')
})

it('discards stale preference reads and completion after the window closes', async () => {
  const pending: ((enabled: boolean) => void)[] = []
  const read = vi.fn(() => new Promise<boolean>((resolve) => pending.push(resolve)))
  const changed = vi.fn()
  const preference = new WindowsTransparencyPreference(read, changed)
  const older = preference.refresh()
  const newer = preference.refresh()
  pending[1](false)
  await newer
  pending[0](true)
  await older
  expect(preference.enabled).toBe(false)
  expect(changed).toHaveBeenCalledTimes(1)
  const closing = preference.refresh()
  preference.dispose()
  pending[2](true)
  await closing
  await preference.refresh()
  expect(changed).toHaveBeenCalledTimes(1)
  expect(read).toHaveBeenCalledTimes(3)
})

vi.mock('node:child_process', () => ({ execFile: vi.fn() }))

it('uses only a bounded, hidden registry query and treats process errors as disabled', async () => {
  const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!
  const originalRoot = process.env.SystemRoot
  const query = vi.mocked(execFile)
  try {
    Object.defineProperty(process, 'platform', { value: 'win32' })
    process.env.SystemRoot = 'C:\\Windows'
    for (const error of [null, new Error('timeout'), new Error('access denied')]) {
      query.mockImplementation((...args: unknown[]) => {
        const callback = args[3] as (error: Error | null, stdout: string) => void
        callback(error, 'EnableTransparency REG_DWORD 0x1')
        return {} as ChildProcess
      })
      expect(await readWindowsTransparency()).toBe(error === null)
      expect(query).toHaveBeenLastCalledWith(
        'C:\\Windows\\System32\\reg.exe',
        [
          'query',
          'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize',
          '/v',
          'EnableTransparency'
        ],
        { windowsHide: true, timeout: 2000, maxBuffer: 8192, encoding: 'utf8' },
        expect.any(Function)
      )
    }
    query.mockClear()
    Object.defineProperty(process, 'platform', { value: 'linux' })
    expect(await readWindowsTransparency()).toBe(false)
    expect(query).not.toHaveBeenCalled()
  } finally {
    Object.defineProperty(process, 'platform', originalPlatform)
    if (originalRoot === undefined) delete process.env.SystemRoot
    else process.env.SystemRoot = originalRoot
  }
})
