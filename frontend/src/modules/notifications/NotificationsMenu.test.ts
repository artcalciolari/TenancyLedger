import { describe, expect, it } from 'vitest';
import { isRenewalNotification, notificationDestination } from './presentation';

describe('notificações de renovação', () => {
  it.each(['RENEWAL_DUE', 'PAYMENT_OVERDUE'])('destaca %s', (type) => {
    expect(isRenewalNotification(type)).toBe(true);
  });

  it('direciona contratos e faturas para a tela correta', () => {
    expect(notificationDestination({ resourceType: 'CONTRACT', resourceId: 'contract-id' })).toBe(
      '/contracts/contract-id',
    );
    expect(notificationDestination({ resourceType: 'INVOICE', resourceId: 'invoice-id' })).toBe(
      '/invoices/invoice-id',
    );
  });
});
