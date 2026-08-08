import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { queryShellStatus } from '../application/query-shell-status'
import { SHELL_STATUS_CHANNEL } from '../contracts/shell'

let mainWindow: BrowserWindow | null = null

function getRendererLocation(): { readonly developmentUrl?: string; readonly productionUrl: string } {
  const rendererFile = join(__dirname, '../renderer/index.html')

  return {
    developmentUrl: process.env.ELECTRON_RENDERER_URL,
    productionUrl: pathToFileURL(rendererFile).toString()
  }
}

function isTrustedRendererUrl(candidate: string): boolean {
  const { developmentUrl, productionUrl } = getRendererLocation()

  if (candidate === productionUrl) {
    return true
  }

  if (!developmentUrl) {
    return false
  }

  try {
    const candidateUrl = new URL(candidate)
    const trustedDevelopmentUrl = new URL(developmentUrl)

    return (
      candidateUrl.origin === trustedDevelopmentUrl.origin &&
      candidateUrl.pathname === trustedDevelopmentUrl.pathname
    )
  } catch {
    return false
  }
}

function assertTrustedSender(event: IpcMainInvokeEvent, args: readonly unknown[]): void {
  const senderFrameUrl = event.senderFrame?.url

  if (
    !mainWindow ||
    event.sender.id !== mainWindow.webContents.id ||
    typeof senderFrameUrl !== 'string' ||
    !isTrustedRendererUrl(senderFrameUrl)
  ) {
    throw new Error('Rejected IPC request from an untrusted renderer.')
  }

  if (args.length !== 0) {
    throw new TypeError('shell:query-status does not accept input.')
  }
}

function registerShellQuery(): void {
  ipcMain.removeHandler(SHELL_STATUS_CHANNEL)
  ipcMain.handle(SHELL_STATUS_CHANNEL, (event, ...args: unknown[]) => {
    assertTrustedSender(event, args)
    return queryShellStatus(app.getVersion())
  })
}

async function loadTrustedRenderer(window: BrowserWindow): Promise<void> {
  const { developmentUrl } = getRendererLocation()

  if (developmentUrl) {
    await window.loadURL(developmentUrl)
  } else {
    await window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function applyWebContentsRestrictions(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  window.webContents.on('will-navigate', (event) => event.preventDefault())
  window.webContents.on('will-frame-navigate', (event) => event.preventDefault())
  window.webContents.on('will-redirect', (event) => event.preventDefault())

  window.webContents.on('will-attach-webview', (event) => {
    event.preventDefault()
  })

  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })
}

async function createMainWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 820,
    minHeight: 600,
    show: false,
    backgroundColor: '#f4f1ea',
    title: 'MyTracer',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  })

  applyWebContentsRestrictions(mainWindow)
  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  await loadTrustedRenderer(mainWindow)
}

app.whenReady().then(async () => {
  registerShellQuery()
  await createMainWindow()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createMainWindow()
  }
})

app.on('window-all-closed', () => {
  app.quit()
})
