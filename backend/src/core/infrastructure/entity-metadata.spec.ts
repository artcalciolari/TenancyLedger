import { getMetadataArgsStorage } from 'typeorm';
import { User } from '../../contexts/auth/domain/entities/user.entity';
import { CashClosing } from '../../contexts/cashbox/domain/cash-closing.entity';
import { Contract } from '../../contexts/contract/domain/entities/contract.entity';
import { Invoice } from '../../contexts/invoice/domain/entities/invoice.entity';
import { PaymentTransaction } from '../../contexts/invoice/domain/entities/payment-transaction.entity';
import { Notification } from '../../contexts/notification/domain/notification.entity';
import { PropertyUnit } from '../../contexts/property/domain/property-unit.entity';
import { Tenant } from '../../contexts/tenant/domain/entities/tenant.entity';

function resolveType(target: unknown): unknown {
  if (typeof target !== 'function') return target;
  if (target.prototype) return target;
  const resolved: unknown = Reflect.apply(target, undefined, []);
  return resolved;
}

describe('TypeORM relation metadata', () => {
  it.each([
    [Contract, [Tenant, PropertyUnit]],
    [Invoice, [Contract]],
    [PaymentTransaction, [User, User, User]],
    [CashClosing, [User, User]],
    [Notification, [User]],
  ] as const)('resolves lazy foreign-key targets for %s', (entity, expectedTargets) => {
    const foreignKeys = getMetadataArgsStorage().filterForeignKeys(entity);
    const actualTargets = foreignKeys.map((metadata) => resolveType(metadata.type));

    expect(actualTargets).toEqual(expect.arrayContaining([...expectedTargets]));
  });

  it('resolves both sides of the invoice-payment relation', () => {
    const invoiceRelation = getMetadataArgsStorage()
      .filterRelations(Invoice)
      .find((metadata) => metadata.propertyName === '_transactions');
    const paymentRelation = getMetadataArgsStorage()
      .filterRelations(PaymentTransaction)
      .find((metadata) => metadata.propertyName === 'invoice');

    expect(invoiceRelation).toBeDefined();
    expect(paymentRelation).toBeDefined();
    if (!invoiceRelation || !paymentRelation) return;

    expect(resolveType(invoiceRelation.type)).toBe(PaymentTransaction);
    expect(resolveType(paymentRelation.type)).toBe(Invoice);
    const invoiceInverse = invoiceRelation.inverseSideProperty;
    const paymentInverse = paymentRelation.inverseSideProperty;
    expect(typeof invoiceInverse).toBe('function');
    expect(typeof paymentInverse).toBe('function');
    if (typeof invoiceInverse !== 'function' || typeof paymentInverse !== 'function') return;
    expect(Reflect.apply(invoiceInverse, undefined, [{ invoice: 'invoice-side' }])).toBe(
      'invoice-side',
    );
    expect(Reflect.apply(paymentInverse, undefined, [{ transactions: 'payment-side' }])).toBe(
      'payment-side',
    );
  });
});
