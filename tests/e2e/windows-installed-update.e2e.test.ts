import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { lstat, readdir } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { expect, test, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import {
  assertExistingPathWithinRoot,
  createTemporaryTestRoot,
  type TemporaryTestRoot
} from '../support/temporary-test-root'
import {
  createInstalledUpdateFacts,
  exportInstalledFacts
} from '../support/installed-update-fixture'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required installed-update input: ${name}`)
  return value
}

function preflight(): void {
  expect(process.platform).toBe('win32')
  expect(['isolated-windows-identity', 't084-approved-current-account-synthetic-data']).toContain(
    required('MYTRACER_INSTALLED_UPDATE_ISOLATION_ACK')
  )
  const identity = spawnSync('whoami.exe', ['/user', '/fo', 'csv', '/nh'], {
    encoding: 'utf8',
    timeout: 10_000
  })
  expect(identity.status).toBe(0)
  expect(identity.stdout.match(/S-\d+(?:-\d+)+/)?.[0]).toBe(
    required('MYTRACER_INSTALLED_UPDATE_ACCOUNT_SID')
  )
  const status = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      "$p=@(Get-Process -Name MyTracer -ErrorAction SilentlyContinue).Count; $r=@(Get-ChildItem 'Registry::HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall' -ErrorAction SilentlyContinue | ForEach-Object {Get-ItemProperty -LiteralPath $_.PSPath -ErrorAction SilentlyContinue} | Where-Object {$_.DisplayName -like '*MyTracer*'}).Count; Write-Output \"$p,$r\""
    ],
    { encoding: 'utf8', timeout: 10_000 }
  )
  expect(status.status).toBe(0)
  expect(status.stdout.trim()).toBe('0,0')
}

function assertSyntheticDefaultAppData(root: TemporaryTestRoot): void {
  const check = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      "if ([Environment]::GetFolderPath('ApplicationData') -eq $env:APPDATA) { exit 0 } else { exit 2 }"
    ],
    { env: minimalElectronEnvironment(root), encoding: 'utf8', timeout: 10_000 }
  )
  if (check.error || check.signal || check.status !== 0) {
    throw new Error(
      'Windows default appData does not follow the approved synthetic root; no installer was started.'
    )
  }
}

async function checkedInstaller(kind: 'SOURCE' | 'BASE'): Promise<string> {
  const file = required(`MYTRACER_INSTALLED_UPDATE_${kind}_INSTALLER`)
  const digest = required(`MYTRACER_INSTALLED_UPDATE_${kind}_SHA256`)
  expect(isAbsolute(file)).toBe(true)
  expect(digest).toMatch(/^[a-f0-9]{64}$/i)
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(file)) hash.update(chunk)
  expect(hash.digest('hex')).toBe(digest.toLowerCase())
  return file
}

async function launch(
  root: TemporaryTestRoot,
  executable: string,
  initialConfiguration = false
): Promise<ElectronApplication> {
  const environment = minimalElectronEnvironment(root)
  // Only legacy source clients need this optional read token; public clients ignore it.
  if (process.env.MYTRACER_UPDATE_TOKEN)
    environment.MYTRACER_UPDATE_TOKEN = process.env.MYTRACER_UPDATE_TOKEN
  if (initialConfiguration)
    environment.MYTRACER_LITELLM_API_KEY = 'synthetic-config-only-never-requested'
  const application = await electron.launch({
    executablePath: executable,
    args: ['--disable-gpu'],
    cwd: root.root,
    env: environment
  })
  await assertExistingPathWithinRoot(
    root,
    await application.evaluate(({ app }) => app.getPath('userData'))
  )
  return application
}

async function assertDownloadedHash(root: TemporaryTestRoot): Promise<void> {
  const expected = required('MYTRACER_INSTALLED_UPDATE_TARGET_SHA256').toLowerCase()
  expect(expected).toMatch(/^[a-f0-9]{64}$/)
  const pending = [root.root]
  let found = false
  while (pending.length) {
    const directory = pending.pop()!
    for (const name of await readdir(directory)) {
      const path = join(directory, name),
        details = await lstat(path)
      if (details.isSymbolicLink()) continue
      if (details.isDirectory()) pending.push(path)
      else if (details.isFile() && name.endsWith('.exe')) {
        await assertExistingPathWithinRoot(root, path)
        const hash = createHash('sha256')
        for await (const bytes of createReadStream(path)) hash.update(bytes)
        if (hash.digest('hex') === expected) found = true
      }
    }
  }
  expect(found, 'Downloaded NSIS package must match the reviewed artifact hash').toBe(true)
}

test('preserves one fixture through manual A to B and application-installed B to C', async () => {
  test.skip(
    process.env.MYTRACER_INSTALLED_UPDATE_TEST !== '1',
    'Requires a real stable feed and approved isolated Windows identity.'
  )
  test.setTimeout(900_000)
  preflight()
  const root = await createTemporaryTestRoot()
  assertSyntheticDefaultAppData(root)
  const baseInstaller = await checkedInstaller('BASE')
  const installer = await checkedInstaller('SOURCE')
  const directory = join(root.root, 'installed-app'),
    executable = join(directory, 'MyTracer.exe')
  const targetVersion = required('MYTRACER_INSTALLED_UPDATE_TARGET_VERSION')
  expect(targetVersion).toBe('0.1.5')
  let application: ElectronApplication | undefined
  // Retain the owned installation and synthetic data for review; no automatic uninstall or deletion.
  try {
    const installation = spawnSync(baseInstaller, ['/S', `/D=${directory}`], {
      cwd: root.root,
      env: minimalElectronEnvironment(root),
      timeout: 300_000
    })
    expect(installation.status).toBe(0)
    await assertExistingPathWithinRoot(root, executable)
    application = await launch(root, executable, true)
    expect(await application.evaluate(({ app }) => app.getVersion())).toBe('0.1.0')
    const userData = await application.evaluate(({ app }) => app.getPath('userData'))
    const page = await application.firstWindow()
    await expect(page.getByRole('heading', { name: '今天', exact: true })).toBeVisible()
    const actionId = await createInstalledUpdateFacts(page, true)
    expect(
      await page.evaluate(() => window.myTracer.aiConfiguration.importFromEnvironment())
    ).toMatchObject({ availability: 'configured-available' })
    const before = await exportInstalledFacts(application, join(root.exports, 'before.json'), 2)
    await application.close()
    application = await launch(root, executable)
    let current = await application.firstWindow()
    expect(await application.evaluate(({ app }) => app.getPath('userData'))).toBe(userData)
    const reopened = await exportInstalledFacts(application, join(root.exports, 'reopened.json'), 2)
    expect(reopened.data).toEqual(before.data)
    expect(await current.evaluate(() => window.myTracer.aiConfiguration.status())).toMatchObject({
      availability: 'configured-available'
    })
    await application.close()
    const bridgeInstallation = spawnSync(installer, ['/S', `/D=${directory}`], {
      cwd: root.root,
      env: minimalElectronEnvironment(root),
      timeout: 300_000
    })
    expect(bridgeInstallation.status).toBe(0)
    application = await launch(root, executable)
    expect(await application.evaluate(({ app }) => app.getVersion())).toBe('0.1.4')
    expect(await application.evaluate(({ app }) => app.getPath('userData'))).toBe(userData)
    const bridge = await exportInstalledFacts(application, join(root.exports, 'bridge.json'), 2)
    expect(bridge.data).toEqual(before.data)
    expect(bridge.sourceDataVersion).toBe(3)
    expect(
      await (
        await application.firstWindow()
      ).evaluate(() => window.myTracer.aiConfiguration.status())
    ).toMatchObject({ availability: 'configured-available' })
    await application.close()
    application = await launch(root, executable)
    const bridgeReopened = await exportInstalledFacts(
      application,
      join(root.exports, 'bridge-reopened.json'),
      2
    )
    expect(bridgeReopened.data).toEqual(before.data)
    current = await application.firstWindow()
    await current.getByRole('button', { name: '目标', exact: true }).click()
    await current.getByRole('button', { name: '新建目标', exact: true }).click()
    await current.getByLabel('目标名称').fill('T084 unsaved draft')
    await current.getByRole('button', { name: '关于与更新' }).click()
    await current.getByRole('button', { name: '检查更新' }).click()
    await expect(current.getByRole('button', { name: '确认下载' })).toBeVisible({
      timeout: 120_000
    })
    expect(
      (await current.evaluate(() => window.myTracer.updates.getStatus())).candidate?.version
    ).toBe(targetVersion)
    await current.getByRole('button', { name: '确认下载' }).click()
    await expect(current.getByRole('button', { name: '确认重启安装' })).toBeVisible({
      timeout: 300_000
    })
    await assertDownloadedHash(root)
    await current.getByRole('button', { name: '确认重启安装' }).click()
    await expect(
      current.getByText('还有未保存的输入或未确认的 AI 建议。请返回处理后再确认安装。')
    ).toBeVisible()
    await expect(current.getByLabel('目标名称')).toHaveValue('T084 unsaved draft')
    await current.getByRole('button', { name: '稍后' }).click()
    await current.getByRole('button', { name: '创建目标', exact: true }).click()
    const beforeInstall = await exportInstalledFacts(
      application,
      join(root.exports, 'before-install.json'),
      2
    )
    await current.getByRole('button', { name: '关于与更新' }).click()
    const exited = new Promise<void>((resolve) =>
      application!.process().once('exit', () => resolve())
    )
    await current.getByRole('button', { name: '确认重启安装' }).click()
    await exited
    application = undefined
    // NSIS is intentionally interactive. The operator completes the actual installer, then
    // closes its automatically restarted application, without installing a different package.
    await expect
      .poll(
        () => {
          const check = spawnSync(
            'powershell.exe',
            [
              '-NoProfile',
              '-NonInteractive',
              '-Command',
              '$v=[Version][System.Diagnostics.FileVersionInfo]::GetVersionInfo($env:MYTRACER_TEST_EXECUTABLE).ProductVersion; if ($v.Revision -eq 0) { $v=$v.ToString(3) }; $p=@(Get-Process -Name MyTracer -ErrorAction SilentlyContinue).Count; Write-Output "$v,$p"'
            ],
            {
              env: { ...minimalElectronEnvironment(root), MYTRACER_TEST_EXECUTABLE: executable },
              encoding: 'utf8',
              timeout: 10_000
            }
          )
          return check.stdout.trim()
        },
        { timeout: 300_000, intervals: [5000, 10000, 20000] }
      )
      .toBe(`${targetVersion},0`)
    application = await launch(root, executable)
    expect(await application.evaluate(({ app }) => app.getVersion())).toBe(targetVersion)
    expect(await application.evaluate(({ app }) => app.getPath('userData'))).toBe(userData)
    const after = await exportInstalledFacts(application, join(root.exports, 'after.json'), 6)
    expect(after.data).toEqual({
      ...(beforeInstall.data as object),
      actionRecords: (beforeInstall.data as { actionRecords: object[] }).actionRecords.map(
        (record) => ({ ...record, summary: null })
      ),
      routineRecords: (beforeInstall.data as { routineRecords: object[] }).routineRecords.map(
        (record) => ({ ...record, summary: null })
      ),
      goals: (beforeInstall.data as { goals: object[] }).goals.map((goal) => ({
        ...goal,
        predecessorGoalId: null
      })),
      routines: (beforeInstall.data as { routines: object[] }).routines.map((routine) => ({
        ...routine,
        arrangementMode: 'weekly'
      }))
    })
    expect(after.sourceDataVersion).toBe(8)
    expect(
      await (
        await application.firstWindow()
      ).evaluate(() => window.myTracer.aiConfiguration.status())
    ).toMatchObject({ availability: 'configured-available' })
    expect(
      await (
        await application.firstWindow()
      ).evaluate(
        (id) =>
          window.myTracer.dataControl.backfillActionRecord({
            actionId: id,
            occurredOn: '2026-08-11',
            durationMinutes: 1,
            outcome: 'partial'
          }),
        actionId
      )
    ).toMatchObject({ ok: true })
    await application.close()
    application = await launch(root, executable)
    expect(
      await (
        await application.firstWindow()
      ).evaluate((id) => window.myTracer.records.listForAction({ actionId: id }), actionId)
    ).toMatchObject({
      ok: true,
      value: expect.arrayContaining([
        expect.objectContaining({ occurredOn: '2026-08-11', durationMinutes: 1 })
      ])
    })
  } finally {
    await application?.close().catch(() => undefined)
  }
})

test('offline upgrade fixture covers lifecycle states and preserves facts through reopen', async () => {
  const root = await createTemporaryTestRoot()
  let application: ElectronApplication | undefined
  const open = () =>
    electron.launch({
      timeout: 15_000,
      args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${root.electronUserData}`],
      cwd: root.root,
      env: minimalElectronEnvironment(root)
    })
  try {
    application = await test.step('launch isolated fixture application', open)
    const page = await application.firstWindow()
    await expect(
      page.getByRole('heading', { name: '看看最近走到了哪里。', exact: true })
    ).toBeVisible()
    await test.step('create synthetic lifecycle facts', () => createInstalledUpdateFacts(page))
    const exported = await test.step('export synthetic baseline', () =>
      exportInstalledFacts(application!, join(root.exports, 'offline.json'), 6))
    const data = exported.data as Record<string, Record<string, unknown>[]>
    expect(new Set(data.goals.map((v) => v.status))).toEqual(new Set(['active', 'paused', 'ended']))
    expect(new Set(data.actions.map((v) => v.status))).toEqual(
      new Set(['pending', 'completed', 'cancelled', 'rescheduled'])
    )
    expect(new Set(data.routines.map((v) => v.status))).toEqual(
      new Set(['active', 'paused', 'ended'])
    )
    expect(data.reviewResults).toHaveLength(1)
    expect(data.todaySelections).toHaveLength(2)
    const outcomes = [...data.actionRecords, ...data.routineRecords].map((v) => v.outcome)
    expect(outcomes).toEqual(
      expect.arrayContaining(['partial', 'target_met', 'acted', 'intentional_rest', 'not_done'])
    )
    const unknown = data.routines.find((v) => v.name === 'T084 unknown')
    expect(unknown).toBeDefined()
    expect(data.routineRecords.some((v) => v.routineId === unknown!.id)).toBe(false)
    await test.step('close baseline application', () => application!.close())
    application = await test.step('reopen isolated fixture application', open)
    const reopened = await test.step('export reopened facts', () =>
      exportInstalledFacts(application!, join(root.exports, 'offline-reopened.json'), 6))
    expect(reopened.data).toEqual(exported.data)
  } finally {
    await application?.close().catch(() => undefined)
  }
})
