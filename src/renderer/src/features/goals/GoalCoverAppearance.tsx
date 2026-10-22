import { useState } from 'react'
import { useUiSession } from '../../app/ui-session'
import { readGoalCoverMark, saveGoalCoverMark, validateGoalCoverMark } from './goal-cover'

export function GoalCoverAppearance({ goalId }: { goalId: string }) {
  const session = useUiSession()
  const [saved, setSaved] = useState(() => readGoalCoverMark(goalId))
  const [draft, setDraft] = useState(() => session.getGoalCoverDraft(goalId) ?? saved)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  function change(value: string) {
    setDraft(value)
    if (value === saved) session.clearGoalCoverDraft(goalId)
    else session.setGoalCoverDraft(goalId, value)
    setError(null)
    setMessage('')
  }

  return (
    <details className="disclosure">
      <summary>外观</summary>
      <form
        className="detail-form"
        onSubmit={(event) => {
          event.preventDefault()
          const parsed = validateGoalCoverMark(draft)
          if (!parsed.valid) {
            setError('请输入 1–2 个可见字符，不含空格或控制符；也可以留空。')
            return
          }
          if (!saveGoalCoverMark(goalId, parsed.value)) {
            setError('外观暂时无法保存到本机，请重试。输入仍保留，原标记没有改变。')
            return
          }
          setSaved(parsed.value)
          setDraft(parsed.value)
          session.clearGoalCoverDraft(goalId)
          setError(null)
          setMessage('外观已保存')
        }}
      >
        <label>
          首页标记（可选）
          <input
            value={draft}
            onChange={(event) => change(event.target.value)}
            aria-describedby="goal-cover-help"
            aria-invalid={error !== null}
          />
        </label>
        <p id="goal-cover-help" className="empty-copy">
          1–2 个字符，例如
          文、R、UI。留空时按首页卡片当前顺序显示“I、II、III”；自定义标记跟随目标。仅保存在本机，不更改目标名称或排列。
        </p>
        {error ? <p role="alert">{error}</p> : null}
        {message ? <p role="status">{message}</p> : null}
        <div className="form-actions">
          <button className="secondary-button" type="submit">
            保存外观
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              setDraft(saved)
              session.clearGoalCoverDraft(goalId)
              setError(null)
              setMessage('')
            }}
          >
            取消外观修改
          </button>
        </div>
      </form>
    </details>
  )
}
