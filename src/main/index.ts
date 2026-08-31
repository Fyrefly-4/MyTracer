import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, BrowserWindow, dialog, ipcMain, safeStorage } from 'electron'
import { GoalService } from '../application/goals'
import { ActionService } from '../application/actions'
import { TodayService } from '../application/today'
import { ActionRecordService } from '../application/action-records'
import { ProgressService } from '../application/progress'
import { RecoveryService } from '../application/recovery'
import { ReviewService } from '../application/review'
import { RoutineService } from '../application/routines'
import { RoutineRecordService } from '../application/routine-records'
import { DataControlService } from '../application/data-control'
import { CompleteExportService } from '../application/complete-export'
import { queryShellStatus } from '../application/query-shell-status'
import { AiStartHelpService } from '../application/ai-start-help'
import {
  AiProviderError,
  type AiStartHelpProvider,
  type ProviderRequestOptions,
  type StartHelpRequestDto
} from '../application/ports/ai-start-help'
import type { MutableAiConfigurationPort } from '../application/ports/configuration'
import type { DiagnosticsPort } from '../application/ports/diagnostics'
import { asStartHelpContextQueryRepository } from '../application/ports/persistence'
import { SHELL_STATUS_CHANNEL } from '../contracts/shell'
import { SystemClock } from '../infrastructure/clock/system-clock'
import { FileAiConfiguration } from '../infrastructure/configuration/file-ai-configuration'
import { SafeStorageCredentialAdapter } from '../infrastructure/credentials/safe-storage-credential-adapter'
import { LiteLlmStartHelpProvider } from '../infrastructure/ai/litellm-start-help-provider'
import {
  SafeDiagnostics,
  StderrDiagnosticWriter
} from '../infrastructure/diagnostics/safe-diagnostics'
import { resolveProductionDatabasePath } from '../infrastructure/sqlite/database-path'
import { SqliteConnection } from '../infrastructure/sqlite/sqlite-connection'
import { SystemExportAdapter } from '../infrastructure/export/system-export-adapter'
import { registerGoalIpc } from './goals-ipc'
import { registerActionIpc } from './actions-ipc'
import { registerTodayIpc } from './today-ipc'
import { registerRecordIpc } from './records-ipc'
import { registerProgressIpc } from './progress-ipc'
import { registerRecoveryIpc } from './recovery-ipc'
import { registerReviewIpc } from './review-ipc'
import { registerRoutineIpc } from './routines-ipc'
import { registerRoutineRecordIpc } from './routine-records-ipc'
import { ActionRecordingContextStore } from './action-recording-contexts'
import { RoutineRecordingContextStore } from './routine-recording-contexts'
import { DeletePreviewContextStore } from './delete-preview-contexts'
import { ReviewContextStore } from './review-contexts'
import { registerDataControlIpc } from './data-control-ipc'
import { registerExportIpc } from './exports-ipc'
import { assertTrustedSender, type RendererLocation } from './ipc-security'
import { AiStartHelpContextCoordinator } from './ai-start-help-context'
import { AiStartHelpSessionStore } from './ai-start-help-session'
import { registerAiStartHelpIpc } from './ai-start-help-ipc'

let mainWindow: BrowserWindow | null = null
let sqliteConnection: SqliteConnection | null = null
let aiConfiguration: MutableAiConfigurationPort | null = null
let diagnostics: DiagnosticsPort | null = null
let aiStartHelpSessions: AiStartHelpSessionStore | null = null
const actionRecordingContexts = new ActionRecordingContextStore(randomUUID)
const routineRecordingContexts = new RoutineRecordingContextStore(randomUUID)
const deletePreviewContexts = new DeletePreviewContextStore(randomUUID)
const reviewContexts = new ReviewContextStore(randomUUID)

type TestAiScenario =
  | 'success'
  | 'timeout'
  | 'authentication'
  | 'quota'
  | 'rate-limited'
  | 'network'
  | 'invalid-response'
  | 'late-response'
  | 'internal'

