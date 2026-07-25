import type { Page } from '@playwright/test';

const dismissedKeyPrefix = 'tenancy-ledger:onboarding-prompt-dismissed:v1:';

/**
 * Evita que o convite do assistente de cadastro (exibido para ADMIN/MANAGER em
 * iPad) bloqueie fluxos que não estão testando o próprio convite.
 */
export async function suppressOnboardingPrompt(page: Page, userId: string): Promise<void> {
  await page.addInitScript((key) => {
    localStorage.setItem(key, String(Date.now()));
  }, `${dismissedKeyPrefix}${userId}`);
}
