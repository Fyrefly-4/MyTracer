import { RecordBookService } from '../application/record-book-service'
import { registerRecordBookIpc } from './record-book-ipc'
import appIcon from '../../resources/brand/MyTracer-app-icon-256.png?asset'
import { readWindowsTransparency, WindowsTransparencyPreference } from './windows-transparency'
import { assertAppearanceSender, registerAppearanceIpc } from './appearance-ipc'
import { release } from 'node:os'
import { APPEARANCE_CHANNELS } from '../contracts/appearance'
import { AppearanceStore, applyAppearance, supportsMica, SHELL_COLOR, CAPTION_OVERLAY } from './appearance'
import { HomeService } from '../application/home'
import { registerHomeIpc } from './home-ipc'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, BrowserWindow, dialog, ipcMain, nativeTheme, safeStorage, type IpcMainInvokeEvent } from 'electron'
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
import { UpdateService } from '../application/update-service'
import { UpdatePortError, type UpdatePort } from '../application/ports/update'
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
import { UPDATE_CHANNELS } from '../contracts/updates'
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
import { GithubUpdatePort } from '../infrastructure/update/github-update-port'
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
import { registerUpdatesIpc } from './updates-ipc'
import { createOfflineTestUpdatePort } from './test-update-port'
import { InstallOperationGate } from './install-operation-gate'
import { RendererDraftProbe } from './renderer-draft-probe'
import { UpdateInstallCoordinator } from './update-install-coordinator'

let mainWindow: BrowserWindow | null = null
let sqliteConnection: SqliteConnection | null = null
let aiConfiguration: MutableAiConfigurationPort | null = null
let diagnostics: DiagnosticsPort | null = null
let aiStartHelpSessions: AiStartHelpSessionStore | null = null
let updateService: UpdateService | null = null
const installGate = new InstallOperationGate()
let draftProbe: RendererDraftProbe | null = null
const guardedIpc = {
  removeHandler: (channel: string): void => ipcMain.removeHandler(channel),
  handle: (
    channel: string,
    listener: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown
  ): void => {
    ipcMain.handle(channel, (event, ...args: unknown[]) =>
      installGate.run(() => listener(event, ...args))
    )
  }
}
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
  | 'aggregate-ac02'

const aggregateAc02Inputs = Object.freeze([
  '__ac02_close__',
  '__ac02_reject__',
  '__ac02_stale__',
  '__ac02_accept_original__',
  '__ac02_edit_confirm__',
  '__ac02_understandings__',
  '__ac02_no_record__',
  '__ac02_invalid__',
  '__ac02_authentication__',
  '__ac02_network__',
  '__ac02_provider_unavailable__',
  '__ac02_cancel__',
  '__ac02_timeout_retry__',
  '__ac02_timeout_retry__'
] as const)

const aggregateAc02ForbiddenMarkers = Object.freeze([
  '__ac02_forbidden_other_goal__',
  '__ac02_forbidden_other_action__',
  '__ac02_forbidden_other_record__',
  '__ac02_forbidden_routine__',
  '__ac02_forbidden_review__',
  '__ac02_forbidden_credential__',
  '__ac02_forbidden_diagnostic__',
  '__ac02_forbidden_note_',
  '__ac02_excluded_record_6__',
  '__ac02_allowed_confusion_6__',
  '__ac02_allowed_next_6__'
])

function assertAggregateAc02(condition: boolean, message: string): void {
  if (!condition) throw new Error(`AC-02 scripted fake assertion failed: ${message}`)
}

function assertExactKeys(value: object, allowed: readonly string[], path: string): void {
  const keys = Object.keys(value)
  assertAggregateAc02(
    keys.every((key) => allowed.includes(key)),
    `${path} contained a non-allowlisted key: ${keys.join(', ')}`
  )
}

