import Database from 'better-sqlite3'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { copyFile, readFile, stat, truncate } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import {
  assertExistingPathWithinRoot,
  createTemporaryTestRoot,
  removeTemporaryTestRootWithOptions,
  type TemporaryTestRoot
} from '../support/temporary-test-root'

test.skip(
  process.env.MYTRACER_UPGRADE_TEST !== '1',
  'Cross-version NSIS installation requires an owner-approved Windows test mode.'
)

const oldVersion = process.env.MYTRACER_UPGRADE_OLD_VERSION ?? '0.1.4'
const newVersion = process.env.MYTRACER_UPGRADE_NEW_VERSION ?? '0.1.5'
const installTimeout = 300_000

function requiredEnvironment(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} must be set for the approved upgrade test.`)
  return value
}

function assertNoExistingInstallation(): void {
  const preflight = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      "$registered = @(Get-ChildItem 'Registry::HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall' -ErrorAction SilentlyContinue | ForEach-Object { Get-ItemProperty -LiteralPath $_.PSPath -ErrorAction SilentlyContinue } | Where-Object { $_.DisplayName -like '*MyTracer*' }).Count; $running = @(Get-Process -Name MyTracer -ErrorAction SilentlyContinue).Count; $defaultInstall = [int](Test-Path -LiteralPath (Join-Path $env:LOCALAPPDATA 'Programs\\MyTracer')); Write-Output \"$registered,$running,$defaultInstall\""
    ],
    { encoding: 'utf8', timeout: 10_000 }
  )
  if (preflight.status !== 0 || preflight.stdout?.trim() !== '0,0,0') {
    throw new Error(
      'An existing MyTracer installation or process prevents current-account testing.'
    )
  }
}

function assertApprovedWindowsIdentity(): void {
  if (process.platform !== 'win32') throw new Error('The upgrade test requires Windows.')
  const approval = requiredEnvironment('MYTRACER_UPGRADE_ISOLATION_ACK')
  if (
    approval !== 'isolated-windows-identity' &&
    approval !== 'T081-owner-approved-current-account' &&
    approval !== 'T083-owner-approved-current-account'
  ) {
    throw new Error('The Windows account approval mode is invalid.')
  }
  const identity = spawnSync('whoami.exe', ['/user', '/fo', 'csv', '/nh'], {
    encoding: 'utf8',
    timeout: 10_000
  })
  const actualSid = identity.stdout?.match(/S-\d+(?:-\d+)+/)?.[0]
  if (identity.status !== 0 || actualSid !== requiredEnvironment('MYTRACER_UPGRADE_ACCOUNT_SID')) {
    throw new Error('The current Windows account does not match the approved test identity.')
  }
  if (approval !== 'isolated-windows-identity') assertNoExistingInstallation()
}

async function sha256(path: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

async function checkedInstaller(pathVariable: string, hashVariable: string): Promise<string> {
  const path = requiredEnvironment(pathVariable)
  const expectedHash = requiredEnvironment(hashVariable)
  if (!isAbsolute(path) || !/^[a-f0-9]{64}$/i.test(expectedHash)) {
    throw new Error('Installer inputs must be absolute paths with SHA-256 hashes.')
  }
  let details
  try {
    details = await stat(path)
  } catch {
    throw new Error(`${pathVariable} does not identify an accessible installer.`)
  }
  if (!details.isFile()) throw new Error(`${pathVariable} does not identify a file.`)
  expect(await sha256(path)).toBe(expectedHash.toLowerCase())
  return path
}

function runInstaller(installer: string, installDirectory: string, root: TemporaryTestRoot): void {
  const result = spawnSync(installer, ['/S', `/D=${installDirectory}`], {
    cwd: root.root,
    env: minimalElectronEnvironment(root),
    encoding: 'utf8',
    timeout: installTimeout
  })
  expect(result.error).toBeUndefined()
  expect(result.status).toBe(0)
}

async function launchInstalled(
  root: TemporaryTestRoot,
  executable: string,
  version: string,
  importSyntheticCredential = false
): Promise<ElectronApplication> {
  const env = minimalElectronEnvironment(root)
  if (importSyntheticCredential) env.MYTRACER_LITELLM_API_KEY = 't081-synthetic-test-value'
  const application = await electron.launch({
    executablePath: executable,
    args: ['--disable-gpu', `--user-data-dir=${root.electronUserData}`],
    cwd: root.root,
    env
  })
  const actualUserData = await application.evaluate(({ app }) => app.getPath('userData'))
  expect(await assertExistingPathWithinRoot(root, actualUserData)).toBe(root.electronUserData)
  expect(await application.evaluate(({ app }) => app.getVersion())).toBe(version)
  return application
}

async function closeInstalled(application: ElectronApplication): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      (async () => {
        // Use the same window-close path as a user before waiting for the Electron process.
        await (await application.firstWindow()).close()
        await application.close()
      })(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error('The installed application did not close within 30 seconds.')),
          30_000
        )
      })
    ])
  } catch (error) {
    const pid = application.process().pid
    if (pid && application.process().exitCode === null) {
      spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { timeout: 10_000 })
    }
    throw error
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

async function setMainDate(application: ElectronApplication): Promise<void> {
  await application.evaluate(() => {
    const RealDate = Date
    const fixedInstant = new RealDate(2026, 7, 12, 12, 0, 0, 0).toISOString()
    Reflect.set(
      globalThis,
      'Date',
      new Proxy(RealDate, {
        construct(target, argumentsList) {
          return Reflect.construct(target, argumentsList.length ? argumentsList : [fixedInstant])
        }
      })
    )
  })
}

async function createOldVersionFacts(page: Page): Promise<string> {
  await page.getByRole('button', { name: '目标', exact: true }).click()
  await page.getByRole('button', { name: '新建目标', exact: true }).click()
  await page.getByLabel('目标名称').fill('T081 upgrade goal')
  await page.getByLabel('当前下一步（可选）').fill('T081 first action')
  await page.getByRole('button', { name: '创建目标' }).click()
  await expect(page.getByLabel('T081 upgrade goal 详情')).toBeVisible()

  const actionId = await page.evaluate(async () => {
    const createLegacyRoutine = window.myTracer.routines.create as (
      input: Omit<Parameters<typeof window.myTracer.routines.create>[0], 'arrangementMode'>
    ) => ReturnType<typeof window.myTracer.routines.create>
    const goals = await window.myTracer.goals.list({ status: 'active' })
    if (!goals.ok || goals.value.length !== 1) throw new Error('Goal creation failed.')
    const goal = await window.myTracer.goals.getDetail({ goalId: goals.value[0].id })
    if (!goal.ok || !goal.value.currentNextActionId) throw new Error('Action creation failed.')
    const outcomes = [
      { name: 'T081 target', outcome: 'target_met', durationMinutes: 10 },
      { name: 'T081 acted', outcome: 'acted', durationMinutes: 0 },
      { name: 'T081 rest', outcome: 'intentional_rest', durationMinutes: null },
      { name: 'T081 not done', outcome: 'not_done', durationMinutes: null }
    ] as const
    for (const item of outcomes) {
      const routine = await createLegacyRoutine({
        goalId: goal.value.id,
        name: item.name,
        minimumAction: 'One small action',
        weekdays: [1, 2, 3, 4, 5, 6, 7]
      })
      if (!routine.ok) throw new Error('Routine creation failed.')
      const record = await window.myTracer.dataControl.backfillRoutineRecord({
        routineId: routine.value.id,
        occurredOn: '2026-08-10',
        outcome: item.outcome,
        plannedForDate: true,
        durationMinutes: item.durationMinutes
      })
      if (!record.ok) throw new Error('Routine record creation failed.')
    }
    const unknown = await createLegacyRoutine({
      goalId: goal.value.id,
      name: 'T081 unknown',
      minimumAction: 'One small action',
      weekdays: [1, 2, 3, 4, 5, 6, 7]
    })
    if (!unknown.ok) throw new Error('Unknown routine creation failed.')
    const actionRecord = await window.myTracer.dataControl.backfillActionRecord({
      actionId: goal.value.currentNextActionId,
      occurredOn: '2026-08-10',
      durationMinutes: 25,
      outcome: 'partial',
      understanding: 'Confirmed old-version understanding',
      confusion: 'Old-version open question'
    })
    if (!actionRecord.ok) throw new Error('Action record creation failed.')
    return goal.value.currentNextActionId
  })

  await page.getByRole('button', { name: '复盘', exact: true }).click()
  await page.getByLabel('一个真实进展').fill('Old-version progress')
  await page.getByLabel('一个主要阻力').fill('Old-version obstacle')
  await page.getByLabel('下一周期的一个调整').fill('Old-version adjustment')
  await page.getByRole('button', { name: '保存复盘', exact: true }).click()
  await expect(page.getByText('本周期复盘已保存。')).toBeVisible()

  expect(
    await page.evaluate(() => window.myTracer.aiConfiguration.importFromEnvironment())
  ).toMatchObject({
    availability: 'configured-available'
  })
  return actionId
}

async function exportFacts(
  application: ElectronApplication,
  page: Page,
  destination: string
): Promise<Record<string, unknown>> {
  await application.evaluate(({ dialog }, path) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: path })
  }, destination)
  await page.getByRole('button', { name: '数据', exact: true }).click()
  await page.locator('details.export-card > summary').click()
  await page.getByRole('button', { name: '导出完整数据' }).click()
  await expect(page.getByText(/已导出/)).toBeVisible()
  return JSON.parse(await readFile(destination, 'utf8')) as Record<string, unknown>
}

function snapshotDatabase(databasePath: string): Record<string, unknown[]> {
  const database = new Database(databasePath, { readonly: true, fileMustExist: true })
  try {
    const tables = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      )
      .all() as { name: string }[]
    expect(tables.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        'goals',
        'actions',
        'routines',
        'action_records',
        'routine_records',
        'review_results'
      ])
    )
    return Object.fromEntries(
      tables.map(({ name }) => {
        if (!/^[a-z_]+$/.test(name)) throw new Error('Unexpected SQLite table name.')
        const rows = database.prepare(`SELECT * FROM "${name}"`).all() as Record<string, unknown>[]
        rows.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
        return [name, rows]
      })
    )
  } finally {
    database.close()
  }
}

test('keeps all old-version facts and synthetic configuration through an in-place NSIS upgrade', async () => {
  test.setTimeout(900_000)
  assertApprovedWindowsIdentity()
  const oldInstaller = await checkedInstaller(
    'MYTRACER_UPGRADE_OLD_INSTALLER',
    'MYTRACER_UPGRADE_OLD_SHA256'
  )
  const newInstaller = await checkedInstaller(
    'MYTRACER_UPGRADE_NEW_INSTALLER',
    'MYTRACER_UPGRADE_NEW_SHA256'
  )
  const root = await createTemporaryTestRoot()
  const installDirectory = join(root.artifacts, 'nsis-install')
  const executable = join(installDirectory, 'MyTracer.exe')
  const databasePath = join(root.electronUserData, 'data', 'mytracer.sqlite3')
  const uninstaller = join(installDirectory, 'Uninstall MyTracer.exe')
  let installed = false
  let application: ElectronApplication | undefined
  try {
    runInstaller(oldInstaller, installDirectory, root)
    installed = true
    application = await launchInstalled(root, executable, oldVersion, true)
    await setMainDate(application)
    const page = await application.firstWindow()
    const actionId = await createOldVersionFacts(page)
    await closeInstalled(application)
    application = undefined

    application = await launchInstalled(root, executable, oldVersion)
    await setMainDate(application)
    const beforeConfiguration = await (
      await application.firstWindow()
    ).evaluate(() => window.myTracer.aiConfiguration.status())
    expect(beforeConfiguration.availability).toBe('configured-available')
    const beforeExport = await exportFacts(
      application,
      await application.firstWindow(),
      join(root.exports, 'before-upgrade.json')
    )
    await closeInstalled(application)
    application = undefined
    const beforeDatabase = snapshotDatabase(databasePath)

    runInstaller(newInstaller, installDirectory, root)
    application = await launchInstalled(root, executable, newVersion)
    await setMainDate(application)
    const newPage = await application.firstWindow()
    expect(await newPage.evaluate(() => window.myTracer.aiConfiguration.status())).toEqual(
      beforeConfiguration
    )
    const afterExport = await exportFacts(
      application,
      newPage,
      join(root.exports, 'after-upgrade.json')
    )
    expect(afterExport).toMatchObject({ exportVersion: 6, sourceDataVersion: 8 })
    expect(afterExport.data).toEqual({
      ...(beforeExport.data as object),
      actionRecords: (beforeExport.data as { actionRecords: object[] }).actionRecords.map(
        (record) => ({ ...record, summary: null })
      ),
      routineRecords: (beforeExport.data as { routineRecords: object[] }).routineRecords.map(
        (record) => ({ ...record, summary: null })
      ),
      goals: (beforeExport.data as { goals: object[] }).goals.map((goal) => ({
        ...goal,
        predecessorGoalId: null
      })),
      routines: (beforeExport.data as { routines: object[] }).routines.map((routine) => ({
        ...routine,
        arrangementMode: 'weekly'
      }))
    })
    await closeInstalled(application)
    application = undefined
    expect(snapshotDatabase(databasePath)).toEqual({
      ...beforeDatabase,
      action_records: beforeDatabase.action_records.map((record) => ({
        ...(record as object),
        summary: null
      })),
      routine_records: beforeDatabase.routine_records.map((record) => ({
        ...(record as object),
        summary: null
      })),
      goals: beforeDatabase.goals.map((goal) => ({
        ...(goal as object),
        predecessor_goal_id: null
      })),
      routines: beforeDatabase.routines.map((routine) => ({
        ...(routine as object),
        arrangement_mode: 'weekly'
      })),
      metadata: beforeDatabase.metadata.map((row) =>
        (row as { key: string }).key === 'schemaVersion' ? { ...(row as object), value: '8' } : row
      )
    })

    application = await launchInstalled(root, executable, newVersion)
    await setMainDate(application)
    const added = await (
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
    expect(added).toMatchObject({ ok: true })
    await closeInstalled(application)
    application = undefined

    application = await launchInstalled(root, executable, newVersion)
    const persisted = await (
      await application.firstWindow()
    ).evaluate((id) => window.myTracer.records.listForAction({ actionId: id }), actionId)
    expect(persisted).toMatchObject({
      ok: true,
      value: expect.arrayContaining([
        expect.objectContaining({ durationMinutes: 25, outcome: 'partial' }),
        expect.objectContaining({ durationMinutes: 1, outcome: 'partial' })
      ])
    })
  } finally {
    try {
      if (application && application.process().exitCode === null) await closeInstalled(application)
    } finally {
      try {
        if (installed) {
          await assertExistingPathWithinRoot(root, uninstaller)
          const removal = spawnSync(uninstaller, ['/S'], {
            cwd: root.root,
            env: minimalElectronEnvironment(root),
            encoding: 'utf8',
            timeout: installTimeout
          })
          expect(removal.error).toBeUndefined()
          expect(removal.status).toBe(0)
        }
      } finally {
        await removeTemporaryTestRootWithOptions(root, { maxRetries: 8, retryDelay: 500 })
      }
    }
  }
})

test('observes a running old application during installation', async () => {
  test.setTimeout(600_000)
  assertApprovedWindowsIdentity()
  const oldInstaller = await checkedInstaller(
    'MYTRACER_UPGRADE_OLD_INSTALLER',
    'MYTRACER_UPGRADE_OLD_SHA256'
  )
  const newInstaller = await checkedInstaller(
    'MYTRACER_UPGRADE_NEW_INSTALLER',
    'MYTRACER_UPGRADE_NEW_SHA256'
  )
  const root = await createTemporaryTestRoot()
  const installDirectory = join(root.artifacts, 'nsis-install')
  const executable = join(installDirectory, 'MyTracer.exe')
  const databasePath = join(root.electronUserData, 'data', 'mytracer.sqlite3')
  const uninstaller = join(installDirectory, 'Uninstall MyTracer.exe')
  let installed = false
  let application: ElectronApplication | undefined
  try {
    runInstaller(oldInstaller, installDirectory, root)
    installed = true
    application = await launchInstalled(root, executable, oldVersion, true)
    await setMainDate(application)
    const page = await application.firstWindow()
    await createOldVersionFacts(page)
    await closeInstalled(application)
    application = undefined

    application = await launchInstalled(root, executable, oldVersion)
    await setMainDate(application)
    const runningPage = await application.firstWindow()
    const beforeExport = await exportFacts(
      application,
      runningPage,
      join(root.exports, 'running-before-upgrade.json')
    )
    const beforeConfiguration = await runningPage.evaluate(() =>
      window.myTracer.aiConfiguration.status()
    )
    expect(beforeConfiguration.availability).toBe('configured-available')
    const beforeDatabase = snapshotDatabase(databasePath)

    const attempt = spawnSync(newInstaller, ['/S', `/D=${installDirectory}`], {
      cwd: root.root,
      env: minimalElectronEnvironment(root),
      encoding: 'utf8',
      timeout: 90_000
    })
    console.log(`T081 running-install attempt exit status: ${attempt.status}`)
    expect(attempt.error).toBeUndefined()
    if (attempt.status === 0) {
      const oldProcess = application.process()
      await expect.poll(() => oldProcess.exitCode, { timeout: 5_000 }).not.toBeNull()
      application = undefined
    } else {
      expect(await application.evaluate(({ app }) => app.getVersion())).toBe(oldVersion)
      await closeInstalled(application)
      application = undefined
      runInstaller(newInstaller, installDirectory, root)
    }

    application = await launchInstalled(root, executable, newVersion)
    await setMainDate(application)
    const newPage = await application.firstWindow()
    expect(await newPage.evaluate(() => window.myTracer.aiConfiguration.status())).toEqual(
      beforeConfiguration
    )
    const afterExport = await exportFacts(
      application,
      newPage,
      join(root.exports, 'running-after-upgrade.json')
    )
    expect(afterExport.data).toEqual({
      ...(beforeExport.data as object),
      actionRecords: (beforeExport.data as { actionRecords: object[] }).actionRecords.map(
        (record) => ({ ...record, summary: null })
      ),
      routineRecords: (beforeExport.data as { routineRecords: object[] }).routineRecords.map(
        (record) => ({ ...record, summary: null })
      ),
      goals: (beforeExport.data as { goals: object[] }).goals.map((goal) => ({
        ...goal,
        predecessorGoalId: null
      })),
      routines: (beforeExport.data as { routines: object[] }).routines.map((routine) => ({
        ...routine,
        arrangementMode: 'weekly'
      }))
    })
    await closeInstalled(application)
    application = undefined
    expect(snapshotDatabase(databasePath)).toEqual({
      ...beforeDatabase,
      action_records: beforeDatabase.action_records.map((record) => ({
        ...(record as object),
        summary: null
      })),
      routine_records: beforeDatabase.routine_records.map((record) => ({
        ...(record as object),
        summary: null
      })),
      goals: beforeDatabase.goals.map((goal) => ({
        ...(goal as object),
        predecessor_goal_id: null
      })),
      routines: beforeDatabase.routines.map((routine) => ({
        ...(routine as object),
        arrangement_mode: 'weekly'
      })),
      metadata: beforeDatabase.metadata.map((row) =>
        (row as { key: string }).key === 'schemaVersion' ? { ...(row as object), value: '8' } : row
      )
    })
  } finally {
    try {
      if (application && application.process().exitCode === null) await closeInstalled(application)
    } finally {
      try {
        if (installed) {
          await assertExistingPathWithinRoot(root, uninstaller)
          const removal = spawnSync(uninstaller, ['/S'], {
            cwd: root.root,
            env: minimalElectronEnvironment(root),
            encoding: 'utf8',
            timeout: installTimeout
          })
          expect(removal.error).toBeUndefined()
          expect(removal.status).toBe(0)
        }
      } finally {
        await removeTemporaryTestRootWithOptions(root, { maxRetries: 8, retryDelay: 500 })
      }
    }
  }
})

test('repairs a failed package launch without replacing old facts', async () => {
  test.setTimeout(600_000)
  assertApprovedWindowsIdentity()
  const oldInstaller = await checkedInstaller(
    'MYTRACER_UPGRADE_OLD_INSTALLER',
    'MYTRACER_UPGRADE_OLD_SHA256'
  )
  const newInstaller = await checkedInstaller(
    'MYTRACER_UPGRADE_NEW_INSTALLER',
    'MYTRACER_UPGRADE_NEW_SHA256'
  )
  const root = await createTemporaryTestRoot()
  const installDirectory = join(root.artifacts, 'nsis-install')
  const executable = join(installDirectory, 'MyTracer.exe')
  const databasePath = join(root.electronUserData, 'data', 'mytracer.sqlite3')
  const uninstaller = join(installDirectory, 'Uninstall MyTracer.exe')
  let installed = false
  let application: ElectronApplication | undefined
  try {
    runInstaller(oldInstaller, installDirectory, root)
    installed = true
    application = await launchInstalled(root, executable, oldVersion, true)
    await setMainDate(application)
    const actionId = await createOldVersionFacts(await application.firstWindow())
    await closeInstalled(application)
    application = undefined

    application = await launchInstalled(root, executable, oldVersion)
    await setMainDate(application)
    const oldPage = await application.firstWindow()
    const beforeConfiguration = await oldPage.evaluate(() =>
      window.myTracer.aiConfiguration.status()
    )
    expect(beforeConfiguration.availability).toBe('configured-available')
    const beforeExport = await exportFacts(
      application,
      oldPage,
      join(root.exports, 'before-failed-launch.json')
    )
    await closeInstalled(application)
    application = undefined
    const beforeDatabase = snapshotDatabase(databasePath)

    const damagedInstaller = join(root.artifacts, 'damaged-setup.exe')
    await copyFile(newInstaller, damagedInstaller)
    await truncate(damagedInstaller, 0)
    const failedAttempt = spawnSync(damagedInstaller, ['/S', `/D=${installDirectory}`], {
      cwd: root.root,
      env: minimalElectronEnvironment(root),
      encoding: 'utf8',
      timeout: 10_000
    })
    console.log(
      `T081 damaged-package launch status: ${failedAttempt.status}; spawn error: ${failedAttempt.error ? 'yes' : 'no'}`
    )
    expect(failedAttempt.error || failedAttempt.status !== 0).toBeTruthy()
    expect(snapshotDatabase(databasePath)).toEqual(beforeDatabase)

    application = await launchInstalled(root, executable, oldVersion)
    await closeInstalled(application)
    application = undefined

    runInstaller(newInstaller, installDirectory, root)
    application = await launchInstalled(root, executable, newVersion)
    await setMainDate(application)
    const newPage = await application.firstWindow()
    expect(await newPage.evaluate(() => window.myTracer.aiConfiguration.status())).toEqual(
      beforeConfiguration
    )
    const afterExport = await exportFacts(
      application,
      newPage,
      join(root.exports, 'after-repair.json')
    )
    expect(afterExport.data).toEqual({
      ...(beforeExport.data as object),
      actionRecords: (beforeExport.data as { actionRecords: object[] }).actionRecords.map(
        (record) => ({ ...record, summary: null })
      ),
      routineRecords: (beforeExport.data as { routineRecords: object[] }).routineRecords.map(
        (record) => ({ ...record, summary: null })
      ),
      goals: (beforeExport.data as { goals: object[] }).goals.map((goal) => ({
        ...goal,
        predecessorGoalId: null
      })),
      routines: (beforeExport.data as { routines: object[] }).routines.map((routine) => ({
        ...routine,
        arrangementMode: 'weekly'
      }))
    })
    await closeInstalled(application)
    application = undefined
    expect(snapshotDatabase(databasePath)).toEqual({
      ...beforeDatabase,
      action_records: beforeDatabase.action_records.map((record) => ({
        ...(record as object),
        summary: null
      })),
      routine_records: beforeDatabase.routine_records.map((record) => ({
        ...(record as object),
        summary: null
      })),
      goals: beforeDatabase.goals.map((goal) => ({
        ...(goal as object),
        predecessor_goal_id: null
      })),
      routines: beforeDatabase.routines.map((routine) => ({
        ...(routine as object),
        arrangement_mode: 'weekly'
      })),
      metadata: beforeDatabase.metadata.map((row) =>
        (row as { key: string }).key === 'schemaVersion' ? { ...(row as object), value: '8' } : row
      )
    })

    application = await launchInstalled(root, executable, newVersion)
    const added = await (
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
    expect(added).toMatchObject({ ok: true })
  } finally {
    try {
      if (application && application.process().exitCode === null) await closeInstalled(application)
    } finally {
      try {
        if (installed) {
          await assertExistingPathWithinRoot(root, uninstaller)
          const removal = spawnSync(uninstaller, ['/S'], {
            cwd: root.root,
            env: minimalElectronEnvironment(root),
            encoding: 'utf8',
            timeout: installTimeout
          })
          expect(removal.error).toBeUndefined()
          expect(removal.status).toBe(0)
        }
      } finally {
        await removeTemporaryTestRootWithOptions(root, { maxRetries: 8, retryDelay: 500 })
      }
    }
  }
})
