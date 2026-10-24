import Database from 'better-sqlite3'
import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { expect, test } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import {
  assertExistingPathWithinRoot,
  createTemporaryTestRoot,
  removeTemporaryTestRootWithOptions,
  type TemporaryTestRoot
} from '../support/temporary-test-root'

test.skip(process.env.MYTRACER_PACKAGE_SMOKE !== '1', 'Runs only after npm.cmd run package.')

const nsisOperationTimeout = process.env.CI === 'true' ? 300_000 : 120_000
const nsisCleanupOptions = process.env.CI === 'true' ? { maxRetries: 8, retryDelay: 500 } : {}

async function verifyPackagedApplication(
  root: TemporaryTestRoot,
  executablePath: string,
  userData: string,
  expectedVersion: string
): Promise<void> {
  await mkdir(userData, { recursive: false })
  const application = await electron.launch({
    executablePath,
    args: ['--disable-gpu', `--user-data-dir=${userData}`],
    cwd: root.root,
    env: minimalElectronEnvironment(root)
  })

  try {
    const actualUserData = await application.evaluate(({ app }) => app.getPath('userData'))
    await expect(assertExistingPathWithinRoot(root, actualUserData)).resolves.toBeDefined()
    expect(actualUserData).toBe(userData)
    expect(await application.evaluate(({ app }) => app.getVersion())).toBe(expectedVersion)

    const page = await application.firstWindow()
    await expect(
      page.getByRole('heading', { name: '看看最近走到了哪里。', exact: true })
    ).toBeVisible()
    expect(await page.evaluate(() => window.myTracer.shell.getStatus())).toMatchObject({
      appName: 'MyTracer',
      platform: 'windows',
      ai: { configured: false, availability: 'not-configured' }
    })
    expect(await page.evaluate(() => Object.keys(window.myTracer))).toEqual([
      'home',
      'shell',
      'updates',
      'goals',
      'actions',
      'today',
      'records',
      'progress',
      'recovery',
      'review',
      'routines',
      'dataControl',
      'recordBook',
      'exports',
      'aiStartHelp',
      'aiConfiguration'
    ])
    expect(await page.evaluate(() => Object.keys(window.myTracer.home))).toEqual(['get', 'day'])
    expect(await page.evaluate(() => Object.isFrozen(window.myTracer.home))).toBe(true)
    expect(await page.evaluate(() => Object.keys(window.myTracer.shell))).toEqual([
      'getAppearance',
      'setAppearance',
      'subscribeAppearance',
      'getStatus'
    ])
    expect(await page.evaluate(() => Object.keys(window.myTracer.updates))).toEqual([
      'getStatus',
      'check',
      'download',
      'cancel',
      'install',
      'cancelPreparation',
      'replyToDraftRequest',
      'subscribe',
      'subscribeDraftRequests'
    ])
    expect(await page.evaluate(() => window.myTracer.updates.getStatus())).toMatchObject({
      state: 'idle',
      currentVersion: expectedVersion
    })
    expect(await page.evaluate(() => window.myTracer.updates.check())).toMatchObject({
      state: 'error',
      error: { code: 'not-configured' }
    })
    await expect(
      page.getByRole('heading', { name: '看看最近走到了哪里。', exact: true })
    ).toBeVisible()
    expect(await page.evaluate(() => Object.keys(window.myTracer.goals))).toEqual([
      'create',
      'updateDetails',
      'pause',
      'resume',
      'end',
      'setCurrentNextAction',
      'createAndSetCurrentNextAction',
      'list',
      'getDetail'
    ])
    expect(await page.evaluate(() => Object.keys(window.myTracer.routines))).toEqual([
      'create',
      'updateDetails',
      'replaceSchedule',
      'pause',
      'resume',
      'end',
      'list',
      'getDetail',
      'beginRecording',
      'cancelRecording',
      'record',
      'getDayState'
    ])
    expect(await page.evaluate(() => Object.keys(window.myTracer.actions))).toEqual([
      'create',
      'updateDetails',
      'complete',
      'cancel',
      'reschedule',
      'getDetail'
    ])
    expect(await page.evaluate(() => Object.keys(window.myTracer.today))).toEqual([
      'selectAction',
      'selectActionAsIntention',
      'removeAction',
      'removeActionIntention',
      'changeActionCommitment',
      'get'
    ])
    expect(await page.evaluate(() => Object.keys(window.myTracer.records))).toEqual([
      'beginFirst',
      'saveFirst',
      'begin',
      'cancel',
      'record',
      'listForAction',
      'getDetail'
    ])
    expect(await page.evaluate(() => Object.keys(window.myTracer.progress))).toEqual([
      'goalActivity',
      'compareWeeks',
      'get'
    ])
    expect(await page.evaluate(() => Object.keys(window.myTracer.recovery))).toEqual(['getContext'])
    expect(await page.evaluate(() => Object.keys(window.myTracer.review))).toEqual([
      'begin',
      'getSummary',
      'getResult',
      'getPreviousAdjustment',
      'complete',
      'cancel'
    ])
    expect(await page.evaluate(() => Object.keys(window.myTracer.recordBook))).toEqual([
      'read',
      'export'
    ])
    expect(await page.evaluate(() => Object.keys(window.myTracer.exports))).toEqual(['generate'])
    expect(await page.evaluate(() => Object.keys(window.myTracer.aiStartHelp))).toEqual([
      'status',
      'start',
      'cancel',
      'retry',
      'reject',
      'confirmSuggestion',
      'confirmUnderstanding',
      'close'
    ])
    expect(await page.evaluate(() => Object.keys(window.myTracer.aiConfiguration))).toEqual([
      'status',
      'importFromEnvironment',
      'enable',
      'disable',
      'deleteCredential'
    ])
    expect(
      await page.evaluate(() =>
        [
          window.myTracer,
          window.myTracer.shell,
          window.myTracer.goals,
          window.myTracer.routines,
          window.myTracer.actions,
          window.myTracer.today,
          window.myTracer.records,
          window.myTracer.progress,
          window.myTracer.recovery,
          window.myTracer.review,
          window.myTracer.dataControl,
          window.myTracer.recordBook,
          window.myTracer.exports,
          window.myTracer.aiStartHelp,
          window.myTracer.aiConfiguration
        ].every((value) => Object.isFrozen(value))
      )
    ).toBe(true)
    expect(await page.evaluate(() => typeof Reflect.get(window, 'node'))).toBe('undefined')
    expect(await page.evaluate(() => typeof Reflect.get(window, 'require'))).toBe('undefined')
    expect(await page.evaluate(() => typeof Reflect.get(window, 'process'))).toBe('undefined')
    expect(await page.evaluate(() => typeof Reflect.get(window, 'safeStorage'))).toBe('undefined')
  } finally {
    await application.close()
  }

  const databasePath = join(userData, 'data', 'mytracer.sqlite3')
  await expect(assertExistingPathWithinRoot(root, databasePath)).resolves.toBe(databasePath)
  const database = new Database(databasePath, { readonly: true })
  try {
    expect(
      database.prepare("SELECT value FROM metadata WHERE key = 'schemaVersion'").get()
    ).toEqual({
      value: '5'
    })
    expect(database.pragma('foreign_keys', { simple: true })).toBe(1)
  } finally {
    database.close()
  }
}