function assertAggregateAc02Request(request: StartHelpRequestDto, expectedInput: string): void {
  assertExactKeys(
    request,
    ['requestId', 'locale', 'userInput', 'goal', 'action', 'currentNextAction', 'recentRelevantRecords'],
    'request'
  )
  assertExactKeys(request.goal, ['name', 'description'], 'goal')
  assertExactKeys(request.action, ['title', 'description'], 'action')
  if (request.currentNextAction) {
    assertExactKeys(request.currentNextAction, ['title', 'description'], 'currentNextAction')
  }
  for (const [index, record] of request.recentRelevantRecords.entries()) {
    assertExactKeys(
      record,
      [
        'occurredOn',
        'outcome',
        'durationMinutes',
        'confirmedUnderstandings',
        'openConfusions',
        'nextStepCandidate'
      ],
      `recentRelevantRecords[${index}]`
    )
  }

  assertAggregateAc02(request.userInput === expectedInput, `expected input ${expectedInput}`)
  const serialized = JSON.stringify(request)
  for (const marker of aggregateAc02ForbiddenMarkers) {
    assertAggregateAc02(!serialized.includes(marker), `forbidden marker escaped: ${marker}`)
  }

  if (expectedInput === '__ac02_no_record__') {
    assertAggregateAc02(request.goal.name === '__ac02_empty_goal__', 'wrong empty Goal')
    assertAggregateAc02(request.action.title === '__ac02_empty_action__', 'wrong empty Action')
    assertAggregateAc02(request.recentRelevantRecords.length === 0, 'empty Goal sent Records')
    assertAggregateAc02(!serialized.includes('__ac02_allowed_goal__'), 'other Goal escaped')
    return
  }

  assertAggregateAc02(request.goal.name === '__ac02_allowed_goal__', 'wrong current Goal')
  assertAggregateAc02(request.action.title === '__ac02_allowed_action__', 'wrong opened Action')
  assertAggregateAc02(!serialized.includes('__ac02_empty_goal__'), 'empty other Goal escaped')
  assertAggregateAc02(request.recentRelevantRecords.length === 5, 'Record limit was not five')
  request.recentRelevantRecords.forEach((record, index) => {
    const marker = `__ac02_allowed_record_${index + 1}__`
    assertAggregateAc02(JSON.stringify(record).includes(marker), `Record order omitted ${marker}`)
  })
}

function aggregateAc02Draft(label: string, understandingCount = 3): unknown {
  return {
    acknowledgement: `__ac02_ack_${label}__`,
    suggestions: [{ text: `__ac02_suggestion_${label}__` }],
    understandingCandidates: Array.from({ length: understandingCount }, (_value, index) => ({
      text: `__ac02_understanding_${label}_${index + 1}__`
    })),
    safetyNotes: ['如果现在需要休息，也可以先休息。']
  }
}

function createAggregateAc02Provider(): AiStartHelpProvider {
  let callIndex = 0
  return Object.freeze({
    capabilities: () => ({ configured: true, available: true }),
    requestStartHelp: async (
      request: StartHelpRequestDto,
      options: ProviderRequestOptions
    ): Promise<unknown> => {
      const expectedInput = aggregateAc02Inputs[callIndex]
      assertAggregateAc02(Boolean(expectedInput), `unexpected Provider call ${callIndex + 1}`)
      assertAggregateAc02Request(request, expectedInput!)
      const step = callIndex
      callIndex += 1

      if (step === 7) return { acknowledgement: 'invalid', suggestions: [] }
      if (step === 8) throw new AiProviderError('authentication')
      if (step === 9) throw new AiProviderError('network')
      if (step === 10) throw new AiProviderError('provider-unavailable')
      if (step === 11) {
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener(
            'abort',
            () => reject(new DOMException('cancelled', 'AbortError')),
            { once: true }
          )
        })
      }
      if (step === 12) {
        return new Promise((resolve) => {
          setTimeout(() => resolve(aggregateAc02Draft('late_old_generation')), 900)
        })
      }
      if (step === 13) return aggregateAc02Draft('retry_new_generation')
      if (step === 6) return aggregateAc02Draft('no_record')
      if (step === 5) return aggregateAc02Draft('understandings')
      if (step === 4) return aggregateAc02Draft('edit_confirm')
      if (step === 3) return aggregateAc02Draft('accept_original')
      if (step === 2) return aggregateAc02Draft('stale')
      if (step === 1) return aggregateAc02Draft('reject')
      return aggregateAc02Draft('close')
    }
  })
}

let aggregateAc02Provider: AiStartHelpProvider | null = null

