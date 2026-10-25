import { expect, it } from 'vitest'
import { retainedRecordText } from '../../src/renderer/src/app/retained-record-text'
it('makes duration-only and outcome-only routine inputs readable after object deletion', () => {
  const draft = {
    context: { routineId: 'r', recordingContextId: 'c', capturedOn: '2026-10-24' },
    durationMinutes: '0',
    outcome: 'intentional_rest' as const,
    summary: '',
    note: ''
  }
  expect(retainedRecordText({ kind: 'routine', draft })).toContain('0 分钟')
  expect(retainedRecordText({ kind: 'routine', draft })).toContain('主动休息')
})
it('preserves every action input and choice without replaying or needing the deleted object', () => {
  const draft = {
    context: { actionId: 'a', recordingContextId: 'c', capturedOn: '2026-10-24' },
    durationMinutes: '7',
    outcome: 'stopped' as const,
    summary: '简述合成',
    note: '备注合成',
    understanding: '理解合成',
    confusion: '困惑合成',
    nextStep: '下一步合成',
    postAction: 'reschedule' as const,
    nextMode: 'use-existing' as const,
    replacementActionId: 'synthetic-selected-action',
    applyRecordedNextStep: true,
    deepExpanded: false,
    postExpanded: false
  }
  const text = retainedRecordText({ kind: 'action', draft })
  for (const expected of [
    '7 分钟',
    '本次在这里停下',
    '简述合成',
    '备注合成',
    '理解合成',
    '困惑合成',
    '下一步合成',
    '重新安排行动',
    '改用已有行动',
    'synthetic-selected-action',
    '应用记录中的下一步：是'
  ])
    expect(text).toContain(expected)
})
