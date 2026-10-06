import { spawnSync } from 'node:child_process'

if (
  process.platform !== 'win32' ||
  process.env.MYTRACER_INSTALLED_UPDATE_TEST !== '1' ||
  !['isolated-windows-identity', 't084-approved-current-account-synthetic-data'].includes(
    process.env.MYTRACER_INSTALLED_UPDATE_ISOLATION_ACK
  )
) {
  process.stderr.write(
    'Installed update test requires T084-approved Windows identity, synthetic data and explicit opt-in.\n'
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
