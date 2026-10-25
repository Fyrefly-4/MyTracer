import type { MyTracerApi } from '../../src/contracts/shell'

/** Synthetic only. The caller must supply an application running in an owned temporary test root. */
export async function seedAssistantJourney(api: MyTracerApi) {
  const goal = await api.goals.create({
    name: '整理居住空间',
    description: '合成验收：先整理桌面，再决定下一小步。',
    initialNextAction: { title: '整理书桌的一角' }
  })
  if (!goal.ok || !goal.value.currentNextActionId) throw new Error('Synthetic goal setup failed')
  const actionId = goal.value.currentNextActionId
  const first = await api.dataControl.backfillActionRecord({
    actionId,
    occurredOn: '2026-10-01',
    outcome: 'partial',
    durationMinutes: 10,
    summary: null,
    note: '把桌面纸张归到一个盒子里。旧票据还没分类，今天先停在这里。'
  })
  const second = await api.dataControl.backfillActionRecord({
    actionId,
    occurredOn: '2026-10-15',
    outcome: 'partial',
    durationMinutes: 5,
    summary: '先分出需要保留的票据',
    note: '今天只分了一小叠。盒子底部还有纸张，暂时不决定全部丢掉。'
  })
  const unrelated = await api.goals.create({
    name: '__assistant_out_of_scope_goal__',
    initialNextAction: { title: '__assistant_out_of_scope_action__' }
  })
  if (!first.ok || !second.ok || !unrelated.ok || !unrelated.value.currentNextActionId) {
    throw new Error('Synthetic record setup failed')
  }
  const excluded = await api.dataControl.backfillActionRecord({
    actionId: unrelated.value.currentNextActionId,
    occurredOn: '2026-10-15',
    outcome: 'partial',
    durationMinutes: 99,
    summary: '__assistant_out_of_scope_summary__',
    note: '__assistant_out_of_scope_note__'
  })
  if (!excluded.ok) throw new Error('Synthetic exclusion setup failed')
  return {
    goalId: goal.value.id,
    actionId,
    recordIds: [first.value.id, second.value.id] as const,
    excludedGoalId: unrelated.value.id,
    excludedRecordId: excluded.value.id
  }
}
