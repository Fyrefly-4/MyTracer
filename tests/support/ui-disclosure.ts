import type { Locator, Page } from '@playwright/test'

export async function openManagement(detail: Locator, kind: '目标' | '行动'): Promise<void> {
  const disclosure = detail.locator('details.disclosure')
  if ((await disclosure.getAttribute('open')) === null) {
    await disclosure
      .locator('summary')
      .filter({ hasText: `编辑与管理${kind}` })
      .click()
  }
}

export async function openActionCreate(page: Page): Promise<void> {
  const trigger = page.getByRole('button', { name: '新建行动', exact: true })
  if ((await trigger.getAttribute('aria-expanded')) === 'false') await trigger.click()
}
