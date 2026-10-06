import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { expect, test } from 'vitest'

const setup = 'MyTracer-0.1.4-x64-setup.exe'
const allowed = [
  setup,
  `${setup}.blockmap`,
  'latest.yml',
  'SHA256SUMS.txt',
  'candidate-manifest.json'
]
const powershell = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$archive = Join-Path $env:T084_TEST_ROOT 'candidate.zip'
$zip = [System.IO.Compression.ZipFile]::Open($archive, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  $names = ConvertFrom-Json $env:T084_TEST_ENTRIES
  foreach ($name in $names) {
    $entry = $zip.CreateEntry($name)
    $stream = $entry.Open()
    try { if ($env:T084_TEST_EMPTY -ne '1') { $stream.WriteByte(65) } } finally { $stream.Dispose() }
  }
} finally { $zip.Dispose() }
& ./tools/release/extract-artifact.ps1 -Archive $archive -Destination $env:T084_TEST_DESTINATION -Version '0.1.4'
`

test.runIf(process.platform === 'win32').each([
  { name: 'exact flat five-file bundle', entries: allowed, valid: true },
  { name: 'parent traversal', entries: [...allowed.slice(0, 4), '../candidate-manifest.json'] },
  { name: 'nested path', entries: [...allowed.slice(0, 4), 'nested/candidate-manifest.json'] },
  { name: 'duplicate entry', entries: [...allowed.slice(0, 4), allowed[0]] },
  { name: 'unexpected executable', entries: [...allowed, 'unapproved.exe'] },
  { name: 'case mismatch', entries: [...allowed.slice(0, 4), 'Candidate-manifest.json'] },
  { name: 'empty file', entries: allowed, empty: true },
  { name: 'existing destination', entries: allowed, existing: true },
  { name: 'destination outside staging root', entries: allowed, outside: true }
])('extracts only an immutable allowlisted archive: $name', async (scenario) => {
  const staging = resolve('.tmp')
  await mkdir(staging, { recursive: true })
  const root = await mkdtemp(join(staging, 't084-extraction-'))
  const owned = relative(staging, resolve(root))
  if (!owned.startsWith('t084-extraction-') || owned.includes('..'))
    throw new Error('Unsafe test cleanup')
  const destination = scenario.outside
    ? join(root, '..', '..', 'forbidden-extraction')
    : join(root, 'bundle')
  try {
    if (scenario.existing) await mkdir(destination)
    const result = spawnSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', powershell],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          T084_TEST_ROOT: root,
          T084_TEST_ENTRIES: JSON.stringify(scenario.entries),
          T084_TEST_DESTINATION: destination,
          T084_TEST_EMPTY: scenario.empty ? '1' : '0'
        },
        encoding: 'utf8',
        windowsHide: true,
        timeout: 30_000
      }
    )
    expect(result.error).toBeUndefined()
    expect(result.signal).toBeNull()
    if (scenario.valid) {
      expect(result.status, result.stderr).toBe(0)
      expect((await readdir(destination)).sort()).toEqual([...allowed].sort())
    } else {
      expect(result.status, result.stderr).toBe(1)
      expect(await readdir(root)).toEqual(
        scenario.existing ? ['bundle', 'candidate.zip'] : ['candidate.zip']
      )
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
