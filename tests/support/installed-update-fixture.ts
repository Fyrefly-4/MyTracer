import { expect, type ElectronApplication, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

export async function createInstalledUpdateFacts(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const api = window.myTracer
    const requireOk = <T>(result: { ok: true; value: T } | { ok: false }): T => {
      if (!result.ok) throw new Error('Synthetic fixture command failed')
      return result.value
    }
    const goal = requireOk(
      await api.goals.create({
        name: 'T084 active goal',
        initialNextAction: { title: 'T084 pending step' }
      })
    )
    if (!goal.currentNextActionId) throw new Error('Missing next step')
    const actionId = goal.currentNextActionId
    requireOk(await api.today.selectAction({ actionId }))
    const intention = requireOk(await api.actions.create({ title: 'T084 intention' }))
    requireOk(await api.today.selectActionAsIntention({ actionId: intention.id }))
    for (const transition of ['complete', 'cancel', 'reschedule'] as const) {
      const action = requireOk(
        await api.actions.create({ goalId: goal.id, title: `T084 ${transition}` })
      )
      requireOk(await api.actions[transition]({ actionId: action.id }))
    }
    requireOk(
      await api.dataControl.backfillActionRecord({
        actionId,
        occurredOn: '2026-08-10',
        durationMinutes: 25,
        outcome: 'partial',
        understanding: 'Confirmed synthetic understanding',
        confusion: 'Synthetic open question'
      })
    )
    for (const outcome of ['target_met', 'acted', 'intentional_rest', 'not_done'] as const) {
      const routine = requireOk(
        await api.routines.create({
          goalId: goal.id,
          name: `T084 ${outcome}`,
          minimumAction: 'One step',
          weekdays: [1, 2, 3, 4, 5, 6, 7]
        })
      )
      requireOk(
        await api.dataControl.backfillRoutineRecord({
          routineId: routine.id,
          occurredOn: '2026-08-10',
          outcome,
          plannedForDate: true,
          durationMinutes: outcome === 'target_met' ? 10 : outcome === 'acted' ? 0 : null
        })
      )
    }
    requireOk(
      await api.routines.create({
        name: 'T084 unknown',
        minimumAction: 'One step',
        weekdays: [1, 2, 3, 4, 5, 6, 7]
      })
    )
    for (const transition of ['pause', 'end'] as const) {
      const otherGoal = requireOk(await api.goals.create({ name: `T084 goal ${transition}` }))
      requireOk(await api.goals[transition]({ goalId: otherGoal.id }))
      const otherRoutine = requireOk(
        await api.routines.create({
          name: `T084 routine ${transition}`,
          minimumAction: 'One step',
          weekdays: [1]
        })
      )
      requireOk(await api.routines[transition]({ routineId: otherRoutine.id }))
    }
    const review = requireOk(await api.review.begin({}))
    requireOk(
      await api.review.complete({
        reviewContextId: review.reviewContextId,
        confirmedProgress: 'Synthetic progress',
        mainObstacle: 'Synthetic obstacle',
        nextAdjustment: 'Synthetic adjustment',
        relatedGoalId: goal.id,
        nextStepChange: { kind: 'none' }
      })
    )
    return actionId
  })
}

export async function exportInstalledFacts(
  application: ElectronApplication,
  destination: string
): Promise<Record<string, unknown>> {
  await application.evaluate(({ dialog }, path) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: path })
  }, destination)
  const result = await (
    await application.firstWindow()
  ).evaluate(() => window.myTracer.exports.generate())
  expect(result).toMatchObject({ ok: true, value: { kind: 'exported', exportVersion: 2 } })
  return JSON.parse(await readFile(destination, 'utf8')) as Record<string, unknown>
}