function createOfflineTestProvider(): AiStartHelpProvider | null {
  if (process.env.NODE_ENV !== 'test') return null
  const scenario = process.env.MYTRACER_E2E_AI_SCENARIO as TestAiScenario | undefined
  if (
    !scenario ||
    ![
      'success', 'timeout', 'authentication', 'quota', 'rate-limited', 'network',
      'invalid-response', 'late-response', 'internal', 'aggregate-ac02'
    ].includes(scenario)
  ) return null

  if (scenario === 'aggregate-ac02') {
    aggregateAc02Provider ??= createAggregateAc02Provider()
    return aggregateAc02Provider
  }

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
  nativeTheme.themeSource = 'light'
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 820,
    minHeight: 600,
    show: false,
    backgroundColor: SHELL_COLOR,
    title: 'MyTracer',
    icon: appIcon,
    // Keep OS caption controls and native window behavior without a second title bar.
    titleBarStyle: 'hidden',
    titleBarOverlay: CAPTION_OVERLAY,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  })

  const appearanceWindow = mainWindow
  const store = new AppearanceStore(join(app.getPath('userData'), 'appearance.json'))
  let appearance = store.read()
  const micaSupported = supportsMica(process.platform, release())
  let windowsTransparency: WindowsTransparencyPreference | undefined
  const refreshAppearance = () => {
    const state = applyAppearance(
      appearanceWindow,
      appearance,
      micaSupported,
      (process.platform === 'win32'
        ? windowsTransparency?.enabled !== true
        : nativeTheme.prefersReducedTransparency) ||
        nativeTheme.shouldUseHighContrastColors ||
        nativeTheme.inForcedColorsMode
    )
    if (!appearanceWindow.webContents.isDestroyed())
      appearanceWindow.webContents.send(APPEARANCE_CHANNELS.changed, state)
    return state
  }
  registerAppearanceIpc({
    ipc: guardedIpc,
    assertSender: (event) => assertAppearanceSender(event, appearanceWindow, getRendererLocation()),
    get: refreshAppearance,
    set: (settings) => {
      appearance = store.write(settings)
      return refreshAppearance()
    }
  })
  const refreshSystemAppearance = () => {
    refreshAppearance()
    void windowsTransparency?.refresh()
  }
  if (micaSupported) {
    windowsTransparency = new WindowsTransparencyPreference(
      readWindowsTransparency,
      refreshAppearance
    )
    // Windows broadcasts WM_SETTINGCHANGE when personalization/accessibility settings change.
    appearanceWindow.hookWindowMessage(0x001a, refreshSystemAppearance)
    appearanceWindow.on('focus', refreshSystemAppearance)
  }
  nativeTheme.on('updated', refreshSystemAppearance)
  const syncCaption = () => appearanceWindow.setTitleBarOverlay(CAPTION_OVERLAY)
  appearanceWindow.on('focus', syncCaption)
  appearanceWindow.on('blur', syncCaption)
  appearanceWindow.on('maximize', syncCaption)
  appearanceWindow.on('unmaximize', syncCaption)
  appearanceWindow.once('closed', () => {
    windowsTransparency?.dispose()
    nativeTheme.removeListener('updated', refreshSystemAppearance)
  })
  refreshAppearance()
  applyWebContentsRestrictions(mainWindow)
  mainWindow.on('close', (event) => {
    if (installGate.state === 'preparing') event.preventDefault()
  })
  const senderId = mainWindow.webContents.id
  mainWindow.webContents.on('did-start-navigation', () => {
    actionRecordingContexts.clearSender(senderId)
    routineRecordingContexts.clearSender(senderId)
    deletePreviewContexts.clearSender(senderId)
    reviewContexts.clearSender(senderId)
    aiStartHelpSessions?.clearSender(senderId)
  })
  mainWindow.webContents.on('destroyed', () => {
    draftProbe?.clear()
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

  await windowsTransparency?.refresh()
  if (!appearanceWindow.isDestroyed()) await loadTrustedRenderer(appearanceWindow)
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) app.quit()
app.on('second-instance', () => {
  if (mainWindow?.isMinimized()) mainWindow.restore()
  mainWindow?.focus()
})

app.whenReady().then(async () => {
  if (!hasSingleInstanceLock) return
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
  let updatePort: UpdatePort
  try {
    updatePort = createOfflineTestUpdatePort(app.getVersion()) ?? new GithubUpdatePort({
      token: process.env.MYTRACER_UPDATE_TOKEN,
      isPackaged: app.isPackaged
    })
  } catch {
    updatePort = {
      check: async () => {
        throw new UpdatePortError('unavailable')
      }
    }
  }
  updateService = new UpdateService({
    port: updatePort,
    currentVersion: app.getVersion(),
    generateId: randomUUID
  })
  updateService.subscribe((status) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(UPDATE_CHANNELS.changed, status)
    }
  })
  draftProbe = new RendererDraftProbe({
    generateId: randomUUID,
    sendRequest: (requestId) => {
      if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) {
        return false
      }
      mainWindow.webContents.send(UPDATE_CHANNELS.draftRequest, { requestId })
      return true
    }
  })
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
  const progressService = new ProgressService({ repository: sqliteConnection.repository, clock })
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
  const recordBookService = new RecordBookService({
    repository: sqliteConnection.repository,
    clock,
    delivery: new SystemExportAdapter({
      dialog: { showSaveDialog: (options) => dialog.showSaveDialog(options) },
      generateToken: randomUUID
    })
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
          generateCandidateId: randomUUID,
          ...(process.env.NODE_ENV === 'test' &&
          process.env.MYTRACER_E2E_AI_SCENARIO === 'aggregate-ac02'
            ? { deadlineMs: 500 }
            : {})
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
    ipc: guardedIpc,
    service: goalService,
    assertSender: (event) => assertTrustedSender(event, mainWindow, getRendererLocation())
  })
  registerActionIpc({
    ipc: guardedIpc,
    service: actionService,
    assertSender: (event) => assertTrustedSender(event, mainWindow, getRendererLocation())
  })
  registerTodayIpc({
    ipc: guardedIpc,
    service: todayService,
    assertSender: (event) => assertTrustedSender(event, mainWindow, getRendererLocation())
  })
  registerRoutineIpc({
    ipc: guardedIpc,
    service: routineService,
    assertSender: (event) => assertTrustedSender(event, mainWindow, getRendererLocation())
  })
  registerRoutineRecordIpc({
    ipc: guardedIpc,
    service: routineRecordService,
    contexts: routineRecordingContexts,
    assertSender: (event) => assertTrustedSender(event, mainWindow, getRendererLocation())
  })
  registerRecordIpc({
    ipc: guardedIpc,
    service: actionRecordService,
    contexts: actionRecordingContexts,
    assertSender: (event) => assertTrustedSender(event, mainWindow, getRendererLocation())
  })
  registerHomeIpc({
    ipc: guardedIpc,
    service: new HomeService(sqliteConnection.homeQuery, clock),
    assertSender: (event) => assertTrustedSender(event, mainWindow, getRendererLocation())
  })
  registerProgressIpc({
    ipc: guardedIpc,
    service: progressService,
    assertSender: (event) => assertTrustedSender(event, mainWindow, getRendererLocation())
  })
  registerRecoveryIpc({
    ipc: guardedIpc,
    service: recoveryService,
    assertSender: (event) => assertTrustedSender(event, mainWindow, getRendererLocation())
  })
  registerReviewIpc({
    ipc: guardedIpc,
    service: reviewService,
    contexts: reviewContexts,
    assertSender: (event) => assertTrustedSender(event, mainWindow, getRendererLocation())
  })
  registerDataControlIpc({
    ipc: guardedIpc,
    service: dataControlService,
    contexts: deletePreviewContexts,
    assertSender: (event) => assertTrustedSender(event, mainWindow, getRendererLocation()),
    now: () => clock.snapshot().instant
  })
  registerExportIpc({
    ipc: guardedIpc,
    service: completeExportService,
    assertSender: (event) => assertTrustedSender(event, mainWindow, getRendererLocation())
  })
  registerRecordBookIpc({
    ipc: guardedIpc,
    service: recordBookService,
    assertSender: (event) => assertTrustedSender(event, mainWindow, getRendererLocation())
  })
  registerAiStartHelpIpc({
    ipc: guardedIpc,
    sessions: aiStartHelpSessions,
    configuration: aiConfiguration,
    assertSender: (event) => assertTrustedSender(event, mainWindow, getRendererLocation())
  })
  const installCoordinator = new UpdateInstallCoordinator({
    service: updateService,
    gate: installGate,
    probeDrafts: () => draftProbe!.request(),
    hasPendingAiDraft: () => {
      if (!mainWindow || !aiStartHelpSessions) return true
      const state = aiStartHelpSessions.status(mainWindow.webContents.id).state
      return !['idle', 'cancelled', 'confirmed', 'rejected', 'closed'].includes(state)
    },
    cancelAiRequests: () => aiStartHelpSessions?.clearAll(),
    closeDatabase: () => {
      sqliteConnection?.close()
      sqliteConnection = null
    },
    quitApplication: () => app.quit()
  })
  registerUpdatesIpc({
    ipc: ipcMain,
    service: updateService,
    installCoordinator,
    draftProbe,
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

app.on('before-quit', (event) => {
  if (installGate.state === 'preparing') {
    event.preventDefault()
    return
  }
  const updateStatus = updateService?.getStatus()
  if (updateStatus?.operationId) updateService?.cancel({ operationId: updateStatus.operationId })
  updateService = null
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
