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
  const [dirty, setDirty] = useState(false)
  const [settingsVisible, setSettingsVisible] = useState(true)
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
          帮我整理
        </AssistantEntryButton>
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
            {entry.entry.intent === 'resume' ? '接上上次' : '选定内容回顾'}
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
