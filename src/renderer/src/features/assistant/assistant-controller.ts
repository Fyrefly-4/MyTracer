import type {
  AssistantApi,
  AssistantCandidate,
  AssistantCandidatePayload,
  AssistantEntry,
  AssistantResult,
  AssistantRun,
  AssistantScope,
  AssistantSession,
  AssistantSessionSummary,
  AssistantWritePreview
} from '../../../../contracts/assistant'
import type { AssistantServiceStatus } from '../../../../contracts/assistant-service'

export interface AssistantLaunch {
  readonly entry: AssistantEntry
  readonly label: string
  readonly selectedObjects?: AssistantScope['selectedObjects']
  /** Reads live editor state, not the snapshot captured when the panel opened. */
  readonly draft?: {
    revision(): string
    apply(payload: AssistantCandidatePayload): boolean
  }
}
export interface AssistantView {
  readonly visible: boolean
  readonly session: AssistantSession | null
  readonly sessions: readonly AssistantSessionSummary[]
  readonly launch: AssistantLaunch | null
  readonly run: AssistantRun | null
  readonly preview: AssistantWritePreview | null
  readonly busy: boolean
  readonly notice: string
}
const errors: Record<string, string> = {
  'stale-context': '参考内容或编辑草稿已变化，请重新打开并整理；没有覆盖新输入。',
  'not-configured': '尚未配置服务，仍可手工编辑。',
  'provider-unavailable': '服务暂时不可用，仍可手工编辑。',
  cancelled: '已停止；没有自动写入记录。',
  'operation-uncertain': '保存结果尚未确认，请先检查目标记录；不要重新生成或重复保存。',
  unsupported: '当前连接暂不支持此操作。',
  'not-found': '此会话或来源已不存在。'
}
export function candidateText(payload: AssistantCandidatePayload): string {
  switch (payload.kind) {
    case 'action-create':
      return `${payload.title}\n${payload.description ?? ''}`.trim()
    case 'review-draft':
      return `${payload.confirmedProgress}\n${payload.mainObstacle}\n${payload.nextAdjustment}`
    default:
      return payload.text
  }
}
export const candidateLabels: Record<AssistantCandidatePayload['kind'], string> = {
  'record-summary': '替换记录简述',
  'note-append': '追加补充笔记',
  'action-create': '创建行动（不设为下一步）',
  'review-draft': '复盘三字段草稿'
}
function unwrap<T>(result: AssistantResult<T>): T {
  if (!result.ok) throw new Error(result.error.code)
  return result.value
}
/** UI orchestration only. The injected API remains responsible for authority and revision checks. */
export class AssistantController {
  private state: AssistantView = {
    visible: false,
    session: null,
    sessions: [],
    launch: null,
    run: null,
    preview: null,
    busy: false,
    notice: ''
  }
  private listeners = new Set<() => void>()
  private epoch = 0
  private active: { sessionId: string; requestId: string } | null = null
  private cancellation: Promise<void> = Promise.resolve()
  private operation: { previewId: string; operationId: string } | null = null
  constructor(
    readonly api: AssistantApi,
    public service: Pick<
      AssistantServiceStatus,
      'endpoint' | 'model' | 'enabled' | 'credentialPresent'
    >,
    readonly simulation = false
  ) {}
  canStop = (): boolean => this.active !== null
  updateService(service: typeof this.service): void {
    this.invalidate()
    this.service = service
    this.patch({ busy: false, run: null, preview: null, notice: '服务配置已更新；旧请求已停止。' })
  }
  getSnapshot = (): AssistantView => this.state
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private patch(value: Partial<AssistantView>): void {
    this.state = { ...this.state, ...value }
    this.listeners.forEach((listener) => listener())
  }
  private fail(error: unknown): void {
    this.patch({
      notice:
        errors[error instanceof Error ? error.message : ''] ??
        '操作未完成，请稍后重试；手工编辑不受影响。'
    })
  }
  private invalidate(): number {
    this.epoch += 1
    const active = this.active
    this.active = null
    if (active)
      this.cancellation = this.api
        .cancelTurn(active)
        .then(() => undefined)
        .catch(() => undefined)
    this.operation = null
    return this.epoch
  }
  async open(
    launch: AssistantLaunch,
    mode: AssistantSession['mode'] = 'persistent',
    resumeExisting = true
  ): Promise<void> {
    const previousSession = this.state.session
    const token = this.invalidate()
    this.patch({
      visible: true,
      launch,
      session: null,
      run: null,
      preview: null,
      busy: true,
      notice: ''
    })
    try {
      if (previousSession?.mode === 'temporary')
        unwrap(await this.api.deleteSession({ sessionId: previousSession.id }))
      const sessions = unwrap(await this.api.listSessions()).filter((s) => s.mode === 'persistent')
      if (token !== this.epoch) return
      const previous =
        resumeExisting && mode === 'persistent' && launch.entry.intent === 'resume'
          ? sessions.find(
              (s) =>
                s.entry.object.kind === launch.entry.object.kind &&
                s.entry.object.id === launch.entry.object.id
            )
          : undefined
      let session = unwrap(
        await (previous
          ? this.api.getSession({ sessionId: previous.id })
          : this.api.createSession({ entry: launch.entry, mode }))
      )
      if (token !== this.epoch) {
        if (session.mode === 'temporary') await this.api.deleteSession({ sessionId: session.id })
        return
      }
      if (!previous && launch.selectedObjects?.length) {
        session = unwrap(
          await this.api.setScope({
            sessionId: session.id,
            expectedRevision: session.revision,
            scope: { ...session.scope, selectedObjects: launch.selectedObjects }
          })
        )
        if (token !== this.epoch) return
      }
      this.patch({
        session,
        sessions,
        notice: previous
          ? '已恢复本地对话；没有重新发送请求。'
          : mode === 'temporary'
            ? '临时会话不写入本地；关闭后丢弃。'
            : '对话保存在本机，不生成长期记忆。'
      })
      await this.refresh(token)
    } catch (error) {
      if (token === this.epoch) this.fail(error)
    } finally {
      if (token === this.epoch) this.patch({ busy: false })
    }
  }
  createNew(launch: AssistantLaunch, mode: AssistantSession['mode']): Promise<void> {
    return this.open(launch, mode, false)
  }
  private async refresh(token: number): Promise<void> {
    const sessions = unwrap(await this.api.listSessions()).filter((s) => s.mode === 'persistent')
    if (token === this.epoch) this.patch({ sessions })
  }
  close(): void {
    const session = this.state.session
    this.invalidate()
    this.patch({ visible: false, busy: false, preview: null, run: null })
    if (session?.mode === 'temporary') {
      this.patch({ session: null })
      void this.api.deleteSession({ sessionId: session.id }).catch(() => undefined)
    }
  }
  async restore(sessionId: string): Promise<void> {
    const previous = this.state.session
    const token = this.invalidate()
    this.patch({ busy: true, run: null, preview: null, launch: null, session: null })
    try {
      if (previous?.mode === 'temporary')
        unwrap(await this.api.deleteSession({ sessionId: previous.id }))
      const session = unwrap(await this.api.getSession({ sessionId }))
      if (token === this.epoch)
        this.patch({ session, notice: '已恢复对话；如需填入编辑草稿，请从对应编辑器重新进入。' })
    } catch (error) {
      if (token === this.epoch) this.fail(error)
    } finally {
      if (token === this.epoch) this.patch({ busy: false })
    }
  }
  async remove(sessionId: string): Promise<void> {
    if (this.state.busy) return
    const token = this.invalidate()
    this.patch({ busy: true, preview: null })
    try {
      unwrap(await this.api.deleteSession({ sessionId }))
      if (token !== this.epoch) return
      if (this.state.session?.id === sessionId) this.patch({ session: null, run: null })
      this.patch({ notice: '已删除对话；正式记录保持不变。' })
      await this.refresh(token)
    } catch (error) {
      if (token === this.epoch) this.fail(error)
    } finally {
      if (token === this.epoch) this.patch({ busy: false })
    }
  }
  async changeScope(scope: AssistantScope): Promise<void> {
    const session = this.state.session
    if (!session || this.state.busy) return
    const token = this.invalidate()
    this.patch({ busy: true, run: null, preview: null })
    try {
      const next = unwrap(
        await this.api.setScope({
          sessionId: session.id,
          expectedRevision: session.revision,
          scope
        })
      )
      if (token === this.epoch)
        this.patch({ session: next, notice: '参考范围已更新；旧候选与预览已失效。' })
    } catch (error) {
      if (token === this.epoch) this.fail(error)
    } finally {
      if (token === this.epoch) this.patch({ busy: false })
    }
  }
  async send(text: string): Promise<void> {
    const session = this.state.session
    if (!session || this.state.busy || !text.trim()) return
    if (!this.service.enabled || !this.service.credentialPresent) {
      this.patch({ notice: '尚未配置或启用服务，仍可手工编辑。' })
      return
    }
    const token = this.invalidate()
    const request = { sessionId: session.id, requestId: crypto.randomUUID() }
    this.active = request
    this.patch({ busy: true, run: null, preview: null, notice: '正在整理；结果仅为候选。' })
    try {
      await this.cancellation
      if (token !== this.epoch) return
      const current = unwrap(await this.api.getSession({ sessionId: session.id }))
      if (token !== this.epoch) return
      this.patch({ session: current })
      let reading = false
      let progressActive = true
      let reads = 0
      const progress = setInterval(() => {
        if (token !== this.epoch || ++reads > 120) {
          clearInterval(progress)
          return
        }
        if (reading) return
        reading = true
        void this.api
          .getRun(request)
          .then((result) => {
            if (progressActive && token === this.epoch && result.ok)
              this.patch({ run: result.value })
          })
          .catch(() => undefined)
          .finally(() => {
            reading = false
          })
      }, 500)
      let run: AssistantRun
      try {
        run = unwrap(
          await this.api.sendTurn({
            ...request,
            expectedRevision: current.revision,
            text: text.trim()
          })
        )
      } finally {
        progressActive = false
        clearInterval(progress)
      }
      // Also accept adapters that return a running snapshot before completion.
      for (
        let reads = 0;
        token === this.epoch && run.state === 'running' && reads < 120;
        reads += 1
      ) {
        this.patch({ run })
        await new Promise((resolve) => setTimeout(resolve, 500))
        if (token !== this.epoch) return
        run = unwrap(await this.api.getRun(request))
      }
      if (token !== this.epoch) return
      if (run.state === 'running') {
        this.stop()
        return
      }
      const completedSession = unwrap(await this.api.getSession({ sessionId: session.id }))
      if (token !== this.epoch) return
      this.patch({
        run,
        session: completedSession,
        notice:
          run.state === 'completed'
            ? '整理完成；候选尚未写入正式记录。'
            : (errors[run.error?.code ?? 'cancelled'] ?? '整理失败，可以手动重试。')
      })
    } catch (error) {
      if (token === this.epoch) this.fail(error)
    } finally {
      if (token === this.epoch) {
        this.active = null
        this.patch({ busy: false })
      }
    }
  }
  stop(): void {
    const session = this.state.session
    const token = this.invalidate()
    this.patch({ busy: true, run: null, preview: null, notice: '已停止；晚到结果将被忽略。' })
    void this.cancellation
      .then(async () => {
        if (!session || token !== this.epoch) return
        const current = unwrap(await this.api.getSession({ sessionId: session.id }))
        if (token === this.epoch) this.patch({ session: current })
      })
      .catch((error) => {
        if (token === this.epoch) this.fail(error)
      })
      .finally(() => {
        if (token === this.epoch) this.patch({ busy: false })
      })
  }
  clearPreview(): void {
    if (!this.state.busy) {
      this.operation = null
      this.patch({ preview: null })
    }
  }
  async preview(
    candidate: AssistantCandidate,
    payload: AssistantCandidatePayload,
    fillDraft = false
  ): Promise<void> {
    const { session, launch } = this.state
    if (payload.kind === 'review-draft' && !fillDraft) {
      this.patch({ notice: 'Assistant 不直接保存复盘；填入三字段草稿后，请使用原复盘页面确认。' })
      return
    }
    if (!session || this.state.busy || candidate.state !== 'proposed') return
    const token = this.epoch
    this.patch({ busy: true, preview: null })
    try {
      if (
        fillDraft &&
        (candidate.target.kind !== session.entry.object.kind ||
          candidate.target.id !== session.entry.object.id)
      )
        throw new Error('stale-context')
      if (fillDraft && (!launch?.draft || launch.draft.revision() !== session.entry.editorRevision))
        throw new Error('stale-context')
      const preview = unwrap(
        await this.api.previewWrite({
          sessionId: session.id,
          candidateId: candidate.id,
          payload,
          expectedTargetRevision: candidate.expectedTargetRevision
        })
      )
      if (token !== this.epoch) return
      if (fillDraft) {
        if (
          !launch?.draft ||
          !preview.editorRevision ||
          preview.editorRevision !== session.entry.editorRevision ||
          launch.draft.revision() !== preview.editorRevision ||
          (preview.payload.kind === 'review-draft' && preview.destination !== 'editor-draft') ||
          !launch.draft.apply(preview.payload)
        )
          throw new Error('stale-context')
        this.patch({ notice: '已填入未保存草稿；请回到编辑器检查并手动保存。' })
      } else {
        this.operation = { previewId: preview.previewId, operationId: crypto.randomUUID() }
        this.patch({ preview })
      }
    } catch (error) {
      if (token === this.epoch) {
        if (
          fillDraft &&
          payload.kind === 'review-draft' &&
          error instanceof Error &&
          error.message === 'unsupported'
        )
          this.patch({
            notice:
              '当前会话内核尚未提供复盘草稿的来源验证，暂不能安全填入；可查看候选并继续手工复盘。'
          })
        else this.fail(error)
      }
    } finally {
      if (token === this.epoch) this.patch({ busy: false })
    }
  }
  async confirm(): Promise<void> {
    const { session, preview } = this.state
    if (!session || !preview || !this.operation || this.state.busy) return
    const token = this.epoch
    this.patch({ busy: true })
    try {
      unwrap(await this.api.confirmWrite({ sessionId: session.id, ...this.operation }))
      if (token !== this.epoch) return
      this.patch({
        preview: null,
        run: this.state.run
          ? {
              ...this.state.run,
              candidates: this.state.run.candidates.map((c) =>
                c.id === preview.candidateId
                  ? { ...c, state: 'committed' }
                  : c.state === 'committed'
                    ? c
                    : { ...c, state: 'stale' }
              )
            }
          : null,
        notice: '已确认保存。删除对话不会删除这条正式记录。'
      })
      this.operation = null
      try {
        const refreshed = unwrap(await this.api.getSession({ sessionId: session.id }))
        if (token !== this.epoch) return
        this.patch({ session: refreshed })
        const run = this.state.run
        if (run) {
          const authoritative = unwrap(
            await this.api.getRun({ sessionId: session.id, requestId: run.requestId })
          )
          if (token === this.epoch) this.patch({ run: authoritative })
        }
      } catch {
        if (token === this.epoch)
          this.patch({ notice: '已确认保存，但会话状态刷新失败；请重新打开对话后继续。' })
      }
    } catch (error) {
      if (token === this.epoch) {
        if (error instanceof Error && error.message === 'operation-uncertain') {
          this.operation = null
          this.patch({
            preview: null,
            run: this.state.run
              ? {
                  ...this.state.run,
                  candidates: this.state.run.candidates.map((c) =>
                    c.id === preview.candidateId ? { ...c, state: 'uncertain' } : c
                  )
                }
              : null
          })
        }
        this.fail(error)
      }
    } finally {
      if (token === this.epoch) this.patch({ busy: false })
    }
  }
}