function createOfflineTestProvider(): AiStartHelpProvider | null {
  if (process.env.NODE_ENV !== 'test') return null
  const scenario = process.env.MYTRACER_E2E_AI_SCENARIO as TestAiScenario | undefined
  if (
    !scenario ||
    ![
      'success', 'timeout', 'authentication', 'quota', 'rate-limited', 'network',
      'invalid-response', 'late-response', 'internal'
    ].includes(scenario)
  ) return null

  return Object.freeze({
    capabilities: () => ({ configured: true, available: true }),
    requestStartHelp: async (
      _request: StartHelpRequestDto,
      options: ProviderRequestOptions
    ) => {
      if (scenario === 'success' || scenario === 'late-response') {
        if (scenario === 'late-response') {
          await new Promise((resolve) => setTimeout(resolve, 60))
        }
        return {
          acknowledgement: '现在难开始也没关系，我们只找一个很小的起点。',
          suggestions: [{ text: '先打开行动需要的资料，只看一眼标题。' }],
          understandingCandidates: [
            { text: '这次阻力可能来自下一步还不够具体。' },
            { text: '把起点缩小后更容易开始。' }
          ],
          safetyNotes: ['如果现在需要休息，也可以先休息。']
        }
      }
      if (scenario === 'invalid-response') return { acknowledgement: 'invalid', suggestions: [] }
      if (scenario === 'timeout') {
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener(
            'abort',
            () => reject(new DOMException('cancelled', 'AbortError')),
            { once: true }
          )
        })
      }
      if (scenario === 'authentication') throw new AiProviderError('authentication')
      if (scenario === 'quota') throw new AiProviderError('quota')
      if (scenario === 'rate-limited') throw new AiProviderError('rate-limited')
      if (scenario === 'network') throw new AiProviderError('network')
      throw new AiProviderError('internal')
    }
  })
}

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
  const senderId = mainWindow.webContents.id
  mainWindow.webContents.on('did-start-navigation', () => {
    actionRecordingContexts.clearSender(senderId)
    routineRecordingContexts.clearSender(senderId)
    deletePreviewContexts.clearSender(senderId)
    reviewContexts.clearSender(senderId)
    aiStartHelpSessions?.clearSender(senderId)
  })
  mainWindow.webContents.on('destroyed', () => {
    actionRecordingContexts.clearSender(senderId)
    routineRecordingContexts.clearSender(senderId)
    deletePreviewContexts.clearSender(senderId)
    reviewContexts.clearSender(senderId)
    aiStartHelpSessions?.clearSender(senderId)
  })
  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    actionRecordingContexts.clearSender(senderId)
    routineRecordingContexts.clearSender(senderId)
    deletePreviewContexts.clearSender(senderId)
    reviewContexts.clearSender(senderId)
    aiStartHelpSessions?.clearSender(senderId)
    mainWindow = null
  })

  await loadTrustedRenderer(mainWindow)
}

