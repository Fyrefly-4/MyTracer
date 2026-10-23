import { describe, expect, it } from 'vitest'
import { UiSession } from '../../src/renderer/src/app/ui-session'
import { RoutineEditSession } from '../../src/renderer/src/app/routine-edit-session'
import type { RoutineDetailDto } from '../../src/contracts/routines'

const routine = (id = 'a'): RoutineDetailDto => ({
  id,
  goalId: null,
  name: id,
  description: null,
  minimumAction: '一步',
  weekdays: [1, 3],
  status: 'active',
  createdAt: '2026-10-22T08:00:00Z',
  updatedAt: '2026-10-22T08:00:00Z',
  goal: null
})
const opened = (): RoutineEditSession => {
  const editor = new RoutineEditSession()
  editor.acceptRead(editor.beginRead(), routine())
  return editor
}

describe('one session-local routine content editor', () => {
  it('keeps an independent slot and update-install protection after page markers clear', () => {
    const session = new UiSession(() => undefined)
    session.routineEditor.acceptRead(session.routineEditor.beginRead(), routine())
    session.routineEditor.editContent({ name: '未保存' })
    session.setUnsavedContent('routine-form', false)
    expect(session.hasUnsavedContent()).toBe(true)
    expect(new UiSession(() => undefined).routineEditor.getSnapshot()).toBeNull()
    session.routineEditor.discard()
    expect(session.hasUnsavedContent()).toBe(false)
  })
  it('retains edits on same-object refresh, but refuses to replace a dirty slot', () => {
    const editor = opened()
    editor.editContent({ name: '输入' })
    editor.editSchedule([2])
    expect(editor.acceptRead(editor.beginRead(), routine('b'))).toBe(false)
    editor.acceptRead(editor.beginRead(), { ...routine(), status: 'paused' })
    expect(editor.getSnapshot()).toMatchObject({
      name: '输入',
      weekdays: [2],
      detail: { status: 'paused' }
    })
    editor.discard()
    expect(editor.acceptRead(editor.beginRead(), routine('b'))).toBe(true)
    expect(editor.getSnapshot()?.name).toBe('b')
  })
  it('saves content and schedule independently without clearing the other part', () => {
    const editor = opened()
    editor.editContent({ minimumAction: '两步' })
    editor.editSchedule([2])
    const content = editor.beginSave('content')!
    editor.finishSave(content, { ...routine(), minimumAction: '两步' })
    expect(editor.getSnapshot()?.weekdays).toEqual([2])
    expect(editor.hasDraft()).toBe(true)
    const schedule = editor.beginSave('schedule')!
    editor.editContent({ description: '另一个输入' })
    editor.finishSave(schedule, { ...routine(), minimumAction: '两步', weekdays: [2] })
    expect(editor.getSnapshot()).toMatchObject({
      minimumAction: '两步',
      description: '另一个输入',
      weekdays: [2]
    })
  })
  it('preserves later typing even when changed back to the pre-save baseline', () => {
    const editor = opened()
    editor.editContent({ name: '提交的名称' })
    const save = editor.beginSave('content')!
    editor.editContent({ name: 'a' })
    editor.finishSave(save, { ...routine(), name: '提交的名称' })
    expect(editor.getSnapshot()).toMatchObject({ name: 'a', detail: { name: '提交的名称' } })
    expect(editor.hasDraft()).toBe(true)
    editor.editSchedule([5])
    const schedule = editor.beginSave('schedule')!
    editor.editSchedule([1, 3])
    editor.finishSave(schedule, { ...routine(), name: '提交的名称', weekdays: [5] })
    expect(editor.getSnapshot()?.weekdays).toEqual([1, 3])
  })
  it('rejects older reads, wrong identity and replayed save responses', () => {
    const editor = opened()
    const old = editor.beginRead()
    const current = editor.beginRead()
    editor.acceptRead(current, routine())
    expect(editor.acceptRead(old, routine('b'))).toBe(false)
    expect(editor.failRead(old, true, 'a')).toBe(false)
    editor.editContent({ name: '保存' })
    const token = editor.beginSave('content')!
    expect(editor.acceptRead(current, routine())).toBe(false)
    editor.finishSave(token, { ...routine(), name: '保存' })
    editor.discard()
    editor.acceptRead(editor.beginRead(), routine('b'))
    editor.finishSave(token, routine())
    expect(editor.getSnapshot()?.detail.id).toBe('b')
    expect(editor.acceptRead(editor.beginRead(), routine('a'), 'b')).toBe(false)
    expect(editor.getSnapshot()?.availability).toBe('error')
  })
  it('keeps pending acknowledgement across page lifetimes and protects newer input', async () => {
    const editor = opened()
    editor.editContent({ name: '提交' })
    const token = editor.beginSave('content')!
    const pending = editor.waitForSave()
    expect(editor.beginSave('content')).toBeNull()
    editor.discard()
    expect(editor.getSnapshot()?.pending).toBe(true)
    editor.editContent({ name: '继续输入' })
    editor.finishSave(token, { ...routine(), name: '提交' })
    await pending
    expect(editor.getSnapshot()?.name).toBe('继续输入')
    expect(editor.waitForSave()).toBeNull()
  })
  it('retains copyable drafts for missing objects and never enables saving them', () => {
    const editor = opened()
    editor.editContent({ name: '保留原文' })
    editor.failRead(editor.beginRead(), true, 'a')
    expect(editor.getSnapshot()).toMatchObject({ name: '保留原文', availability: 'missing' })
    expect(editor.beginSave('content')).toBeNull()
    expect(editor.hasDraft()).toBe(true)
    editor.discard()
    expect(editor.getSnapshot()).toBeNull()
  })
  it('retains all input on rejected writes and status changes', () => {
    const editor = opened()
    editor.editContent({ name: '不丢' })
    editor.editSchedule([6])
    editor.finishSave(editor.beginSave('content')!)
    expect(editor.getSnapshot()).toMatchObject({ name: '不丢', weekdays: [6], pending: false })
    editor.finishSave(editor.beginSave('status')!, { ...routine(), status: 'ended' })
    expect(editor.getSnapshot()).toMatchObject({
      name: '不丢',
      weekdays: [6],
      detail: { status: 'ended' }
    })
  })
  it('discard does not turn failed validation into a verified object', () => {
    const editor = opened()
    editor.editContent({ name: '输入' })
    editor.failRead(editor.beginRead(), false, 'a')
    editor.discard()
    expect(editor.getSnapshot()).toMatchObject({ name: 'a', availability: 'error' })
    expect(editor.beginSave('content')).toBeNull()
    const creation = editor.beginRead(false)
    editor.acceptRead(editor.beginRead(), routine('b'))
    expect(editor.acceptRead(creation, routine('new'))).toBe(false)
    expect(editor.getSnapshot()?.detail.id).toBe('b')
  })
})
