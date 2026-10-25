import type { RecordDraft } from '../../../contracts/record-drafts'
import { recordOutcomeText, routineRecordOutcomeText } from './ui-text'

/** Read-only recovery of inputs whose original object no longer exists. */
export function retainedRecordText(value: RecordDraft): string {
  const draft = value.draft
  const lines = [
    `投入时长（原输入）：${draft.durationMinutes === '' ? '未填写' : draft.durationMinutes + ' 分钟'}`,
    `本次结果：${value.kind === 'routine' ? routineRecordOutcomeText[value.draft.outcome] : draft.outcome ? recordOutcomeText[draft.outcome as keyof typeof recordOutcomeText] : '未选择'}`,
    `简述：${draft.summary}`,
    `备注：${draft.note}`
  ]
  if (value.kind === 'action') {
    const d = value.draft
    const actions = {
      'keep-pending': '保持待行动',
      complete: '完成行动',
      cancel: '取消行动',
      reschedule: '重新安排行动'
    }
    const next = {
      clear: '清空当前下一步',
      'use-existing': '改用已有行动',
      'recorded-next': '用记录中的下一步创建行动'
    }
    lines.push(
      `我理解了：${d.understanding}`,
      `我仍困惑：${d.confusion}`,
      `记录中的下一步：${d.nextStep}`,
      `保存后行动状态：${actions[d.postAction]}`,
      `当前下一步处理：${next[d.nextMode]}`,
      `选择的已有行动 ID：${d.replacementActionId || '未选择'}`,
      `应用记录中的下一步：${d.applyRecordedNextStep ? '是' : '否'}`
    )
  }
  return lines.join('\n')
}
