import { ValidationError } from '../../../../core/domain/errors/validation.error';
import { Contract, ContractStateError, ContractStatus } from './contract.entity';

const TENANT_ID = 'c16a5325-1d5c-49c5-a5cb-452e75a72c75';
const PROPERTY_ID = 'f04b6434-28f1-49a7-99aa-e49624bc68b9';

describe('Contract', () => {
  it('creates a contract with an explicit, inclusive validity period and cents', () => {
    const contract = Contract.create(TENANT_ID, PROPERTY_ID, '2026-01-01', 125_050, 12, true, 10);

    expect(contract.moveInDate).toBe('2026-01-01');
    expect(contract.endDate).toBe('2026-12-31');
    expect(contract.monthlyBaseValueCents).toBe(125_050);
    expect(contract.billingDay).toBe(10);
    expect(contract.status).toBe(ContractStatus.ACTIVE);
  });

  it('handles calendar-month boundaries deterministically', () => {
    expect(Contract.calculateEndDate('2025-01-31', 1)).toBe('2025-02-27');
    expect(Contract.calculateEndDate('2024-02-29', 12)).toBe('2025-02-27');
  });

  it('renews a renewable contract and recomputes its end date', () => {
    const contract = Contract.create(TENANT_ID, PROPERTY_ID, '2026-01-01', 100_00, 12, true);

    contract.renew(6);

    expect(contract.durationInMonths).toBe(18);
    expect(contract.endDate).toBe('2027-06-30');
  });

  it('rejects renewal when it is not allowed', () => {
    const contract = Contract.create(TENANT_ID, PROPERTY_ID, '2026-01-01', 100_00, 12, false);
    expect(() => contract.renew(1)).toThrow(ContractStateError);
  });

  it.each([
    ['not-a-uuid', PROPERTY_ID, '2026-01-01', 100, 1],
    [TENANT_ID, PROPERTY_ID, '2026-02-30', 100, 1],
    [TENANT_ID, PROPERTY_ID, '2026-01-01', 0, 1],
    [TENANT_ID, PROPERTY_ID, '2026-01-01', 100.5, 1],
    [TENANT_ID, PROPERTY_ID, '2026-01-01', 100, 0],
  ])(
    'rejects invalid identifiers, dates, money, and duration',
    (tenantId, propertyId, date, cents, duration) => {
      expect(() => Contract.create(tenantId, propertyId, date, cents, duration, true)).toThrow(
        ValidationError,
      );
    },
  );

  it('reports billing eligibility only while active and in force', () => {
    const contract = Contract.create(TENANT_ID, PROPERTY_ID, '2026-07-10', 100_00, 2, true, 15);

    expect(contract.isActiveOn('2026-07-09')).toBe(false);
    expect(contract.isActiveOn('2026-07-15')).toBe(true);
    expect(contract.isActiveOn('2026-09-10')).toBe(false);
    expect(contract.dueDateFor('2026-07')).toBe('2026-07-15');
  });
});
