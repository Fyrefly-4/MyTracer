import { useEffect, useRef, useState, type ReactNode } from 'react'
import type {
  AssistantServiceApi,
  AssistantServiceStatus
} from '../../../../contracts/assistant-service'
import './assistant.css'

export function AssistantSettings({
  api,
  simulation = false,
  onChanged,
  onDirtyChange
}: {
  readonly api: AssistantServiceApi
  readonly simulation?: boolean
  readonly onChanged?: (status: AssistantServiceStatus) => void
  readonly onDirtyChange?: (dirty: boolean) => void
}): ReactNode {
  const [endpoint, setEndpoint] = useState('')
  const [model, setModel] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [key, setKey] = useState('')
  const [present, setPresent] = useState(false)
  const [busy, setBusy] = useState(true)
  const [saved, setSaved] = useState(false)
  const [notice, setNotice] = useState('正在读取配置…')
  const alive = useRef(true)
  const baseline = useRef({ endpoint: '', model: '', enabled: false })
  const publishDirty = (next: {
    endpoint?: string
    model?: string
    enabled?: boolean
    key?: string
  }): void => {
    onDirtyChange?.(
      (next.endpoint ?? endpoint) !== baseline.current.endpoint ||
        (next.model ?? model) !== baseline.current.model ||
        (next.enabled ?? enabled) !== baseline.current.enabled ||
        (next.key ?? key).length > 0
    )
  }
  const accept = (status: AssistantServiceStatus): void => {
    baseline.current = { endpoint: status.endpoint, model: status.model, enabled: status.enabled }
    onDirtyChange?.(false)
    setEndpoint(status.endpoint)
    setModel(status.model)
    setEnabled(status.enabled)
    setPresent(status.credentialPresent)
    setSaved(true)
    onChanged?.(status)
  }
  useEffect(() => {
    alive.current = true
    void api
      .getStatus()
      .then((result) => {
        if (!alive.current) return
        if (result.ok) {
          baseline.current = {
            endpoint: result.value.endpoint,
            model: result.value.model,
            enabled: result.value.enabled
          }
          setEndpoint(result.value.endpoint)
          setModel(result.value.model)
          setEnabled(result.value.enabled)
          setPresent(result.value.credentialPresent)
          setSaved(true)
          setNotice('密钥不会回填；留空保留同一服务已有密钥。')
        } else setNotice('配置暂时不可读取；手工功能不受影响。')
      })
      .catch(() => {
        if (alive.current) setNotice('配置暂时不可读取。')
      })
      .finally(() => {
        if (alive.current) setBusy(false)
      })
    return () => {
      alive.current = false
    }
  }, [api])
  const run = async (action: 'save' | 'delete' | 'test'): Promise<void> => {
    if (busy) return
    setBusy(true)
    const credential = key
    // Keep the unsaved credential until persistence succeeds; never publish it to the probe.
    try {
      if (action === 'test') {
        const result = await api.testConnection()
        if (!alive.current) return
        setNotice(
          result.ok
            ? `${simulation ? '模拟测试' : '连接测试'}：已连通。流式：${result.value.streaming === 'unknown' ? '未知' : result.value.streaming === 'supported' ? '支持' : '不支持'}；工具：${result.value.tools === 'unknown' ? '未知' : result.value.tools === 'supported' ? '支持' : '不支持'}。连通不代表全部能力可用。`
            : `连接未通过（${result.error.code}）；手工编辑仍可继续。`
        )
      } else {
        const result = await (action === 'save'
          ? api.saveConfiguration({
              endpoint,
              model,
              enabled,
              ...(credential ? { apiKey: credential } : {})
            })
          : api.deleteCredential())
        if (!alive.current) return
        if (result.ok) {
          setKey('')
          accept(result.value)
          setNotice(action === 'delete' ? '密钥已删除。' : '配置已保存；未发起连接请求。')
        } else setNotice(`操作未完成（${result.error.code}），请检查配置。`)
      }
    } catch {
      if (alive.current) setNotice('服务暂时不可用；未显示原始响应或密钥。')
    } finally {
      if (alive.current) setBusy(false)
    }
  }
  return (
    <section className="assistant-settings" aria-label="Assistant 服务配置">
      <h2>Assistant 服务</h2>
      <p>
        {simulation
          ? '模拟设置：只测试合成服务，不发真实请求。'
          : '连接你选择的 OpenAI 兼容服务。仅在点击测试连接时发送测试请求。'}
      </p>
      <fieldset disabled={busy}>
        <label>
          服务地址
          <input
            type="url"
            value={endpoint}
            placeholder="https://example.invalid/v1"
            onChange={(e) => {
              publishDirty({ endpoint: e.target.value })
              setEndpoint(e.target.value)
              setSaved(false)
            }}
          />
        </label>
        <label>
          模型名称
          <input
            value={model}
            onChange={(e) => {
              publishDirty({ model: e.target.value })
              setModel(e.target.value)
              setSaved(false)
            }}
          />
        </label>
        <label>
          API Key
          <input
            type="password"
            autoComplete="off"
            value={key}
            placeholder={present ? '已保存密钥（不会回填）' : '尚未保存密钥'}
            onChange={(e) => {
              publishDirty({ key: e.target.value })
              setKey(e.target.value)
              setSaved(false)
            }}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              publishDirty({ enabled: e.target.checked })
              setEnabled(e.target.checked)
              setSaved(false)
            }}
          />
          启用 Assistant
        </label>
        <p>更换服务地址时请重新输入密钥。密钥不会显示在对话和日志中。</p>
        <div className="assistant-actions">
          <button
            type="button"
            className="primary-button"
            disabled={!endpoint.trim() || !model.trim()}
            onClick={() => void run('save')}
          >
            保存配置
          </button>
          <button
            type="button"
            disabled={!saved || !present || !enabled}
            onClick={() => void run('test')}
          >
            测试已保存连接
          </button>
          {present ? (
            <button type="button" onClick={() => void run('delete')}>
              删除密钥
            </button>
          ) : null}
        </div>
      </fieldset>
      <p role="status">{notice}</p>
    </section>
  )
}