test('starts Windows x64 unpacked and isolated NSIS-installed applications', async () => {
  test.setTimeout(process.env.CI === 'true' ? 720_000 : 300_000)
  test.skip(process.platform !== 'win32', 'T004 package smoke is Windows-only.')

  const packageJson = JSON.parse(await readFile(join(process.cwd(), 'package.json'), 'utf8')) as {
    version: string
  }
  expect(packageJson.version).toMatch(/^\d+\.\d+\.\d+$/)
  const root = await createTemporaryTestRoot()
  const unpackedExecutable = join(process.cwd(), 'release', 'win-unpacked', 'MyTracer.exe')
  const installer = join(process.cwd(), 'release', `MyTracer-${packageJson.version}-x64-setup.exe`)
  const installDirectory = join(root.artifacts, 'nsis-install')
  const unpackedUserData = join(root.root, 'unpacked-user-data')
  const installedUserData = join(root.root, 'installed-user-data')
  const uninstaller = join(installDirectory, 'Uninstall MyTracer.exe')
  let installed = false
  let uninstalled = false

  try {
    await verifyPackagedApplication(root, unpackedExecutable, unpackedUserData, packageJson.version)

    const install = spawnSync(installer, ['/S', `/D=${installDirectory}`], {
      cwd: root.root,
      encoding: 'utf8',
      env: minimalElectronEnvironment(root),
      timeout: nsisOperationTimeout
    })
    expect(install.error).toBeUndefined()
    expect(install.status, install.stderr).toBe(0)
    installed = true

    const installedExecutable = join(installDirectory, 'MyTracer.exe')
    await expect(assertExistingPathWithinRoot(root, installedExecutable)).resolves.toBe(
      installedExecutable
    )
    await verifyPackagedApplication(
      root,
      installedExecutable,
      installedUserData,
      packageJson.version
    )

    await expect(assertExistingPathWithinRoot(root, uninstaller)).resolves.toBe(uninstaller)
    const uninstall = spawnSync(uninstaller, ['/S'], {
      cwd: root.root,
      encoding: 'utf8',
      env: minimalElectronEnvironment(root),
      timeout: nsisOperationTimeout
    })
    expect(uninstall.error).toBeUndefined()
    expect(uninstall.status, uninstall.stderr).toBe(0)
    uninstalled = true
  } finally {
    try {
      if (installed && !uninstalled) {
        const fallbackUninstall = spawnSync(uninstaller, ['/S'], {
          cwd: root.root,
          encoding: 'utf8',
          env: minimalElectronEnvironment(root),
          timeout: nsisOperationTimeout
        })
        expect(fallbackUninstall.error).toBeUndefined()
        expect(fallbackUninstall.status, fallbackUninstall.stderr).toBe(0)
      }
    } finally {
      await removeTemporaryTestRootWithOptions(root, nsisCleanupOptions)
    }
  }
})
