const { app, BrowserWindow, ipcMain, nativeTheme } = require('electron')
const { mkdtempSync, rmSync } = require('node:fs')
const { tmpdir, release } = require('node:os')
const { join } = require('node:path')
const { pathToFileURL } = require('node:url')
const { SHELL, CAPTION, syncCaption, supportsMaterial, applyMaterial } = require('./material.cjs')

// Chromium needs a profile, but this experiment never opens MyTracer's profile/data.
const profile = mkdtempSync(join(tmpdir(), 'mytracer-material-shell-'))
app.setPath('userData', profile)
app.setPath('sessionData', profile)
app.on('quit', () => {
  try {
    rmSync(profile, { recursive: true, force: true })
  } catch {
    /* OS may hold cache files. */
  }
})
const page = pathToFileURL(join(__dirname, 'index.html')).href
const supported = supportsMaterial(process.platform, release())
let window
let state

app
  .whenReady()
  .then(async () => {
    nativeTheme.themeSource = 'light'
    window = new BrowserWindow({
      width: 1120,
      height: 760,
      minWidth: 820,
      minHeight: 600,
      show: false,
      backgroundColor: SHELL,
      title: 'MyTracer · Material shell experiment',
      titleBarStyle: 'hidden',
      titleBarOverlay: CAPTION,
      autoHideMenuBar: true,
      webPreferences: {
        preload: join(__dirname, 'preload.cjs'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        partition: 'material-shell'
      }
    })
    // Reassert the transparent overlay on activation changes without changing DWM material.
    window.on('focus', () => syncCaption(window))
    window.on('blur', () => syncCaption(window))
    const contents = window.webContents
    contents.setWindowOpenHandler(() => ({ action: 'deny' }))
    for (const name of [
      'will-navigate',
      'will-frame-navigate',
      'will-redirect',
      'will-attach-webview'
    ]) {
      contents.on(name, (event) => event.preventDefault())
    }
    contents.session.setPermissionRequestHandler((_contents, _permission, callback) =>
      callback(false)
    )
    contents.session.setPermissionCheckHandler(() => false)
    contents.session.webRequest.onBeforeRequest((details, callback) => {
      callback({ cancel: !details.url.startsWith(pathToFileURL(__dirname + '/').href) })
    })
    function trusted(event) {
      if (
        event.sender !== contents ||
        event.senderFrame !== contents.mainFrame ||
        event.senderFrame.url !== page
      ) {
        throw new Error('Untrusted shell sender')
      }
    }
    state = applyMaterial(
      window,
      { mode: 'environment', material: 'mica', intensity: 'subtle' },
      supported
    )
    ipcMain.handle('material-shell:read', (event) => {
      trusted(event)
      return state
    })
    ipcMain.handle('material-shell:apply', (event, settings) => {
      trusted(event)
      state = applyMaterial(window, settings, supported)
      return state
    })
    window.once('ready-to-show', () => window.show())
    await window.loadURL(page)
  })
  .catch((error) => {
    console.error(error)
    app.exit(1)
  })
app.on('window-all-closed', () => app.quit())
