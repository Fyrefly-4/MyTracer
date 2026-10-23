// Compile and (on Windows) execute the exact production scope decision macro.
// No real registry, user records, elevation or application installation is touched.
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { getMakeNsisPath } = require('app-builder-lib/out/toolsets/windows')
const root = fileURLToPath(new URL('../../', import.meta.url))
assert.equal(require('electron-builder/package.json').version, '26.15.3')
assert.equal(require('electron-updater/package.json').version, '6.8.10')
const empty = {
  Updated: '1',
  DirectoryOverride: '',
  UserPath: '',
  UserUninstallPath: '',
  MachinePath: '',
  MachineUninstallPath: '',
  UserExists: '0',
  MachineExists: '0'
}
const user = {
  UserPath: 'C:\\Custom notes',
  UserUninstallPath: 'C:\\Custom notes',
  UserExists: '1'
}
const machine = {
  MachinePath: 'C:\\Shared notes',
  MachineUninstallPath: 'C:\\Shared notes',
  MachineExists: '1'
}
const cases = [
  ['fresh', {}, ''],
  ['manual user', { ...user, Updated: '0' }, ''],
  ['manual machine', { ...machine, Updated: '0' }, ''],
  ['user update', user, 'user'],
  ['machine update', machine, 'machine'],
  ['both scopes', { ...user, ...machine }, ''],
  ['orphan other uninstall', { ...user, MachineUninstallPath: 'C:\\Old' }, ''],
  ['missing uninstall', { ...user, UserUninstallPath: '' }, ''],
  ['mismatched uninstall', { ...machine, MachineUninstallPath: 'C:\\Old' }, ''],
  ['missing executable', { ...user, UserExists: '0' }, ''],
  ['explicit directory', { ...user, DirectoryOverride: 'C:\\Other' }, ''],
  ['elevated machine', machine, 'machine', true],
  ['elevated different HKCU', { ...user, ...machine }, 'machine', true],
  ['elevated missing records', {}, '', true],
  ['elevated missing uninstall', { ...machine, MachineUninstallPath: '' }, '', true],
  ['elevated missing exe', { ...machine, MachineExists: '0' }, '', true],
  ['elevated mismatched path', { ...machine, MachineUninstallPath: 'C:\\Old' }, '', true]
]
const temporary = await mkdtemp(path.join(tmpdir(), 'mytracer-nsis-fixture-'))
try {
  const exe = path.join(temporary, 'scope.exe')
  const source = path.join(temporary, 'scope.nsi')
  const instructions = cases.flatMap(([name, overrides, expected, elevated], index) => {
    const inputs = { ...empty, ...overrides }
    const expectedPath =
      expected === 'user' ? inputs.UserPath : expected === 'machine' ? inputs.MachinePath : ''
    return [
      `; ${name}`,
      ...Object.entries(inputs).map(([key, value]) => `StrCpy $myTracer${key} "${value}"`),
      `!insertmacro ${elevated ? 'MyTracerSelectElevatedUpdateScope' : 'MyTracerSelectUpdateScope'}`,
      `StrCmp $myTracerUpdateScope "${expected}" +3`,
      `SetErrorLevel ${index + 1}`,
      'Quit',
      `StrCmp $myTracerUpdatePath "${expectedPath}" +3`,
      `SetErrorLevel ${index + 101}`,
      'Quit'
    ]
  })
  await writeFile(
    source,
    [
      'Unicode true',
      'RequestExecutionLevel user',
      'SilentInstall silent',
      `OutFile "${exe}"`,
      '!include LogicLib.nsh',
      `!include "${path.join(root, 'build/installer/update-scope.nsh')}"`,
      ...[...Object.keys(empty), 'UpdateScope', 'UpdatePath'].map((key) => `Var myTracer${key}`),
      'Section',
      ...instructions,
      'SetErrorLevel 0',
      'SectionEnd'
    ].join('\n')
  )
  const compiler = await getMakeNsisPath()
  execFileSync(compiler.path, [process.platform === 'win32' ? '/V2' : '-V2', source], {
    env: { ...process.env, ...compiler.env },
    stdio: 'inherit'
  })
  assert.equal((await readFile(exe)).subarray(0, 2).toString(), 'MZ')
  console.log(`Compiled ${cases.length} NSIS scope/path fixtures.`)
  if (process.platform === 'win32') {
    execFileSync(exe, [], { timeout: 30000, stdio: 'inherit' })
    console.log(`Executed ${cases.length} NSIS scope/path fixtures successfully.`)
  } else {
    console.log('Windows fixture execution pending; compilation only on this host.')
  }
} finally {
  await rm(temporary, { recursive: true, force: true })
}
