// Browser-only UI smoke. This deliberately does not claim native DWM validation.
import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { applyMaterial } from './material.cjs'

const assets = new Map([
  ['/', ['index.html', 'text/html']],
  ['/shell.css', ['shell.css', 'text/css']],
  ['/renderer.js', ['renderer.js', 'text/javascript']]
])
const server = createServer(async (request, response) => {
  const asset = assets.get(request.url)
  if (!asset) {
    response.writeHead(404).end()
    return
  }
  response.setHeader('Content-Type', asset[1])
  response.end(await readFile(new URL(asset[0], import.meta.url)))
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
let browser
try {
  browser = await chromium.launch({
    executablePath: process.env.SHELL_SMOKE_CHROMIUM || undefined,
    headless: true
  })
  const page = await browser.newPage({ viewport: { width: 1120, height: 760 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  let state
  const windowStub = { setBackgroundMaterial() {}, setBackgroundColor() {} }
  await page.exposeFunction('readShell', () => state)
  await page.exposeFunction('applyShell', (settings) => {
    state = applyMaterial(windowStub, settings, true)
    return state
  })
  await page.addInitScript(() => {
    window.materialShell = {
      read: () => window.readShell(),
      apply: (settings) => window.applyShell(settings)
    }
  })
  state = applyMaterial(
    windowStub,
    { mode: 'environment', material: 'mica', intensity: 'subtle' },
    true
  )
  await page.goto(`http://127.0.0.1:${server.address().port}/`)
  await page.locator('#status').filter({ hasText: '88%' }).waitFor()
  const reference = await page.locator('main').evaluate((node) => ({
    color: getComputedStyle(node).color,
    background: getComputedStyle(node).backgroundColor,
    opacity: getComputedStyle(node).opacity
  }))
  assert.equal(reference.background, 'rgb(250, 249, 245)')
  for (const material of ['mica', 'acrylic']) {
    await page.selectOption('#material', material)
    for (const [intensity, alpha] of [
      ['subtle', '88%'],
      ['standard', '68%'],
      ['strong', '42%']
    ]) {
      await page.selectOption('#intensity', intensity)
      await page.locator('#status').filter({ hasText: alpha }).waitFor()
      assert.deepEqual(
        await page.locator('main').evaluate((node) => ({
          color: getComputedStyle(node).color,
          background: getComputedStyle(node).backgroundColor,
          opacity: getComputedStyle(node).opacity
        })),
        reference
      )
      assert.equal(
        await page
          .locator('article')
          .first()
          .evaluate((node) => getComputedStyle(node).backgroundColor),
        reference.background
      )
      assert.equal(
        await page.locator('body').evaluate((node) => getComputedStyle(node).opacity),
        '1'
      )
    }
  }
  await page.selectOption('#mode', 'solid')
  await page.locator('#status').filter({ hasText: '100%' }).waitFor()
  assert.equal(await page.locator('#intensity').isDisabled(), true)
  await page.selectOption('#mode', 'environment')
  await page.locator('#status').filter({ hasText: '42%' }).waitFor()
  assert.equal(await page.locator('#intensity').isEnabled(), true)
  await page.setViewportSize({ width: 820, height: 600 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  assert.equal(
    await page.locator('.titlebar').evaluate((node) => getComputedStyle(node).webkitAppRegion),
    'drag'
  )
  if (process.env.SHELL_SMOKE_SCREENSHOT)
    await page.screenshot({ path: process.env.SHELL_SMOKE_SCREENSHOT })
  assert.deepEqual(errors, [])
  console.log(
    `PASS: six material/intensity combinations, solid toggle, opaque content, minimum width, drag CSS`
  )
} finally {
  await browser?.close()
  await new Promise((resolve) => server.close(resolve))
}
