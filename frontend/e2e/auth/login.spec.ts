import { expect, test } from '@playwright/test';

test('exibe o login público com os campos essenciais', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByRole('heading', { name: 'Tenancy Ledger' })).toBeVisible();
  await expect(page.getByLabel('E-mail')).toBeVisible();
  await expect(page.getByLabel('Senha')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
});
