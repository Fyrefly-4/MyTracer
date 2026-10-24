import Database from 'better-sqlite3'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { minimalElectronEnvironment } from '../support/electron-environment'
import {
  assertExistingPathWithinRoot,
  createTemporaryTestRoot,
  removeTemporaryTestRoot
} from '../support/temporary-test-root'

test('runs the Electron shell with an isolated userData root', async () => {
  const testRoot = await createTemporaryTestRoot()
  let application: Awaited<ReturnType<typeof electron.launch>> | undefined
  let databasePath: string | undefined

  try {
    application = await electron.launch({
      cwd: testRoot.root,
      args: [
        join(process.cwd(), 'out/main/index.js'),
        `--user-data-dir=${testRoot.electronUserData}`
      ],
      env: minimalElectronEnvironment(testRoot)
    })

    const actualUserData = await application.evaluate(({ app }) => app.getPath('userData'))
    await expect(
      assertExistingPathWithinRoot(testRoot, actualUserData),
      'Electron must use this test case temporary root'
    ).resolves.toBeDefined()
    const actualWorkingDirectory = await application.evaluate(() => process.cwd())
    expect(actualWorkingDirectory).toBe(testRoot.root)
    databasePath = join(actualUserData, 'data', 'mytracer.sqlite3')

    const inheritedEnvironment = await application.evaluate(() => ({
      home: process.env.HOME,
      userProfile: process.env.USERPROFILE,
      appData: process.env.APPDATA,
      localAppData: process.env.LOCALAPPDATA,
      temp: process.env.TEMP,
      tmp: process.env.TMP,
      sensitiveNames: Object.keys(process.env).filter((name) =>
        /(?:API[_-]?KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)/i.test(name)
      )
    }))
    expect(inheritedEnvironment).toEqual({
      home: testRoot.root,
      userProfile: testRoot.root,
      appData: testRoot.roamingAppData,
      localAppData: testRoot.localAppData,
      temp: testRoot.temporary,
      tmp: testRoot.temporary,
      sensitiveNames: []
    })

    const page = await application.firstWindow()
    await expect(
      page.getByRole('heading', { name: '看看最近走到了哪里。', exact: true })
    ).toBeVisible()

    const mark = page.getByRole('banner').getByRole('img', { name: 'MyTracer', exact: true })
    await expect(mark).toBeVisible()
    expect(
      await mark.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)
    ).toBe(true)
    const iconSize = await application.evaluate(({ app, nativeImage }) => {
      const icon = nativeImage.createFromPath(
        `${app.getAppPath()}/../../resources/brand/MyTracer-app-icon-256.png`
      )
      return icon.getSize()
    })
    expect(iconSize).toEqual({ width: 256, height: 256 })

    const status = await page.evaluate(() => window.myTracer.shell.getStatus())
    expect(status.ai).toEqual({ configured: false, availability: 'not-configured' })
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
    expect(await page.evaluate(() => Object.keys(window.myTracer.recordBook))).toEqual([
      'read',
      'export'
    ])
    expect(await page.evaluate(() => Object.isFrozen(window.myTracer.recordBook))).toBe(true)
    expect(await page.evaluate(() => Object.keys(window.myTracer.home))).toEqual(['get', 'day'])
    expect(await page.evaluate(() => Object.isFrozen(window.myTracer.home))).toBe(true)
    expect(await page.evaluate(() => Object.keys(window.myTracer.shell))).toEqual([
      'getAppearance',
      'setAppearance',
      'subscribeAppearance',
      'getStatus'
    ])
    expect(await page.evaluate(() => Object.keys(window.myTracer.goals))).toEqual([
      'create',
      'createStage',
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
    expect(await page.evaluate(() => typeof Reflect.get(window, 'node'))).toBe('undefined')
    expect(await page.evaluate(() => typeof Reflect.get(window, 'require'))).toBe('undefined')
    expect(await page.evaluate(() => typeof Reflect.get(window, 'process'))).toBe('undefined')
    expect(await page.evaluate(() => typeof Reflect.get(window, 'safeStorage'))).toBe('undefined')

    await page.getByRole('button', { name: '进展', exact: true }).click()
    await expect(page.getByRole('heading', { name: '进展', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '复盘', exact: true }).click()
    await expect(page.getByRole('heading', { name: '复盘', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: '本周期还没有记录' })).toBeVisible()
    await expect(page.getByText(/未记录不等于未进行或失败/)).toBeVisible()
    await page.getByRole('button', { name: '今天', exact: true }).click()
    await expect(page.getByRole('heading', { name: '今天', exact: true })).toBeVisible()
  } finally {
    try {
      await application?.close()
      if (databasePath) {
        const database = new Database(databasePath, { readonly: true })
        try {
          expect(
            database.prepare("SELECT value FROM metadata WHERE key = 'schemaVersion'").get()
          ).toEqual({
            value: '6'
          })
        } finally {
          database.close()
        }
      }
    } finally {
      await removeTemporaryTestRoot(testRoot)
    }
  }
})
