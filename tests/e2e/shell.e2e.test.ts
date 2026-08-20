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
    await expect(page.getByRole('heading', { name: '今天，从一个真实动作开始' })).toBeVisible()

    const status = await page.evaluate(() => window.myTracer.shell.getStatus())
    expect(status.ai).toEqual({ configured: false, availability: 'not-configured' })
    expect(await page.evaluate(() => Object.keys(window.myTracer))).toEqual([
      'shell',
      'goals',
      'actions',
      'today',
      'records',
      'progress',
      'routines',
      'dataControl',
      'exports'
    ])
    expect(await page.evaluate(() => Object.keys(window.myTracer.shell))).toEqual(['getStatus'])
    expect(await page.evaluate(() => Object.keys(window.myTracer.goals))).toEqual([
      'create',
      'updateDetails',
      'pause',
      'resume',
      'end',
      'setCurrentNextAction',
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
      'begin',
      'cancel',
      'record',
      'listForAction',
      'getDetail'
    ])
    expect(await page.evaluate(() => Object.keys(window.myTracer.progress))).toEqual(['get'])
    expect(await page.evaluate(() => Object.keys(window.myTracer.exports))).toEqual(['generate'])
    expect(await page.evaluate(() => typeof Reflect.get(window, 'node'))).toBe('undefined')
    expect(await page.evaluate(() => typeof Reflect.get(window, 'require'))).toBe('undefined')
    expect(await page.evaluate(() => typeof Reflect.get(window, 'process'))).toBe('undefined')
    expect(await page.evaluate(() => typeof Reflect.get(window, 'safeStorage'))).toBe('undefined')

    await page.getByRole('button', { name: 'Progress' }).click()
    await expect(page.getByRole('heading', { name: '进展会来自已经记录的事实' })).toBeVisible()
    await page.getByRole('button', { name: 'Review' }).click()
    await expect(page.getByRole('heading', { name: '复盘将帮助你选择下一次调整' })).toBeVisible()
    await page.getByRole('button', { name: 'Today' }).click()
    await expect(page.getByRole('heading', { name: '今天，从一个真实动作开始' })).toBeVisible()
  } finally {
    try {
      await application?.close()
      if (databasePath) {
        const database = new Database(databasePath, { readonly: true })
        try {
          expect(
            database.prepare("SELECT value FROM metadata WHERE key = 'schemaVersion'").get()
          ).toEqual({
            value: '2'
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
