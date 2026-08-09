import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, BrowserWindow, ipcMain, safeStorage } from 'electron'
import { GoalService } from '../application/goals'
import { queryShellStatus } from '../application/query-shell-status'
import type { AiConfigurationPort } from '../application/ports/configuration'
import type { DiagnosticsPort } from '../application/ports/diagnostics'
import { SHELL_STATUS_CHANNEL } from '../contracts/shell'
import { SystemClock } from '../infrastructure/clock/system-clock'
import { EmptyAiConfiguration } from '../infrastructure/configuration/empty-ai-configuration'
import { EmptySafeStorageCredentialAdapter } from '../infrastructure/credentials/safe-storage-credential-adapter'
import {
  SafeDiagnostics,
  StderrDiagnosticWriter
} from '../infrastructure/diagnostics/safe-diagnostics'
import { resolveProductionDatabasePath } from '../infrastructure/sqlite/database-path'
import { SqliteConnection } from '../infrastructure/sqlite/sqlite-connection'
import { registerGoalIpc } from './goals-ipc'
import { assertTrustedSender, type RendererLocation } from './ipc-security'

let mainWindow: BrowserWindow | null = null
let sqliteConnection: SqliteConnection | null = null
let aiConfiguration: AiConfigurationPort | null = null
let diagnostics: DiagnosticsPort | null = null

function getRendererLocation(): RendererLocation {
  const rendererFile = join(__dirname, '../renderer/index.html')

  return {
    developmentUrl: process.env.ELECTRON_RENDERER_URL,
    productionUrl: pathToFileURL(rendererFile).toString()
  }
}

function registerShellQuery(): void {
  ipcMain.removeHandler(SHELL_STATUS_CHANNEL)
  ipcMain.handle(SHELL_STATUS_CHANNEL, (event, ...args: unknown[]) => {
    assertTrustedSender(event, mainWindow, getRendererLocation())
    if (args.length !== 0) {
      throw new TypeError('shell:query-status does not accept input.')
    }
    return queryShellStatus(app.getVersion(), aiConfiguration?.readState())
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
  const clock = new SystemClock()
  diagnostics = new SafeDiagnostics(clock, new StderrDiagnosticWriter())
  const credentialStore = new EmptySafeStorageCredentialAdapter(safeStorage)
  aiConfiguration = new EmptyAiConfiguration(credentialStore)

  try {
    sqliteConnection = SqliteConnection.open(resolveProductionDatabasePath(app.getPath('userData')))
  } catch {
    diagnostics.record({
      code: 'sqlite-initialization-failed',
      severity: 'error',
      correlationId: 'startup.sqlite',
      category: 'persistence'
    })
    throw new Error('MyTracer could not initialize its local data store.')
  }

  const configuration = aiConfiguration.readState()
  diagnostics.record({
    code:
      configuration.credentialProtection === 'available'
        ? 'configuration-not-configured'
        : 'safe-storage-unavailable',
    severity: configuration.credentialProtection === 'available' ? 'info' : 'warning',
    correlationId: 'startup.configuration',
    category:
      configuration.credentialProtection === 'available'
        ? 'configuration'
        : 'credential-protection'
  })
  diagnostics.record({
    code: 'application-started',
    severity: 'info',
    correlationId: 'startup.complete'
  })
  registerShellQuery()
  const goalService = new GoalService({
    repository: sqliteConnection.repository,
    unitOfWork: sqliteConnection,
    clock,
    generateId: randomUUID
  })
  registerGoalIpc({
    ipc: ipcMain,
    service: goalService,
    assertSender: (event) => assertTrustedSender(event, mainWindow, getRendererLocation())
  })
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

app.on('before-quit', () => {
  diagnostics?.record({
    code: 'application-stopping',
    severity: 'info',
    correlationId: 'shutdown.requested'
  })
  sqliteConnection?.close()
  sqliteConnection = null
  aiConfiguration = null
  diagnostics = null
})
