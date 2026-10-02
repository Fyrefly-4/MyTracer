import { spawnSync } from 'node:child_process'

if (
  process.platform !== 'win32' ||
  process.env.MYTRACER_INSTALLED_UPDATE_TEST !== '1' ||
  process.env.MYTRACER_INSTALLED_UPDATE_ISOLATION_ACK !== 'isolated-windows-identity'
) {
  process.stderr.write(
    'Installed update test requires an approved isolated Windows identity and explicit opt-in.\n'
  )
  process.exitCode = 1
} else {
  const result = spawnSync(
    process.execPath,
    [
      'node_modules/@playwright/test/cli.js',
      'test',
      'tests/e2e/windows-installed-update.e2e.test.ts'
    ],
    { stdio: 'inherit', shell: false, windowsHide: true }
  )
  process.exitCode = result.status ?? 1
}
