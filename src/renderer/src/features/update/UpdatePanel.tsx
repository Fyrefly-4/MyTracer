import { type ReactNode, useEffect, useState } from 'react'
import type { UpdateFailureCode, UpdateStatusDto } from '../../../../contracts/updates'

const ERROR_TEXT: Record<UpdateFailureCode, string> = {
  'not-configured': '尚未配置更新源只读凭据。设置后请重启应用。',
  unavailable: '当前无法连接更新源；安装版应用或更新源可能暂不可用。',
  authentication: '更新源拒绝了凭据。请检查凭据是否过期或已撤销。',
  network: '网络连接失败，请检查网络后重试。',
  timeout: '等待更新源超时，请稍后重试。',
  cancelled: '本次操作已取消，可以稍后重试。',
  'invalid-metadata': '更新信息无效或候选已经变化，未使用此安装包。',
  integrity: '下载文件未通过完整性校验，未使用此安装包。',
  'unsupported-version': '更新源提供的版本不受当前稳定通道支持。',
  internal: '更新检查遇到问题，核心功能仍可继续使用。'
}

export function UpdatePanel(props: { readonly onClose: () => void }): ReactNode {
  const [status, setStatus] = useState<UpdateStatusDto | null>(null)
  const [connectionError, setConnectionError] = useState(false)

  useEffect(() => {
    let active = true
    const unsubscribe = window.myTracer.updates.subscribe((next) => {
      if (active) setStatus(next)
    })
    void window.myTracer.updates
      .getStatus()
      .then((next) => {
        if (active) setStatus(next)
      })
      .catch(() => {
        if (active) setConnectionError(true)
      })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const call = (action: () => Promise<UpdateStatusDto>): void => {
    setConnectionError(false)
    void action()
      .then(setStatus)
      .catch(() => setConnectionError(true))
  }
  const candidate = status?.candidate
  const busy = status?.state === 'checking' || status?.state === 'downloading'
  const canDownload =
    candidate &&
    status?.operationId &&
    (status.state === 'available' ||
      (status.state === 'error' && status.error?.retryAction === 'download'))

  return (
    <aside className="update-panel" aria-label="关于与更新">
      <div className="update-panel-heading">
        <div>
          <h2>关于与更新</h2>
          <p>当前版本 {status?.currentVersion ?? '读取中'}</p>
        </div>
        <button
          type="button"
          className="update-close"
          onClick={props.onClose}
          aria-label="关闭更新面板"
        >
          ×
        </button>
      </div>

      {connectionError ? <p role="alert">暂时无法读取更新状态，核心功能仍可使用。</p> : null}
      {status?.state === 'idle' ? <p>如需检查新版本，请手动开始。</p> : null}
      {status?.state === 'checking' ? <p role="status">正在检查私有更新源…</p> : null}
      {status?.state === 'upToDate' ? <p role="status">当前已是最新稳定版。</p> : null}
      {status?.state === 'available' ? (
        <p role="status">发现可用版本 {candidate?.version}。</p>
      ) : null}
      {status?.state === 'downloading' ? (
        <p role="status">
          正在下载 {candidate?.version}：{Math.round(status.progressPercent ?? 0)}%
        </p>
      ) : null}
      {status?.state === 'downloaded' ? (
        <p role="status">版本 {candidate?.version} 已下载并校验。稍后可继续使用当前版本。</p>
      ) : null}
      {status?.state === 'error' && status.error ? (
        <p role="alert">{ERROR_TEXT[status.error.code]}</p>
      ) : null}

      {candidate ? (
        <div className="update-candidate">
          <strong>目标版本 {candidate.version}</strong>
          {candidate.releaseNotes ? <p>{candidate.releaseNotes}</p> : <p>暂无更新说明。</p>}
        </div>
      ) : null}

      <div className="update-actions">
        <button
          type="button"
          onClick={() => call(() => window.myTracer.updates.check())}
          disabled={!status || busy}
        >
          {status?.state === 'error' && status.error?.retryAction === 'check'
            ? '重试检查'
            : '检查更新'}
        </button>
        {canDownload ? (
          <button
            type="button"
            onClick={() =>
              call(() =>
                window.myTracer.updates.download({
                  operationId: status.operationId!,
                  version: candidate.version
                })
              )
            }
          >
            {status?.state === 'error' ? '重试下载' : '确认下载'}
          </button>
        ) : null}
        {busy && status?.operationId ? (
          <button
            type="button"
            onClick={() =>
              call(() => window.myTracer.updates.cancel({ operationId: status.operationId! }))
            }
          >
            取消
          </button>
        ) : null}
        <button type="button" onClick={props.onClose}>
          稍后
        </button>
      </div>
      <p className="update-privacy">检查更新会连接私有分发服务；不会上传本地记录或 AI 密钥。</p>
    </aside>
  )
}
