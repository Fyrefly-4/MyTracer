import { useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { AssistantController } from '../../src/renderer/src/features/assistant/assistant-controller'
import {
  createFakeAssistantAdapter,
  syntheticAssistantEntries
} from '../../src/renderer/src/features/assistant/fake-assistant-adapter'
import { AssistantHost } from '../../src/renderer/src/features/assistant/AssistantHost'
import { AssistantEntryButton } from '../../src/renderer/src/features/assistant/AssistantContext'
import { AssistantSettings } from '../../src/renderer/src/features/assistant/AssistantSettings'
import '../../src/renderer/src/design-system.css'
const fake = createFakeAssistantAdapter({ delayMs: 100 })
const controller = new AssistantController(fake.api, fake.status, true)
function Harness(): ReactNode {
  const [note, setNote] = useState(syntheticAssistantEntries[0].entry.editorText!)
  const [summary, setSummary] = useState('')
  const [saves, setSaves] = useState(0)
  const [dirty, setDirty] = useState(false)
  const [settingsVisible, setSettingsVisible] = useState(false)
  const [review, setReview] = useState({
    confirmedProgress: '',
    mainObstacle: '',
    nextAdjustment: ''
  })
  return (
    <AssistantHost
      controller={controller}
      scopeChoices={[{ ref: syntheticAssistantEntries[0].entry.object, label: '选择合成记录' }]}
    >
      <main
        data-testid="underlying-pane"
        style={{ padding: 24, maxWidth: 900, height: 440, overflowY: 'auto' }}
      >
        <button onClick={() => setDirty(controller.hasUnsavedInput())}>检查安装草稿</button>
        <span data-testid="install-dirty">{String(dirty)}</span>
        <h1>整理居住空间 · 合成测试</h1>
        <p>仅模拟界面和响应，不代表 Electron、持久化或真实模型质量。</p>
        <button
          onClick={() =>
            void controller.open({
              entry: { object: { kind: 'conversation', id: 'free-chat' }, intent: 'chat' },
              label: '自由对话'
            })
          }
        >
          AI 助手
        </button>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setSaves(saves + 1)
          }}
        >
          <output data-testid="formal-saves">{saves}</output>
          <label>
            原笔记
            <textarea aria-label="原笔记" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <label>
            简述草稿
            <textarea
              aria-label="简述草稿"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </label>
          <AssistantEntryButton
            label={syntheticAssistantEntries[0].label}
            entry={{
              ...syntheticAssistantEntries[0].entry,
              editorText: note,
              editorRevision: JSON.stringify([note, summary])
            }}
            apply={(payload) => {
              if (payload.kind !== 'record-summary') return false
              setSummary(payload.text)
              return true
            }}
          >
            AI 整理笔记
          </AssistantEntryButton>
        </form>
        {syntheticAssistantEntries.slice(1).map((entry) => (
          <AssistantEntryButton
            key={entry.entry.object.id}
            label={entry.label}
            entry={
              entry.entry.intent === 'review'
                ? { ...entry.entry, editorRevision: JSON.stringify(review) }
                : entry.entry
            }
            apply={
              entry.entry.intent === 'review'
                ? (payload) => {
                    if (payload.kind !== 'review-draft') return false
                    setReview(payload)
                    return true
                  }
                : undefined
            }
          >
            {entry.entry.intent === 'resume' ? 'AI 接上上次' : 'AI 回顾选定内容'}
          </AssistantEntryButton>
        ))}
        <label>
          复盘进展草稿
          <textarea aria-label="复盘进展草稿" value={review.confirmedProgress} readOnly />
        </label>
        <label>
          复盘阻碍草稿
          <textarea aria-label="复盘阻碍草稿" value={review.mainObstacle} readOnly />
        </label>
        <label>
          复盘调整草稿
          <textarea aria-label="复盘调整草稿" value={review.nextAdjustment} readOnly />
        </label>
        <button onClick={() => setSettingsVisible(!settingsVisible)}>切换设置可见</button>
        <div hidden={!settingsVisible}>
          <AssistantSettings
            api={fake.serviceApi}
            simulation
            onDirtyChange={(dirty) => controller.setInputDirty('settings', dirty)}
            onChanged={(status) => controller.updateService(status)}
          />
        </div>
      </main>
    </AssistantHost>
  )
}
createRoot(document.getElementById('root')!).render(<Harness />)
