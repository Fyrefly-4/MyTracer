import { describe, expect, it } from 'vitest'
import { GoalContentDraft } from '../../src/renderer/src/features/goals/goal-content-draft'
import { UiSession } from '../../src/renderer/src/app/ui-session'

const goal = { id: 'a', name: '原名称', description: null }

describe('existing goal content session slot', () => {
  it('normalizes an absent description and preserves both fields through same-object reads', () => {
    const draft = new GoalContentDraft()
    draft.read(goal)
    expect(draft.dirty).toBe(false)
    draft.edit('a', 'name', '修改名称')
    draft.edit('a', 'description', '第一行\n第二行')
    draft.read({ ...goal, name: '读取到的旧名称' })
    expect(draft.snapshot).toMatchObject({ name: '修改名称', description: '第一行\n第二行' })
    expect(() => draft.read({ ...goal, id: 'b' })).toThrow()
  })

  it('acknowledges the submitted baseline while retaining typing made during the save', () => {
    const draft = new GoalContentDraft()
    draft.read(goal)
    draft.edit('a', 'name', '提交名称')
    const submitted = draft.beginSave()!
    draft.edit('a', 'name', goal.name)
    draft.edit('a', 'description', '后来写的说明')
    draft.finishSave(submitted, true)
    draft.read({ ...goal, name: '提交名称' })
    expect(draft.snapshot).toMatchObject({
      name: goal.name,
      baselineName: '提交名称',
      description: '后来写的说明'
    })
    expect(draft.dirty).toBe(true)
  })

  it('preserves a newer return to baseline through reads before and after save acknowledgement', () => {
    const draft = new GoalContentDraft()
    draft.read(goal)
    draft.edit('a', 'name', '提交名称')
    const submitted = draft.beginSave()!
    draft.edit('a', 'name', goal.name)
    expect(draft.dirty).toBe(false)
    expect(draft.retained).toBe(true)
    const readVersion = draft.savedVersion
    draft.read({ ...goal, name: '提交名称' }, readVersion)
    expect(draft.snapshot?.name).toBe(goal.name)
    draft.finishSave(submitted, true)
    draft.read(goal, readVersion)
    expect(draft.snapshot).toMatchObject({ name: goal.name, baselineName: '提交名称' })
    expect(draft.dirty).toBe(true)
  })

  it('retains the original baseline and values on a rejected save, then allows retry', () => {
    const draft = new GoalContentDraft()
    draft.read(goal)
    draft.edit('a', 'description', '保留')
    const submitted = draft.beginSave()!
    expect(draft.beginSave()).toBeNull()
    draft.finishSave(submitted, false)
    expect(draft.saveFailed).toBe(true)
    expect(draft.snapshot?.description).toBe('保留')
    expect(draft.dirty).toBe(true)
    draft.finishSave(draft.beginSave()!, true)
    expect(draft.dirty).toBe(false)
    expect(draft.saveFailed).toBe(false)
  })

  it('does not acknowledge an explicitly discarded generation or another object', () => {
    const draft = new GoalContentDraft()
    draft.read(goal)
    draft.edit('a', 'name', '提交')
    const submitted = draft.beginSave()!
    draft.discard()
    draft.read(goal)
    draft.edit('a', 'description', '重新开始')
    draft.finishSave(submitted, true)
    expect(draft.snapshot).toMatchObject({ baselineName: goal.name, description: '重新开始' })
    draft.discard()
    draft.read({ ...goal, id: 'b' })
    draft.finishSave(submitted, true)
    expect(draft.snapshot?.goalId).toBe('b')
  })

  it('counts retained content and in-flight saves for install safety without disk persistence', () => {
    const session = new UiSession(() => undefined)
    session.goalContentDraft.read(goal)
    expect(session.hasUnsavedContent()).toBe(false)
    session.goalContentDraft.edit('a', 'description', '跨页草稿')
    expect(session.hasUnsavedContent()).toBe(true)
    expect(new UiSession(() => undefined).goalContentDraft.snapshot).toBeNull()
    const submitted = session.goalContentDraft.beginSave()!
    session.goalContentDraft.discard()
    expect(session.hasUnsavedContent()).toBe(true)
    session.goalContentDraft.finishSave(submitted, true)
    expect(session.hasUnsavedContent()).toBe(false)
  })
})