app.whenReady().then(async () => {
  const clock = new SystemClock()
  diagnostics = new SafeDiagnostics(clock, new StderrDiagnosticWriter())
  const credentialStore = new SafeStorageCredentialAdapter(safeStorage)
  aiConfiguration = new FileAiConfiguration({
    userDataPath: app.getPath('userData'),
    credentialProtection: credentialStore
  })

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
  const actionService = new ActionService({
    repository: sqliteConnection.repository,
    unitOfWork: sqliteConnection,
    clock,
    generateId: randomUUID
  })
  const todayService = new TodayService({
    repository: sqliteConnection.repository,
    unitOfWork: sqliteConnection,
    clock
  })
  const routineService = new RoutineService({
    repository: sqliteConnection.repository,
    unitOfWork: sqliteConnection,
    clock,
    generateId: randomUUID
  })
  const actionRecordService = new ActionRecordService({
    repository: sqliteConnection.repository,
    unitOfWork: sqliteConnection,
    clock,
    generateId: randomUUID
  })
  const routineRecordService = new RoutineRecordService({
    repository: sqliteConnection.repository,
    unitOfWork: sqliteConnection,
    clock,
    generateId: randomUUID
  })
  const progressService = new ProgressService({ repository: sqliteConnection.repository })
  const recoveryService = new RecoveryService({ repository: sqliteConnection.repository, clock })
  const reviewService = new ReviewService({
    repository: sqliteConnection.repository,
    unitOfWork: sqliteConnection,
    clock,
    generateId: randomUUID
  })
  const dataControlService = new DataControlService({
    repository: sqliteConnection.repository,
    unitOfWork: sqliteConnection,
    clock,
    generateId: randomUUID
  })
  const completeExportService = new CompleteExportService({
    repository: sqliteConnection.repository,
    clock,
    exportPort: new SystemExportAdapter({
      dialog: { showSaveDialog: (options) => dialog.showSaveDialog(options) },
      generateToken: randomUUID
    })
  })
  const contextCoordinator = new AiStartHelpContextCoordinator({
    contextQuery: asStartHelpContextQueryRepository(sqliteConnection.repository),
    clock,
    contextBudget: { totalTextCharacters: 8_000 },
    requestCapture: { captureStartHelpRequest: () => undefined },
    generateRequestId: randomUUID
  })
  aiStartHelpSessions = new AiStartHelpSessionStore({
    selectContext: (input) => contextCoordinator.start(input),
    readConfiguration: () => aiConfiguration!.readState(),
    execute: (request, signal) => {
      const offlineTestProvider = createOfflineTestProvider()
      if (offlineTestProvider) {
        return new AiStartHelpService({
          provider: offlineTestProvider,
          generateCandidateId: randomUUID
        }).execute(request, signal)
      }
      const credential = aiConfiguration!.readProviderCredential()
      if (!credential) {
        return Promise.resolve({
          ok: false,
          error: { code: 'credential-unavailable', retryable: false }
        })
      }
      return new AiStartHelpService({
        provider: new LiteLlmStartHelpProvider({ apiKey: credential }),
        generateCandidateId: randomUUID
      }).execute(request, signal)
    },
    confirmSuggestion: (command) => {
      goalService.createAndSetGoalCurrentNextAction({
        goalId: command.goalId,
        title: command.finalText,
        expectedCurrentNextActionId: command.expectedCurrentNextActionId,
        expectedGoalUpdatedAt: command.expectedGoalUpdatedAt,
        expectedContextActionId: command.contextActionId,
        expectedContextActionUpdatedAt: command.expectedActionUpdatedAt
      })
    },
    confirmUnderstanding: (command) => {
      actionRecordService.addConfirmedUnderstandingToActionRecord({
        actionRecordId: command.actionRecordId,
        expectedGoalId: command.expectedGoalId,
        text: command.finalText
      })
    },
    generateSessionId: randomUUID,
    generateTargetRef: randomUUID
  })
  registerGoalIpc({
    ipc: ipcMain,
    service: goalService,
    assertSender: (event) => assertTrustedSender(event, mainWindow, getRendererLocation())
  })
  registerActionIpc({
    ipc: ipcMain,
    service: actionService,
    assertSender: (event) => assertTrustedSender(event, mainWindow, getRendererLocation())
  })
  registerTodayIpc({
    ipc: ipcMain,
    service: todayService,
    assertSender: (event) => assertTrustedSender(event, mainWindow, getRendererLocation())
  })
  registerRoutineIpc({
    ipc: ipcMain,
    service: routineService,
    assertSender: (event) => assertTrustedSender(event, mainWindow, getRendererLocation())
  })
  registerRoutineRecordIpc({
    ipc: ipcMain,
    service: routineRecordService,
    contexts: routineRecordingContexts,
    assertSender: (event) => assertTrustedSender(event, mainWindow, getRendererLocation())
  })
  registerRecordIpc({
    ipc: ipcMain,
    service: actionRecordService,
    contexts: actionRecordingContexts,
    assertSender: (event) => assertTrustedSender(event, mainWindow, getRendererLocation())
  })
  registerProgressIpc({
    ipc: ipcMain,
    service: progressService,
    assertSender: (event) => assertTrustedSender(event, mainWindow, getRendererLocation())
  })
  registerRecoveryIpc({
    ipc: ipcMain,
    service: recoveryService,
    assertSender: (event) => assertTrustedSender(event, mainWindow, getRendererLocation())
  })
  registerReviewIpc({
    ipc: ipcMain,
    service: reviewService,
    contexts: reviewContexts,
    assertSender: (event) => assertTrustedSender(event, mainWindow, getRendererLocation())
  })
  registerDataControlIpc({
    ipc: ipcMain,
    service: dataControlService,
    contexts: deletePreviewContexts,
    assertSender: (event) => assertTrustedSender(event, mainWindow, getRendererLocation()),
    now: () => clock.snapshot().instant
  })
  registerExportIpc({
    ipc: ipcMain,
    service: completeExportService,
    assertSender: (event) => assertTrustedSender(event, mainWindow, getRendererLocation())
  })
  registerAiStartHelpIpc({
    ipc: ipcMain,
    sessions: aiStartHelpSessions,
    configuration: aiConfiguration,
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
  actionRecordingContexts.clearAll()
  routineRecordingContexts.clearAll()
  deletePreviewContexts.clearAll()
  reviewContexts.clearAll()
  aiStartHelpSessions?.clearAll()
  diagnostics?.record({
    code: 'application-stopping',
    severity: 'info',
    correlationId: 'shutdown.requested'
  })
  sqliteConnection?.close()
  sqliteConnection = null
  aiConfiguration = null
  aiStartHelpSessions = null
  diagnostics = null
})
